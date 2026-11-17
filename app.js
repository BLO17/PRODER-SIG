// app.js — Orchestration principale
import { CONFIG } from './js/config.js';
import { loadData } from './js/data-loader.js?v2026-11-14a';
import { buildMERUnits, buildUVUnits, buildPFCUnits, buildCoopUnits } from './js/valorisation.js';
import { LayerManager } from './js/layers.js?v2026-11-14a';
import { IndicatorEngine } from './js/indicators.js';
import { AnimationEngine } from './js/animation.js';
import { UIManager } from './js/ui.js?v2026-11-14a'; // versionneur : à changer à chaque modification de ui.js
import { DashboardManager } from './js/dashboard.js';
import { StoryEngine } from './js/story-engine.js?v2026-10-25r'; // versionneur (restauration MER après story)
import { StoryUI } from './js/story-ui.js';
import { VoiceNarrator } from './js/voice-narrator.js';
import { getStoryMap } from './js/story-chapters.js';
import { StoryHotspots } from './js/story-hotspots.js';
import { StoryChain } from './js/story-chain.js';
import { ComplementarityModel } from './js/story-complementarity.js';
import { sanitizeFeatures } from './js/privacy.js';

let map, layerManager, indicatorEngine, animationEngine, uiManager, dashboardManager, storyEngine, storyUI;
let chain, complementarity;
let allFeatures = [];

async function tryStyle(url) {
  return new Promise((resolve, reject) => {
    let mapInstance;
    let settled = false;
    try {
      mapInstance = new maplibregl.Map({
        container: 'map',
        style: url,
        center: CONFIG.center,
        zoom: CONFIG.zoom,
        pitch: CONFIG.pitch,
        bearing: CONFIG.bearing,
        antialias: true,
        // Le contrôle d'attribution natif est désactivé : le crédit du fond de
        // carte (OpenFreeMap / OpenMapTiles / OpenStreetMap) est reporté dans
        // le bandeau permanent en bas de fenêtre. L'obligation d'attribution
        // reste donc remplie, mais sans doublon et sans que le crédit
        // institutionnel soit concurrencé dans le coin de la carte.
        attributionControl: false
      });
    } catch (err) {
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { mapInstance.remove(); } catch (_) { /* déjà détruit */ }
      reject(new Error(`Délai dépassé pour le style ${url}`));
    }, 30000);

    mapInstance.on('load', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(mapInstance);
    });

    mapInstance.on('error', (e) => {
      // Les erreurs de tuiles isolées ne doivent pas bloquer l'application.
      console.warn('Map error:', e?.error?.message || e?.message || e);
    });
  });
}

function showFatalError(error) {
  const loadingStatus = document.getElementById('loading-status');
  const progressFill = document.getElementById('progress-fill');
  if (loadingStatus) loadingStatus.textContent = 'Erreur : ' + error.message;
  if (progressFill) progressFill.style.background = '#F44336';
  const content = document.querySelector('.loading-content');
  if (!content) return;
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:20px;padding:12px;background:rgba(244,67,54,0.1);border:1px solid #F44336;border-radius:8px;color:#F44336;font-size:12px;max-height:220px;overflow:auto;text-align:left;';
  box.textContent = error.stack || error.message;
  content.appendChild(box);

  const help = document.createElement('p');
  help.style.cssText = 'margin-top:10px;font-size:12px;color:#8899aa;';
  help.textContent = 'Vérifiez la console du navigateur. Si le jeu de données manque, exécutez : npm run build:data';
  content.appendChild(help);
}

