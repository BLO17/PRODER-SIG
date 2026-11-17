// layers.js — Gestion des couches MapLibre
import { CONFIG } from './config.js';

/** Emprise carrée (polygone) autour d'une parcelle, pour l'extrusion 3D.
 *  Une couche fill-extrusion n'accepte pas de géométrie ponctuelle. */
function plantationPads(features) {
  const padFeatures = [];
  for (const f of features) {
    const c = f.properties._coords || (f.geometry?.type === 'Point' ? f.geometry.coordinates : null);
    if (!c) continue;
    const sup = f.properties._sup || 0.5;
    const half = Math.max(0.0008, Math.sqrt(Math.max(sup, 0.1)) * 0.0012);
    const [lon, lat] = c;
    padFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lon - half, lat - half],
          [lon + half, lat - half],
          [lon + half, lat + half],
          [lon - half, lat + half],
          [lon - half, lat - half]
        ]]
      },
      properties: f.properties
    });
  }
  return padFeatures;
}

export class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = new Map();
    this.sources = new Map();
    this.visible = new Set();
    this.initialVisible = [];
  }

  addSource(id, data) {
    if (this.map.getSource(id)) return;
    this.map.addSource(id, { type: 'geojson', data });
    this.sources.set(id, data);
  }

  /**
   * Couches de surbrillance : elles ne sont PAS gérées par la visibilité.
   *
   * `hideAll()` masque toutes les couches enregistrées ; si les couches de
   * sélection y figuraient, elles étaient masquées au démarrage et plus rien
   * ne les rallumait — d'où une surbrillance invisible quel que soit le clic.
   * Elles sont donc créées hors du registre, et pilotées uniquement par leur
   * filtre.
   */
  static isOverlay(id) {
    return id === 'perimetres-selected-fill' || id === 'perimetres-selected-line' ||
      id === 'mer-units-selected' || id === 'pistes-selected-line' ||
      id === 'tamkin-selected-symbol' || id === 'mfr-commune-hl' ||
      id === 'mfr-commune-hl-glow' || id === 'mfr-points' || id === 'mfr-points-glow';
  }

  addLayer(id, config) {
    if (this.map.getLayer(id)) return;
    this.map.addLayer(config);
    if (!LayerManager.isOverlay(id)) this.layers.set(id, config);
  }

  setupLayers(features) {
    const byCat = {};
    for (const f of features) {
      const cat = f.properties._category;
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(f);
    }

    const makeFC = (feats) => ({
      type: 'FeatureCollection',
      features: (feats || []).filter(f => f.geometry && f.geometry.type)
    });

    // Sources
    this.addSource('plantations', makeFC(byCat.C1));
    this.addSource('plantations-3d', makeFCFromPads(byCat.C1));
    this.addSource('ravins', makeFC(byCat.C2));
    this.addSource('seuils', makeFC(byCat.C3));
    this.addSource('sous-bassins', makeFC(byCat.C4));
    this.addSource('pistes', makeFC(byCat.C5));
    this.addSource('uv', makeFC(byCat.C6));
    this.addSource('pfc', makeFC(byCat.C7));
    this.addSource('mer', makeFC(byCat.C8));
    // Valorisation — MER : la source « mer-units » est créée par initMER()
    // AVEC SES DONNÉES (v j) — une source créée vide puis alimentée par
    // setData avant le chargement du style perdait ses données (bug 25/10).
    this.addSource('cooperatives', makeFC(byCat.C9));
    this.addSource('tamkin', makeFC(byCat.C10));
    this.addSource('mfr', makeFC(byCat.C11));
    this.addSource('communes', makeFC(byCat.C12));
    this.addSource('references', makeFC(byCat.C13));
    this.addSource('perimetres', makeFC(byCat.C14));
    this.addSource('bassins', makeFC(byCat.C15));

    // --- Ordre d'affichage : fonds, lignes, puis points ---

    // Communes
    this.addLayer('communes-fill', {
      id: 'communes-fill', type: 'fill', source: 'communes',
      paint: { 'fill-color': '#455A64', 'fill-opacity': 0.12 }
    });
    this.addLayer('communes-outline', {
      id: 'communes-outline', type: 'line', source: 'communes',
      paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 1 }
    });

    // Bassins versants (6 grands bassins)
    const basinColor = ['match', ['get', 'name'],
      'BV O.Kert', '#AC7C0B',
      'BV Ouergha', '#46E4AB',
      'BV Nekour', '#55FAE6',
      "BV O.M'soun", '#C5D2F3',
      'BV INNAOUEN', '#959D85',
      'BV Lben', '#65AA82',
      '#0D47A1'];
    this.addLayer('bassins-fill', {
      id: 'bassins-fill', type: 'fill', source: 'bassins',
      paint: { 'fill-color': basinColor, 'fill-opacity': 0.10 }
    });
    this.addLayer('bassins-outline', {
      id: 'bassins-outline', type: 'line', source: 'bassins',
      paint: { 'line-color': '#0D47A1', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.7 }
    });

    // Sous-bassins
    this.addLayer('sous-bassins-fill', {
      id: 'sous-bassins-fill', type: 'fill', source: 'sous-bassins',
      paint: { 'fill-color': '#1A237E', 'fill-opacity': 0.22 }
    });
    this.addLayer('sous-bassins-outline', {
      id: 'sous-bassins-outline', type: 'line', source: 'sous-bassins',
      paint: { 'line-color': '#1A237E', 'line-width': 1.2, 'line-opacity': 0.6 }
    });
    this.addLayer('sous-bassins-extrusion', {
      id: 'sous-bassins-extrusion', type: 'fill-extrusion', source: 'sous-bassins',
      paint: {
        'fill-extrusion-color': '#1A237E',
        'fill-extrusion-height': 0,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.5
      }
    });

    // Polygones de plantation (périmètres sous marché) — couleur par filière
    const polyColor = ['match', ['get', '_filierePoly'],
      'Plantation Amandier', CONFIG.filiereColors['Plantation Amandier'],
      'Plantation Figuier', CONFIG.filiereColors['Plantation Figuier'],
      'Plantation Caroubier', CONFIG.filiereColors['Plantation Caroubier'],
      'Plantation Olivier', CONFIG.filiereColors['Plantation Olivier'],
      '#8D6E63'];
    // Aucun filtre « marché sans données » : la liste des marchés est portée
    // par la source, elle est donc affichée intégralement. (Voir la remarque
    // dans l'audit : ce filtre faisait disparaître des marchés de la carte.)
    this.addLayer('perimetres-fill', {
      id: 'perimetres-fill', type: 'fill', source: 'perimetres',
      paint: {
        'fill-color': polyColor,
        'fill-opacity': 0.4,
        'fill-outline-color': polyColor
      }
    });
    this.addLayer('perimetres-outline', {
      id: 'perimetres-outline', type: 'line', source: 'perimetres',
      // AUCUN FILTRE. Tout polygone de marché fourni par la source de référence
      // est dessiné, sans exception. Le filtre précédent retirait les marchés
      // dépourvus de lignes de plantation : c'est lui qui faisait disparaître
      // une partie des marchés de la carte, alors que la liste des marchés est
      // portée par la source elle-même.
      paint: {
        'line-color': polyColor,
        'line-width': 1.8,
        'line-opacity': 0.9
      }
    });
    // Surbrillance : UNE SEULE couche, filtrée sur le polygone sélectionné.
    // Le survol ne modifie plus rien — seule la sélection éclaire.
    this.addLayer('perimetres-selected-fill', {
      id: 'perimetres-selected-fill', type: 'fill', source: 'perimetres',
      filter: ['==', ['get', '_marcheKey'], '__aucun__'],
      paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.28 }
    });
    this.addLayer('perimetres-selected-line', {
      id: 'perimetres-selected-line', type: 'line', source: 'perimetres',
      filter: ['==', ['get', '_marcheKey'], '__aucun__'],
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 3.5,
        'line-opacity': 1
      }
    });

    // Seuils CES (tronçons linéaires)
    this.addLayer('seuils-line', {
      id: 'seuils-line', type: 'line', source: 'seuils',
      paint: {
        'line-color': ['match', ['get', '_influence'],
          'Grande Influence', CONFIG.influenceColors['Grande Influence'],
          'Moyenne influence', CONFIG.influenceColors['Moyenne influence'],
          'faible influence', CONFIG.influenceColors['faible influence'],
          '#F57C00'],
        'line-width': ['interpolate', ['linear'], ['coalesce', ['get', '_volume'], 0], 0, 1, 100, 2, 1000, 5],
        'line-opacity': 0.85
      }
    });

    // Pistes sous marché (couleur par cercle : Tainaste en bleu clair)
    this.addLayer('pistes-line', {
      id: 'pistes-line', type: 'line', source: 'pistes',
      paint: {
        'line-color': ['match', ['get', '_cercle'], 'TAINASTE', CONFIG.typeColors.pisteTainaste, CONFIG.typeColors.piste],
        'line-width': 2.5,
        'line-opacity': 0.85
      }
    });
    // Surbrillance de la piste sélectionnée (orange, plus épaisse)
    this.addLayer('pistes-selected-line', {
      id: 'pistes-selected-line', type: 'line', source: 'pistes',
      filter: ['==', ['get', '_marche'], '__aucun__'],
      paint: {
        'line-color': '#FF9800',
        'line-width': 4.5,
        'line-opacity': 1
      }
    });

    // Plantations — extrusion 3D (pads polygonaux)
    this.addLayer('plantations-extrusion', {
      id: 'plantations-extrusion', type: 'fill-extrusion', source: 'plantations-3d',
      paint: {
        'fill-extrusion-color': ['match', ['get', '_filiere'],
          'Plantation Amandier', CONFIG.filiereColors['Plantation Amandier'],
          'Plantation Figuier', CONFIG.filiereColors['Plantation Figuier'],
          'Plantation Caroubier', CONFIG.filiereColors['Plantation Caroubier'],
          'Plantation Olivier', CONFIG.filiereColors['Plantation Olivier'],
          '#4CAF50'],
        'fill-extrusion-height': 0,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.75
      }
    });

    // Coopératives, MER, TAMKIN, MFR
    this.addLayer('cooperatives-circle', {
      id: 'cooperatives-circle', type: 'circle', source: 'cooperatives',
      paint: {
        'circle-radius': 3.5,
        'circle-color': CONFIG.typeColors.cooperative,
        'circle-opacity': 0.6
      }
    });
    // Les adhérents MER ne sont PLUS dessinés (demande du responsable) :
    // seule l'unité (point principal) est affichée ; les 214 adhérents restent
    // en données (fiche, compteurs, bornes du recentrage).
    // TAMKIN — logo sur la carte (remplace le cercle). Option B validée
    // (demande du responsable) : même comportement que les marqueurs MER.
    // - Source RECADRÉE `logo-tamkin-pin.png` (248×292 px, glyphe + liseré
    //   blanc cuit, marge PAD=16 tout autour) : la pointe touche la
    //   coordonnée via icon-offset [0, 16] (multiplié par icon-size),
    //   exactement comme le pin MER recadré.
    // - icon-size PROPORTIONNEL AU ZOOM, échelle MER exacte
    //   h(z) = 48 × clamp(0.5 × 2^((z-9)/4), .35, 1.7) :
    //   z9 = 24 px (moitié de sélection), z13 = 48 px (référence),
    //   z17 = 81.6 px (plateau de la borne 1.70).
    // - SURBRILLANCE au clic (demande du responsable) : réplique du filtre
    //   CSS `.mer-marker-selected` des marqueurs MER (3 drop-shadow orange
    //   #FF9800 / rgba(255,152,0,.85) + ombre sombre) cuite dans
    //   `logo-tamkin-pin-sel.png` (328x372, même glyphe 216x260 au centre).
    //   Cuite dans l'image, la surbrillance garde la même proportion à
    //   tous les zooms — exactement comme le drop-shadow CSS côté MER.
    //   Repli : pin simple si l'image halo ne charge pas.
    const logoTamkin = new Image();
    logoTamkin.src = 'logo-tamkin-pin.png';
    const logoTamkinSel = new Image();
    logoTamkinSel.src = 'logo-tamkin-pin-sel.png';
    let baseSettled = false, selSettled = false, selOk = false;
    logoTamkinSel.onload = () => { selSettled = true; selOk = true; buildTamkinLayers(); };
    logoTamkinSel.onerror = () => { selSettled = true; buildTamkinLayers(); };
    const buildTamkinLayers = () => {
      if (!baseSettled || !selSettled) return;
      if (!this.map.hasImage('logo-tamkin')) this.map.addImage('logo-tamkin', logoTamkin);
      if (selOk && !this.map.hasImage('logo-tamkin-sel')) this.map.addImage('logo-tamkin-sel', logoTamkinSel);
      if (!this.map.getLayer('tamkin-symbol')) {
        this.addLayer('tamkin-symbol', {
          id: 'tamkin-symbol', type: 'symbol', source: 'tamkin',
          layout: {
            'icon-image': 'logo-tamkin',
            // glyphe 260 px : arrêts = hauteur cible / 260 (24 / 48 / 81.6 px)
            'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 9, 0.0923, 13, 0.1846, 17, 0.3138],
            // 16 px transparents sous la pointe (marge du liseré) →
            // décalage vers le bas, lui aussi proportionnel à icon-size.
            'icon-offset': [0, 16],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-rotation-alignment': 'viewport',
            // Masqué au départ : c'est le bouton on/off du panneau gauche
            // (TAMKIN) qui l'allume, comme les autres calques.
            'visibility': 'none'
          },
          paint: { 'icon-opacity': 0.9 }
        });
      }
      if (!this.map.getLayer('tamkin-selected-symbol')) {
        this.map.addLayer({
          id: 'tamkin-selected-symbol', type: 'symbol', source: 'tamkin',
          filter: ['==', ['get', '_rowId'], '__aucun__'],
          layout: {
            // Surbrillance = halo orange cuit (équivalent `.mer-marker-selected`),
            // repli sur le pin simple si l'image halo est absente.
            'icon-image': selOk ? 'logo-tamkin-sel' : 'logo-tamkin',
            // Sélection = ×1.2 (ratio identique à l'ancien 0.03/0.025)
            'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 9, 0.1108, 13, 0.2215, 17, 0.3766],
            // Marge transparente SOUS le glyphe : 56 px image halo, 16 px pin.
            'icon-offset': selOk ? [0, 56] : [0, 16],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-rotation-alignment': 'viewport'
          },
          paint: { 'icon-opacity': 1 }
        });
      }
    };
    logoTamkin.onload = () => { baseSettled = true; buildTamkinLayers(); };
    logoTamkin.onerror = () => {
      // Fallback : cercle si l'image ne charge pas
      this.addLayer('tamkin-circle', {
        id: 'tamkin-circle', type: 'circle', source: 'tamkin',
        paint: {
          'circle-radius': 6,
          'circle-color': CONFIG.typeColors.tamkin,
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.3)'
        }
      });
    };
    this.addLayer('mfr-circle', {
      id: 'mfr-circle', type: 'circle', source: 'mfr',
      paint: {
        'circle-radius': 7,
        'circle-color': ['match', ['get', '_formation'], 'ARBORICULTURE', CONFIG.typeColors.mfr, 'APICULTURE', '#8BC34A', '#558B2F'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Plantations (points)
    this.addLayer('plantations-circle', {
      id: 'plantations-circle', type: 'circle', source: 'plantations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', '_sup'], 0], 0, 3, 1, 4.5, 2, 6, 5, 9, 10, 12],
        'circle-color': ['match', ['get', '_filiere'],
          'Plantation Amandier', CONFIG.filiereColors['Plantation Amandier'],
          'Plantation Figuier', CONFIG.filiereColors['Plantation Figuier'],
          'Plantation Caroubier', CONFIG.filiereColors['Plantation Caroubier'],
          'Plantation Olivier', CONFIG.filiereColors['Plantation Olivier'],
          '#4CAF50'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(255,255,255,0.35)'
      }
    });

    // Ravins
    this.addLayer('ravins-circle', {
      id: 'ravins-circle', type: 'circle', source: 'ravins',
      paint: {
        'circle-radius': 6,
        'circle-color': CONFIG.typeColors.ravin,
        'circle-opacity': 0.9,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });

    // Références / autres
    this.addLayer('references-circle', {
      id: 'references-circle', type: 'circle', source: 'references',
      paint: { 'circle-radius': 3, 'circle-color': CONFIG.typeColors.commune, 'circle-opacity': 0.35 }
    });

    // UV et PFC au-dessus
    this.addLayer('uv-circle', {
      id: 'uv-circle', type: 'circle', source: 'uv',
      paint: {
        'circle-radius': 10,
        'circle-color': CONFIG.typeColors.uv,
        'circle-opacity': 0.95,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
    this.addLayer('pfc-circle', {
      id: 'pfc-circle', type: 'circle', source: 'pfc',
      paint: {
        'circle-radius': 12,
        'circle-color': CONFIG.typeColors.pfc,
        'circle-opacity': 0.95,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Les calques MER (mer-units-*) sont créés par initMER()/_addMERLayers()
    // (v j) : ils dépendent de la source « mer-units », qui n'existe qu'après
    // l'alimentation par initMER.
    // Les couches de surbrillance perimetres-selected-* sont créées au milieu
    // des autres : on les remonte au premier plan pour qu'elles ne soient
    // jamais recouvertes par une couche ajoutée après elles.
    for (const id of ['perimetres-selected-fill', 'perimetres-selected-line']) {
      if (this.map.getLayer(id)) this.map.moveLayer(id);
    }

    // État initial : lecture par les polygones de plantation (couleur par
    // filière). Les points individuels restent disponibles dans la liste des
    // composantes, mais ne sont plus affichés par défaut.
    this.hideAll();
    this.show('communes-fill');
    this.show('communes-outline');
    this.show('perimetres-fill');
    this.show('perimetres-outline');
    // Les calques MER affichés par défaut sont ajoutés (et inscrits dans
    // initialVisible) par initMER() — v j : le jeu de calques MER est créé
    // après setupLayers, avec sa source déjà alimentée.
    this.initialVisible = [...this.visible];
  }

  show(layerId) {
    if (this.map.getLayer(layerId)) {
      this.map.setLayoutProperty(layerId, 'visibility', 'visible');
      this.visible.add(layerId);
    }
  }

  hide(layerId) {
    if (this.map.getLayer(layerId)) {
      this.map.setLayoutProperty(layerId, 'visibility', 'none');
      this.visible.delete(layerId);
    }
  }

  hideAll() {
    for (const [id] of this.layers) this.hide(id);
  }

  toggle(layerId) {
    if (this.visible.has(layerId)) this.hide(layerId);
    else this.show(layerId);
  }

  isVisible(layerId) {
    return this.visible.has(layerId);
  }

  getVisible() {
    return [...this.visible];
  }

  /** Groupe de couches à activer/désactiver ensemble. */
  showGroup(layerId, on) {
    const groups = {
      'plantations-circle': ['plantations-circle', 'plantations-extrusion'],
      'sous-bassins-fill': ['sous-bassins-fill', 'sous-bassins-outline', 'sous-bassins-extrusion'],
      'perimetres-fill': ['perimetres-fill', 'perimetres-outline'],
      'bassins-fill': ['bassins-fill', 'bassins-outline'],
      // PFC / UV : le nom du « groupe » n'est pas l'id du calque MapLibre.
      // Sans ces entrées, `groups[id]` valait undefined → repli sur ['pfc'] /
      // ['uv'], qui ne correspondent à AUCUN calque : le on/off ne faisait
      // donc rien du tout sur la carte.
      'pfc': ['pfc-circle'],
      'uv': ['uv-circle'],
      'tamkin-symbol': ['tamkin-symbol', 'tamkin-selected-symbol'],
      'mer-units': []
    };
    for (const id of groups[layerId] || [layerId]) {
      if (on) this.show(id); else this.hide(id);
    }
    // Les marqueurs DOM PFC/UV SONT l'affichage de ces couches : on les
    // synchronise avec le même on/off pour que le visuel suive toujours.
    if (layerId === 'pfc') { this._syncPFCMarkers(); }
    if (layerId === 'uv')  { this._syncUVMarkers(); }
    // Un calque plantation (re)activé globalement reprend le filtre marché
    // courant — il ne revient jamais « tout visible » si un marché est éteint.
    if (on && (layerId === 'plantations-circle' || layerId === 'perimetres-fill')) this._applyMarcheData();
    // Groupe MER — comportement UNIFIÉ avec Arboriculture : réactiver la
    // famille RÉ-ALIMENTE les sources (setData) et remonte au premier plan :
    // si une sous-couche avait vidé la source (unités éteintes), elle
    // « répond » de nouveau à la carte, comme les marchés plantation.
    if (on && layerId === 'mer-units') {
      this._applyMERData();
      this._syncMERMarkers();
    }
  }


  // ----------------------------------------------------------- filtres marché
  /**
   * Filtre par marché du calque plantation (périmètres + lignes + pads 3D).
   *
   * Le menu de gestion organise l'arboriculture par filière → année → marché :
   * désactiver un marché n'éteint que les ENTITÉS de ce marché — la logique
   * d'affichage (couleur par filière, fond, contour, extrusion 3D) reste
   * strictement inchangée pour le reste.
   */

  /**
   * CORRESPONDANCE menu gauche ↔ calques plantation — niveau SOURCES.
   *
   * L'état on/off de chaque marché est appliqué en REDONNANT LES DONNÉES DES
   * SOURCES (setData), et non en posant un filtre de COUCHE. C'est
   * indispensable : l'AnimationEngine (scénarios, frise chronologique) pose
   * SA PROPRE setFilter sur ces mêmes couches et un filtre marché de niveau
   * couche serait écrasé au premier changement de scénario — le switch
   * « ne ferait plus rien ». Au niveau des sources, les deux logiques
   * coexistent naturellement : ce qui est DONNÉ (source) est ensuite filtré
   * par les couches (scénario) — intersection exacte, pas de collision.
   */
  initPlantationMarches(features) {
    this._plantC1 = (features || []).filter((f) => f.properties?._category === 'C1');
    this._plantC14 = (features || []).filter((f) => f.properties?._category === 'C14');
    this._onMarches = new Set(
      [...new Set([...this._plantC1, ...this._plantC14]
        .map((f) => f.properties?._marcheKey).filter(Boolean))]
    );
    this._totalMarches = this._onMarches.size;
    this._applyMarcheData();
  }

  setMarchesVisible(keys, on) {
    if (!this._onMarches) return;
    for (const k of keys || []) {
      if (on) this._onMarches.add(k); else this._onMarches.delete(k);
    }
    this._applyMarcheData();
  }

  /** Public : re-pour les données plantation (après rechargement de la carte). */
  applyPlantationMarchesFilters() {
    this._applyMarcheData();
  }

  marcheIsOn(key) {
    if (!this._onMarches) return true;
    return key ? this._onMarches.has(key) : true;
  }

  _applyMarcheData() {
    if (!this._plantC1) return;
    const keep = (f) => {
      const k = f.properties?._marcheKey;
      return k ? this._onMarches.has(k) : true; // sans marché = toujours montré
    };
    const c1 = this._plantC1.filter(keep);
    const c14 = this._plantC14.filter(keep);
    const fc = (feats) => ({ type: 'FeatureCollection', features: feats });
    const pour = (srcId, data) => {
      const s = this.map.getSource(srcId);
      if (s) s.setData(data);
    };
    pour('plantations', fc(c1));
    pour('plantations-3d', makeFCFromPads(c1));
    pour('perimetres', fc(c14));
    console.debug('[plantation] marché :', c1.length, 'lignes /', c14.length, 'périmètres affichés (', this._onMarches.size + '/' + this._allMarchesCount() + ' marchés actifs )');
  }

  _allMarchesCount() {
    return this._totalMarches ?? 0;
  }

  // ----------------------------------------------------------- pistes on/off
  initPistes(features) {
    this._pisteFeatures = (features || []).filter((f) => f.properties?._category === 'C5');
    this._pisteOn = new Set(this._pisteFeatures.map((f) => f.properties?._marche).filter(Boolean));
    this._applyPisteData();
    // Les pistes sont visibles dès le départ (calque + surbrillance).
    this.show('pistes-line');
    this.show('pistes-selected-line');
    if (!this.initialVisible.includes('pistes-line')) this.initialVisible.push('pistes-line');
  }
  setPisteVisible(keys, on) {
    if (!this._pisteOn) return;
    for (const k of keys || []) {
      if (on) this._pisteOn.add(k); else this._pisteOn.delete(k);
    }
    this._applyPisteData();
  }
  pisteIsOn(key) {
    return !this._pisteOn || (key ? this._pisteOn.has(key) : true);
  }
  _applyPisteData() {
    if (!this._pisteFeatures) return;
    const keep = (f) => {
      const k = f.properties?._marche;
      return k ? this._pisteOn.has(k) : true;
    };
    const fc = { type: 'FeatureCollection', features: this._pisteFeatures.filter(keep) };
    const s = this.map.getSource('pistes');
    if (s) s.setData(fc);
  }
  setPisteSelection(marche) {
    const layer = this.map.getLayer('pistes-selected-line');
    if (!layer) return;
    if (!marche) {
      this.map.setFilter('pistes-selected-line', ['==', ['get', '_marche'], '__aucun__']);
      return;
    }
    this.map.setFilter('pistes-selected-line', ['==', ['get', '_marche'], marche]);
  }

  /** Surbrillance d'une classe TAMKIN sélectionnée : le logo passe en taille
   *  plus grande et devient opaque (orange halo via la couche dédiée).
   *  `null` = désélection. */
  setTamkinSelection(rowId) {
    const layer = this.map.getLayer('tamkin-selected-symbol');
    if (!layer) return;
    if (!rowId) {
      this.map.setFilter('tamkin-selected-symbol', ['==', ['get', '_rowId'], '__aucun__']);
      return;
    }
    this.map.setFilter('tamkin-selected-symbol', ['==', ['get', '_rowId'], rowId]);
  }

  // ------------------------------------- tamkin — communes (niveau données)
  /**
   * Visibilité des classes TAMKIN par commune du menu (modèle Pistes /
   * Arboriculture : setData sur la source, JAMAIS de filtre de couche —
   * l'AnimationEngine possède les filtres de couche). `_tkCommune` est posé
   * par le loader : graphie `CT` normalisée vers le nom du calque communes,
   * ou commune de recoupement géographique pour les 6 classes sans `CT`.
   * Tous ON au démarrage ; racine OFF = source vide (re-allumage instantané).
   */
  initTamkinCommunes(features) {
    this._tamkinFeats = (features || []).filter((f) => f.properties?._category === 'C10');
    // Toutes les communes démarrent OFF : le calque TAMKIN est caché au
    // démarrage (comportement historique de la pilule C10) — la source
    // vide correspond exactement à ce que montre la carte. Racine, cercle
    // ou commune : tout rallumage ré-alimente les données (modèle pistes).
    this._onTamkinCommunes = new Set();
    this._applyTamkinData();
  }

  setTamkinCommunesVisible(keys, on) {
    if (!this._onTamkinCommunes) return;
    for (const k of keys || []) {
      if (on) this._onTamkinCommunes.add(k); else this._onTamkinCommunes.delete(k);
    }
    this._applyTamkinData();
  }

  tamkinCommuneIsOn(key) {
    return !this._onTamkinCommunes || (key ? this._onTamkinCommunes.has(key) : true);
  }

  _applyTamkinData() {
    if (!this._tamkinFeats) return;
    const fc = {
      type: 'FeatureCollection',
      features: this._tamkinFeats.filter((f) => this.tamkinCommuneIsOn(f.properties?._tkCommune))
    };
    const s = this.map.getSource('tamkin');
    if (s) s.setData(fc);
  }

  // ------------------------------------- MFR — surbrillance commune (agrégats)
  /**
   * Volet MFR (demande du responsable, 15/11) : la navigation Tranche →
   * Spécialité → Commune n'affiche AUCUN point bénéficiaire par défaut.
   * Au clic d'une commune : surbrillance du CONTOUR (2 calques ligne posés
   * sur la source « communes » existante) + fiche d'agrégats en bas.
   * Zoom sur la commune à la sélection (décision du responsable, 17/11/2026) :
   * fitBounds différé de 300 ms (correctif caméra MapLibre 3.6.2), maxZoom 11.5.
   * Les géométries des communes sont gardées ici pour la jointure spatiale
   * des emplacements (cf. setMFRBenefPoints).
   */
  initMFRCommunes(features) {
    this._mfrCommuneGeom = {};
    let x0, y0, x1, y1;
    for (const f of features || []) {
      const p = f.properties || {};
      if (p._category !== 'C12') continue;
      const nm = p.name;
      if (!nm || this._mfrCommuneGeom[nm]) continue;
      this._mfrCommuneGeom[nm] = f.geometry;
      const pts = [];
      const walk = (o) => {
        if (!Array.isArray(o)) return;
        if (o.length >= 2 && typeof o[0] === 'number') { pts.push(o); return; }
        for (const x of o) walk(x);
      };
      walk(f.geometry && f.geometry.coordinates);
      for (const c of pts) {
        x0 = x0 === undefined ? c[0] : Math.min(x0, c[0]);
        y0 = y0 === undefined ? c[1] : Math.min(y0, c[1]);
        x1 = x1 === undefined ? c[0] : Math.max(x1, c[0]);
        y1 = y1 === undefined ? c[1] : Math.max(y1, c[1]);
      }
    }
    // Emprise du périmètre (marge 0,05° ≈ 5 km) : garde-fou des emplacements
    // — écarte les géocodages aberrants (27 points « Msila » à X ≈ -2,49).
    if (x0 !== undefined) this._mfrZone = { x0, y0, x1, y1 };
  }

  _mfrInZone(lon, lat) {
    const z = this._mfrZone;
    if (!z) return false;
    const m = 0.05;
    return lon >= z.x0 - m && lon <= z.x1 + m && lat >= z.y0 - m && lat <= z.y1 + m;
  }

  highlightMFRCommune(name) {
    if (!this.map.getSource('communes')) return;
    const key = name || '__aucune__';
    this._mfrCurKey = key;
    if (this._mfrFitT) { clearTimeout(this._mfrFitT); this._mfrFitT = null; }
    const ensure = (id, conf) => {
      if (!this.map.getLayer(id)) this.addLayer(id, conf);
    };
    ensure('mfr-commune-hl-glow', {
      id: 'mfr-commune-hl-glow', type: 'line', source: 'communes',
      filter: ['==', ['get', 'name'], key],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#558B2F', 'line-width': 12, 'line-opacity': 0.22 }
    });
    ensure('mfr-commune-hl', {
      id: 'mfr-commune-hl', type: 'line', source: 'communes',
      filter: ['==', ['get', 'name'], key],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#7CB342', 'line-width': 3.5, 'line-opacity': 1 }
    });
    this.map.setFilter('mfr-commune-hl-glow', ['==', ['get', 'name'], key]);
    this.map.setFilter('mfr-commune-hl', ['==', ['get', 'name'], key]);
    // Zoom sur la commune sélectionnée (décision du responsable, 17/11/2026) :
    // fitBounds différé de 300 ms — MapLibre 3.6.2 ignore un cadrage lancé dans
    // le même tick que addLayer (diagnostic 16/11) ; le garde _mfrCurKey annule
    // le mouvement si la sélection change entre-temps.
    // Cadre = UNION du contour et des emplacements de la commune : le champ
    // CT de la source prime sur la position (rattachement validé) et des
    // bénéficiaires peuvent tomber légèrement hors du polygone officiel —
    // sans l'union, les points verts resteraient hors champ après le zoom.
    if (!name) return;
    const gm = this._mfrCommuneGeom && this._mfrCommuneGeom[name];
    if (!gm) return;
    let x0, y0, x1, y1;
    const walk = (o) => {
      if (!Array.isArray(o)) return;
      if (o.length >= 2 && typeof o[0] === 'number') {
        x0 = x0 === undefined ? o[0] : Math.min(x0, o[0]);
        y0 = y0 === undefined ? o[1] : Math.min(y0, o[1]);
        x1 = x1 === undefined ? o[0] : Math.max(x1, o[0]);
        y1 = y1 === undefined ? o[1] : Math.max(y1, o[1]);
        return;
      }
      for (const x of o) walk(x);
    };
    const gs = gm.type === 'GeometryCollection' ? (gm.geometries || []) : [gm];
    for (const g of gs) walk(g.coordinates);
    if (x0 === undefined) return;
    const fitOpts = { padding: 70, duration: 800, maxZoom: 11.5, essential: true };
    this._mfrFitT = setTimeout(() => {
      this._mfrFitT = null;
      if (this._mfrCurKey !== key || !this.map.getSource('communes')) return;
      // Étend le cadre aux emplacements de CETTE commune (tous tid/sid).
      let bx0 = x0, by0 = y0, bx1 = x1, by1 = y1;
      this.ensureMFRPointsSource().then((fc) => {
        for (const f of fc.features || []) {
          if ((f.properties || {}).commune !== name) continue;
          const c = f.geometry && f.geometry.coordinates;
          if (!c) continue;
          bx0 = Math.min(bx0, c[0]); by0 = Math.min(by0, c[1]);
          bx1 = Math.max(bx1, c[0]); by1 = Math.max(by1, c[1]);
        }
        this.map.fitBounds([[bx0, by0], [bx1, by1]], fitOpts);
      }).catch(() => { this.map.fitBounds([[x0, y0], [x1, y1]], fitOpts); });
    }, 300);
  }

  // ─── MFR — emplacements des bénéficiaires (points verts, AFFICHAGE AU
  // CHOIX, décision du responsable 15/11/2026) ─────────────────────────────
  // Source dépersonnalisée data/mfr-points.geojson (code technique +
  // tranche/spécialité/commune — AUCUN identifiant, CIN, nom ni âge). Le
  // filtre suit le MÊME rattachement que les agrégats de la fiche (commune
  // par CT normalisé) et écarte par l'emprise du périmètre les 27 points
  // géocodés hors zone (Msila). Emplacements muets (aucun tooltip
  // identitaire) : la fiche d'agrégats reste la source d'information.
  async ensureMFRPointsSource() {
    if (this._mfrPointsData) return this._mfrPointsData;
    try {
      const res = await fetch('data/mfr-points.geojson');
      if (!res.ok) throw new Error('mfr-points introuvable');
      this._mfrPointsData = await res.json();
    } catch (_) {
      this._mfrPointsData = { type: 'FeatureCollection', features: [] };
    }
    if (!this.map.getSource('mfr-points')) this.addSource('mfr-points', this._mfrPointsData);
    return this._mfrPointsData;
  }

  _mfrInCommune(lon, lat, gm) {
    if (!gm) return false;
    const inRing = (ring) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const x1 = ring[i][0], y1 = ring[i][1];
        const x2 = ring[j][0], y2 = ring[j][1];
        if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / ((y2 - y1) || 1e-12) + x1) ins = !ins;
      }
      return ins;
    };
    const inPoly = (poly) => inRing(poly[0]) && !poly.slice(1).some(inRing);
    if (gm.type === 'Polygon') return inPoly(gm.coordinates);
    if (gm.type === 'MultiPolygon') return gm.coordinates.some(inPoly);
    if (gm.type === 'GeometryCollection') return (gm.geometries || []).some((g) => this._mfrInCommune(lon, lat, g));
    return false;
  }

  /**
   * Affiche/masque les emplacements des bénéficiaires de la commune
   * sélectionnée pour la (tranche, spécialité) courante. `on` = afficher.
   * Renvoie la promesse du nombre de points affichés (0 si aucun).
   */
  setMFRBenefPoints(tid, sid, commune, on) {
    const empty = { type: 'FeatureCollection', features: [] };
    if (!on) {
      const s0 = this.map.getSource('mfr-points');
      if (s0) s0.setData(empty);
      return Promise.resolve(0);
    }
    return this.ensureMFRPointsSource().then((fc) => {
      const sel = {
        type: 'FeatureCollection',
        features: (fc.features || []).filter((f) => {
          const p = f.properties || {};
          // MÊME rattachement que les agrégats de la fiche (commune par CT
          // normalisé) : les emplacements affichés coïncident avec les
          // compteurs H/F/Jeunes de la fiche — puis garde-fou d'emprise.
          if (p.tid !== tid || p.sid !== sid) return false;
          if (p.commune !== commune) return false;
          const c = f.geometry && f.geometry.coordinates;
          if (!c) return false;
          return this._mfrInZone(c[0], c[1]);
        })
      };
      const s = this.map.getSource('mfr-points');
      if (s) s.setData(sel);
      const ensure = (id, conf) => { if (!this.map.getLayer(id)) this.addLayer(id, conf); };
      ensure('mfr-points-glow', {
        id: 'mfr-points-glow', type: 'circle', source: 'mfr-points',
        paint: { 'circle-color': '#A3E635', 'circle-radius': 11, 'circle-opacity': 0.35, 'circle-blur': 0.55 }
      });
      ensure('mfr-points', {
        id: 'mfr-points', type: 'circle', source: 'mfr-points',
        paint: { 'circle-color': '#A3E635', 'circle-radius': 6.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.4 }
      });
      if (!this._mfrCursorWired) {
        this._mfrCursorWired = true;
        this.map.on('mouseenter', 'mfr-points', () => { this.map.getCanvas().style.cursor = 'pointer'; });
        this.map.on('mouseleave', 'mfr-points', () => { this.map.getCanvas().style.cursor = ''; });
      }
      this._mfrPointsCount = sel.features.length;
      return sel.features.length;
    });
  }

  // -------------------------------------------- valorisation — MER
  /**
   * Alimentation des sources MER au NIVEAU DONNÉES (setData), à l'image de la
   * bascule marché du calque plantation : l'unité n'étant pas une entité de la
   * source, la source « mer-units » reçoit les centroïdes calculés
   * (js/valorisation.js). L'état on/off de chaque unité ne change que ce qui
   * est DONNÉ — jamais la logique d'affichage (couleur, badge, surbrillance).
   */
  /**
   * Les POINTS MER = MARQUEURS DOM (v r, demandé par le responsable : le
   * logo MER, 25/10 ; perfectionnés en s). Chaque unité = un BOUTON
   * `.mer-marker` de 38 px de haut (TAILLE CONSTANTE en CSS — jamais
   * dépendante du zoom), positionné par MapLibre Marker au point de SA
   * propre entité source (pas un centroïde). Le DOM est indépendant du
   * pipeline de rendu MapLibre (prouvé navigateur réel 25/10 : source +
   * calques = rendu incertain ; calques symbol = pipeline de la source
   * enterré). Idempotent (guard _merMarkers).
   *
   * Géométrie (v s) : le logo est l'image RECADRÉE `logo-MER-pin.png`
   * (l'original transparent de `logo-MER-icon.png` laissait 11 % de vide
   * en bas : la punaise flottait ~4 px au-dessus du point) et le libellé
   * est placé AU-DESSUS de la punaise — la pointe touche donc exactement
   * la coordonnée, sans libellé posé sur le point.
   */
  createMERMarkers(onClick) {
    if (this._merMarkers || !this._merUnits) return;
    this._merMarkers = this._merUnits.map((f) => {
      const p = f.properties || {};
      const unit = p._unit;
      const nom = p._nom || p.name || '';
      const adherents = Number.isFinite(p._count) ? p._count : null;
      const letter = p._cercleLetter || '';
      const disp = unit + (letter ? '_' + letter : '');
      const titre = disp + (nom ? ' — ' + nom : '') +
        (adherents !== null ? ' · ' + adherents + ' adhérents' : '') +
        ' · cliquer pour ouvrir la fiche';
      // Le marqueur est un BOUTON : clic souris, tap, Entrée/Espace et
      // focus clavier (lecteur d'écran) sans code supplémentaire.
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mer-marker';
      el.dataset.unit = unit;
      el.title = titre;
      el.setAttribute('aria-label', titre);
      const img = document.createElement('img');
      img.src = 'logo-MER-pin.png';
      img.alt = ''; // décoratif : le nom accessible est porté par le bouton
      img.className = 'mer-marker-logo';
      img.draggable = false;
      const lbl = document.createElement('span');
      lbl.className = 'mer-marker-label';
      lbl.textContent = disp;
      el.appendChild(lbl);
      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Handler lu À L'APPEL, jamais capturé à la création : les marqueurs
        // naissent dans initMER(), AVANT que app.js ne branche la sélection
        // (bug « clic MER sans effet » corrigé en s).
        const handler = this._merMarkerOnClick || (typeof onClick === 'function' ? onClick : null);
        if (handler) handler(unit, el);
      });
      const coords = f.geometry.coordinates;
      // Marqueur 100 % DOM (pas d'API Marker MapLibre) : position + taille
      // posées par _applyMERLayout() — immédiatement ci-dessous, puis à
      // CHAQUE frame par la boucle rAF. Aucune taille CSS par défaut.
      this.map.getContainer().appendChild(el);
      return { el, lbl, unit, coords };
    });
    this._syncMERMarkers();
    // Taille + position correctes DÈS LE PREMIER AFFICHAGE : au zoom de
    // chargement (z9) l'icône fait la MOITIÉ de sa taille de sélection (z13).
    this._applyMERLayout();
    // Boucle rAF permanente : position ET taille recalculées à CHAQUE frame.
    // try/catch ⇒ la boucle ne peut jamais mourir, la taille ne peut jamais
    // rester figée, quel que soit l'état de la carte.
    if (!this._merRafId) {
      const _rafMER = () => {
        try { this._applyMERLayout(); } catch (e) { /* frame suivante */ }
        this._merRafId = requestAnimationFrame(_rafMER);
      };
      this._merRafId = requestAnimationFrame(_rafMER);
    }
  }

  /**
   * Échelle PROPORTIONNELLE au zoom — exponentielle, donc JAMAIS plate :
   *   z9  = zoom de CHARGEMENT → 0.50 (moitié de la taille de sélection)
   *   z13 = zoom de SÉLECTION  → 1.00 (taille de référence 60×48 px)
   *   +4 niveaux de zoom = icône doublée ; bornes de sécurité 0.35 → 1.70.
   */
  _merScale(zoom) {
    const s = 0.5 * Math.pow(2, (zoom - 9) / 4);
    return Math.max(0.35, Math.min(1.7, s));
  }

  /** Position (ancrage bas-centre sur la coordonnée) + taille de tous les
   *  marqueurs MER pour le zoom courant. Appelée immédiatement puis à
   *  chaque frame par la boucle rAF. */
  _applyMERLayout() {
    if (!this._merMarkers || !this.map) return;
    const zoom = this.map.getZoom();
    const scale = this._merScale(zoom);
    const w = Math.round(60 * scale);
    const h = Math.round(48 * scale);
    // Libellé proportionnel mais toujours lisible (plafonné 7–13 px).
    const font = Math.round(10 * Math.max(0.7, Math.min(1.3, scale)));
    for (const m of this._merMarkers) {
      const el = m.el;
      if (!el) continue;
      const pt = this.map.project(m.coords);
      el.style.position = 'absolute';
      el.style.left = (pt.x - w / 2) + 'px';
      el.style.top = (pt.y - h) + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      if (m.lbl) m.lbl.style.fontSize = font + 'px';
    }
  }

  _stopMERMarkers() {
    if (this._merRafId) { cancelAnimationFrame(this._merRafId); this._merRafId = null; }
  }

  /** (Ré)aligne la visibilité des marqueurs MER sur l'état on/off courant. */
  _syncMERMarkers() {
    for (const m of this._merMarkers || []) {
      m.el.style.display = this._merOn && !this._merOn.has(m.unit) ? 'none' : '';
    }
  }

  initMER(merData) {
    if (!merData) return;
    this._merUnits = merData.unitsFC.features;
    this._merOn = new Set(this._merUnits.map((f) => f.properties._unit));
    // La source et les calques MER doivent être créés/ré-alimentés APRÈS le
    // chargement du style (preuve navigateur réel 25/10 : un setData pré-
    // load est perdu par la source ; témoin créé+alimenté post-load =
    // rendu immédiat). Tentative immédiate (no-op si le style n'est pas
    // prêt), ré-exécutée à chaque map 'load' par app.js via ensureMERLayers().
    this.ensureMERLayers();
    console.log(
      '%cPoints MER%c ' + this._merUnits.length + ' unités (marqueurs DOM : logo MER + libellé) — ' +
      merData.total + ' adhérents en données (fiche / compteurs) · menu « Valorisation »',
      'color:#C2185B;font-weight:700', 'color:#dfe6f2'
    );
  }

  /**
   * (Ré)crée la source « mer-units » + les calques MER, les rend visibles,
   * les inscrit dans initialVisible, puis ré-alimente les données.
   * DOIT courir APRÈS le chargement du style — RACINE DU BUG « MER
   * invisibles » (diagnostiqué navigateur réel, 25/10) : un setData() pré-
   * load est PERDU par la source (preuve : la source 'perimetres', créée
   * avec données et sans setData pré-load, est rendue ; 'mer-units' avec
   * setData pré-load, que la création soit vide ou pleine, ne l'est pas ;
   * un témoin identique créé et alimenté APRÈS le load est rendu
   * immédiatement). Idempotent (guards), appelé à chaque map 'load'.
   */
  /**
   * (Ré)crée la source + les calques MER (au steady-state uniquement —
   * PRUVÉ navigateur réel 25/10 : pipeline de rendu instable ~5-8 s après
   * le load du style ; une source créée avant ce steady-state est MORTE
   * côté rendu, 0 feature rendue, 17 au constructeur ; créée à t+8 s elle
   * rend immédiatement), puis délégué à syncMERData().
   */
  ensureMERLayers() {
    if (!this._merUnits) return;
    if (!this.map.getSource('mer-units')) {
      // La source « mer-units » = DONNÉES (17 unités + propriétés) : état
      // initial = toutes ON = l'intégralité. Elle sert de socle de données
      // (fiche, compteurs, bornes de déploiement) — l'affichage MER passe
      // par les MARQUEURS DOM (createMERMarkers), indépendants du pipeline
      // de rendu MapLibre (prouvé navigateur réel 25/10).
      this.map.addSource('mer-units', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: this._merUnits }
      });
      this._merAppliedSig = [...this._merOn].sort().join(',');
    }
    // Marqueurs DOM : idempotent (création une fois, synchro ensuite).
    this.createMERMarkers(this._merMarkerOnClick);
    this.syncMERData();
  }

  /**
   * Resynchronisation sur une source MER EXISTANTE : ré-alimente UNIQUEMENT
   * si l'état on/off a changé, ou si la source a été re-créée « toute » par
   * un rechargement de style (comparaison features actives vs attendues —
   * auto-réparation 3D). _loadMERLogo est ré-exécuté : si la première
   * tentative d'addImage a échoué (pré-load), elle reprend ici et l'icône
   * arrive au passage suivant. No-op si la source n'existe pas encore.
   */
  syncMERData() {
    if (!this._merUnits) return;
    // Marqueurs DOM : l'état on/off se propage TOUJOURS (indépendant du
    // pipeline de rendu).
    this._syncMERMarkers();
    // Source (données) : ré-alimentation seulement si l'état a changé.
    if (this.map.getSource('mer-units')) {
      const sig = [...this._merOn].sort().join(',');
      const want = this._merUnits.filter((f) => this._merOn.has(f.properties._unit)).length;
      const liveSrc = this.map.getSource('mer-units');
      const live = liveSrc && liveSrc._data ? liveSrc._data.features.length : -1;
      if (this._merAppliedSig !== sig || live !== want) this._applyMERData();
    }
  }

  setMERUnitVisible(units, on) {
    if (!this._merOn) return;
    for (const u of units || []) {
      if (on) this._merOn.add(u); else this._merOn.delete(u);
    }
    this._applyMERData();
    this._syncMERMarkers(); // les marqueurs DOM suivent l'état immédiatement
  }

  /** Callback DOM des marqueurs MER (clic sur le logo = sélection de l'unité)
   *  — branché par app.js vers uiManager.selectMERUnit. */
  setMERMarkerHandler(fn) { this._merMarkerOnClick = fn; }

  merUnitIsOn(unit) {
    return !this._merOn || this._merOn.has(unit);
  }

  _applyMERData() {
    if (!this._merUnits) return;
    const keep = (f) => this._merOn.has(f.properties._unit);
    const fc = (feats) => ({ type: 'FeatureCollection', features: feats });
    this.map.getSource('mer-units')?.setData(fc(this._merUnits.filter(keep)));
    this._merAppliedSig = [...this._merOn].sort().join(',');
  }

  /** Surbrillance d'une unité MER = HALO ORANGE autour du logo (classe
   *  DOM) ; `null` = désélection. Le logo n'est JAMAIS agrandi
   *  (demande du responsable — « juste la surbrillance »). */
  setMERSelection(unit) {
    this._merSelected = unit;
    for (const m of this._merMarkers || []) {
      const on = m.unit === unit;
      m.el.classList.toggle('mer-marker-selected', on);
      m.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  setPFCSelection(name) {
    this._pfcSelected = name;
    for (const m of this._pfcMarkers || []) {
      const on = m.name === name;
      m.el.classList.toggle('pfc-marker-selected', on);
      m.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  setUVSelection(name) {
    this._uvSelected = name;
    for (const m of this._uvMarkers || []) {
      const on = m.name === name;
      m.el.classList.toggle('uv-marker-selected', on);
      m.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // -------------------------------------------- valorisation — PFC / UV
  /** Créé les marqueurs DOM pour les PFC (C7) — même principe que MER. */
  createPFCMarkers(onClick) {
    if (this._pfcMarkers || !this._pfcUnits) return;
    this._pfcMarkers = this._pfcUnits.map((f) => {
      const p = f.properties || {};
      const name = p._name;
      const titre = name + ' · Plateforme de commercialisation · cliquer pour ouvrir la fiche';
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pfc-marker';
      el.dataset.name = name;
      el.title = titre;
      el.setAttribute('aria-label', titre);
      const img = document.createElement('img');
      img.src = 'logo-pfc.png';
      img.alt = '';
      img.className = 'pfc-marker-logo';
      img.draggable = false;
      const lbl = document.createElement('span');
      lbl.className = 'pfc-marker-label';
      lbl.textContent = name;
      el.appendChild(lbl);
      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handler = this._pfcMarkerOnClick || (typeof onClick === 'function' ? onClick : null);
        if (handler) handler(name, el);
      });
      const coords = f.geometry.coordinates;
      this.map.getContainer().appendChild(el);
      return { el, lbl, name, coords };
    });
    this._syncPFCMarkers();
    this._applyPFCUVLayout();
    if (!this._pfcRafId) {
      const _raf = () => {
        try { this._applyPFCUVLayout(); } catch (e) { /* frame suivante */ }
        this._pfcRafId = requestAnimationFrame(_raf);
      };
      this._pfcRafId = requestAnimationFrame(_raf);
    }
  }

  /** Créé les marqueurs DOM pour les UV (C6) — même principe que MER. */
  createUVMarkers(onClick) {
    if (this._uvMarkers || !this._uvUnits) return;
    this._uvMarkers = this._uvUnits.map((f) => {
      const p = f.properties || {};
      const name = p._name;
      const titre = name + ' · Unité de valorisation du miel · cliquer pour ouvrir la fiche';
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'uv-marker';
      el.dataset.name = name;
      el.title = titre;
      el.setAttribute('aria-label', titre);
      const img = document.createElement('img');
      img.src = 'logo-uv.png';
      img.alt = '';
      img.className = 'uv-marker-logo';
      img.draggable = false;
      const lbl = document.createElement('span');
      lbl.className = 'uv-marker-label';
      lbl.textContent = name;
      el.appendChild(lbl);
      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handler = this._uvMarkerOnClick || (typeof onClick === 'function' ? onClick : null);
        if (handler) handler(name, el);
      });
      const coords = f.geometry.coordinates;
      this.map.getContainer().appendChild(el);
      return { el, lbl, name, coords };
    });
    this._syncUVMarkers();
    this._applyPFCUVLayout();
    if (!this._uvRafId) {
      const _raf = () => {
        try { this._applyPFCUVLayout(); } catch (e) { /* frame suivante */ }
        this._uvRafId = requestAnimationFrame(_raf);
      };
      this._uvRafId = requestAnimationFrame(_raf);
    }
  }

  /** Créé les marqueurs DOM pour les coopératives apicoles (C9). */
  createCoopMarkers(onClick) {
    if (this._coopMarkers || !this._coopUnits) return;
    this._coopMarkers = this._coopUnits.map((f) => {
      const p = f.properties || {};
      const code = p._code;
      const titre = code + ' — Coopérative apicole · cliquer pour ouvrir la fiche';
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'coop-marker';
      el.dataset.code = code;
      el.title = titre;
      el.setAttribute('aria-label', titre);
      const img = document.createElement('img');
      img.src = 'logo-ooperatives apicoles_v3.png';
      img.alt = '';
      img.className = 'coop-marker-logo';
      img.draggable = false;
      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handler = this._coopMarkerOnClick || (typeof onClick === 'function' ? onClick : null);
        if (handler) handler(code, el);
      });
      const coords = f.geometry.coordinates;
      this.map.getContainer().appendChild(el);
      return { el, code, coords };
    });
    this._syncCoopMarkers();
    this._applyCoopLayout();
    if (!this._coopRafId) {
      const _raf = () => {
        try { this._applyCoopLayout(); } catch (e) { /* frame suivante */ }
        this._coopRafId = requestAnimationFrame(_raf);
      };
      this._coopRafId = requestAnimationFrame(_raf);
    }
  }

  /** Position + taille des marqueurs coopératives (même échelle exponentielle que MER). */
  _applyCoopLayout() {
    if (!this._coopMarkers?.length) return;
    if (!this.map) return;
    const zoom = this.map.getZoom();
    const scale = this._merScale(zoom);
    const w = Math.round(50 * scale), h = Math.round(40 * scale);
    for (const m of this._coopMarkers) {
      const pt = this.map.project(m.coords);
      m.el.style.position = 'absolute';
      m.el.style.left = (pt.x - w / 2) + 'px';
      m.el.style.top = (pt.y - h) + 'px';
      m.el.style.width = w + 'px';
      m.el.style.height = h + 'px';
    }
  }

  _syncCoopMarkers() {
    for (const m of this._coopMarkers || []) {
      m.el.style.display = this._coopOn && !this._coopOn.has(m.code) ? 'none' : '';
    }
  }
  _stopCoopMarkers() { if (this._coopRafId) { cancelAnimationFrame(this._coopRafId); this._coopRafId = null; } }

  /** Position + taille des marqueurs PFC et UV (même échelle exponentielle que MER). */
  _applyPFCUVLayout() {
    if (!this._pfcMarkers && !this._uvMarkers) return;
    if (!this.map) return;
    const zoom = this.map.getZoom();
    const scale = this._merScale(zoom);
    // PFC/UV un peu plus petits que MER : base 50×40 px à z13.
    const pw = Math.round(50 * scale), ph = Math.round(40 * scale);
    const uw = Math.round(50 * scale), uh = Math.round(40 * scale);
    const font = Math.round(10 * Math.max(0.7, Math.min(1.3, scale)));
    for (const m of this._pfcMarkers || []) {
      const el = m.el; if (!el) continue;
      const pt = this.map.project(m.coords);
      el.style.position = 'absolute';
      el.style.left = (pt.x - pw / 2) + 'px';
      el.style.top = (pt.y - ph) + 'px';
      el.style.width = pw + 'px';
      el.style.height = ph + 'px';
      if (m.lbl) m.lbl.style.fontSize = font + 'px';
    }
    for (const m of this._uvMarkers || []) {
      const el = m.el; if (!el) continue;
      const pt = this.map.project(m.coords);
      el.style.position = 'absolute';
      el.style.left = (pt.x - uw / 2) + 'px';
      el.style.top = (pt.y - uh) + 'px';
      el.style.width = uw + 'px';
      el.style.height = uh + 'px';
      if (m.lbl) m.lbl.style.fontSize = font + 'px';
    }
  }

  _syncPFCMarkers() {
    for (const m of this._pfcMarkers || []) {
      m.el.style.display = this._pfcOn && !this._pfcOn.has(m.name) ? 'none' : '';
    }
  }
  _syncUVMarkers() {
    for (const m of this._uvMarkers || []) {
      m.el.style.display = this._uvOn && !this._uvOn.has(m.name) ? 'none' : '';
    }
  }
  _stopPFCMarkers() { if (this._pfcRafId) { cancelAnimationFrame(this._pfcRafId); this._pfcRafId = null; } }
  _stopUVMarkers()  { if (this._uvRafId)  { cancelAnimationFrame(this._uvRafId);  this._uvRafId  = null; } }

  initPFC(pfcData) {
    if (!pfcData) return;
    this._pfcUnits = pfcData.unitsFC.features;
    this._pfcOn = new Set(this._pfcUnits.map(f => f.properties._name));
    this.createPFCMarkers(this._pfcMarkerOnClick);
    console.log('%cPFC%c ' + this._pfcUnits.length + ' plateforme(s) (marqueurs DOM)', 'color:#0288D1;font-weight:700', 'color:#dfe6f2');
  }
  initUV(uvData) {
    if (!uvData) return;
    this._uvUnits = uvData.unitsFC.features;
    this._uvOn = new Set(this._uvUnits.map(f => f.properties._name));
    this.createUVMarkers(this._uvMarkerOnClick);
    console.log('%cUV%c ' + this._uvUnits.length + ' unité(s) (marqueurs DOM)', 'color:#9C27B0;font-weight:700', 'color:#dfe6f2');
  }
  /** Initialise les marqueurs DOM des coopératives apicoles (C9). */
  initCoops(coopData) {
    if (!coopData) return;
    this._coopUnits = coopData.unitsFC.features;
    this._coopOn = new Set(this._coopUnits.map(f => f.properties._code));
    this.createCoopMarkers(this._coopMarkerOnClick);
    console.log('%cCoop%c ' + this._coopUnits.length + ' coopérative(s) (marqueurs DOM)', 'color:#0097A7;font-weight:700', 'color:#dfe6f2');
  }
  setPFCMarkerHandler(fn) { this._pfcMarkerOnClick = fn; }
  setUVMarkerHandler(fn)  { this._uvMarkerOnClick  = fn; }
  setCoopMarkerHandler(fn) { this._coopMarkerOnClick = fn; }
  pfcUnitIsOn(name)       { return !this._pfcOn || this._pfcOn.has(name); }
  uvUnitIsOn(name)        { return !this._uvOn  || this._uvOn.has(name); }
  coopUnitIsOn(code)      { return !this._coopOn  || this._coopOn.has(code); }
  /**
   * ON/OFF d'une unité PFC — NIVEAU DONNÉES (modèle MER) : l'état vit dans
   * `_pfcOn`, l'affichage suit via `_syncPFCMarkers()` (les marqueurs DOM
   * logo + libellé SONT l'affichage PFC). Les anciennes pills appelaient
   * `showGroup('pfc')` : aucun calque MapLibre ne porte ce nom ('pfc-circle'
   * existe, 'pfc' non) et la source des marqueurs n'était jamais touchée —
   * les boutons n'avaient donc AUCUN effet sur la carte.
   */
  setPFCUnitVisible(names, on) {
    if (!this._pfcOn) return;
    for (const n of names || []) {
      if (on) this._pfcOn.add(n); else this._pfcOn.delete(n);
    }
    this._syncPFCMarkers(); // les marqueurs DOM suivent l'état immédiatement
  }
  /** ON/OFF d'une unité UV — même mécanique données que les PFC. */
  setUVUnitVisible(names, on) {
    if (!this._uvOn) return;
    for (const n of names || []) {
      if (on) this._uvOn.add(n); else this._uvOn.delete(n);
    }
    this._syncUVMarkers(); // les marqueurs DOM suivent l'état immédiatement
  }
  /** ON/OFF d'une coopérative apicole — même modèle MER/PFC/UV. */
  setCoopUnitVisible(names, on) {
    if (!this._coopOn) return;
    for (const n of names || []) {
      if (on) this._coopOn.add(n); else this._coopOn.delete(n);
    }
    this._syncCoopMarkers();
  }
  setCoopSelection(code) {
    this._coopSelected = code;
    for (const m of this._coopMarkers || []) {
      const on = m.code === code;
      m.el.classList.toggle('coop-marker-selected', on);
      m.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  setPFCScope(units) {
    if (!units || !this.map.fitBounds) return;
    const cs = units.map(u => u.coords).filter(Boolean);
    if (!cs.length) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const c of cs) { if(c[0]<minX)minX=c[0]; if(c[0]>maxX)maxX=c[0]; if(c[1]<minY)minY=c[1]; if(c[1]>maxY)maxY=c[1]; }
    const px=Math.max(0.015,(maxX-minX)*0.15+0.005), py=Math.max(0.015,(maxY-minY)*0.15+0.005);
    const b=[[minX-px,minY-py],[maxX+px,maxY+py]];
    const center=()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>{try{this.map.setPadding(this._mapViewportPadding());this.map.fitBounds(b,{duration:800,ease:t=>t*(2-t)});}catch(_){}}));};
    if(this.map.getPitch&&this.map.getPitch()>0){this.map.easeTo({pitch:0,duration:350});this.map.once('easeend',center);}else center();
  }
  setUVScope(units) {
    if (!units || !this.map.fitBounds) return;
    const cs = units.map(u => u.coords).filter(Boolean);
    if (!cs.length) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const c of cs) { if(c[0]<minX)minX=c[0]; if(c[0]>maxX)maxX=c[0]; if(c[1]<minY)minY=c[1]; if(c[1]>maxY)maxY=c[1]; }
    const px=Math.max(0.015,(maxX-minX)*0.15+0.005), py=Math.max(0.015,(maxY-minY)*0.15+0.005);
    const b=[[minX-px,minY-py],[maxX+px,maxY+py]];
    const center=()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>{try{this.map.setPadding(this._mapViewportPadding());this.map.fitBounds(b,{duration:800,ease:t=>t*(2-t)});}catch(_){}}));};
    if(this.map.getPitch&&this.map.getPitch()>0){this.map.easeTo({pitch:0,duration:350});this.map.once('easeend',center);}else center();
  }
}


function makeFCFromPads(features) {
  return { type: 'FeatureCollection', features: plantationPads(features || []) };
}
