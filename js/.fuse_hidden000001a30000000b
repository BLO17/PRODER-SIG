// story-chain.js — Chaîne de valeur interactive et diagnostic de complémentarité
//
// Trois vues, dans le rail de la Story Map :
//   1. Plantations : production → protection CES → accès → appui → marché ;
//   2. Apiculture : production → appui → valorisation → marché ;
//   3. Intégrée   : les deux chaînes et leur tronc commun (PFC, TAMKIN, MFR).
//
// Chaque maillon est cliquable : il isole les couches concernées sur la carte,
// cadre l'emprise, affiche sa valeur (résolue à l'exécution) et sa preuve.
// Le diagnostic mesure, parcelle par parcelle, la proximité aux trois leviers
// (piste, ouvrage CES, plate-forme) : la complémentarité devient vérifiable.

import { resolveMetric, formatValue } from './story-metrics.js';
import { ComplementarityModel, THRESHOLDS } from './story-complementarity.js';

const LEVEL_LABEL = { 1: 'Observé', 2: 'Estimé', 3: 'À renseigner' };
const LEVEL_CLASS = { 1: 'confidence-1', 2: 'confidence-2', 3: 'confidence-3' };

const CHAINS = {
  plantations: {
    id: 'plantations',
    label: 'Filière Plantation',
    color: '#4CAF50',
    nodes: [
      {
        id: 'production',
        icon: '🌳',
        label: 'Production',
        metric: 'plantation.parcelles',
        secondary: ['plantation.surfaceHa', 'plantation.beneficiaires'],
        categories: ['C1'],
        layers: ['plantations-circle', 'plantations-extrusion'],
        role: "Quatre filières arboricoles (amandier, figuier, caroubier, olivier) portées par des bénéficiaires identifiés.",
        enables: "La matière première de la chaîne : sans parcelle plantée, aucun des maillons suivants n'a d'objet.",
        proof: 'Registre des bénéficiaires PRODER, lignes de plantation 2021-2025.',
        level: 1,
        flux: null
      },
      {
        id: 'protection',
        icon: '🛡️',
        label: 'Protection CES',
        metric: 'ces.ravins',
        secondary: ['ces.seuils', 'ces.volumeTotal'],
        categories: ['C2', 'C3', 'C4'],
        layers: ['communes-fill', 'communes-outline', 'sous-bassins-fill', 'sous-bassins-outline', 'seuils-line', 'ravins-circle'],
        role: "Traitement des ravins et des seuils en gabion, adossé aux sous-bassins versants.",
        enables: "Les jeunes plantations tiennent sur leur versant : l'eau est ralentie, les sédiments retenus, le sol stabilisé.",
        proof: 'Registre des marchés CES ; volumes et linéaires déclarés par ouvrage.',
        level: 1,
        flux: null
      },
      {
        id: 'acces',
        icon: '🛣️',
        label: 'Accès — pistes',
        metric: 'pistes.kmHorsEtude',
        secondary: ['pistes.count', 'pistes.nbEtude'],
        categories: ['C5'],
        layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'pistes-line'],
        role: "Pistes sous marché retenues (marché de travaux et année renseignés). Les études sont exclues du décompte.",
        enables: "Les intrants montent, les récoltes descendent : sans piste, la production reste enclavée.",
        proof: 'Marchés de travaux ; une piste en étude est exclue (voir tableau de bord).',
        level: 1,
        flux: { from: 'plantations', to: 'pfc', label: 'Convergence indicative des parcelles vers les PFC' }
      },
      {
        id: 'appui',
        icon: '🤝',
        label: 'Appui & formation',
        metric: 'mer.em.adherents',
        secondary: ['mer.em.unites', 'mfr.arbo.stagiaires'],
        categories: ['C8', 'C11'],
        filter: { layer: 'mer-circle', value: { _merType: 'EM' } },
        layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'mer-circle', 'mfr-circle'],
        role: "Rassemblements locaux de production (MER arboriculture) et Maisons Familiales Rurales.",
        enables: "La compétence et l'organisation : tailles, traitements, récolte, gestion. C'est le maillon qui transforme des plants en revenus.",
        proof: 'Fiches MER et registres MFR (spécialité arboriculture).',
        level: 1,
        flux: null
      },
      {
        id: 'marche',
        icon: '🏪',
        label: 'Commercialisation',
        metric: 'pfc.uv.pfc',
        secondary: ['per.marches', 'per.surface'],
        categories: ['C7'],
        layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'pfc-circle'],
        role: "Deux plates-formes de commercialisation (PFC-AKNOUL et PFC-MSILA).",
        enables: "Le point de convergence des quatre filières : regroupement, exposition, vente.",
        proof: 'Localisation et fonction des PFC (jeu de référence PRODER).',
        level: 1,
        flux: { from: 'plantations', to: 'pfc', label: 'Convergence indicative des parcelles vers les PFC' }
      }
    ],
    links: [
      {
        from: 'production', to: 'protection',
        label: 'Protéger pour produire',
        detail: "La plantation sans ouvrage CES laisse le versant se ravin­er. Le seuil retient le sol ; la parcelle reste productive."
      },
      {
        from: 'protection', to: 'acces',
        label: 'Stabiliser pour désenclaver',
        detail: "Les ouvrages stabilisent les talus que la piste traverse : l'accès devient durable, pas seulement ouvert."
      },
      {
        from: 'acces', to: 'appui',
        label: 'Accéder pour accompagner',
        detail: "Une piste praticable permet aux MER et aux MFR d'atteindre les douars : l'appui technique cesse d'être théorique."
      },
      {
        from: 'appui', to: 'marche',
        label: 'Former pour vendre',
        detail: "La formation et l'organisation coopérative conditionnent la qualité, le conditionnement et donc l'accès au marché."
      }
    ]
  },
  apiculture: {
    id: 'apiculture',
    label: 'Filière Apicole',
    color: '#FFB300',
    nodes: [
      {
        id: 'production',
        icon: '🐝',
        label: 'Production',
        metric: 'coop.adherents',
        secondary: ['coop.unions', 'mer.apicole.adherents'],
        categories: ['C9', 'C8'],
        filter: { layer: 'mer-circle', value: { _merType: 'AGR' } },
        layers: ['communes-fill', 'communes-outline', 'cooperatives-circle', 'mer-circle'],
        role: "Adhérents de coopératives apicoles, unions et un MER dédié à la valorisation du miel.",
        enables: "La matière première et la base sociale de la filière : le miel des ruchers.",
        proof: 'Registres des coopératives et fiches MER (type AGR).',
        level: 1,
        flux: { from: 'cooperatives', to: 'uv', label: 'Convergence indicative des coopératives vers les unités de valorisation' }
      },
      {
        id: 'appui',
        icon: '🎓',
        label: 'Appui & formation',
        metric: 'mfr.api.stagiaires',
        secondary: ['tamkin.benef', 'tamkin.femmes'],
        categories: ['C11', 'C10'],
        filter: { layer: 'mfr-circle', value: { _formation: 'APICULTURE' } },
        layers: ['communes-fill', 'communes-outline', 'mfr-circle', 'tamkin-circle'],
        role: "Maisons Familiales Rurales (apiculture) et centres TAMKIN d'alphabétisation.",
        enables: "La professionnalisation des apiculteurs et l'autonomie des femmes, socle de la gestion coopérative.",
        proof: 'Registres MFR (spécialité apiculture) et fiches TAMKIN.',
        level: 1,
        flux: null
      },
      {
        id: 'valorisation',
        icon: '🍯',
        label: 'Valorisation',
        metric: 'pfc.uv.uv',
        secondary: ['mer.apicole.unites'],
        categories: ['C6'],
        layers: ['communes-fill', 'communes-outline', 'cooperatives-circle', 'uv-circle'],
        role: "Deux unités de valorisation du miel : UV-AJDIR et UV-MSILA.",
        enables: "Transformer et conditionner : le miel quitte le vrac et gagne de la valeur.",
        proof: 'Localisation et fonction des unités de valorisation.',
        level: 1,
        flux: { from: 'cooperatives', to: 'uv', label: 'Convergence indicative des coopératives vers les unités de valorisation' }
      },
      {
        id: 'marche',
        icon: '🏪',
        label: 'Commercialisation',
        metric: 'pfc.uv.pfc',
        secondary: ['coop.adherents', 'coop.unions'],
        categories: ['C7'],
        layers: ['communes-fill', 'communes-outline', 'uv-circle', 'pfc-circle'],
        role: "Deux plates-formes de commercialisation, dont PFC-MSILA à une quarantaine de mètres d'UV-MSILA.",
        enables: "La continuité physique entre transformation et vente : un maillon de moins à franchir.",
        proof: 'Coordonnées des UV et PFC ; distance calculée entre UV-MSILA et PFC-MSILA.',
        level: 1,
        flux: { from: 'uv', to: 'pfc', label: 'Convergence indicative des unités vers les plates-formes' }
      }
    ],
    links: [
      {
        from: 'production', to: 'appui',
        label: 'Se former pour durer',
        detail: "La conduite d'un rucher, l'hygiène et la gestion coopérative s'apprennent : sans formation, la production reste fragile."
      },
      {
        from: 'appui', to: 'valorisation',
        label: 'Se former pour transformer',
        detail: "Tenir une unité de valorisation exige des compétences en conditionnement, traçabilité et qualité."
      },
      {
        from: 'valorisation', to: 'marche',
        label: 'Transformer pour vendre',
        detail: "Le miel conditionné et étiqueté accède à un autre marché que le miel en vrac. La plus-value se joue ici."
      }
    ]
  }
};