async function init() {
  const loading = document.getElementById('loading');
  const progressFill = document.getElementById('progress-fill');
  const loadingStatus = document.getElementById('loading-status');

  function onProgress(msg, pct) {
    if (progressFill) progressFill.style.width = pct + '%';
    if (loadingStatus) loadingStatus.textContent = msg;
    console.log(`[${pct}%] ${msg}`);
  }

  try {
    onProgress('Initialisation de la carte...', 5);
    try {
      map = await tryStyle(CONFIG.style);
      console.log('Style principal chargé');
    } catch (e) {
      console.warn('Style principal indisponible, bascule sur le style de secours :', e.message);
      map = await tryStyle(CONFIG.fallbackStyle);
      console.log('Style de secours chargé');
    }

    // Relief (optionnel — une erreur ici ne doit pas bloquer l'application)
    try {
      if (!map.getSource(CONFIG.terrain.source)) {
        map.addSource(CONFIG.terrain.source, {
          type: 'raster-dem',
          tiles: CONFIG.terrain.tiles,
          encoding: CONFIG.terrain.encoding,
          tileSize: CONFIG.terrain.tileSize,
          maxzoom: CONFIG.terrain.maxzoom
        });
      }
      map.setTerrain({ source: CONFIG.terrain.source, exaggeration: 1.4 });
    } catch (e) {
      console.warn('Relief non disponible :', e.message);
    }

    onProgress('Chargement des données PRODER...', 10);
    const result = await loadData(onProgress);
    allFeatures = result.features;
    console.log('Données chargées :', allFeatures.length, 'entités');

    // Les indicateurs travaillent sur les données complètes (y compris
    // l'identifiant bénéficiaire), les couches sur une version expurgée.
    onProgress('Calcul des indicateurs...', 94);
    indicatorEngine = new IndicatorEngine(allFeatures);
    // Hiérarchie MFR (agrégats) rattachée au moteur — getMFRHierarchy().
    indicatorEngine.mfrHierarchy = result.mfrHierarchy || null;

    onProgress('Création des couches...', 96);

    // Un marché sans aucune ligne de plantation n'est pas affiché : il
    // n'aurait qu'un « aucune donnée » à montrer. Le marquage doit précéder
    // `sanitizeFeatures`, qui recopie les propriétés : fait après, il ne
    // parviendrait jamais aux couches.
    markMarketsWithData(allFeatures);

    const sanitized = sanitizeFeatures(allFeatures);

    layerManager = new LayerManager(map);
    layerManager.setupLayers(sanitized);
    // Filtre par marché du menu arboriculture (calques plantation + périmètres).
    layerManager.initPlantationMarches(sanitized);
    layerManager.initPistes(sanitized);
    // TAMKIN — hiérarchie Cercle → Commune : visibilité par commune au
    // niveau données (modèle pistes/MER), sur les features sanitizées.
    layerManager.initTamkinCommunes(sanitized);
    // MFR — bboxes des communes pour la surbrillance contour
    // (aucun point bénéficiaire dessiné, demande du responsable).
    layerManager.initMFRCommunes(sanitized);
    // Valorisation — MER : les unités + agrégats sont calculés ici.
    // La SOURCE et les calques MER (logo + libellé + halo-ring) sont créés au
    // premier « idle » du renderer (steady-state) — PRUVÉ navigateur réel
    // 25/10 : une source créée au « load » du style ou à la fin de l'init est
    // MORTE côté rendu (bisection S1/S2 : témoin créé au steady-state =
    // rendu immédiat ; MER créées au load/fin d'init = 0 feature rendue).
    layerManager.initMER(buildMERUnits(sanitized));
    layerManager.initPFC(buildPFCUnits(sanitized));
    layerManager.initUV(buildUVUnits(sanitized));
    layerManager.initCoops(buildCoopUnits(sanitized));
    layerManager.applyPlantationMarchesFilters();
    map.on('load', () => {
      layerManager.applyPlantationMarchesFilters(); // rechargements de style (3D/fallback)
      layerManager.ensureMERLayers(); // re-création si le rechargement a vidé la source MER
      layerManager.applyPlantationMarchesFilters();
    });
    map.on('idle', () => {
      layerManager.syncMERData(); // resynchronisation (marqueurs + source)
      layerManager.applyPlantationMarchesFilters();
    });
    // CRÉATION AU STEADY-STATE (PRUVÉ navigateur réel, 25/10) : le pipeline
    // de rendu des SOURCES est instable ~5-8 s après le load du style — la
    // source MER (données) est donc créée à t+8 s ; les marqueurs DOM (qui
    // font l'affichage) ne dépendent pas de ce pipeline et arrivent au même
    // moment, quand la carte est stable.
    setTimeout(() => {
      layerManager.ensureMERLayers();
    }, 8000);
    layerManager.applyPlantationMarchesFilters();

    animationEngine = new AnimationEngine(map, layerManager, allFeatures);

    onProgress("Initialisation de l'interface...", 98);
    uiManager = new UIManager(map, layerManager, animationEngine, indicatorEngine, result.stats, result.features, result.mfrHierarchy);
    uiManager.init();
    // Rattachement bénéficiaires ↔ polygones : calculé une fois, bilan affiché.
    uiManager.initJoin();
    // GARANTIE D'AFFICHAGE MER (comportement unifié) : quelles que soient les
    // manipulations d'un moteur antérieur (story, scénario), la famille MER
    // est (re)visible au démarrage — ré-alimentation + remontée au 1er plan.
    layerManager.showGroup('mer-units', true);
    // Clic sur un marqueur MER (logo) = sélection de l'unité (fiche +
    // anneau + recentrage) — handler DOM branché ici (points MER = marqueurs).
    layerManager.setMERMarkerHandler((unit) => uiManager.selectMERUnit(unit));
    // PFC / UV : mêmes handlers que MER (clic marqueur → fiche + recentrage).
    layerManager.setPFCMarkerHandler((name) => uiManager.selectPFC(name));
    layerManager.setUVMarkerHandler((name)  => uiManager.selectUV(name));
    // Coopératives apicoles : clic marqueur → fiche + recentrage.
    layerManager.setCoopMarkerHandler((code) => uiManager.selectCoop(code));
    console.log(
      '%cMER affichage garanti%c points MER = marqueurs DOM (logo + libellé), créés à t+8 s (steady-state) · ' +
      (layerManager.getVisible().length) + ' couches actives au total',
      'color:#C2185B;font-weight:700', 'color:#dfe6f2'
    );

    // Story Map
    const voiceNarrator = new VoiceNarrator();
    storyEngine = new StoryEngine(map, layerManager, animationEngine, indicatorEngine);
    storyEngine.setNarrator(voiceNarrator);
    const hotspots = new StoryHotspots(map, layerManager, uiManager, allFeatures);
    storyEngine.setHotspots(hotspots);

    // Complémentarité : modèle spatial + panneau de chaîne de valeur.
    complementarity = new ComplementarityModel(allFeatures);
    chain = new StoryChain({
      map,
      layers: layerManager,
      anim: animationEngine,
      engine: storyEngine,
      indicators: indicatorEngine,
      stats: result.stats,
      features: allFeatures,
      model: complementarity,
      hotspots
    });

    storyUI = new StoryUI(storyEngine, indicatorEngine, result.stats, allFeatures, chain);
    storyUI.init(map);
    storyEngine.loadStory(getStoryMap('plantations'));

    // Story mode buttons
    document.getElementById('btn-story-plantations')?.addEventListener('click', () => {
      chain.setMode('plantations');
      storyEngine.loadStory(getStoryMap('plantations'));
      storyUI.open();
      storyEngine.play();
    });
    document.getElementById('btn-story-apiculture')?.addEventListener('click', () => {
      chain.setMode('apiculture');
      storyEngine.loadStory(getStoryMap('apiculture'));
      storyUI.open();
      storyEngine.play();
    });

    dashboardManager = new DashboardManager(indicatorEngine, () => uiManager.joinStats);
    dashboardManager.render();

    document.getElementById('dashboard')?.classList.add('visible');
    const showBtn = document.getElementById('btn-show-dashboard');
    if (showBtn) showBtn.style.display = 'none';

    onProgress('Terminé', 100);
    setTimeout(() => {
      if (!loading) return;
      loading.style.opacity = '0';
      setTimeout(() => { loading.style.display = 'none'; }, 500);
    }, 400);

    // Point de contrôle utilisé par le test de fumée (scripts/smoke-test.mjs).
    window.__PRODER_APP__ = {
      ready: true,
      map,
      layerManager,
      indicatorEngine,
      animationEngine,
      uiManager,
      storyEngine,
      storyUI,
      chain,
      complementarity,
      hotspots,
      features: allFeatures,
      stats: result.stats,
      indicators: indicatorEngine.getAllIndicators()
    };

    console.log('PRODER Taza 3D — Application initialisée avec succès (version app 2026-10-25r)');
  } catch (error) {
    console.error("Erreur d'initialisation :", error);
    window.__PRODER_APP__ = { ready: false, error: error.message };
    showFatalError(error);
  }
}

