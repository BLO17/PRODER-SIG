// ui.js — Interface utilisateur
import { CONFIG, CATEGORIES } from './config.js';
import { getScenario, getScenariosByVolet } from './scenarios.js';
import {
  attachPlantationsToPolygons,
  buildMarketAggregates,
  marketDisplayLabel,
  territoireLabel
} from './market.js';
import { buildMERUnits, MER_COLORS, MER_LABELS, buildUVUnits, buildPFCUnits, buildCoopUnits } from './valorisation.js';

/** Affichages numériques tolérants. */
const num1 = (v) => (v === null || v === undefined || !Number.isFinite(v))
  ? '—'
  : v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const int = (v) => (v === null || v === undefined || !Number.isFinite(v))
  ? '—'
  : Math.round(v).toLocaleString('fr-FR');
/**
 * Pourcentage à deux décimales, sans seuil d'effectif.
 *
 * Les parts inférieures à 1 % existent : les arrondir à une décimale les
 * afficherait « 0,0 % », ce qui se lit comme une absence de données. Deux
 * décimales conservent la distinction entre « 0 % » (effectif nul, un fait) et
 * « 0,04 % » (effectif réel mais très faible).
 */
const pct2 = (v) => (v === null || v === undefined || !Number.isFinite(v))
  ? '—'
  : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nf = (n, d = 0) => Number(n || 0).toLocaleString('fr-FR', {
  minimumFractionDigits: d, maximumFractionDigits: d
});

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Nombre d'anneaux EXTÉRIEURS d'une géométrie — c'est-à-dire de polygones.
 *
 * Un marché n'est pas un polygone : il en assemble plusieurs. Ce comptage dit
 * combien de périmètres sont réellement dessinés pour une entité, afin de ne
 * pas confondre « nombre de marchés » et « nombre de polygones ».
 *
 * Les anneaux intérieurs (trous) ne comptent pas : un trou n'est pas un
 * périmètre de plus.
 */
function compterAnneaux(geom) {
  if (!geom) return 0;
  if (geom.type === 'Polygon') return 1;
  if (geom.type === 'MultiPolygon') return (geom.coordinates || []).length;
  if (geom.type === 'GeometryCollection') {
    let n = 0;
    for (const g of geom.geometries || []) n += compterAnneaux(g);
    return n;
  }
  return 0;
}

/**
 * Barre de répartition empilée (une seule barre par axe).
 *
 * Les parts sont une **partition du total** : leur somme fait le total, donc
 * une barre pleine à 100 %. C'est la même règle que les deux camemberts
 * qu'elle remplace — un axe « Femmes / Hommes / Jeunes » unique serait faux,
 * une femme jeune y serait comptée deux fois.
 *
 * @param parts  [{ n, color, label }] — effectifs, pas pourcentages
 * @param total  dénominateur (bénéficiaires du marché)
 */
function stackedBar(parts, total) {
  if (!total) return '';
  const segs = parts
    .filter((p) => (p.n || 0) > 0)
    .map((p) => {
      const w = ((p.n || 0) / total) * 100;
      return '<i style="width:' + w.toFixed(3) + '%;background:' + p.color +
        '" title="' + esc(p.label) + ' : ' + p.n + '"></i>';
    })
    .join('');
  return '<div class="pzc-stack">' + segs + '</div>';
}

const LAYER_BY_CAT = {
  C1: 'plantations-circle',
  C2: 'ravins-circle',
  C3: 'seuils-line',
  C4: 'sous-bassins-fill',
  C5: 'pistes-line',
  C6: 'uv-circle',
  C7: 'pfc-circle',
  C8: 'mer-circle',
  C9: 'cooperatives-circle',
  C10: 'tamkin-symbol',
  C11: 'mfr-circle',
  C12: 'communes-fill',
  C13: 'references-circle',
  C14: 'perimetres-fill',
  C15: 'bassins-fill'
};