const SHARED = [
  { id: 'pfc', icon: '🏪', label: '2 PFC partagées', metric: 'pfc.uv.pfc', categories: ['C7'], layers: ['pfc-circle'], note: 'Les deux plates-formes accueillent arboriculture et miel.' },
  { id: 'tamkin', icon: '👩‍🌾', label: 'TAMKIN', metric: 'tamkin.benef', categories: ['C10'], layers: ['tamkin-circle'], note: 'Majoritairement des femmes : la base sociale des deux filières.' },
  { id: 'mfr', icon: '🎓', label: 'MFR', metric: 'mfr.beneficiaires', categories: ['C11'], layers: ['mfr-circle'], note: 'Arboriculture et apiculture formées dans le même réseau.' },
  { id: 'territoire', icon: '🗺️', label: 'Un territoire', metric: 'cat.communes', categories: ['C12'], layers: ['communes-fill', 'communes-outline'], note: 'Les deux filières se déploient dans le même cercle.' }
];

export class StoryChain {
  constructor({ map, layers, anim, engine, indicators, stats, features, model, hotspots }) {
    this.map = map;
    this.layers = layers;
    this.anim = anim;
    this.engine = engine;
    this.indicators = indicators;
    this.stats = stats;
    this.features = features || [];
    this.model = model || new ComplementarityModel(this.features);
    this.hotspots = hotspots;

    this.chainHost = null;
    this.diagHost = null;
    this.mode = 'plantations';
    this.selectedNode = null;
    this.selectedLink = null;
    this.active = { access: true, ces: true, market: true };
    this.diagnosticReady = false;
    this.diagnosticVisible = false;
    this._weakOnly = false;
    this._sourceBuilt = false;
  }