/**
 * Marque chaque polygone de marché (C14) selon qu'il a, ou non, des lignes de
 * plantation (C1) rattachées.
 *
 * Un marché sans aucune ligne n'a rien à montrer : sa fiche n'afficherait
 * qu'un « effectifs non mesurables ». Il est donc **retiré de la carte**
 * (filtre de couche) plutôt que de rester à l'écran comme un polygone vide
 * qu'on peut cliquer sans rien apprendre.
 *
 * Le rattachement reprend la clé de marché déjà normalisée `NN/AAAA`, la même
 * que celle utilisée par la fiche et par la jointure.
 */
function markMarketsWithData(features) {
  const marketsWithRows = new Set();
  for (const f of features) {
    if (f.properties?._category !== 'C1') continue;
    const k = f.properties?._marcheKey;
    if (k) marketsWithRows.add(k);
  }

  let kept = 0, dropped = 0;
  for (const f of features) {
    if (f.properties?._category !== 'C14') continue;
    const k = f.properties?._marcheKey;
    // La source simplifiée porte la LISTE DES MARCHÉS : chaque polygone qu'elle
    // fournit doit être visible, même sans bénéficiaires rattachés. Sans cette
    // exception, les marchés figuier, caroubier et ceux de 2022 — qui n'ont
    // pas de lignes dans cette source — disparaîtraient de la carte. C'est le
    // défaut que le responsable du projet a signalé.
    const has = f.properties?._sourcePlantation
      ? true
      : !!(k && marketsWithRows.has(k));
    // `_hasPlantations` est lu par le filtre de couche (js/layers.js).
    f.properties._hasPlantations = has;
    if (has) kept++; else dropped++;
  }
  console.log(
    `%cMarchés de plantation%c ${kept} affichés, ${dropped} sans données masqués`,
    'color:#4CAF50;font-weight:700', 'color:#dfe6f2'
  );
  return { kept, dropped };
}

init();