const COMPONENT_ORDER = ['C1', 'C2', 'C3', 'C4', 'C15', 'C14', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13'];

/**
 * Arbre arboriculture — filière → année → marché — calculé depuis les DONNÉES
 * (jamais codé en dur : une mise à jour de la source change l'arborescence
 * toute seule). Exporté pour le test.
 */
export function buildArboricultureTree(features) {
  const byMarche = new Map();
  for (const f of features || []) {
    const p = f.properties || {};
    if (p._category !== 'C1' && p._category !== 'C14') continue;
    const k = p._marcheKey;
    if (!k) continue;
    let m = byMarche.get(k);
    if (!m) { m = { key: k, rows: 0, polys: 0, ha: 0, haLignes: 0, filiere: null, codes: new Set(), sansCin: 0 }; byMarche.set(k, m); }
    if (p._category === 'C1') {
      m.rows++; m.haLignes += p._sup || 0;
      // Décompte des bénéficiaires DISTINCTS : la CIN (`_benefId`) sert de code ;
      // une ligne SANS CIN reçoit son propre code (`row-<n>`), elle est donc
      // comptée comme une personne non identifiée, jamais fusionnée (même règle
      // que buildMarketAggregates de js/market.js → cohérence fiche/menu/indicateur).
      m.codes.add(p._benefId || ('row-' + p._rowId));
      if (!p._benefId) m.sansCin++;
    }
    else { m.polys++; m.ha += p._supPerimetre || 0; if (!m.filiere) m.filiere = p._filierePoly || p._filiere || null; }
  }
  const byFiliere = new Map();
  for (const m of byMarche.values()) {
    m.filiere = m.filiere || 'Plantation Non renseignée';
    let g = byFiliere.get(m.filiere);
    if (!g) {
      g = {
        filiere: m.filiere,
        label: String(m.filiere).replace(/^Plantation /, ''),
        color: CONFIG.filiereColors[m.filiere] || '#8D6E63',
        marches: [],
        annees: new Map(),
        rows: 0, polys: 0, ha: 0
      };
      byFiliere.set(m.filiere, g);
    }
    g.marches.push(m);
    const an = String(m.key).split('/')[1];
    if (!g.annees.has(an)) g.annees.set(an, []);
    g.annees.get(an).push(m);
  }
  const out = [];
  const rootCodes = new Set();
  let rootSansCin = 0;
  for (const g of byFiliere.values()) {
    g.marches.sort((a, b) => a.key.localeCompare(b.key, 'fr'));
    g.rows = g.marches.reduce((s, x) => s + x.rows, 0);
    g.polys = g.marches.reduce((s, x) => s + x.polys, 0);
    g.ha = g.marches.reduce((s, x) => s + (x.ha > 0 ? x.ha : x.haLignes), 0);
    g.sansCin = g.marches.reduce((s, x) => s + x.sansCin, 0);
    const gCodes = new Set();
    g.marches.forEach((x) => { x.distincts = x.codes.size; x.codes.forEach((c) => { gCodes.add(c); rootCodes.add(c); }); });
    g.distincts = gCodes.size;
    rootSansCin += g.sansCin;
    g.annees = [...g.annees.entries()]
      .map(([an, ms]) => {
        ms.sort((a, b) => a.key.localeCompare(b.key, 'fr'));
        const yCodes = new Set();
        ms.forEach((x) => { x.codes.forEach((c) => yCodes.add(c)); });
        return {
          annee: an,
          marches: ms,
          rows: ms.reduce((s, x) => s + x.rows, 0),
          polys: ms.reduce((s, x) => s + x.polys, 0),
          ha: ms.reduce((s, x) => s + (x.ha > 0 ? x.ha : x.haLignes), 0),
          distincts: yCodes.size,
          sansCin: ms.reduce((s, x) => s + x.sansCin, 0)
        };
      })
      .sort((a, b) => (Number(a.annee) - Number(b.annee)) || a.annee.localeCompare(b.annee));
    out.push(g);
  }
  // Ordre des filières demandé par le responsable du projet : Amandier puis Olivier,
// le reste par nombre de marchés décroissant (nouvelle filière = fin de liste).
const FILIERE_ORDER = { Amandier: 0, Olivier: 1, Figuier: 2, Caroubier: 3 };
out.sort((a, b) =>
  (FILIERE_ORDER[a.label] ?? 99) - (FILIERE_ORDER[b.label] ?? 99) ||
  (b.marches.length - a.marches.length) ||
  a.label.localeCompare(b.label, 'fr'));
  return {
    filieres: out,
    rows: out.reduce((s, g) => s + g.rows, 0),
    polys: out.reduce((s, g) => s + g.polys, 0),
    ha: out.reduce((s, g) => s + g.ha, 0),
    distincts: rootCodes.size,
    sansCin: rootSansCin
  };
}

export class UIManager {
  constructor(map, layerManager, animationEngine, indicatorEngine, stats, features, mfrHierarchy = null) {
    this.map = map;
    this.layers = layerManager;
    this.anim = animationEngine;
    this.indicators = indicatorEngine;
    this.stats = stats || { categories: {} };
    this.features = features || [];
    this.currentScenario = null;
    this.currentYear = CONFIG.referenceYear;
    // Hiérarchie MFR (agrégats Tranche → Spécialité → Commune) — data/mfr-hierarchy.json.
    this.mfrHierarchy = mfrHierarchy;
  }

  init() {
    this.setupTabs();
    this.setupComponents();
    this.setupScenarios();
    this.setupControls();
    this.setupLegend();
    this.setupPopups();
    this.setupDataStamp();
  }

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab)?.classList.add('active');
      });
    });
  }

  setupComponents() {
    const list = document.getElementById('components-list');
    if (!list) return;
    list.innerHTML = '';

    const L = this.layers;
    const catColor = (catId) => CATEGORIES[catId]?.color || '#8D6E63';
    const catCount = (catId) => this.stats.categories?.[catId] || 0;

    // ---- modèle QGIS / Google Earth My Maps --------------------------
    //
    // Liste PLATE : chaque catégorie s'ouvre sur ses sous-catégories, TOUTES
    // à la même marge gauche (aucun décalage, aucune indentation). L'arbre
    // est déplié par défaut ; le chevron replie/déplie à la main. Un petit
    // interrupteur coloré (pills) par ligne pilote la visibilité, comme les
    // cases Google Earth. La hiérarchie est portée par le chevron, pas par
    // le décalage horizontal.

    const allParents = [];
    const leafStates = (r) => {
      const out = [];
      const walk = (x) => {
        const kids = x._children || [];
        kids.length ? kids.forEach(walk) : out.push(x._state);
      };
      walk(r);
      return out;
    };
    const reparentAll = () => {
      for (const r of allParents) {
        const s = leafStates(r);
        r._set(s.length ? (s.every((v) => v === 'on') ? 'on' : (s.every((v) => v === 'off') ? 'off' : 'part')) : 'on');
      }
    };

    const makeRow = (opts) => {
      const row = document.createElement('div');
      row.className = 'crow ' + (opts.level ? 'lvl' + opts.level : '');
      row.title = opts.title || '';
      row._state = 'off';
      row._children = [];

      const hasKids = (opts.children || []).length > 0;
      const chev = document.createElement('button');
      chev.className = 'chev';
      chev.type = 'button';
      chev.textContent = hasKids ? '▾' : '';
      chev.disabled = !hasKids;

      const pill = document.createElement('button');
      pill.className = 'pill off';
      pill.type = 'button';
      pill.style.setProperty('--lc', opts.color || '#4CAF50');

      const lab = document.createElement('span');
      lab.className = 'clabel';
      lab.textContent = opts.label;

      row.append(chev, pill, lab);
      if (opts.count != null && opts.count !== '') {
        const cnt = document.createElement('span');
        cnt.className = 'ccount' + (opts.countColor ? ' ha' : '');
        cnt.textContent = typeof opts.count === 'string' ? opts.count : String(opts.count).toLocaleString('fr-FR');
        if (opts.countColor) cnt.style.color = opts.countColor;
        row.appendChild(cnt);
      }
      row._set = (state) => {
        row._state = state;
        pill.classList.toggle('on', state === 'on');
        pill.classList.toggle('part', state === 'part');
        pill.classList.toggle('off', state === 'off');
      };

      if (hasKids) {
        row._children = opts.children;
        const sub = document.createElement('div');
        sub.className = 'csub';
        opts.children.forEach((ch) => sub.appendChild(ch));
        row.appendChild(sub);
        // Une ligne _noReparent gère ELLE-MÊME son état (toggle racine MER) :
        // reparentAll ne doit JAMAIS l'écraser depuis l'état de ses feuilles —
        // c'est exactement le défaut qui laissait la pilule « Valorisation »
        // verrouillée à ON quel que soit le clic.
        if (!opts._noReparent) allParents.push(row);
        // Déplié par défaut (comme dans QGIS) — sauf si la ligne
        // demande explicitement de naître repliée (filières, au chargement).
        if (opts.expanded !== false) row.classList.add('open');
      }
      chev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!hasKids) return;
        const open = !row.classList.contains('open');
        row.classList.toggle('open', open);
        chev.textContent = open ? '▾' : '▸';
      });
      lab.addEventListener('click', () => {
        if (!hasKids) return;
        const open = !row.classList.contains('open');
        row.classList.toggle('open', open);
        chev.textContent = open ? '▾' : '▸';
      });
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = row._state === 'off' ? 'on' : 'off';
        row._set(next);
        if (row._onToggle) row._onToggle(next);
        reparentAll();
      });
      return row;
    };

    // Ligne calque simple : pilote un groupe de couches.
    const leafLayer = (catId, level, labelOverride) => {
      const layerId = LAYER_BY_CAT[catId];
      const r = makeRow({
        label: labelOverride || CATEGORIES[catId].name,
        color: catColor(catId),
        level,
        count: catCount(catId),
        title: 'Calque « ' + CATEGORIES[catId].name + ' »'
      });
      r._onToggle = (next) => { L.showGroup(layerId, next === 'on'); };
      r._set(L.isVisible(layerId) ? 'on' : 'off');
      return r;
    };

    // Superficie affichée (« 140 ha ») : somme des SUP-Périmètre(ha), arrondie.
    const haFmt = (n) => (n > 0 ? Math.round(n).toLocaleString('fr-FR') + ' ha' : null);
    // Ligne de marché (feuilles arboriculture) : pilote le filtre MapLibre.
    const leafMarche = (m, g, level) => {
      const r = makeRow({
        label: 'M' + String(m.key).split('/')[0],        color: g.color,
        level,
        count: haFmt(m.ha > 0 ? m.ha : m.haLignes) || (m.rows + m.polys),
        countColor: g.color,
        title: 'M' + m.key + ' — ' + m.distincts + (m.distincts > 1 ? ' bénéficiaires uniques' : ' bénéficiaire unique')
      });
      r._marcheKey = m.key;
      r._onToggle = (next) => { L.setMarchesVisible([m.key], next === 'on'); };
      r._set('on');
      // Clic sur la ligne = sélection du marché (surbrillance + fiche + recentrage),
      // identique au clic carte. L'interrupteur a son propre rôle (on/off).
      r.classList.add('selectable');
      const pillEl = r.children[1];
      r.addEventListener('click', (e) => {
        if (e.target === pillEl) return;
        this.selectMarketByKey(m.key);
      });
      return r;
    };

    // Parent arboriculture : tous les marchés descendants d'un coup.
    const collectKeys = (r) => {
      const out = [];
      const walk = (x) => { (x._children || []).length ? x._children.forEach(walk) : out.push(x._marcheKey); };
      walk(r);
      return out.filter(Boolean);
    };
    const parentMarches = (row) => {
      row._onToggle = (next) => {
        L.setMarchesVisible(collectKeys(row), next === 'on');
        const paintAll = (x) => { (x._children || []).forEach((c) => { c._set(next); paintAll(c); }); };
        paintAll(row);
      };
    };

    // Section (titre composante)
    const section = (icon, title, rows) => {
      const comp = document.createElement('div');
      comp.className = 'composant';
      const tit = document.createElement('div');
      tit.className = 'composant-titre';
      tit.innerHTML = '<span class="ct-ico">' + icon + '</span><span>' + title + '</span>';
      comp.appendChild(tit);
      const body = document.createElement('div');
      body.className = 'composant-body';
      rows.forEach((r) => body.appendChild(r));
      comp.appendChild(body);
      list.appendChild(comp);
    };

    // ---- Composante 1 — Environnement ----------------------------------
    const cesKids = [
      leafLayer('C2', 2, 'Ravins'),
      leafLayer('C3', 2, 'Seuils'),
      leafLayer('C4', 2, 'Sous-bassins'),
      leafLayer('C15', 2, 'Bassins')
    ];
    const ces = makeRow({ label: 'CES', color: catColor('C2'), level: 1, children: cesKids, title: 'Conservation des Eaux et des Sols' });
    ces._onToggle = (next) => { cesKids.forEach((c) => { c._set(next); c._onToggle(next); }); };

    // Apiculture : 移除已归入「Valorisation」的 UV/PFC，改为按 100 个合作组建单个可开关的 Cooperatives 分支。
    const coopData = buildCoopUnits(this.features);
    this._coopData = coopData;
    const coopKids = coopData.units.map((u) => {
      const r = makeRow({
        label: u.code,
        color: CONFIG.typeColors.coop || '#0097A7',
        level: 2,
        title: u.code + ' · ' + (u.name || 'Coopérative') + ' · ' + u.total + ' adhérents'
      });
      r._set(L.coopUnitIsOn(u.code) ? 'on' : 'off');
      r.classList.add('selectable');
      r._onToggle = (next) => {
        L.setCoopUnitVisible([u.code], next === 'on');
      };
      r.addEventListener('click', () => { this.selectCoop(u.code); });
      return r;
    });
    const coopGroup = makeRow({
      label: 'Coopératives',
      color: CONFIG.typeColors.coop || '#0097A7',
      level: 1,
      title: 'Coopératives apicoles — ' + coopData.units.length + ' unités',
      children: coopKids,
      expanded: false,
      _noReparent: true
    });
    coopGroup._onToggle = (next) => {
      L.setCoopUnitVisible(coopData.units.map((u) => u.code), next === 'on');
      coopKids.forEach((r) => { r._set(next); });
    };
    coopGroup._set('on');
    const apiKids = [coopGroup];
    const api = makeRow({ label: 'Apiculture', color: catColor('C6'), level: 1, children: apiKids });
    api._onToggle = (next) => { coopGroup._onToggle(next); coopKids.forEach((r) => { r._set(next); }); }

    // Arboriculture fruitière — ARBORESCENCE QGIS : filière → année → marché,
    // entièrement générée depuis les données.
    const tree = buildArboricultureTree(this.features);
    const filiereRows = tree.filieres.map((g) => {
      const anneeRows = g.annees.map((y) => {
        const mkts = y.marches.map((m) => leafMarche(m, g, 4));
        const yr = makeRow({
          label: y.annee,          color: g.color,
          level: 3,
          count: haFmt(y.ha) || (y.rows + y.polys),
          countColor: g.color,
          title: 'M' + y.annee + ' — ' + y.marches.length + ' marché(s) · ' + y.distincts + (y.distincts > 1 ? ' bénéficiaires uniques' : ' bénéficiaire unique'),
          children: mkts,
          expanded: false
        });
        parentMarches(yr);
        return yr;
      });
      const fr = makeRow({
        label: g.label,
        color: g.color,
        level: 2,
        count: haFmt(g.ha) || (g.rows + g.polys),
        countColor: g.color,
        title: g.label + ' — ' + g.marches.length + ' marché(s) · ' + g.distincts + (g.distincts > 1 ? ' bénéficiaires uniques' : ' bénéficiaire unique'),
        children: anneeRows,
        expanded: false
      });
      parentMarches(fr);
      return fr;
    });
    const arb = makeRow({
      label: 'Arboriculture fruitière',
      color: CONFIG.typeColors?.plantation || '#4CAF50',
      level: 1,
      count: haFmt(tree.ha) || (tree.rows + tree.polys),
      countColor: CONFIG.typeColors?.plantation || '#4CAF50',
      title: 'Arboriculture — ' + tree.filieres.reduce((s, g) => s + g.marches.length, 0) + ' marché(s) · ' + tree.distincts + ' bénéficiaires uniques',
      children: filiereRows
    });
    parentMarches(arb);

    section('🌿', 'Composante 1 — Environnement', [ces, arb, api]);

    // ---- Composante 2 — Infrastructures --------------------------------
    // ---- Pistes agricoles — groupement par cercle (modèle MER/coopératives) ----
    const pisteFeatures = (this.features || []).filter((f) => f.properties?._category === 'C5');
    const cercles = [...new Set(pisteFeatures.map((f) => (f.properties?._cercle || '').toUpperCase()).filter(Boolean))].sort();
    const pisteOn = (m) => L.pisteIsOn(m);
    const cercleKids = cercles.map((cer) => {
      const feats = pisteFeatures.filter((f) => (f.properties?._cercle || '').toUpperCase() === cer);
      const marcheRows = feats.map((f) => {
        const m = f.properties?._marche || f.properties?.name || '';
        const km = f.properties?._longueurKm;
        const r = makeRow({
          label: m,
          color: CONFIG.typeColors.piste,
          level: 3,
          count: km != null ? km.toFixed(2) + ' km' : '',
          countColor: CONFIG.typeColors.piste,
          title: m + ' · ' + (f.properties?._nomPiste || '') + (km != null ? ' · ' + km.toFixed(2) + ' km' : '')
        });
        r._set(pisteOn(m) ? 'on' : 'off');
        r.classList.add('selectable');
        const pillEl = r.children[1];
        r._onToggle = (next) => {
          L.setPisteVisible([m], next === 'on');
          if (next === 'on') { L.show('pistes-line'); L.show('pistes-selected-line'); }
        };
        r.addEventListener('click', (e) => {
          if (e.target === pillEl) return;
          this.selectPiste(m);
        });
        return r;
      });
      const totalKm = feats.reduce((s, f) => s + (f.properties?._longueurKm || 0), 0);
      const g = makeRow({
        label: cer,
        color: CONFIG.typeColors.piste,
        level: 2,
        count: totalKm.toFixed(1) + ' km',
        countColor: CONFIG.typeColors.piste,
        title: cer + ' — ' + feats.length + ' piste(s) · ' + totalKm.toFixed(1) + ' km',
        children: marcheRows,
        expanded: false,
        _noReparent: true
      });
      g._onToggle = (next) => {
        L.setPisteVisible(feats.map((f) => f.properties?._marche).filter(Boolean), next === 'on');
        if (next === 'on') { L.show('pistes-line'); L.show('pistes-selected-line'); }
        marcheRows.forEach((r) => r._set(next));
      };
      g._set('on');
      return g;
    });
    const pistes = makeRow({
      label: 'Pistes agricoles',
      color: CONFIG.typeColors.piste,
      level: 1,
      count: pisteFeatures.reduce((s, f) => s + (f.properties?._longueurKm || 0), 0).toFixed(1) + ' km',
      countColor: CONFIG.typeColors.piste,
      title: 'Pistes agricoles — ' + pisteFeatures.length + ' tronçon(s)',
      children: cercleKids,
      expanded: false
    });
    pistes._onToggle = (next) => {
      L.setPisteVisible(pisteFeatures.map((f) => f.properties?._marche).filter(Boolean), next === 'on');
      if (next === 'on') { L.show('pistes-line'); L.show('pistes-selected-line'); }
      const setKids = (r) => { (r._children || []).forEach((c) => { c._set(next); setKids(c); }); };
      setKids(pistes);
    };
    pistes._set('on');
    // Valorisation — MER : arborescence générée depuis les données
    // (spécialité → unités), sans aucune donnée nominative. La racine est
    // l'interrupteur de la famille entière ; chaque unité a le sien.
    const merData = buildMERUnits(this.features);
    this._merData = merData;
    const leafMER = (u, color) => {
      const letter = u.cercleLetter || '';
      const displayName = letter ? u.unit + '_' + letter : u.unit;
      const r = makeRow({
        label: displayName,
        color,
        level: 4,
        count: u.count,
        countColor: color,
        title: displayName + (u.nom ? ' — ' + u.nom : '') + ' · ' + u.count + ' adhérents · ' + u.femmesPct + ' % F · ' + u.jeunesPct + ' % J'
      });
      // ON/OFF de l'unité (niveau données, comme les marchés arboriculture) :
      // le pill retire / remontre l'unité sur la carte. Tous les MER sont ON
      // au démarrage (tout est affiché tant que la famille est ON). Le clic
      // sur la LIGNE (hors pill) = SÉLECTION (surbrillance + fiche + zoom).
      r._onToggle = (next) => { L.setMERUnitVisible([u.unit], next === 'on'); };
      r._set(L.merUnitIsOn(u.unit) ? 'on' : 'off');
      r.classList.add('selectable');
      const pillEl = r.children[1];
      r.addEventListener('click', (e) => {
        if (e.target === pillEl) return;
        this.selectMERUnit(u.unit);
      });
      return r;
    };
    const merColor = (sp) => MER_COLORS[sp] || '#8D6E63';
    const specRow = (specialite) => {
      const unitsList = merData.units.filter((u) => u.specialite === specialite);
      const rows = unitsList.map((u) => leafMER(u, merColor(specialite)));
      const total = unitsList.reduce((s, u) => s + u.count, 0);
      const g = makeRow({
        label: MER_LABELS[specialite],
        color: merColor(specialite),
        level: 3,
        count: total,
        countColor: merColor(specialite),
        title: MER_LABELS[specialite] + ' — ' + unitsList.length + ' unité(s) · ' + total + ' adhérents',
        children: rows,
        expanded: false,
        _noReparent: true
      });
      // ON/OFF de la spécialité (niveau données) : retire / remontre toutes
      // les unités de cette spécialité sur la carte (batch). Tous ON au départ.
      g._onToggle = (next) => {
        L.setMERUnitVisible(unitsList.map((u) => u.unit), next === 'on');
        rows.forEach((r) => r._set(next));
      };
      g._set('on');
      return g;
    };
    const merKids = ['apiculture', 'arboriculture']
      .map((sp) => specRow(sp))
      .filter((g) => g._children.length > 0);
    // Groupe « MER » (demande du responsable, 25/10) : les deux spécialités
    // sont regroupées sous UN nœud intermédiaire. Son pill ne retire rien :
    // il CADRE le déploiement complet des MER sur la carte (« le voir de
    // loin »), comme les pills spécialités. Le on/off d'affichage reste
    // exclusif à la racine « Valorisation » (règle § 3).
    const merGroup = makeRow({
      label: 'MER',
      color: catColor('C8'),
      level: 2,
      count: merData.total,
      countColor: catColor('C8'),
      title: 'MER — ' + merData.units.length + ' unités · ' + merData.total + ' adhérents',
      children: merKids,
      expanded: false,
      _noReparent: true
    });
    // ON/OFF de la famille MER (niveau données) : retire / remontre les 17
    // unités sur la carte ; synchronise visuellement spécialités + unités.
    merGroup._onToggle = (next) => {
      L.setMERUnitVisible(merData.units.map((u) => u.unit), next === 'on');
      const setKidsMER = (r) => { (r._children || []).forEach((c) => { c._set(next); setKidsMER(c); }); };
      setKidsMER(merGroup);
    };
    merGroup._set('on');
    // ── Sous-groupes UV & PFC pour le volet Valorisation ────────────────────
    const pfcData = buildPFCUnits(this.features);
    const uvData  = buildUVUnits(this.features);
    const pfcKids = pfcData.units.map((u) => {
      const r = makeRow({
        label: u.name,
        color: CONFIG.typeColors.pfc,
        level: 4,
        title: u.name + ' · Commercialisation / vente'
      });
      r._set(L.pfcUnitIsOn(u.name) ? 'on' : 'off');
      r.classList.add('selectable');
      // Pilule on/off de l'unité PFC : pilote la donnée (visibilité du
      // marqueur DOM + calque de cercle). Éteindre une unité ne cache les
      // autres que si toutes sont éteintes.
      r._onToggle = (next) => {
        // Modèle MER : l'état vit dans les DONNÉES (`_pfcOn`), l'affichage
        // suit via _syncPFCMarkers(). C'est le seul mécanisme qui a un effet
        // visible, car l'affichage PFC = les marqueurs DOM (logo + libellé).
        L.setPFCUnitVisible([u.name], next === 'on');
      };
      r.addEventListener('click', () => { this.selectPFC(u.name); });
      return r;
    });
    const pfcGroup = makeRow({
      label: 'PFC',
      color: catColor('C7'),
      level: 3,
      title: 'PFC — ' + pfcData.units.length + ' plateforme(s)',
      children: pfcKids,
      expanded: false,
      _noReparent: true
    });
    pfcGroup._onToggle = (next) => {
      L.setPFCUnitVisible(pfcData.units.map((u) => u.name), next === 'on');
      pfcKids.forEach((r) => { r._set(next); });
    };
    pfcGroup._set('on');
    const uvKids = uvData.units.map((u) => {
      const r = makeRow({
        label: u.name,
        color: CONFIG.typeColors.uv,
        level: 4,
        title: u.name + ' · Transformation / valorisation'
      });
      r._set(L.uvUnitIsOn(u.name) ? 'on' : 'off');
      r.classList.add('selectable');
      // Pilule on/off de l'unité UV : pilote la donnée (visibilité du
      // marqueur DOM + calque de cercle). Éteindre une unité ne cache les
      // autres que si toutes sont éteintes.
      r._onToggle = (next) => {
        // Modèle MER : état dans les DONNÉES (`_uvOn`), affichage via
        // _syncUVMarkers() — les marqueurs DOM sont l'affichage UV.
        L.setUVUnitVisible([u.name], next === 'on');
      };
      r.addEventListener('click', () => { this.selectUV(u.name); });
      return r;
    });
    const uvGroup = makeRow({
      label: 'UV (Miel)',
      color: catColor('C6'),
      level: 3,
      title: 'UV — ' + uvData.units.length + ' unité(s)',
      children: uvKids,
      expanded: false,
      _noReparent: true
    });
    uvGroup._onToggle = (next) => {
      L.setUVUnitVisible(uvData.units.map((u) => u.name), next === 'on');
      uvKids.forEach((r) => { r._set(next); });
    };
    uvGroup._set('on');
    // ─────────────────────────────────────────────────────────────────────────
    const valor = makeRow({
      label: 'Valorisation',
      color: catColor('C8'),
      level: 1,
      count: merData.total,
      countColor: catColor('C8'),
      title: 'MER — appui économique et gestion : ' + merData.units.length + ' unités · ' + merData.total + ' adhérents',
      children: [merGroup, pfcGroup, uvGroup],
      expanded: false,
      _noReparent: true
    });
    // NIVEAU DONNÉES (modèle Arboriculture) : ON = toutes les unités MER dans
    // la carte (ré-alimentation + premier plan), OFF = famille retirée. La
    // VISIBILITÉ des couches reste ON en permanence : éteindre puis rallumer
    // répond donc instantanément à la carte, exactement comme « Arboriculture ».
    const allMERUnits = merData.units.map((u) => u.unit);
    valor._onToggle = (next) => {
      L.setMERUnitVisible(allMERUnits, next === 'on');
      if (next === 'on') {
        L.showGroup('mer-units', true); // ré-alimentation + premier plan ; au OFF, les couches RESTENT visibles (données vides) pour que le re-allumage réponde instantanément
        this.fitMERScope(merData.units); // TOUS les MER vus sur la carte
      }
      const setKids = (r) => { (r._children || []).forEach((c) => { c._set(next); setKids(c); }); };
      setKids(valor);
      // PFC / UV : même modèle données que MER. Sans ces deux appels, la
      // pilule « Valorisation » ne changeait que l'état VISUEL des lignes
      // (les pilules passaient à off) sans jamais toucher aux marqueurs
      // DOM, donc la carte ne bougeait pas.
      L.setPFCUnitVisible(pfcData.units.map((u) => u.name), next === 'on');
      L.setUVUnitVisible(uvData.units.map((u) => u.name), next === 'on');
    };
    valor._set('on');
    // TAMKIN — hiérarchie Cercle → Commune (plan validé, 13/11/2026).
    // Modèle Pistes/MER : on/off à chaque niveau, NIVEAU DONNÉES (setData sur
    // la source « tamkin », jamais de filtre de couche). Communes OFF au départ ;
    // cercles repliés. Étiquette de commune = nom du calque communes (les 6
    // classes sans `CT` suivent leur commune de recoupement géographique).
    // Effectifs bénéficiaires en gras (règle § 3 : aucun compte d'entités).
    const tkColor = catColor('C10');
    const tkFeats = (this.features || []).filter((f) => f.properties?._category === 'C10');
    const tkBenef = (f) => f.properties?._nbBenefFormation || 0;
    const tkCommuneOf = (f) => f.properties?._tkCommune || 'Non renseignée';
    const tkCercles = [...new Set(tkFeats.map((f) => f.properties?._tkCercle || '—'))].sort();
    const tkCercleRows = tkCercles.map((cer) => {
      const featsCer = tkFeats.filter((f) => (f.properties?._tkCercle || '—') === cer);
      const communes = [...new Set(featsCer.map(tkCommuneOf))].sort((a, b) => a.localeCompare(b, 'fr'));
      const rows = communes.map((com) => {
        const n = featsCer.filter((f) => tkCommuneOf(f) === com).reduce((s, f) => s + tkBenef(f), 0);
        const r = makeRow({
          label: com,
          color: tkColor,
          level: 4,
          count: n,
          countColor: tkColor,
          title: com + ' - ' + featsCer.filter((f) => tkCommuneOf(f) === com).length + ' classe(s) - ' + n + ' bénéficiaires'
        });
        r._set(L.tamkinCommuneIsOn(com) ? 'on' : 'off');
        r._onToggle = (next) => {
          L.setTamkinCommunesVisible([com], next === 'on');
          if (next === 'on') L.showGroup('tamkin-symbol', true);
        };
        return r;
      });
      const totCer = featsCer.reduce((s, f) => s + tkBenef(f), 0);
      const g = makeRow({
        label: cer,
        color: tkColor,
        level: 3,
        count: totCer,
        countColor: tkColor,
        title: 'Cercle ' + cer + ' — ' + featsCer.length + ' classe(s) · ' + totCer + ' bénéficiaires',
        children: rows,
        expanded: false,
        _noReparent: true
      });
      g._onToggle = (next) => {
        L.setTamkinCommunesVisible(communes, next === 'on');
        if (next === 'on') L.showGroup('tamkin-symbol', true);
        rows.forEach((r) => r._set(next));
      };
      // État de départ du cercle = état de ses communes (toutes OFF au
      // démarrage — le calque TAMKIN démarre caché).
      const stCercle = communes.every((c) => L.tamkinCommuneIsOn(c)) ? 'on'
        : (communes.some((c) => L.tamkinCommuneIsOn(c)) ? 'part' : 'off');
      g._set(stCercle);
      return g;
    });
    const tkTotal = tkFeats.reduce((s, f) => s + tkBenef(f), 0);
    const tamkinRow = makeRow({
      label: 'TAMKIN',
      color: tkColor,
      level: 2,
      count: tkTotal,
      countColor: tkColor,
      title: 'TAMKIN — ' + tkFeats.length + ' classe(s) · ' + tkTotal + ' bénéficiaires',
      children: tkCercleRows,
      expanded: false
    });
    tamkinRow._onToggle = (next) => {
      L.setTamkinCommunesVisible(
        [...new Set(tkFeats.map((f) => f.properties?._tkCommune).filter(Boolean))],
        next === 'on'
      );
      if (next === 'on') L.showGroup('tamkin-symbol', true);
      const setKids = (r) => { (r._children || []).forEach((c) => { c._set(next); setKids(c); }); };
      setKids(tamkinRow);
    };
    // État de départ = état réel du calque (caché au démarrage, comme la
    // pilule C10 avant la hiérarchie) ; reparentAll confirme depuis les
    // feuilles (communes toutes OFF — données vides).
    tamkinRow._set('off');
    // Sous-arbre dense : les libellés longs (AKNOUL, TAINASTE, communes)
    // ont besoin de toute la largeur — gain de place scopé (cf. style.css).
    tamkinRow.classList.add('tk-tree');
    const icsKids = [
      tamkinRow,
      this.buildMFRTree(makeRow, leafLayer, catColor('C11'), L)
    ];
    const ics = makeRow({ label: 'Ingénierie sociale', color: catColor('C10'), level: 1, title: 'Ingénierie sociale — formation et insertion', children: icsKids });
    ics._onToggle = (next) => { icsKids.forEach((c) => { c._set(next); c._onToggle(next); }); }
    section('🏗️', 'Composante 2 — Infrastructures', [pistes, valor, ics]);

    // ---- Références ------------------------------------------------------
    const refKids = [
      leafLayer('C12', 2, 'Communes'),
      leafLayer('C13', 2, 'Références / autres')
    ];
    const ref = makeRow({ label: 'Références', color: catColor('C12'), level: 1, children: refKids });
    ref._onToggle = (next) => { refKids.forEach((c) => { c._set(next); c._onToggle(next); }); }
    section('📎', 'Références', [ref]);

    reparentAll();
  }



  // ─── MFR — arbre Tranche → Spécialité → Commune (demande du responsable,
  // 15/11) : AUCUN point bénéficiaire n'est dessiné ; le clic d'une commune
  // met en surbrillance son CONTOUR et ouvre la fiche horizontale d'agrégats
  // (H/F/NR/Jeunes) en bas de carte. Données = data/mfr-hierarchy.json
  // (agrégats pré-calculés, zéro donnée nominative). Repli : feuille simple
  // si le fichier est absent.
  buildMFRTree(makeRow, leafLayer, mfrColor, L) {
    const hier = this.mfrHierarchy;
    if (!hier || !Array.isArray(hier.tranches)) return leafLayer('C11', 2, 'MFR');
    const nf = (n) => (n || 0).toLocaleString('fr-FR');
    const hidePill = (row) => {
      const p = row.querySelector('.pill');
      if (p) p.style.visibility = 'hidden';
    };
    const communeRow = (com, spec, tr) => {
      const isHors = com.hors_perimetre === true;
      const r = makeRow({
        label: com.nom,
        color: mfrColor,
        level: 5,
        count: com.total,
        countColor: mfrColor,
        title: com.nom + ' — ' + tr.label + ' · ' + spec.label + ' : ' + nf(com.total) +
          ' bénéficiaire(s) · H ' + nf(com.hommes) + ' · F ' + nf(com.femmes) + ' · NR ' +
          nf(com.non_renseigne) + ' · Jeunes ' + nf(com.jeunes) +
          (com.jeunes_nr ? ' (+ ' + nf(com.jeunes_nr) + ' NR)' : '')
      });
      r._onToggle = (next) => {
        if (next === 'on') {
          this.selectMFRCommune(r, tr, spec, com, isHors, L);
        } else if (this._mfrSelectedRow === r) {
          this.deselectMFRCommune(L);
        }
      };
      r.querySelector('.clabel').addEventListener('click', () => r.querySelector('.pill').click());
      return r;
    };
    const specRow = (spec, tr) => {
      const r = makeRow({
        label: spec.label + (spec.note ? ' — ' + spec.note : ''),
        color: mfrColor, level: 4, count: spec.total, countColor: mfrColor,
        title: spec.label + ' (' + tr.label + ') — ' + nf(spec.total) + ' bénéficiaire(s)',
        children: spec.communes.map((c) => communeRow(c, spec, tr)),
        expanded: false, _noReparent: true
      });
      hidePill(r);
      return r;
    };
    const trRow = (tr) => {
      const r = makeRow({
        label: tr.label, color: mfrColor, level: 3, count: tr.total, countColor: mfrColor,
        title: tr.label + ' — ' + nf(tr.total) + ' bénéficiaire(s)',
        children: tr.specialites.map((s) => specRow(s, tr)),
        expanded: false, _noReparent: true
      });
      hidePill(r);
      return r;
    };
    const rows = hier.tranches.map(trRow);
    const root = makeRow({
      label: 'MFR — Formation Diplomante',
      color: mfrColor, level: 2, count: hier.total_beneficiaires, countColor: mfrColor,
      title: 'MFR — ' + nf(hier.total_beneficiaires) + ' bénéficiaires · ' + hier.tranches.length +
        ' tranches · la pilule racine éteint tout (sélection, fiche, emplacements)',
      children: rows, expanded: false, _noReparent: true
    });
    // Menu OFF à la racine (décision du responsable, 15/11/2026) : la pilule
    // racine purge le volet — désélection, fiche, surbrillance, emplacements.
    this._mfrRootRow = root;
    root._onToggle = (next) => { if (next === 'off') this.deselectMFRCommune(L); };
    root.classList.add('mfr-tree');
    return root;
  }

  selectMFRCommune(row, tranche, specialite, commune, isHors, L) {
    if (this._mfrSelectedRow && this._mfrSelectedRow !== row) this._mfrSelectedRow._set('off');
    this._mfrSelectedRow = row;
    L.highlightMFRCommune(isHors ? null : commune.nom);
    if (this._mfrRootRow && this._mfrRootRow._state === 'off') this._mfrRootRow._set('on');
    this.showMFRSheet(tranche, specialite, commune);
    // Emplacements (au choix) : suivent la sélection courante, même état.
    this._applyMFRBenef(tranche, specialite, commune);
  }

  deselectMFRCommune(L) {
    if (this._mfrSelectedRow) {
      this._mfrSelectedRow._set('off');
      this._mfrSelectedRow = null;
    }
    (L || this.layers).highlightMFRCommune(null);
    this.hideMFRSheet();
    // Purge des emplacements (menu OFF racine ou fermeture de la fiche).
    this._mfrBenefOn = false;
    (L || this.layers).setMFRBenefPoints(null, null, null, false);
    if (this._mfrRootRow) this._mfrRootRow._set('off');
  }

  // Fiche horizontale MFR (bas de carte) — gabarit market-sheet :
  // logo + commune/spécialité/tranche + répartition H/F/NR/Jeunes.
  showMFRSheet(tranche, specialite, commune) {
    const sheet = document.getElementById('mfr-sheet');
    const body = document.getElementById('mfr-sheet-body');
    if (!sheet || !body) return;
    if (!this._mfrSheetWired) {
      this._mfrSheetWired = true;
      const btn = document.getElementById('mfr-sheet-close');
      if (btn) btn.addEventListener('click', () => this.deselectMFRCommune());
    }
    const nf = (n) => (n || 0).toLocaleString('fr-FR');
    const tot = commune.total || 0;
    const pct = (n) => (tot ? Math.round((n / tot) * 100) : 0);
    const bar = (label, n, color, extra) =>
      '<div class="mfr-bar"><div class="mfr-bar-top"><span>' + label + '</span><span>' +
      nf(n) + (extra || '') + '</span></div><div class="mfr-track"><div class="mfr-fill" style="--mc:' +
      color + ';width:' + pct(n) + '%"></div></div></div>';
    body.innerHTML =
      '<div class="mfr-head"><img src="logo-MFR.png" alt="Logo MFR">' +
      '<div><div class="mfr-title">' + commune.nom + ' · ' + specialite.label +
      (commune.hors_perimetre ? ' — hors périmètre des communes' : '') + '</div>' +
      '<div class="mfr-sub">' + tranche.label + ' — ' + nf(tot) + ' bénéficiaire(s)' +
      (commune.jeunes_nr ? ' · ' + nf(commune.jeunes_nr) + ' sans âge' : '') +
      ' · agrégats par commune, aucune donnée nominative</div></div></div>' +
      '<div class="mfr-bars">' +
      bar('Hommes', commune.hommes, '#4A7EBB') +
      bar('Femmes', commune.femmes, '#C25590') +
      bar('Non renseigné', commune.non_renseigne, '#78909C') +
      bar('Jeunes ≤ 35 ans', commune.jeunes, '#558B2F',
        commune.jeunes_nr ? ' <span style="opacity:.7">+' + nf(commune.jeunes_nr) + ' NR</span>' : '') +
      '</div>' +
      // Emplacements (au choix) : points verts, aucune identité affichée.
      '<div class="mfr-loc-row">' +
      '<button id="mfr-loc-btn" class="mfr-loc' + (this._mfrBenefOn ? ' on' : '') +
      '" type="button" title="Afficher/masquer les emplacements des bénéficiaires de cette commune (points verts, aucune identité affichée)">' +
      (this._mfrBenefOn ? 'Masquer les emplacements' : 'Emplacements des bénéficiaires') +
      '</button><span id="mfr-loc-count" class="mfr-loc-count"></span></div>';
    sheet.hidden = false;
    const locBtn = document.getElementById('mfr-loc-btn');
    if (locBtn) {
      locBtn.addEventListener('click', () => {
        this._mfrBenefOn = !this._mfrBenefOn;
        this._updateMFRLocBtn();
        this._applyMFRBenef(tranche, specialite, commune);
      });
    }
    this._updateMFRLocBtn();
  }

  hideMFRSheet() {
    const sheet = document.getElementById('mfr-sheet');
    if (sheet) sheet.hidden = true;
  }

  // Emplacements (au choix) : applique l'état du bouton à la sélection
  // courante et met à jour le compteur affiché dans la fiche.
  _applyMFRBenef(tranche, specialite, commune) {
    const L = this.layers;
    if (!L || !L.setMFRBenefPoints) return;
    const on = this._mfrBenefOn === true && commune.hors_perimetre !== true;
    const p = on ? L.setMFRBenefPoints(tranche.id, specialite.id, commune.nom, true)
                 : L.setMFRBenefPoints(null, null, null, false);
    Promise.resolve(p).then((n) => {
      const el = document.getElementById('mfr-loc-count');
      if (el) el.textContent = on ? (String(n || 0) + ' emplacement(s) affiché(s)') : '';
    }).catch(() => { });
  }

  _updateMFRLocBtn() {
    const btn = document.getElementById('mfr-loc-btn');
    if (!btn) return;
    btn.classList.toggle('on', this._mfrBenefOn === true);
    btn.textContent = this._mfrBenefOn ? 'Masquer les emplacements' : 'Emplacements des bénéficiaires';
  }

  setupScenarios() {
    const container1 = document.getElementById('scenarios-list');
    if (container1) {
      for (const s of getScenariosByVolet(1)) this.addScenarioCard(container1, s);
    }

    const volet2 = document.getElementById('volet2');
    if (volet2 && !document.getElementById('scenarios-list-2')) {
      const section = document.createElement('div');
      section.className = 'section';
      section.innerHTML = '<h3>Scénarios</h3>';
      const container2 = document.createElement('div');
      container2.id = 'scenarios-list-2';
      container2.style.marginTop = '8px';
      section.appendChild(container2);
      volet2.appendChild(section);
      for (const s of getScenariosByVolet(2)) this.addScenarioCard(container2, s);
    }
  }

  addScenarioCard(container, s) {
    const card = document.createElement('div');
    card.className = 'scenario-card';
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="scenario-volet">Volet ${s.volet}</div>
      <div class="scenario-title">${esc(s.title)}</div>
      <div class="scenario-desc">${esc(s.description)}</div>
      <button class="scenario-btn" data-id="${esc(s.id)}">Lancer</button>
    `;
    card.querySelector('.scenario-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.launchScenario(s.id);
    });
    card.addEventListener('click', () => this.launchScenario(s.id));
    container.appendChild(card);
  }

  async launchScenario(id) {
    const scenario = getScenario(id);
    if (!scenario) return;

    this.currentScenario = id;
    document.querySelectorAll('.scenario-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === id);
    });

    // Un scénario remet la timeline sur l'année de référence.
    this.setTimeline(CONFIG.referenceYear);

    this.setStatus(`Scénario ${scenario.id} — ${scenario.title} : lancement…`);
    try {
      const steps = scenario.etapes.map(step => step.contentFrom
        ? { ...step, content: this.buildScenarioText(step.contentFrom) }
        : step);
      await this.anim.runScenario(
        { ...scenario, etapes: steps },
        (i, etape, s) => {
          this.setStatus(`Scénario ${s.id} — étape ${i + 1}/${s.etapes.length} : ${describeStep(etape)}`);
        },
        () => {
          this.setStatus(`Scénario ${scenario.id} terminé.`);
        }
      );
    } catch (err) {
      console.error('Erreur scénario', id, err);
      this.setStatus(`Scénario ${scenario.id} interrompu : ${err.message}`);
    }
  }

  /** Texte de fiche recalculé à partir des indicateurs (jamais codé en dur). */
  buildScenarioText(key) {
    const ind = this.indicators.getAllIndicators();
    const rows = {};
    for (const f of this.indicators.features) {
      if (f.properties._category === 'C1') {
        const fil = f.properties._filiere || 'Non renseigné';
        rows[fil] = (rows[fil] || 0) + 1;
      }
    }
    const filiere = (name) => {
      const b = ind.plantation.byFiliere[name] || { parcelles: 0, surface: 0, beneficiaires: 0, femmes: 0, jeunes: 0 };
      return `${nf(rows[name] || 0)} lignes → ${nf(b.parcelles)} parcelles uniques, ${nf(b.beneficiaires)} bénéficiaires identifiés (${nf(b.femmes)} femmes, ${nf(b.jeunes)} jeunes), ${nf(b.surface, 1)} ha.`;
    };
    switch (key) {
      case 'amandier':
        return `Amandier : ${filiere('Plantation Amandier')} Les liaisons vers la PFC sont des liens potentiels par proximité, non des flux documentés.`;
      case 'figuier':
        return `Figuier : ${filiere('Plantation Figuier')} Aucun flux commercial n'est prouvé par la seule proximité géographique.`;
      case 'caroubier':
        return `Caroubier : ${filiere('Plantation Caroubier')} Desserte par pistes sous marché à confirmer.`;
      case 'olivier':
        return `Olivier : ${filiere('Plantation Olivier')} Liaison vers la PFC non documentée.`;
      case 'miel': {
        const { uv } = this.indicators.getPFC_UV();
        return `Miel : ${nf(ind.mer.apicole.count)} MER apicoles (${nf(ind.mer.apicole.adherents)} adhérents), ${nf(ind.mer.em.count)} entreprises de machinisme, ${nf(uv.length)} UV. Les volumes collectés et les flux vers les PFC ne figurent pas dans le jeu de données.`;
      }
      case 'ces':
        return `CES : ${nf(ind.ces.ravins)} ravins, ${nf(ind.ces.seuils)} tronçons de seuils (${nf(ind.ces.seuilsDeclares)} seuils déclarés), ${nf(ind.ces.volumeTotal)} m³ traités. « Marché attribué » n'équivaut pas à « travaux réceptionnés ».`;
      case 'mfr':
        return `MFR : ${nf(ind.mfr.entites)} bénéficiaires recensés (${nf(ind.mfr.beneficiaires)} identifiés). Le lien vers les MER est un rapprochement à valider, non une insertion professionnelle mesurée.`;
      case 'coop':
        return `${nf(ind.coop.count)} coopératives, ${nf(ind.coop.adherents)} adhérents dont ${nf(ind.coop.femmes)} femmes (${nf(ind.coop.tauxFeminisation, 1)} %). Les liens vers les UV et PFC sont des hypothèses de circuit, non des flux commerciaux mesurés.`;
      case 'tamkin':
        return `TAMKIN : ${nf(ind.tamkin.centers)} classes, ${nf(ind.tamkin.benef)} bénéficiaires dont ${nf(ind.tamkin.femmes)} femmes (${nf(ind.tamkin.tauxFeminisation, 1)} %). Les taux d'achèvement et d'insertion nécessitent les registres de formation.`;
      case 'pistes':
        return `Pistes : ${nf(ind.pistes.count)} tronçons, ${nf(ind.pistes.totalKm, 1)} km dont ${nf(ind.pistes.nbEtude)} en étude (${nf(ind.pistes.etudeKm, 1)} km) ; ${nf(ind.pistes.kmHorsEtude, 1)} km hors étude. L'état de réception reste à confirmer.`;
      case 'environnement':
        return `Impact environnemental : ${nf(ind.sb.count)} sous-bassins (${nf(ind.sb.totalSurface)} ha), ${nf(ind.bv.count)} bassins versants (${nf(ind.bv.totalSurface / 1000)} km²), couverture végétale ${nf(ind.veg.coverage, 1)} % de la surface des sous-bassins.`;
      default:
        return '';
    }
  }

  setupControls() {
    document.getElementById('btn-play')?.addEventListener('click', () => {
      if (this.currentScenario) {
        this.launchScenario(this.currentScenario);
      } else {
        const first = getScenariosByVolet(1)[0];
        if (first) this.launchScenario(first.id);
      }
    });

    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.anim.stop();
      this.setStatus('Animation mise en pause.');
    });

    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      this.setStatus('Réinitialisation…');
      this.setTimeline(CONFIG.referenceYear);
      await this.anim.reset();
      this.setStatus('Carte réinitialisée.');
    });

    const speedSlider = document.getElementById('speed-slider');
    speedSlider?.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      this.anim.setSpeed(val);
      const label = document.getElementById('speed-value');
      if (label) label.textContent = val.toFixed(1) + '×';
    });

    const timelineSlider = document.getElementById('timeline-slider');
    timelineSlider?.addEventListener('input', () => {
      const val = parseInt(timelineSlider.value, 10);
      this.setTimeline(val);
    });

    document.getElementById('btn-3d-toggle')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-3d-toggle');
      const currentPitch = this.map.getPitch();
      if (currentPitch < 10) {
        this.map.easeTo({ pitch: 55, duration: 1000 });
        if (btn) btn.textContent = 'Vue 2D';
      } else {
        this.map.easeTo({ pitch: 0, duration: 1000 });
        if (btn) btn.textContent = 'Vue 3D';
      }
    });

    // Le tableau de bord libère la droite : la fiche du bas s'y élargit
    // (`body.no-dashboard` porte l'information, le CSS fait le reste).
    document.getElementById('btn-toggle-dashboard')?.addEventListener('click', () => {
      document.getElementById('dashboard')?.classList.remove('visible');
      document.body.classList.add('no-dashboard');
      const show = document.getElementById('btn-show-dashboard');
      if (show) show.style.display = 'flex';
    });
    document.getElementById('btn-show-dashboard')?.addEventListener('click', () => {
      document.getElementById('dashboard')?.classList.add('visible');
      document.body.classList.remove('no-dashboard');
      const show = document.getElementById('btn-show-dashboard');
      if (show) show.style.display = 'none';
    });

    // Fermeture de la fiche du marché.
    document.getElementById('market-sheet-close')?.addEventListener('click', () => {
      this.closeMarketSheet();
    });
    // Échap ferme la fiche : attendu pour un panneau qui capte l'attention.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._sheetOpen) this.closeMarketSheet();
    });
  }

  /** Filtre temporel cumulatif : plantations recensées jusqu'à l'année choisie. */
  setTimeline(year) {
    this.currentYear = year;
    const label = document.getElementById('timeline-value');
    if (label) label.textContent = String(year);

    const slider = document.getElementById('timeline-slider');
    if (slider) slider.value = String(year);

    const filter = ['<=', ['coalesce', ['get', '_annee'], 0], year];
    for (const layerId of ['plantations-circle', 'plantations-extrusion']) {
      if (this.map.getLayer(layerId)) this.map.setFilter(layerId, filter);
    }
  }

  setStatus(text) {
    const el = document.getElementById('anim-status');
    if (el) el.textContent = text;
  }

  setupLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    legend.innerHTML = '';
    // Compte réel des marchés dessinés, affiché dans la légende. C'est le
    // chiffre qui doit valoir 47 : sans lui, une absence de polygone ne se
    // voit qu'en comparant la carte à la source, ce qui est le travail de
    // personne. Le nombre vient des entités effectivement chargées, pas d'une
    // constante écrite à la main.
    const features = this.indicators?.features || [];

    // ATTENTION AUX MOTS — un marché n'est PAS un polygone.
    //
    // Chaque marché est dessiné par une entité C14 qui contient PLUSIEURS
    // polygones (un par périmètre). Compter les entités C14 ne donne donc pas
    // le nombre de polygones affichés, et écrire « N marchés » à partir de ce
    // compte serait faux dès qu'un marché couvre plusieurs périmètres.
    //
    // On distingue donc explicitement :
    //   - les MARCHÉS      : entités C14 distinctes, par numéro de marché ;
    //   - les POLYGONES    : anneaux extérieurs réellement contenus dedans ;
    //   - les bénéficiaires: lignes C1.
    const entitesC14 = features.filter((f) => f.properties?._category === 'C14');
    const marches = new Set();
    let nbPolygones = 0;
    for (const f of entitesC14) {
      const k = f.properties?._marcheKey;
      if (k) marches.add(k);
      nbPolygones += compterAnneaux(f.geometry);
    }
    const nbLignes = features.filter((f) => f.properties?._category === 'C1').length;

    const synthese = document.createElement('div');
    synthese.className = 'legend-item legend-synthese';
    synthese.style.cssText = 'font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,.18);' +
      'padding-bottom:5px;margin-bottom:5px;display:block';
    const arbo = buildArboricultureTree(features);
    synthese.textContent =
      marches.size + ' marchés · ' + nbPolygones + ' polygones · ' +
      arbo.distincts + ' bénéficiaires uniques';
    synthese.title =
      'Marchés distincts, polygones de périmètre qui les composent, ' +
      'et BÉNÉFICIAIRES UNIQUES (une CIN = une personne ; chaque ligne sans CIN ' +
      'est comptée comme une personne à part, jamais fusionnée — 482 lignes)';
    legend.appendChild(synthese);

    const items = [
      { color: CONFIG.filiereColors['Plantation Amandier'], label: 'Amandier' },
      { color: CONFIG.filiereColors['Plantation Figuier'], label: 'Figuier' },
      { color: CONFIG.filiereColors['Plantation Caroubier'], label: 'Caroubier' },
      { color: CONFIG.filiereColors['Plantation Olivier'], label: 'Olivier' },
      { color: CONFIG.typeColors.ravin, label: 'Ravins CES' },
      { color: CONFIG.typeColors.seuil, label: 'Seuils CES' },
      { color: CONFIG.typeColors.sousBassin, label: 'Sous-bassins' },
      { color: CONFIG.typeColors.bassin, label: 'Bassins versants' },
      { color: CONFIG.typeColors.perimetre, label: 'Polygones de plantation' },
      { color: CONFIG.typeColors.piste, label: 'Pistes sous marché' },
      { color: CONFIG.typeColors.uv, label: 'UV (Miel)' },
      { color: CONFIG.typeColors.pfc, label: 'PFC' },
      { color: CONFIG.typeColors.mer, label: 'MER' },
      { color: CONFIG.typeColors.cooperative, label: 'Coopératives' },
      { color: CONFIG.typeColors.tamkin, label: 'TAMKIN' },
      { color: CONFIG.typeColors.mfr, label: 'MFR' }
    ];
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'legend-item';
      div.innerHTML = `<div class="legend-color" style="background: ${item.color}"></div><span class="legend-label">${item.label}</span>`;
      legend.appendChild(div);
    }
  }

  setupPopups() {
    const clickableLayers = [
      'plantations-circle', 'ravins-circle', 'seuils-line',
      'sous-bassins-fill', 'bassins-fill', 'perimetres-fill',
      'uv-circle', 'pfc-circle', 'cooperatives-circle',
      'mfr-circle', 'tamkin-symbol'
    ];

    for (const layerId of clickableLayers) {
      // NB : le calque TAMKIN symbol est créé asynchrone (chargement de
      // l'image logo). Le listener MapLibre vérifie `getLayer()` à chaque
      // événement — il n'y a donc PAS besoin de `continue` ici.
      const plantation = layerId === 'perimetres-fill';

      this.map.on('click', layerId, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        // La surbrillance porte sur le **marché** entier : tous les polygones
        // qui partagent le numéro de marché s'illuminent ensemble. La fiche
        // affichée étant elle-même une fiche de marché, le polygone cliqué
        // n'est plus seul surligné — ce qui serait trompeur.
        if (plantation) this._selectMarket(f.properties?._marcheKey);

        if (plantation) {
          // La fiche de marché s'affiche dans le panneau du bas, pas dans un
          // popup : plus rien à positionner, à suivre au zoom ni à déplacer.
          this.openMarketSheet(f);
          return;
        }

        // Lesucher les autres calques gardent un popup classique, faute de fiche
        // dédiée : leur contenu est court et tient à côté du point cliqué.
        if (layerId === 'tamkin-symbol') {
          this.selectTamkin(f);
          return;
        }
        new maplibregl.Popup({ maxWidth: '300px' })
          .setLngLat(e.lngLat)
          .setHTML(this.buildPopup(f))
          .addTo(this.map);
      });

      // Le survol ne modifie que le curseur : la surbrillance est réservée au
      // marché sélectionné.
      this.map.on('mouseenter', layerId, (e) => {
        if (this.map.getLayer(layerId)) this.map.getCanvas().style.cursor = 'pointer';
        if (layerId === 'pistes-line') {
          const f = e.features?.[0];
          if (f) {
            const m = f.properties?._marche || f.properties?.name || '';
            if (!this._pisteHoverPopup) {
              this._pisteHoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '220px', offset: 8 });
            }
            this._pisteHoverPopup.setLngLat(e.lngLat).setHTML('<div class="popup-title">' + esc(m) + '</div>').addTo(this.map);
          }
        }
      });
      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
        if (layerId === 'pistes-line' && this._pisteHoverPopup) {
          this._pisteHoverPopup.remove();
        }
      });
    }

    // Pistes : clic → sélection (surbrillance + fiche + recentrage) ; survol → libellé
    if (this.map.getLayer('pistes-line')) {
      this.map.on('click', 'pistes-line', (e) => {
        const f = e.features?.[0];
        const m = f?.properties?._marche;
        if (m) this.selectPiste(m);
      });
      this.map.on('mouseenter', 'pistes-line', (e) => {
        this.map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        const m = f?.properties?._marche || f?.properties?.name || '';
        if (!this._pisteHoverPopup) {
          this._pisteHoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '220px', offset: 8 });
        }
        if (m) this._pisteHoverPopup.setLngLat(e.lngLat).setHTML('<div class="popup-title">' + esc(m) + '</div>').addTo(this.map);
      });
      this.map.on('mouseleave', 'pistes-line', () => {
        this.map.getCanvas().style.cursor = '';
        if (this._pisteHoverPopup) this._pisteHoverPopup.remove();
      });
    }

  }

  // Clic MER : les points MER sont des MARQUEURS DOM (logo + libellé, v r) —
  // le handler est branché par layerManager.setMERMarkerHandler() (app.js),
  // pas par un calque MapLibre (le pipeline de calques MER est mort, prouvé
  // navigateur réel 25/10).

  /**
   * Ouvre la fiche du marché dans le panneau du bas.
   *
   * Un panneau fixe remplace le popup : il n'y a plus rien à positionner, à
   * suivre au zoom ni à déplacer — les trois sources de bugs du popup
   * disparaissent avec lui. La fiche reste ouverte jusqu'à ce qu'on clique la
   * croix ou un autre marché.
   */
  openMarketSheet(feature) {
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body) return;

    const p = feature.properties || {};
    const accent = this._accentFor(p._filierePoly);

    // L'accent de couleur sert à la fois à la bordure de l'en-tête et au
    // bouton de fermeture (focus) : on le pose sur le panneau entier.
    sheet.style.setProperty('--pzc-accent', accent);
    body.innerHTML = this.buildPlantationPopup(feature);
    sheet.hidden = false;

    this._selectMarket(p._marcheKey);
    this._sheetOpen = true;

    // Le panneau occupe le bas de la carte : on réserve sa hauteur pour que
    // la navigation (zoom, relief) ne se retrouve pas sous lui.
    requestAnimationFrame(() => {
      try {
        this.map.setPadding(this._mapViewportPadding());
      } catch (_) { /* padding indisponible : sans conséquence */ }
    });
  }

  /**
   * Sélection D'UN MARCHÉ depuis le MENU GAUCHE : comportement strictement
   * identique au clic carte (surbrillance de tous les périmètres du marché +
   * fiche signalétique), avec un recentrage doux pour que la sélection soit
   * visible même si le marché est hors écran.
   */
  selectMarketByKey(marcheKey) {
    if (!marcheKey) return;
    const feat = (this.features || [])
      .find((f) => f.properties._category === 'C14' && f.properties._marcheKey === marcheKey) ||
      (this.features || []).find((f) => f.properties._category === 'C1' && f.properties._marcheKey === marcheKey);
    if (!feat) return;
    this._selectMarket(marcheKey);
    this.openMarketSheet(feat);
    const b = this._marcheBounds(marcheKey);
    if (!b || !this.map.fitBounds) return;
    // Le panneau du bas réserve lui-même la place (setPadding, posé avant notre
    // recentrage) : on ne passe DONC AUCUN padding à fitBounds — sinon la
    // réservation est comptée deux fois et le marché apparaît « non centré ».
    // Aucun plafond de zoom : un petit marché arrive au lieu juste.
    const center = () => {
      // Deux frames : la fiche a fini de se rendre. Le padding (panneaux +
      // fiche) est POSÉ JUSTE AVANT le fitBounds : le marché est centré sur
      // la zone effectivement visible, sur toute son étendue.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          this.map.setPadding(this._mapViewportPadding());
          this.map.fitBounds(b, { duration: 800, ease: (t) => t * (2 - t) });
        } catch (_) { /* déjà arrêté */ }
      }));
    };
    // En vue 3D le centre de l'écran n'est plus au-dessus de la cible : on
    // ramène le pitch à 0 le temps du centrage (l'utilisateur repasse en 3D
    // comme avant).
    const pitch = this.map.getPitch ? this.map.getPitch() : 0;
    if (pitch > 0) {
      this.map.easeTo({ pitch: 0, duration: 350 });
      this.map.once('easeend', center);
    } else {
      center();
    }
  }

  /**
   * Sélection d'UNE UNITÉ MER depuis le MENU GAUCHE : comportement strictement
   * identique à celui d'un marché (surbrillance de l'unité + fiche du bas +
   * recentrage doux).
   */
  selectPiste(marche) {
    if (!marche) return;
    const L = this.layers;
    L.setPisteSelection(marche);
    const f = (this.features || []).find((x) => x.properties?._category === 'C5' && x.properties?._marche === marche);
    if (!f) return;
    this.openPisteSheet(f);
    const coords = f.geometry?.coordinates;
    if (coords && coords.length && this.map.fitBounds) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of coords) {
        if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
      }
      const px = Math.max(0.01, (maxX - minX) * 0.15 + 0.005);
      const py = Math.max(0.01, (maxY - minY) * 0.15 + 0.005);
      const b = [[minX - px, minY - py], [maxX + px, maxY + py]];
      const center = () => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try { this.map.setPadding(this._mapViewportPadding()); this.map.fitBounds(b, { duration: 800, ease: (t) => t * (2 - t) }); } catch (_) { }
        }));
      };
      const pitch = this.map.getPitch ? this.map.getPitch() : 0;
      if (pitch > 0) { this.map.easeTo({ pitch: 0, duration: 350 }); this.map.once('easeend', center); }
      else center();
    }
  }

  /** Fiche d'une piste dans le panneau du bas (même structure que MER/PFC/UV). */
  openPisteSheet(f) {
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body || !f) return;
    const p = f.properties || {};
    const accent = CONFIG.typeColors.piste || '#FFD600';
    sheet.style.setProperty('--pzc-accent', accent);
    const km = p._longueurKm != null ? p._longueurKm : null;
    body.innerHTML = [
      '<div class="sheet-head" style="--pzc-accent:' + accent + '">',
      '  <span class="sheet-fact sheet-fact-key"><i>Piste</i><b>' + esc(p._marche || p.name || '—') + '</b></span>',
      '  <span class="sheet-sep" aria-hidden="true"></span>',
      '  <span class="sheet-facts">',
      '    <span class="sheet-fact"><i>Cercle</i><b>' + esc(p._cercle || '—') + '</b></span>',
      '    <span class="sheet-fact"><i>Piste</i><b>' + esc(p._nomPiste || '—') + '</b></span>',
      '    <span class="sheet-fact"><i>Commune</i><b>' + esc(p._commune || '—') + '</b></span>',
      '    <span class="sheet-fact"><i>Longueur</i><b>' + (km != null ? km.toFixed(2) : '—') + ' km</b></span>',
      (p._commentaire ? '    <span class="sheet-fact"><i>Commentaire</i><b>' + esc(p._commentaire) + '</b></span>' : ''),
      '  </span>',
      '</div>'
    ].join('');
    sheet.hidden = false;
    this._sheetOpen = true;
    requestAnimationFrame(() => { try { this.map.setPadding(this._mapViewportPadding()); } catch (_) { } });
  }

  selectMERUnit(unitId) {
    const u = this._merData?.byUnit?.get(unitId);
    if (!u) return;
    this._selectMER(u.unit);
    this.openMERSheet(u);
    const b = this._merUnitBounds(u);
    if (!b || !this.map.fitBounds) return;
    const center = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          this.map.setPadding(this._mapViewportPadding());
          this.map.fitBounds(b, { duration: 800, ease: (t) => t * (2 - t) });
        } catch (_) { /* déjà arrêté */ }
      }));
    };
    const pitch = this.map.getPitch ? this.map.getPitch() : 0;
    if (pitch > 0) {
      this.map.easeTo({ pitch: 0, duration: 350 });
      this.map.once('easeend', center);
    } else {
      center();
    }
  }

  /** Fiche d'une unité MER dans le panneau du bas (même panneau que le marché). */
  openMERSheet(u) {
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body) return;
    const accent = MER_COLORS[u.specialite] || '#8D6E63';
    sheet.style.setProperty('--pzc-accent', accent);
    body.innerHTML = this.buildMERPopup(u);
    sheet.hidden = false;
    this._sheetOpen = true;
    requestAnimationFrame(() => {
      try { this.map.setPadding(this._mapViewportPadding()); } catch (_) { /* ignoré */ }
    });
  }

  /** Corps de la fiche MER : en-tête (indicateur → valeur) + 2 barres. */
  buildMERPopup(u) {
    const total = u.count;
    const genreParts = [
      { label: 'Femmes', n: u.femmes, color: '#E76F51' },
      { label: 'Hommes', n: Math.max(0, total - u.femmes), color: '#264653' }
    ];
    const jeuneParts = [
      { label: 'Jeunes', n: u.jeunes, color: '#FFC107' },
      { label: 'Non-jeunes', n: Math.max(0, total - u.jeunes), color: 'rgba(255,255,255,0.18)' }
    ];
    const accent = MER_COLORS[u.specialite] || '#8D6E63';
    return [
      '<div class="sheet-head" style="--pzc-accent:' + accent + '">',
      // Même logo que la punaise de la carte : l'unité ouverte est
      // reconnaissable immédiatement (v s).
      '  <img class="sheet-logo" src="logo-MER-pin.png" alt="">',
      '  <span class="sheet-fact sheet-fact-key"><i>Unité</i><b>' + esc(u.unit) + (u.cercleLetter ? '_' + u.cercleLetter : '') + '</b></span>',
      '  <span class="sheet-sep" aria-hidden="true"></span>',
      '  <span class="sheet-facts">',
      '    <span class="sheet-fact"><i>Spécialité</i><b>' + esc(MER_LABELS[u.specialite] || '—') + '</b></span>',
      '    <span class="sheet-fact"><i>Adhérents</i><b>' + int(total) + '</b></span>',
      u.nom
        ? '    <span class="sheet-fact"><i>Micro-entreprise</i><b>' + esc(u.nom) + '</b></span>'
        : '',
      '    <span class="sheet-fact"><i>Femmes</i><b>' + int(u.femmes) + ' · ' + u.femmesPct + ' %</b></span>',
      '    <span class="sheet-fact"><i>Jeunes</i><b>' + int(u.jeunes) + ' · ' + u.jeunesPct + ' %</b></span>',
      '  </span>',
      '</div>',
      this._barBlock('GENRE', genreParts, total),
      this._barBlock('JEUNES', jeuneParts, total)
    ].join('');
  }

  /**
   * CADRE le déploiement d'unités MER sur la zone VISIBLE : les points de ce
   * ensemble tiennent à l'écran (« le déploiement de tous les points MER de
   * loin »). Bornes = centroïdes des unités (ce qui est dessiné), marge 15 %.
   * Même protocole que les recenterings marché/fiche : setPadding AVANT le
   * fitBounds, 2× rAF, chaîne pitch → 0 en vue 3D.
   */
  fitMERScope(units) {
    const cs = (units || []).map((u) => u.centroid).filter(Boolean);
    if (!cs.length || !this.map.fitBounds) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cs) {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    }
    const px = Math.max(0.015, (maxX - minX) * 0.15 + 0.005);
    const py = Math.max(0.015, (maxY - minY) * 0.15 + 0.005);
    const b = [[minX - px, minY - py], [maxX + px, maxY + py]];
    const center = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          this.map.setPadding(this._mapViewportPadding());
          this.map.fitBounds(b, { duration: 800, ease: (t) => t * (2 - t) });
        } catch (_) { /* déjà arrêté */ }
      }));
    };
    const pitch = this.map.getPitch ? this.map.getPitch() : 0;
    if (pitch > 0) {
      this.map.easeTo({ pitch: 0, duration: 350 });
      this.map.once('easeend', center);
    } else {
      center();
    }
  }

  /** Bornes des adhérents d'une unité MER (pour le recentrage). */
  _merUnitBounds(u) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of u.adherents || []) {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    }
    if (!Number.isFinite(minX)) return null;
    // Marge : une unité de 5 adhérents ne doit pas remplir l'écran.
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const dx = Math.max(0.004, (maxX - minX) / 2 + 0.002);
    const dy = Math.max(0.004, (maxY - minY) / 2 + 0.002);
    return [[cx - dx, cy - dy], [cx + dx, cy + dy]];
  }

  _selectMER(unitId) {
    this.layers?.setMERSelection?.(unitId);
  }

  /** Sélection d'un PFC : surbrillance DOM + fiche bas + recentrage. */
  selectPFC(name) {
    this.layers?.setPFCSelection?.(name);
    const feat = (this.features || []).find(f => f.properties?.name === name && f.properties?._category === 'C7');
    if (!feat) return;
    this._openSheet(feat, CONFIG.typeColors.pfc, 'logo-pfc.png');
    const b = [[feat.geometry.coordinates[0], feat.geometry.coordinates[1]]];
    this._fitSinglePoint(b);
  }

  /** Sélection d'une UV : surbrillance DOM + fiche bas + recentrage. */
  selectUV(name) {
    this.layers?.setUVSelection?.(name);
    const feat = (this.features || []).find(f => f.properties?.name === name && f.properties?._category === 'C6');
    if (!feat) return;
    this._openSheet(feat, CONFIG.typeColors.uv, 'logo-uv.png');
    const b = [[feat.geometry.coordinates[0], feat.geometry.coordinates[1]]];
    this._fitSinglePoint(b);
  }

  /** Sélection d'une coopérative apicole : surbrillance DOM + fiche bas + recentrage. */
  selectCoop(code) {
    this.layers?.setCoopSelection?.(code);
    // 在 coopData.units 里找，因为 features 里 C9 是明细面，不是按 Code 分组的点。
    const unit = (this._coopData?.units || []).find(u => u.code === code);
    if (!unit) return;
    const accent = CONFIG.typeColors.coop || '#0097A7';
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body) return;
    sheet.style.setProperty('--pzc-accent', accent);
    body.innerHTML = this.buildCoopPopup(unit, accent, 'logo-ooperatives apicoles_v3.png');
    sheet.hidden = false;
    this._sheetOpen = true;
    requestAnimationFrame(() => { try { this.map.setPadding(this._mapViewportPadding()); } catch (_) {} });
    const b = [[unit.coords[0], unit.coords[1]]];
    this._fitSinglePoint(b);
  }

  /** Sélection d'une unité TAMKIN : fiche bas + recentrage + surbrillance sur la carte. */
  selectTamkin(f) {
    const accent = CONFIG.typeColors.tamkin;
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body) return;
    sheet.style.setProperty('--pzc-accent', accent);
    body.innerHTML = this.buildTamkinPopup(f, accent);
    sheet.hidden = false;
    this._sheetOpen = true;
    const coords = f.geometry?.coordinates || f.properties?._coords;
    if (!coords) return;
    const center = () => {
      try {
        this.map.setPadding(this._mapViewportPadding());
        this.map.flyTo({
          center: [coords[0], coords[1]],
          zoom: (this.map.getZoom ? this.map.getZoom() + 1 : 14),
          duration: 800
        });
      } catch (_) { /* déjà arrêté */ }
    };
    requestAnimationFrame(() => center());
    // Surbrillance du logo sur la carte
    this.layers?.setTamkinSelection?.(f.properties._rowId);
  }

  /** Corps de la fiche TAMKIN (classe de formation) : en-tête + 2 barres (GENRE / JEUNES). */
  buildTamkinPopup(f, accent) {
    const p = f.properties || {};
    const total = p._nbBenefFormation || 0;
    const femmes = p._nbFemmesFormation || 0;
    const hommes = p._nbHommesFormation || 0;
    const jeunes = p._nbJeunesFormation || 0;
    const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
    const genreParts = [
      { label: 'Femmes', n: femmes, color: '#E76F51' },
      { label: 'Hommes', n: hommes, color: '#2196F3' }
    ];
    const jeuneParts = [
      { label: 'Jeunes', n: jeunes, color: '#FFC107' },
      { label: 'Non-jeunes', n: Math.max(0, total - jeunes), color: 'rgba(255,255,255,0.18)' }
    ];
    const mainFacts = [
      ['Association', p._association],
      ['Cercle', p._cercle],
      ['Commune', p._tkCommune || p._ct || p._commune],
      ['Douar', p._douar],
      ['Niveau scolaire', p._niveauScolaire],
      ['Bénéficiaires', total]
    ].filter((c) => c[1] && c[1] !== 0)
      .map((c) => '<span class="sheet-fact"><i>' + esc(c[0]) + '</i><b>' + esc(c[1]) + '</b></span>')
      .join('');
    const genderFacts = [
      ['Femmes', int(femmes) + ' · ' + pct(femmes) + ' %'],
      ['Hommes', int(hommes) + ' · ' + pct(hommes) + ' %'],
      ['Jeunes', int(jeunes) + ' · ' + pct(jeunes) + ' %']
    ].filter((c) => c[1] && c[1] !== 0)
      .map((c) => '<span class="sheet-fact"><i>' + esc(c[0]) + '</i><b>' + esc(c[1]) + '</b></span>')
      .join('');
    return [
      '<div class="sheet-head" style="--pzc-accent:' + accent + '">',
      '  <img class="sheet-logo" src="logo-tamkin.png" alt="">',
      '  <span class="sheet-facts">' + mainFacts + '</span>',
      '  <span class="sheet-facts sheet-facts-col">' + genderFacts + '</span>',
      '</div>',
      this._barBlock('GENRE', genreParts, total),
      this._barBlock('JEUNES', jeuneParts, total)
    ].join('');
  }

  /** Ouvrir la fiche dans le panneau du bas (réutilise buildPopup pour C6/C7). */
  _openSheet(feat, accent, logoSrc) {
    const sheet = document.getElementById('market-sheet');
    const body = document.getElementById('market-sheet-body');
    if (!sheet || !body) return;
    sheet.style.setProperty('--pzc-accent', accent);
    // PFC/UV : fiche avec logo (même modèle que MER).
    if (feat.properties?._category === 'C6' || feat.properties?._category === 'C7') {
      body.innerHTML = this.buildPVFCPopup(feat, accent, logoSrc);
    } else {
      body.innerHTML = this.buildPopup(feat);
    }
    sheet.hidden = false;
    this._sheetOpen = true;
    requestAnimationFrame(() => { try { this.map.setPadding(this._mapViewportPadding()); } catch (_) {} });
  }

  /** Corps de la fiche PFC / UV : en-tête avec logo + lignes de propriétés.
   *  Structure alignée sur buildMERPopup (sheet-head en tant que premier
   *  enfant direct de #market-sheet-body, pas de wrapper arbitraire). */
  buildPVFCPopup(feat, accent, logoSrc) {
    const p = feat.properties || {};
    const name = p.name || '—';
    const isUV = p._category === 'C6';
    const type = isUV ? 'Unité de valorisation-miel' : 'Plateforme de commercialisation';
    const func = isUV ? 'Transformation / valorisation' : 'Commercialisation / vente';
    const rowsHtml = [
      ['Type', type],
      ['Fonction', func]
    ].map(([l, v]) =>
      `<div class="popup-row"><span class="popup-label">${esc(l)}</span><span class="popup-value">${esc(v)}</span></div>`
    ).join('');
    return `<div class="sheet-head" style="--pzc-accent:${accent}">` +
      `<img class="sheet-logo" src="${logoSrc}" alt="">` +
      `<span class="sheet-fact sheet-fact-key"><i>${type}</i><b>${esc(name)}</b></span>` +
      `<span class="sheet-sep" aria-hidden="true"></span>` +
      `<span class="sheet-facts"><span class="sheet-fact"><i>Fonction</i><b>${esc(func)}</b></span></span>` +
      `</div>${rowsHtml}`;
  }

  /** Corps de la fiche coopérative apicole — même style que MER (sheet-head
   *  + barres GENRE / JEUNES). */
  buildCoopPopup(u, accent, logoSrc) {
    const total = u.total || 0;
    const femmes = u.femmes || 0;
    const jeunes = u.jeunes || 0;
    const genreParts = [
      { label: 'Femmes', n: femmes, color: '#E76F51' },
      { label: 'Hommes', n: Math.max(0, total - femmes), color: '#264653' }
    ];
    const jeuneParts = [
      { label: 'Jeunes', n: jeunes, color: '#FFC107' },
      { label: 'Non-jeunes', n: Math.max(0, total - jeunes), color: 'rgba(255,255,255,0.18)' }
    ];
    const unionHtml = u.union
      ? '<span class="sheet-fact"><i>Union</i><b>' + esc(u.union) + '</b></span>'
      : '';
    return [
      '<div class="sheet-head" style="--pzc-accent:' + accent + '">',
      '  <img class="sheet-logo" src="' + logoSrc + '" alt="">',
      '  <span class="sheet-fact sheet-fact-key"><i>Coopérative</i><b>' + esc(u.code) + '</b></span>',
      '  <span class="sheet-sep" aria-hidden="true"></span>',
      '  <span class="sheet-facts">',
      '    <span class="sheet-fact"><i>Spécialité</i><b>' + esc(MER_LABELS[u.specialite] || '—') + '</b></span>',
      // Nom propre de la coopérative quand il est renseigné (u.name == code quand manque).
      (u.name && u.name !== u.code)
        ? '    <span class="sheet-fact"><i>Nom</i><b>' + esc(u.name) + '</b></span>'
        : '',
      '    <span class="sheet-fact"><i>Adhérents</i><b>' + int(total) + '</b></span>',
      '    <span class="sheet-fact"><i>Femmes</i><b>' + int(femmes) + ' · ' + Math.round(total ? (femmes / total) * 100 : 0) + ' %</b></span>',
      '    <span class="sheet-fact"><i>Jeunes</i><b>' + int(jeunes) + ' · ' + Math.round(total ? (jeunes / total) * 100 : 0) + ' %</b></span>',
      '    ' + unionHtml,
      '  </span>',
      '</div>',
      this._barBlock('GENRE', genreParts, total),
      this._barBlock('JEUNES', jeuneParts, total)
    ].join('');
  }

  /** Recentrage sur un point unique (PFC/UV) avec animation douce. */
  _fitSinglePoint(bounds) {
    if (!this.map.fitBounds) return;
    const px = 0.008, py = 0.008;
    const b = [[bounds[0][0] - px, bounds[0][1] - py], [bounds[0][0] + px, bounds[0][1] + py]];
    const center = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try { this.map.setPadding(this._mapViewportPadding()); this.map.fitBounds(b, { duration: 800, ease: t => t * (2 - t) }); }
        catch (_) {}
      }));
    };
    if (this.map.getPitch && this.map.getPitch() > 0) {
      this.map.easeTo({ pitch: 0, duration: 350 });
      this.map.once('easeend', center);
    } else { center(); }
  }

  _clearMERSelection() {
    this.layers?.setMERSelection?.(null);
  }

  /**
   * Réservations de viewport pour MapLibre : les panneaux du panneau
   * gauche, du dashboard et de la fiche MASQUENT une partie de la carte.
   * En leur réserve via setPadding, le centrage (fitBounds) se fait sur la
   * zone VISIBLE — sans ça, le marché est centré sur la fenêtre entière
   * et apparaît décentré sous les panneaux.
   */
  _mapViewportPadding() {
    const p = { top: 0, left: 0, right: 0, bottom: 0 };
    const visible = (id) => {
      const n = document.getElementById(id);
      if (!n || n.hidden) return false;
      try { return typeof getComputedStyle === 'function' ? getComputedStyle(n).display !== 'none' : true; } catch (_) { return true; }
    };
    const cp = document.getElementById('control-panel');
    if (cp && visible('control-panel')) p.left = cp.offsetWidth + 10;
    const dash = document.getElementById('dashboard');
    if (dash && visible('dashboard')) p.right = dash.offsetWidth + 10;
    const sheet = document.getElementById('market-sheet');
    if (sheet && !sheet.hidden) p.bottom = sheet.offsetHeight + 16;
    return p;
  }

  /** Bornes des périmètres d'un marché (pour le recentrage). */
  _marcheBounds(marcheKey) {
    const rings = [];
    const walk = (g) => {
      if (!g) return;
      if (g.type === 'Polygon') rings.push(g.coordinates?.[0]);
      else if (g.type === 'MultiPolygon') for (const p of g.coordinates || []) rings.push(p[0]);
      else if (g.type === 'GeometryCollection') for (const s of g.geometries || []) walk(s);
    };
    for (const f of (this.features || [])) {
      if (f.properties._category !== 'C14' || f.properties._marcheKey !== marcheKey) continue;
      walk(f.geometry);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of rings) for (const c of ring || []) {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    }
    return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
  }

  /** Ferme la fiche et éteint la surbrillance. */
  closeMarketSheet() {
    const sheet = document.getElementById('market-sheet');
    if (sheet) sheet.hidden = true;
    this._sheetOpen = false;
    this._clearSelection();
    this._clearMERSelection();
    this._clearPFCSelection();
    this._clearUVSelection();
    this._clearPisteSelection();
    try { this.map.setPadding(this._mapViewportPadding()); } catch (_) { /* ignoré */ }
  }

  _clearPFCSelection() { this.layers?.setPFCSelection?.(null); }
  _clearUVSelection()  { this.layers?.setUVSelection?.(null); }
  _clearPisteSelection() { this.layers?.setPisteSelection?.(null); }

  /**
   * Surbrillance : une seule couche, filtrée sur le **marché** sélectionné.
   *
   * La fiche étant une fiche de marché, c'est l'ensemble du marché — tous
   * ses polygones de périmètre — qui doit s'illuminer : surligner le seul
   * polygone cliqué laisserait croire que les chiffres ne concernent que lui.
   */
  _selectMarket(marcheKey) {
    if (!marcheKey) return;
    const filter = ['==', ['get', '_marcheKey'], marcheKey];
    for (const id of ['perimetres-selected-fill', 'perimetres-selected-line']) {
      if (!this.map.getLayer(id)) continue;
      this.map.setFilter(id, filter);
      // Ceinture et bretelles : une couche peut avoir été masquée par un
      // groupe de couches (showGroup) — on la remet explicitement visible.
      this.map.setLayoutProperty(id, 'visibility', 'visible');
      // Et au premier plan : sinon une couche ajoutée plus tard la recouvre.
      this.map.moveLayer(id);
    }
    this._selectionActive = true;
  }

  _clearSelection() {
    // On vide par un filtre impossible plutôt que par la visibilité : la
    // couche reste prête, et rien ne dépend d'un état de visibilité qui peut
    // être modifié ailleurs.
    for (const id of ['perimetres-selected-fill', 'perimetres-selected-line']) {
      if (!this.map.getLayer(id)) continue;
      this.map.setFilter(id, ['==', ['get', '_marcheKey'], '__aucun__']);
    }
    this._selectionActive = false;
  }

  buildPopup(f) {
    const p = f.properties || {};
    const d = p._parsed || {};
    const cat = p._category ? CATEGORIES[p._category] : null;

    let title = p.name || d['Nom Coopérative'] || d['NOM DE LOCAL'] || cat?.name || 'Entité';
    let rows = [];

    const add = (label, value, unit = '') => {
      if (value === null || value === undefined || value === '') return;
      rows.push([label, `${value}${unit ? ' ' + unit : ''}`]);
    };

    if (p._category === 'C1') {
      add('Filière', p._filiere);
      add('Commune', p._commune);
      add('Périmètre', p._perimetre);
      add('Cercle', p._cercle);
      add('Surface', p._sup, 'ha');
      add('Année', p._annee);
      add('Genre', p._genre);
      add('Jeune', p._jeune);
      add('Marché', p._marche);
    } else if (p._category === 'C2' || p._category === 'C3') {
      add('Marché', d['N° De Marché'] || p._marche);
      add('Commune', d['Commune territoriale'] || p._commune);
      add('Cercle', d['CERCLE'] || p._cercle);
      add('Ravine', d.Ravine);
      add('Seuil', d.Seuil);
      add('Influence', p._influence);
      add('Longueur', p._longueur ? Math.round(p._longueur) : null, 'm');
      add('Volume', p._volume != null ? Math.round(p._volume) : null, 'm³');
      add('Nb seuils', p._nbSeuils);
    } else if (p._category === 'C5') {
      add('Marché', p._marche);
      add('Cercle', p._cercle);
      add('Piste', p._nomPiste);
      add('Commune', p._commune);
      add('Longueur', p._longueurKm != null ? p._longueurKm : d['Linéaire (km)'], 'km');
    } else if (p._category === 'C4' || p._category === 'C15') {
      add('Surface', p._surfaceHa ? Math.round(p._surfaceHa).toLocaleString('fr-FR') : null, 'ha');
      add('Type', p._category === 'C4' ? 'Sous-bassin versant' : 'Bassin versant');
    } else if (p._category === 'C14') {
      add('Marché', d['N° Marché']);
      add('Filière', d.Plantation);
      add('Surface marché', d['SUP-total-Marché(ha)'], 'ha');
      add('Surface périmètre', d['SUP-Périmètre(ha)'], 'ha');
      add('Entreprise', d.Entreprise || d['Société']);
    } else if (p._category === 'C8') {
      add('Code MER', p._code);
      add('Type', p._merType);
      add('Axe', p._axe);
      add('Spécialité', p._specialite);
      add('Avancement', p._avancement);
      add('Adhérents', d["Nbre d'adhérents Total"]);
    } else if (p._category === 'C9') {
      add('Coopérative', p._nomCooperative);
      add('Union', p._appartenanceUnion);
      add('Adhérents', d["Nbre d'adhérents Total"]);
      add('Femmes', d["Nbre d'adhérents FEMMES"]);
      add('Jeunes', d["Nbre d'adhérents JEUNES"]);
      add('Création', d['Année création']);
    } else if (p._category === 'C10') {
      add('Local', 'Local de formation');
      add('Classe', d.CLASSE || d.Classe);
      add('Niveau', p._niveauScolaire);
      add('Bénéficiaires', p._nbBenefFormation);
      add('Femmes', p._nbFemmesFormation);
      add('Durée', p._dureeFormation);
    } else if (p._category === 'C11') {
      add('Formation', p._formation);
      add('Durée', p._dureeFormation);
      add('Niveau', p._niveauScolaire);
      add('Résultat', p._resultat);
      add('Année scolaire', p._anneeScolaire);
    } else if (p._category === 'C6' || p._category === 'C7') {
      add('Type', p._category === 'C6' ? 'Unité de valorisation' : 'Plateforme de commercialisation');
      add('Fonction', p._category === 'C6' ? 'Transformation / valorisation' : 'Commercialisation / vente');
    }
    add('Catégorie', cat?.name);

    const rowsHtml = rows.map(([l, v]) =>
      `<div class="popup-row"><span class="popup-label">${esc(l)}</span><span class="popup-value">${esc(v)}</span></div>`
    ).join('');

    return `<div class="popup-title">${esc(title)}</div>${rowsHtml}`;
  }

  // ---------------------------------------------------------------- fiche de plantation

  /**
   * Rattachement des lignes de plantation aux polygones (calculé une fois).
   * Renvoie { byPoly, unattached, stats } — voir js/market.js.
   */
  _join() {
    if (!this._joined) {
      const features = this.indicators?.features || [];
      const polygons = features.filter(f => f.properties?._category === 'C14');
      const plantations = features.filter(f => f.properties?._category === 'C1');
      this._joined = attachPlantationsToPolygons(polygons, plantations);
      this._markets = buildMarketAggregates(plantations);
      // Nombre de polygones par marché, et somme de leurs surfaces.
      //
      // ATTENTION — depuis la bascule sur la source simplifiée, un marché n'a
      // plus qu'UN polygone, et son champ `SUP-Périmètre(ha)` ne désigne plus
      // « la surface de l'un des périmètres du marché » mais une surface
      // partielle sans rapport avec la somme attendue (exemple : le marché
      // 24/2023 affiche `SUP-Périmètre: 78` alors que le marché fait 503 ha).
      // `_supOfMarket()` ne doit donc PLUS servir à vérifier « Σ périmètres =
      // marché » : le contrôle d'intégrité historique n'a plus de sens ici. Il
      // n'a d'ailleurs aucun consommateur dans le code — vérifié par recherche
      // sur tout `js/`. La surface affichée dans la fiche est `_supTotal`
      // (`SUP-total-Marché(ha)`), qui reste exacte.
      this._polyCount = new Map();
      this._supByMarket = new Map();
      for (const f of polygons) {
        const k = f.properties?._marcheKey;
        if (!k) continue;
        this._polyCount.set(k, (this._polyCount.get(k) || 0) + 1);
        const sup = f.properties?._supPerimetre;
        if (typeof sup === 'number') {
          const cur = this._supByMarket.get(k) || 0;
          this._supByMarket.set(k, cur + sup);
        }
      }
      this._logJoinStats(this._joined.stats);
    }
    return this._joined;
  }

  /** Statistiques d'un marché (niveau marché : tous les périmètres confondus). */
  _marketStats(key) {
    if (!key) return null;
    this._join();
    return this._markets.get(key) || null;
  }

  /** Nombre de polygones rattachés à un numéro de marché. */
  _polygonsOfMarket(key) {
    if (!key) return 0;
    this._join();
    return this._polyCount.get(key) || 0;
  }

  /** Somme des surfaces de périmètre d'un marché (contrôle d'intégrité). */
  _supOfMarket(key) {
    if (!key) return null;
    this._join();
    return this._supByMarket.get(key) ?? null;
  }

  /** Bilan de rattachement : rendu visible dès le premier affichage. */
  _logJoinStats(s) {
    const pct = (s.coverage || 0).toFixed(1);
    console.log(
      `%cRattachement polygones ↔ plantations%c\n` +
      `  couverture   ${pct} %  (${s.spatial + s.market}/${s.polygons} polygones)\n` +
      `  spatial      ${s.spatial}   (niveau 2 — point dans le polygone)\n` +
      `  par marché   ${s.market}   (niveau 1 — numéro de marché commun)\n` +
      `  sans objet   ${s.none}\n` +
      `  lignes       ${s.pointsSpatial} rattachées géographiquement, ` +
      `${s.pointsMarket} par marché, ${s.pointsOutside} hors polygone, ` +
      `${s.pointsWithoutCoord} sans coordonnées (total ${s.points})`,
      'color:#4CAF50;font-weight:700',
      'color:#dfe6f2'
    );
    if (s.none) {
      console.warn(`${s.none} polygone(s) de plantation restent sans bénéficiaire rattachable.`);
    }
    return s;
  }

  /** Bilan de rattachement, exposé pour le tableau de bord et les tests. */
  get joinStats() { return this._joined ? this._joined.stats : null; }

  /** Force le calcul du rattachement au démarrage (bilan visible immédiatement). */
  initJoin() { this._join(); return this._joined; }

  /** Accents de couleur communs à la carte et à la fiche. */
  _accentFor(filiere) {
    return (filiere && CONFIG.filiereColors[filiere]) || '#8D6E63';
  }

  /**
   * Fiche du polygone de plantation — **niveau marché**.
   *
   * Un marché est l'unité de lecture : le popup affiche donc les informations
   * du **marché entier** (tous ses périmètres confondus), et la surbrillance
   * éclaire tous les polygones qui le composent.
   *
   * Contenu, volontairement réduit : une fiche lisible d'un coup d'œil, qui
   * n'occupe pas le quart de l'écran.
   *   - en-tête : numéro de marché (forme harmonisée, une seule ligne),
   *     superficie, puis le **total des bénéficiaires en gras** ;
   *   - deux camemberts disjoints : l'un sur le genre, l'autre sur le statut
   *     jeune — chacun une partition exhaustive du total, donc 100 % ;
   *   - une ligne discrète : les taux calculés sur leur dénominateur propre.
   *
   * Champs sources : N° Marché, SUP-total-Marché(ha), Plantation.
   * Agrégats : calculés sur les lignes de plantation existantes
   * (`buildMarketAggregates`). Rien n'est inventé ; un chiffre absent
   * s'affiche « absent », jamais 0.
   */
  buildPlantationPopup(f) {
    const p = f.properties || {};
    const filiere = p._filierePoly || p._plantedType || 'Non renseigné';
    const filiereShort = filiere.replace(/^Plantation\s+/i, '');
    const accent = this._accentFor(p._filierePoly);
    // Numéro de marché : forme harmonisée, sur une seule ligne — à l'année
    // VALIDÉE (clé normalisée, alias du projet appliqués : M14/2025, M33/2024).
    // La graphie d'origine source reste tracée via _marcheRaw.
    const label = marketDisplayLabel(p._marcheKey ? 'M' + p._marcheKey : (p._marcheRaw ?? p._marche));
    const key = p._marcheKey;

    const market = this._marketStats(key);

    // Combien de périmètres ce marché couvre-t-il ?
    //
    // Depuis la bascule sur la source simplifiée, un marché n'est plus dessiné
    // par un polygone par périmètre : il tient en UN polygone qui assemble tous
    // les siens. Annoncer « 1 périmètre » serait donc exact mais trompeur —
    // l'expert croirait à un périmètre isolé alors qu'il regarde le marché
    // entier. On lit le nombre réel dans la géométrie (`_nbPerimetres`), et on
    // ne retombe sur le décompte des polygones que si l'information manque.
    const nbPerim = p._nbPerimetres || 0;
    const polyCount = this._polygonsOfMarket(key);
    const nbAffiche = nbPerim || polyCount;

    const polyLabel = nbAffiche > 1 ? nbAffiche + ' périmètres'
      : nbAffiche === 1 ? '1 périmètre'
      : 'marché non rattaché';

    // --- Les barres de répartition -----------------------------------------
    // Chaque barre est une partition du MÊME total (les bénéficiaires
    // distincts du marché) sur un axe distinct : genre, statut jeune,
    // superficie cumulée. Une barre unique « Femmes / Hommes / Jeunes »
    // compterait deux fois les femmes jeunes et dépasserait 100 % — d'où des
    // axes séparés.
    let blocks = '';
    if (market) {
      const total = market.persons;
      const nonRenseigne = Math.max(0, total - market.genreConnus);
      const nonJeunes = Math.max(0, total - market.jeunes);
      const sc = market.supClasses || { p0_2: 0, p2_5: 0, p5plus: 0, sansSup: 0 };

      // Une catégorie « non renseignée » à zéro n'apprend rien : elle est
      // retirée de l'affichage. Dès qu'elle compte au moins une personne, elle
      // est conservée — c'est une information : la donnée manque.
      const dropIfEmpty = (label, n) =>
        !(/non renseign/i.test(label) && n === 0);

      const genreParts = [
        { label: 'Femmes', n: market.femmes, color: '#E91E63' },
        { label: 'Hommes', n: market.hommes, color: '#2196F3' },
        { label: 'Genre non renseigné', n: nonRenseigne, color: 'rgba(255,255,255,0.18)' }
      ].filter((p) => dropIfEmpty(p.label, p.n));
      const jeuneParts = [
        { label: 'Jeunes', n: market.jeunes, color: '#FFC107' },
        { label: 'Non-jeunes', n: nonJeunes, color: 'rgba(255,255,255,0.18)' }
      ];
      // Superficie : le champ SUP de la source est la surface d'UNE parcelle ;
      // les parcelles d'un même bénéficiaire (même CIN → même _benefId) sont
      // additionnées avant le classement.
      const supParts = [
        { label: '0 – 2 ha', n: sc.p0_2, color: '#4CAF50' },
        { label: '2 – 5 ha', n: sc.p2_5, color: '#FFB300' },
        { label: 'plus de 5 ha', n: sc.p5plus, color: '#7E57C2' },
        { label: 'Superficie non renseignée', n: sc.sansSup, color: 'rgba(255,255,255,0.18)' }
      ].filter((p) => dropIfEmpty(p.label, p.n));

      blocks = [
        this._barBlock('GENRE', genreParts, total),
        this._barBlock('JEUNES', jeuneParts, total),
        this._barBlock("CLASSES D'EXPLOITATIONS", supParts, total)
      ].join('');

    }
    // NB — la ligne « Taux de féminisation / Taux de jeunesse » a été RETIRÉE
    // (demande du responsable du projet) : elle occupait une bande pleine
    // largeur sous les trois barres, donc une hauteur non nulle en bas de la
    // fiche. Les effectifs Femmes / Hommes / Jeunes et leurs parts restent
    // affichés dans les barres GENRE et JEUNES : l'information n'est pas
    // perdue, seule la redondance « taux » disparaît.

    const totalLine = market
      ? ''
      : '<div class="pzc-note pzc-note-warn">Aucune ligne de plantation ne porte ' +
        'le numéro <code>' + esc(label) + '</code> dans le jeu public : ' +
        'effectifs non mesurables — ce n\'est pas 0.</div>';

    // En-tête : UNE seule bande pleine largeur, et des paires
    // « indicateur → valeur » plutôt que « valeur → indicateur ».
    //
    // Avant, chaque repère s'affichait valeur d'abord, libellé ensuite
    // (« 830,0 ha SUPERFICIE ») : le lecteur devait finir la ligne pour savoir
    // de quoi le chiffre parlait. L'ordre demandé par le responsable du projet
    // est l'inverse — l'indicateur à gauche, sa valeur à droite :
    //
    //   MARCHÉ 28/2022/DPA/32/SMOPFPA · CERCLE Tainaste │ SUPERFICIE 830,0 ha
    //                                                    · BÉNÉFICIAIRES 475
    //                                                    · FILIÈRE Figuier
    //
    // Le numéro de marché porte la classe `sheet-fact-key` : c'est lui qui
    // identifie la fiche, il garde donc une typographie plus grande et son
    // libellé « Marché » ne s'efface jamais (contrairement aux autres, dont le
    // libellé se retire quand la fiche se resserre — un chiffre sans libellé
    // reste lisible à côté du titre, un numéro de marché sans le mot
    // « Marché » deviendrait un code opaque).
    //
    // Cercle : il vient JUSTE APRÈS le marché, comme demandé.
    //
    // Le CERCLE (Aknoul, Tainaste) remplace la commune : c'est le repère de
    // lecture du territoire dans la source, et sa graphie y est cohérente —
    // contrairement à celle de la commune, où la même entité s'écrit `JBARNA`
    // ou `Jbarna` selon les lignes (ce qui produisait un faux « +1 »).
    //
    // Le polygone porte SON PROPRE cercle dans sa description (`Cercle: AKNOUL`)
    // — c'est la source la plus directe, on la lit en premier. Le cercle agrégé
    // du marché ne sert que de repli, si le polygone n'en a pas.
    const cercles = (market && market.cercles) || [];
    const cercleDirect = territoireLabel(p._cercle);
    const cercleLabel = cercleDirect || cercles[0] || null;
    // En-tête court : au-delà de deux cercles (rare), on abrège plutôt que de
    // pousser les autres informations hors de la ligne. La liste complète est
    // dans l'infobulle.
    const cerclesAll = cercleDirect && !cercles.includes(cercleDirect)
      ? [cercleDirect, ...cercles]
      : cercles;

    return [
      '<div class="sheet-head" style="--pzc-accent:' + accent + '">',
      '  <span class="sheet-fact sheet-fact-key">',
      '    <i>Marché</i>',
      '    <b>' + esc(label) + '</b>',
      '  </span>',
      '  <span class="sheet-sep" aria-hidden="true"></span>',
      '  <span class="sheet-facts">',
      '    <span class="sheet-fact">',
      '      <i>Superficie</i>',
      '      <b>' + (p._supTotal != null ? esc(num1(p._supTotal)) + ' ha' : '—') + '</b>',
      '    </span>',
      market
        ? '    <span class="sheet-fact">' +
            '      <i>Bénéficiaires</i>' +
            '      <b>' + esc(int(market.persons)) + '</b>' +
            '    </span>'
        : '',
      '    <span class="sheet-fact">',
      '      <i>Filière</i>',
      '      <b>' + esc(filiereShort) + '</b>',
      '    </span>',
      '  </span>',
      '</div>',
      blocks,
      totalLine
    ].join('');
  }

  /**
   * Un bloc « barre empilée + légende ».
   *
   * La légende porte l'effectif **propre** de chaque catégorie et sa part en
   * pourcentage du total : les deux correspondent exactement aux segments
   * dessinés. Un effectif nul affiche « 0 % » (c'est un fait mesuré) ; un
   * effectif de 1 à 4 personnes garde son segment mais son pourcentage n'est
   * pas publié — règle de seuil appliquée dans toute l'application.
   */
  _barBlock(title, parts, total) {
    const rows = parts.map((part) => {
      const n = part.n || 0;
      // Tous les pourcentages sont affichés, sans seuil d'effectif : y compris
      // les parts inférieures à 1 %, qui apparaissent alors comme « 0,x % » et
      // ne doivent pas être confondues avec une absence de données. Un effectif
      // nul affiche « 0 % ».
      const pct = total > 0 ? (n / total) * 100 : 0;
      const shown = esc(pct2(pct)) + ' %';
      return [
        '<div class="pzc-leg">',
        '  <span class="pzc-dot" style="background:' + part.color + '"></span>',
        '  <span class="pzc-leg-name">' + esc(part.label) + '</span>',
        '  <span class="pzc-leg-n">' + esc(int(n)) + '</span>',
        '  <span class="pzc-leg-pct">' + shown + '</span>',
        '</div>'
      ].join('');
    }).join('');

    // Le total des bénéficiaires n'est plus répété dans les trois en-têtes : il
    // figure une seule fois, dans la bande de descriptif du marché. Dans des
    // colonnes d'un tiers de largeur, ce doublon volait la place du titre.
    return [
      '<div class="pzc-barblock">',
      '  <div class="pzc-barblock-head"><span>' + esc(title) + '</span></div>',
      stackedBar(parts, total),
      '  <div class="pzc-legend">' + rows + '</div>',
      '</div>'
    ].join('');
  }

  setupDataStamp() {
    const el = document.getElementById('data-stamp');
    if (!el) return;
    const total = this.stats.total || 0;
    el.textContent = `${total.toLocaleString('fr-FR')} entités · source GeoJSON du 09/10/2026 · jeu public pseudonymisé`;
  }
}

function describeStep(etape) {
  switch (etape.action) {
    case 'flyTo': return `cadrage sur ${etape.target}`;
    case 'showLayer': return `affichage de ${etape.layer}`;
    case 'hideLayer': return `masquage de ${etape.layer}`;
    case 'staggeredAppear': return `apparition progressive (${etape.layer})`;
    case 'extrude': return `extrusion 3D (${etape.layer})`;
    case 'drawFlux': return `tracé des liaisons ${etape.from} → ${etape.to} (potentielles)`;
    case 'drawProgressive': return `tracé progressif (${etape.layer})`;
    case 'showPopup': return 'affichage de la fiche';
    case 'wait': return 'pause';
    case 'reset': return 'réinitialisation';
    default: return etape.action;
  }
}