  init({ chainHost, diagnosticHost }) {
    this.chainHost = chainHost;
    this.diagHost = diagnosticHost;
    this.render();
    this.renderDiagnostic();
  }

  // ------------------------------------------------------------ contexte

  _context() {
    return {
      indicators: this.indicators?.getAllIndicators?.() || {},
      stats: this.stats
    };
  }

  _metric(key) {
    return resolveMetric(key, this._context());
  }

  _node(id, mode = null) {
    const lanes = mode === 'both' || mode === null
      ? [CHAINS.plantations, CHAINS.apiculture]
      : [CHAINS[mode]];
    for (const lane of lanes) {
      const node = lane.nodes.find(n => n.id === id);
      if (node) return { ...node, color: lane.color };
    }
    return SHARED.find(n => n.id === id) || null;
  }

  // ------------------------------------------------------------ rendu chaîne

  setMode(mode) {
    if (!['plantations', 'apiculture', 'both'].includes(mode)) return;
    this.mode = mode;
    this.selectedNode = null;
    this.selectedLink = null;
    this.render();
  }

  render() {
    if (!this.chainHost) return;
    const lanes = this.mode === 'both'
      ? [CHAINS.plantations, CHAINS.apiculture]
      : [CHAINS[this.mode]];

    this.chainHost.innerHTML = [
      '<div class="chain-mode">',
      '  <button class="chain-mode-btn ' + (this.mode === 'plantations' ? 'active' : '') + '" data-mode="plantations">Plantation</button>',
      '  <button class="chain-mode-btn ' + (this.mode === 'apiculture' ? 'active' : '') + '" data-mode="apiculture">Apicole</button>',
      '  <button class="chain-mode-btn ' + (this.mode === 'both' ? 'active' : '') + '" data-mode="both">Les deux</button>',
      '</div>',
      '<p class="chain-hint">Cliquez un maillon : la carte l\'isole et affiche sa preuve.</p>',
      '<div class="chain-grid ' + (lanes.length > 1 ? 'two' : '') + '">',
      lanes.map(lane => this._laneHtml(lane)).join(''),
      '</div>',
      this.mode === 'both' ? this._sharedHtml() : '',
      '<div id="chain-detail" class="chain-detail"></div>'
    ].join('');

    this.chainHost.querySelectorAll('.chain-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });
    this.chainHost.querySelectorAll('.chain-node').forEach(btn => {
      btn.addEventListener('click', () => this.focusNode(btn.dataset.node));
    });
    this.chainHost.querySelectorAll('.chain-link').forEach(btn => {
      btn.addEventListener('click', () => this.showLink(btn.dataset.from, btn.dataset.to));
    });
    this.chainHost.querySelectorAll('.chain-shared-item').forEach(btn => {
      btn.addEventListener('click', () => this.focusShared(btn.dataset.shared));
    });

    if (this.selectedNode) this._renderDetailForNode(this.selectedNode);
    if (this.selectedLink) this._renderDetailForLink(this.selectedLink.from, this.selectedLink.to);
  }

  _laneHtml(lane) {
    const parts = [
      '<div class="chain-lane" style="--lane:' + lane.color + '">',
      '<div class="chain-lane-head"><span class="chain-lane-dot"></span>' + lane.label + '</div>'
    ];
    lane.nodes.forEach((node, index) => {
      const m = this._metric(node.metric);
      parts.push(
        '<button class="chain-node" data-node="' + lane.id + ':' + node.id + '" title="' + this._escape(node.enables) + '">',
        '  <span class="chain-node-icon">' + node.icon + '</span>',
        '  <span class="chain-node-main">',
        '    <span class="chain-node-label">' + node.label + '</span>',
        '    <span class="chain-node-value">' + m.value + '<span class="chain-node-unit">' + (m.unit || '') + '</span></span>',
        '  </span>',
        '  <span class="chain-node-level ' + m.className + '">' + (m.level === 1 ? 'O' : m.level === 2 ? 'E' : '?') + '</span>',
        '</button>'
      );
      if (index < lane.nodes.length - 1) {
        const link = lane.links.find(l => l.from === node.id && l.to === lane.nodes[index + 1].id);
        if (link) {
          parts.push(
            '<button class="chain-link" data-from="' + link.from + '" data-to="' + link.to + '" title="' + this._escape(link.detail) + '">',
            '  <span class="chain-link-dot"></span><span class="chain-link-text">' + link.label + '</span>',
            '</button>'
          );
        } else {
          parts.push('<div class="chain-link chain-link-empty"><span class="chain-link-dot"></span></div>');
        }
      }
    });
    parts.push('</div>');
    return parts.join('');
  }

  _sharedHtml() {
    return [
      '<div class="chain-shared">',
      '  <div class="chain-shared-head">Tronc commun aux deux filières</div>',
      '  <div class="chain-shared-grid">',
      SHARED.map(item => {
        const m = this._metric(item.metric);
        return '<button class="chain-shared-item" data-shared="' + item.id + '" title="' + this._escape(item.note) + '">' +
          '<span class="chain-shared-icon">' + item.icon + '</span>' +
          '<span class="chain-shared-value">' + m.value + '<span class="chain-shared-unit">' + (m.unit || '') + '</span></span>' +
          '<span class="chain-shared-label">' + item.label + '</span></button>';
      }).join(''),
      '  </div>',
      '  <p class="chain-shared-note">Deux filières, un même territoire, les mêmes plates-formes et le même réseau de formation : c\'est là que la complémentarité devient visible.</p>',
      '</div>'
    ].join('');
  }

  // ------------------------------------------------------------ détail

  _detailEl() { return document.getElementById('chain-detail'); }

  _renderDetailForNode(node) {
    const el = this._detailEl();
    if (!el) return;
    const m = this._metric(node.metric);
    const extras = (node.secondary || []).map(key => this._metric(key));
    el.innerHTML = [
      '<div class="chain-detail-head"><span class="chain-detail-icon">' + node.icon + '</span>',
      '<span class="chain-detail-title">' + node.label + '</span>',
      '<span class="chain-detail-value">' + m.value + ' <small>' + (m.unit || '') + '</small></span></div>',
      '<p class="chain-detail-role">' + node.role + '</p>',
      extras.length ? '<div class="chain-detail-extra">' + extras.map(e =>
        '<span class="chain-detail-chip">' + e.value + ' ' + (e.unit || '') + ' · ' + e.label + '</span>').join('') + '</div>' : '',
      '<p class="chain-detail-enables"><strong>Ce que ça rend possible :</strong> ' + node.enables + '</p>',
      '<div class="chain-detail-proof"><span class="story-metric-level ' + LEVEL_CLASS[node.level] + '">' +
        LEVEL_LABEL[node.level] + '</span> ' + node.proof + '</div>',
      node.flux ? '<button class="chain-flux-btn" id="chain-flux">Montrer la convergence sur la carte</button>' : '',
      '<div class="chain-flux-note" id="chain-flux-note"></div>'
    ].join('');

    const fluxBtn = document.getElementById('chain-flux');
    if (fluxBtn && node.flux) {
      fluxBtn.addEventListener('click', () => this._drawFlux(node.flux));
    }
  }

  _renderDetailForLink(fromId, toId) {
    const el = this._detailEl();
    if (!el) return;
    const lane = [CHAINS.plantations, CHAINS.apiculture].find(l => l.links.some(k => k.from === fromId && k.to === toId));
    if (!lane) return;
    const link = lane.links.find(k => k.from === fromId && k.to === toId);
    const from = lane.nodes.find(n => n.id === fromId);
    const to = lane.nodes.find(n => n.id === toId);
    el.innerHTML = [
      '<div class="chain-detail-head"><span class="chain-detail-icon">🔗</span>',
      '<span class="chain-detail-title">' + link.label + '</span></div>',
      '<p class="chain-detail-role">' + link.detail + '</p>',
      '<div class="chain-detail-extra">',
      '  <span class="chain-detail-chip">' + from.icon + ' ' + from.label + '</span>',
      '  <span class="chain-detail-chip">→ ' + to.icon + ' ' + to.label + '</span>',
      '</div>',
      '<div class="chain-detail-proof"><span class="story-metric-level confidence-2">Lecture</span> ',
      'Le lien décrit une dépendance fonctionnelle documentée par le dispositif PRODER ; il ne quantifie pas un flux commercial.',
      '</div>'
    ].join('');
  }

  // ------------------------------------------------------------ carte

  focusNode(key) {
    const [laneId, nodeId] = String(key).includes(':') ? String(key).split(':') : [this.mode, key];
    const laneMode = laneId === 'apiculture' ? 'apiculture' : 'plantations';
    const node = this._node(nodeId, laneMode);
    if (!node) return;
    this.selectedNode = node;
    this.selectedLink = null;

    this.engine?.pause();
    this.anim.clearFluxLayers?.();
    this.hotspots?.closePopup();
    this.hotspots?.clearHalo();
    this.setDiagnosticVisible(false);

    this.layers.hideAll();
    this.layers.show('communes-fill');
    this.layers.show('communes-outline');
    for (const layer of node.layers || []) this.layers.show(layer);

    if (node.filter) {
      this.anim.applyFilter(node.filter.layer, node.filter.value);
    }
    if (node.id === 'appui') {
      this.anim.applyFilter('mfr-circle', {
        _formation: laneMode === 'apiculture' ? 'APICULTURE' : 'ARBORICULTURE'
      });
    }

    // Halo sur un échantillon d'entités citées.
    const sample = this._sample(node, 3);
    if (sample.length) this.hotspots?.setHalo(sample);

    const bounds = this._boundsOf(node.categories || []);
    if (bounds) {
      this.map.fitBounds(bounds, {
        padding: { top: 80, bottom: 90, left: 380, right: 80 },
        maxZoom: 12,
        duration: 1200
      });
      this.map.easeTo({ pitch: 45, duration: 700 });
    }

    this.render();
    this._renderDetailForNode(node);
    this.chainHost?.querySelector('.chain-node[data-node="' + laneId + ':' + nodeId + '"]')?.classList.add('active');
  }

  focusShared(id) {
    const item = SHARED.find(s => s.id === id);
    if (!item) return;
    this.selectedNode = item;
    this.selectedLink = null;
    this.engine?.pause();
    this.anim.clearFluxLayers?.();
    this.hotspots?.closePopup();
    this.hotspots?.clearHalo();
    this.setDiagnosticVisible(false);

    this.layers.hideAll();
    this.layers.show('communes-fill');
    this.layers.show('communes-outline');
    for (const layer of item.layers) this.layers.show(layer);

    const sample = this._sample(item, 4);
    if (sample.length) this.hotspots?.setHalo(sample);

    const bounds = this._boundsOf(item.categories || []);
    if (bounds) {
      this.map.fitBounds(bounds, {
        padding: { top: 80, bottom: 90, left: 380, right: 80 },
        maxZoom: 11,
        duration: 1200
      });
      this.map.easeTo({ pitch: 40, duration: 700 });
    }

    const m = this._metric(item.metric);
    const el = this._detailEl();
    if (el) {
      el.innerHTML = [
        '<div class="chain-detail-head"><span class="chain-detail-icon">' + item.icon + '</span>',
        '<span class="chain-detail-title">' + item.label + '</span>',
        '<span class="chain-detail-value">' + m.value + ' <small>' + (m.unit || '') + '</small></span></div>',
        '<p class="chain-detail-role">' + item.note + '</p>',
        '<div class="chain-detail-proof"><span class="story-metric-level confidence-1">Observé</span> ',
        'Élément mutualisé entre les deux filières.</div>'
      ].join('');
    }
    this.chainHost?.querySelectorAll('.chain-shared-item').forEach(b => b.classList.toggle('active', b.dataset.shared === id));
  }

  showLink(fromId, toId) {
    this.selectedLink = { from: fromId, to: toId };
    this.selectedNode = null;
    this.chainHost?.querySelectorAll('.chain-link').forEach(b =>
      b.classList.toggle('active', b.dataset.from === fromId && b.dataset.to === toId));
    this.chainHost?.querySelectorAll('.chain-node').forEach(b => b.classList.remove('active'));
    this._renderDetailForLink(fromId, toId);
  }

  _drawFlux(flux) {
    if (!flux) return;
    this.anim.clearFluxLayers?.();
    this.anim.drawFlux(flux.from, flux.to, '#FFD600', 2200, flux.label);
    const note = document.getElementById('chain-flux-note');
    if (note) {
      note.textContent = 'Tracé indicatif de proximité : ce n\'est pas un flux commercial documenté.';
    }
  }

  _sample(node, limit) {
    const cats = new Set(node.categories || []);
    const out = [];
    for (const f of this.features) {
      if (!cats.has(f.properties?._category)) continue;
      if (node.filter && f.properties?.[Object.keys(node.filter.value)[0]] !== Object.values(node.filter.value)[0]) continue;
      out.push(f);
      if (out.length >= limit) break;
    }
    return out;
  }

  _boundsOf(categories) {
    const cats = new Set(categories);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (coords) => {
      if (typeof coords?.[0] === 'number') {
        const [x, y] = coords;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        return;
      }
      if (Array.isArray(coords)) for (const c of coords) visit(c);
    };
    for (const f of this.features) {
      if (!cats.has(f.properties?._category)) continue;
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'GeometryCollection') {
        for (const sub of g.geometries || []) visit(sub.coordinates);
      } else {
        visit(g.coordinates);
      }
      if (f.properties?._coords) visit([f.properties._coords]);
    }
    if (!Number.isFinite(minX)) return null;
    // Une emprise dégénérée (points alignés) doit rester cadrable.
    if (maxX - minX < 0.005) { minX -= 0.01; maxX += 0.01; }
    if (maxY - minY < 0.005) { minY -= 0.01; maxY += 0.01; }
    return [[minX, minY], [maxX, maxY]];
  }

  _escape(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ------------------------------------------------------------ diagnostic

  renderDiagnostic() {
    if (!this.diagHost) return;
    const r = this.model.results;
    this.diagHost.innerHTML = [
      '<p class="diag-intro">La complémentarité se vérifie : chaque ligne de plantation est comparée à trois dispositifs. ',
      'Les seuils sont des hypothèses explicites, affichées ci-dessous.</p>',
      '<div class="diag-thresholds">',
      '  <button class="diag-toggle active" data-lever="access"><span class="diag-toggle-dot" style="background:#FFD600"></span>Piste ≤ ' + THRESHOLDS.accessKm + ' km</button>',
      '  <button class="diag-toggle active" data-lever="ces"><span class="diag-toggle-dot" style="background:#FF9800"></span>Ouvrage CES ≤ ' + THRESHOLDS.cesKm + ' km</button>',
      '  <button class="diag-toggle active" data-lever="market"><span class="diag-toggle-dot" style="background:#4CAF50"></span>PFC ≤ ' + THRESHOLDS.marketKm + ' km</button>',
      '</div>',
      '<div class="diag-main">',
      '  <div class="diag-big"><span id="diag-three">—</span><small>%</small></div>',
      '  <div class="diag-big-label" id="diag-big-label">des lignes de plantation cumulent<br>les 3 leviers actifs</div>',
      '</div>',
      '<div class="diag-bar" id="diag-bar"></div>',
      '<div class="diag-counts" id="diag-counts"></div>',
      '<div class="diag-actions">',
      '  <button class="diag-btn" id="diag-run">Calculer le diagnostic</button>',
      '  <button class="diag-btn" id="diag-zoom" disabled>Zoom zone à renforcer</button>',
      '</div>',
      '<div id="diag-progress" class="diag-progress"></div>',
      '<div id="diag-detail"></div>',
      '<p class="diag-method">Niveau de preuve 2 — proximité géographique calculée sur les géométries du jeu public. ',
      'Ne mesure ni l\'usage réel, ni la qualité de l\'ouvrage. Distance orthodromique au plus proche sommet.</p>'
    ].join('');

    this.diagHost.querySelectorAll('.diag-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const lever = btn.dataset.lever;
        this.active[lever] = !this.active[lever];
        btn.classList.toggle('active', this.active[lever]);
        this._refreshCounts();
      });
    });
    document.getElementById('diag-run')?.addEventListener('click', () => this.runDiagnostic());
    document.getElementById('diag-zoom')?.addEventListener('click', () => this.zoomWeakest());

    if (this.model.hasResults) this._refreshCounts();
  }

  async runDiagnostic() {
    const progress = document.getElementById('diag-progress');
    const runBtn = document.getElementById('diag-run');
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Calcul en cours…'; }
    if (progress) progress.innerHTML = '<div class="diag-progress-bar"><div style="width:0%"></div></div><p>Préparation…</p>';

    try {
      await this.model.compute((label, percent) => {
        if (!progress) return;
        progress.innerHTML = '<div class="diag-progress-bar"><div style="width:' + percent + '%"></div></div><p>' + label + '</p>';
      });
      this.diagnosticReady = true;
      if (progress) progress.innerHTML = '';
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Recalculer'; }
      this._refreshCounts();
      this._buildDiagnosticLayer();
      this.setDiagnosticVisible(true);
      this._renderDiagnosticDetail();
    } catch (err) {
      console.warn('Diagnostic de complémentarité indisponible :', err);
      if (progress) progress.innerHTML = '<p class="diag-error">Calcul impossible : ' + err.message + '</p>';
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Réessayer'; }
    }
  }

  _refreshCounts() {
    if (!this.model.hasResults) return;
    const counts = this.model.countsFor(this.active);
    const total = counts.total;
    const threeEl = document.getElementById('diag-three');
    if (threeEl) threeEl.textContent = formatValue(counts.allActive.pct, 'pct');
    const label = document.getElementById('diag-big-label');
    if (label) {
      label.innerHTML = counts.activeCount === 1
        ? 'des lignes de plantation cumulent<br>le levier actif'
        : 'des lignes de plantation cumulent<br>les ' + counts.activeCount + ' leviers actifs';
    }

    const bar = document.getElementById('diag-bar');
    if (bar) {
      bar.innerHTML = [
        ['3 leviers', counts.three, '#4CAF50'],
        ['2 leviers', counts.two, '#CDDC39'],
        ['1 levier', counts.one, '#FF9800'],
        ['aucun', counts.zero, '#EF5350']
      ].map(([label, v, color]) =>
        '<div class="diag-seg" style="width:' + (total ? (v.count / total) * 100 : 0) + '%;background:' + color + '" title="' +
        label + ' : ' + v.count + ' lignes (' + v.pct + '%)"></div>'
      ).join('');
    }

    const box = document.getElementById('diag-counts');
    if (box) {
      const r = this.model.results;
      box.innerHTML = [
        this._countRow('Accès piste', r.plantation.access, '#FFD600', this.active.access),
        this._countRow('Ouvrage CES', r.plantation.ces, '#FF9800', this.active.ces),
        this._countRow('Plate-forme', r.plantation.market, '#4CAF50', this.active.market)
      ].join('') +
        '<div class="diag-median">Médiane : ' + formatValue(r.plantation.median.accessKm, 'dec1') + ' km d\'une piste · ' +
        formatValue(r.plantation.median.cesKm, 'dec1') + ' km d\'un ouvrage CES · ' +
        formatValue(r.plantation.median.marketKm, 'dec1') + ' km d\'une PFC</div>';
    }

    if (this.diagnosticReady) this._updateDiagnosticLayer();
    this._renderDiagnosticDetail();
  }

  _countRow(label, value, color, active) {
    return '<div class="diag-row' + (active ? '' : ' off') + '">' +
      '<span class="diag-row-dot" style="background:' + color + '"></span>' +
      '<span class="diag-row-label">' + label + '</span>' +
      '<span class="diag-row-value">' + formatValue(value.pct, 'pct') + '%</span>' +
      '<span class="diag-row-count">' + formatValue(value.count, 'int') + '</span></div>';
  }

  _renderDiagnosticDetail() {
    const box = document.getElementById('diag-detail');
    if (!box || !this.model.hasResults) return;
    const r = this.model.results;
    const filieres = Object.entries(r.plantation.byFiliere)
      .sort((a, b) => b[1].total - a[1].total);

    box.innerHTML = [
      '<div class="diag-subhead">Par filière — part cumulant les 3 leviers</div>',
      filieres.map(([fil, d]) =>
        '<div class="diag-filiere"><span>' + fil.replace('Plantation ', '') + '</span>' +
        '<span class="diag-filiere-bar"><span style="width:' + (d.three.pct || 0) + '%"></span></span>' +
        '<span class="diag-filiere-val">' + formatValue(d.three.pct, 'pct') + '%</span></div>'
      ).join(''),
      '<div class="diag-subhead">Filière apicole</div>',
      '<div class="diag-api">',
      '  <div class="diag-api-item"><strong>' + formatValue(r.apiculture.coopsNearUv.pct, 'pct') + '%</strong><span>des coopératives à ≤ ' + THRESHOLDS.marketKm + ' km d\'une UV</span></div>',
      '  <div class="diag-api-item"><strong>' + formatValue(r.apiculture.coopsNearPfc.pct, 'pct') + '%</strong><span>à ≤ ' + THRESHOLDS.marketKm + ' km d\'une PFC</span></div>',
      '  <div class="diag-api-item"><strong>' + formatValue(r.apiculture.uvToPfc, 'dec1') + ' km</strong><span>entre l\'UV et la PFC les plus proches</span></div>',
      '</div>',
      '<p class="diag-read">Lecture : la couverture n\'est pas totale. Les zones sans levier sont la marge de renforcement du programme — ' +
      'un argument de poursuite, pas une faiblesse cachée.</p>'
    ].join('');

    const zoomBtn = document.getElementById('diag-zoom');
    if (zoomBtn) zoomBtn.disabled = !r.plantation.weakest;
  }

  _buildDiagnosticLayer() {
    if (!this.map || this._sourceBuilt) return;
    const rows = this.model.results.plantations;
    const data = {
      type: 'FeatureCollection',
      features: rows.map((r, i) => ({
        type: 'Feature',
        id: i,
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: {
          filiere: r.filiere,
          leviers: ComplementarityModel.levelOf(r, this.active)
        }
      }))
    };
    if (!this.map.getSource('complementarity')) {
      this.map.addSource('complementarity', { type: 'geojson', data });
    } else {
      this.map.getSource('complementarity').setData(data);
    }
    if (!this.map.getLayer('complementarity-circle')) {
      this.map.addLayer({
        id: 'complementarity-circle',
        type: 'circle',
        source: 'complementarity',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6],
          'circle-color': [
            'match', ['get', 'leviers'],
            3, '#4CAF50',
            2, '#CDDC39',
            1, '#FF9800',
            0, '#EF5350',
            '#9E9E9E'
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.6,
          'circle-stroke-color': 'rgba(0,0,0,0.45)'
        }
      });
    }
    this._sourceBuilt = true;
  }

  _updateDiagnosticLayer() {
    if (!this.map?.getSource('complementarity')) return;
    const rows = this.model.results.plantations;
    const features = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const leviers = ComplementarityModel.levelOf(r, this.active);
      if (this._weakOnly && leviers > 1) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: { filiere: r.filiere, leviers }
      });
    }
    this.map.getSource('complementarity').setData({ type: 'FeatureCollection', features });
  }

  setDiagnosticVisible(visible) {
    this.diagnosticVisible = visible;
    if (!this.map?.getLayer('complementarity-circle')) return;
    this.map.setLayoutProperty('complementarity-circle', 'visibility', visible ? 'visible' : 'none');
    if (visible) {
      this.layers.hideAll();
      this.layers.show('communes-fill');
      this.layers.show('communes-outline');
      this.anim.clearFluxLayers?.();
      this.hotspots?.clearHalo();
      this.hotspots?.closePopup();
      if (this.model.results) {
        const b = this.model.results.plantation.weakest;
        const bounds = b ? [[b.bounds[0][0] - 0.02, b.bounds[0][1] - 0.02], [b.bounds[1][0] + 0.02, b.bounds[1][1] + 0.02]] : null;
        if (bounds) {
          this.map.fitBounds(bounds, {
            padding: { top: 90, bottom: 90, left: 380, right: 90 },
            maxZoom: 11,
            duration: 1200
          });
        }
      }
    }
  }

  zoomWeakest() {
    const b = this.model.results?.plantation.weakest;
    if (!b) return;
    this.setDiagnosticVisible(true);
    const bounds = [[b.bounds[0][0] - 0.02, b.bounds[0][1] - 0.02], [b.bounds[1][0] + 0.02, b.bounds[1][1] + 0.02]];
    this.map.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 380, right: 90 },
      maxZoom: 12,
      duration: 1400
    });
    const note = document.getElementById('diag-detail');
    if (note) {
      const hint = document.createElement('p');
      hint.className = 'diag-weak';
      hint.textContent = b.count + ' lignes de plantation ne cumulent aucun des trois leviers : ' +
        'c\'est ici que le programme peut concentrer la suite.';
      note.prepend(hint);
    }
  }

  /** Appelé lors d'un changement de chapitre : les valeurs restent à jour. */
  refresh() {
    this.render();
    if (this.model.hasResults) this._refreshCounts();
  }
}

export { CHAINS as VALUE_CHAINS };
