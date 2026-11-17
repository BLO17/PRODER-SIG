// animation.js — Moteur d'animation 3D
import { CONFIG } from './config.js';

const PAIRS = {
  'plantations-circle': ['plantations-circle', 'plantations-extrusion'],
  'plantations-extrusion': ['plantations-circle', 'plantations-extrusion']
};

export class AnimationEngine {
  constructor(map, layerManager, features) {
    this.map = map;
    this.layers = layerManager;
    this.features = features || [];
    this.featuresBySource = {};
    this.running = false;
    this.speed = 1;
    this.currentScenario = null;
    this.stepIndex = 0;
    this.fluxLayers = [];
    this.filters = new Map();
    this.originalOpacity = new Map();
  }

  setSpeed(s) { this.speed = Math.max(0.1, Math.min(5, s)); }
  isRunning() { return this.running; }

  async runScenario(scenario, onStep, onDone) {
    if (this.running) this.stop();
    // Laisse le temps à une éventuelle boucle précédente de s'arrêter.
    await this.wait(50);
    this.running = true;
    this.currentScenario = scenario;
    this.stepIndex = 0;

    try {
      for (let i = 0; i < scenario.etapes.length; i++) {
        if (!this.running) break;
        this.stepIndex = i;
        const etape = scenario.etapes[i];
        onStep?.(i, etape, scenario);
        await this.executeStep(etape);
      }
    } finally {
      this.running = false;
      onDone?.(scenario);
    }
  }

  stop() {
    this.running = false;
  }

  async executeStep(etape) {
    const dur = (etape.duration || 1000) / this.speed;
    switch (etape.action) {
      case 'flyTo':
        await this.flyTo(etape.target, etape.pitch, etape.zoom, dur);
        break;
      case 'showLayer':
        this.layers.show(etape.layer);
        if (etape.filter) this.applyFilter(etape.layer, etape.filter);
        if (etape.opacity !== undefined) this.setOpacity(etape.layer, etape.opacity);
        await this.wait(200 / this.speed);
        break;
      case 'hideLayer':
        this.layers.hide(etape.layer);
        await this.wait(100 / this.speed);
        break;
      case 'staggeredAppear':
        await this.staggeredAppear(etape.layer, etape.delay, etape.duration);
        break;
      case 'extrude':
        await this.extrude(etape.layer, etape.heightField, etape.factor, dur);
        break;
      case 'drawFlux':
        await this.drawFlux(etape.from, etape.to, etape.color, dur, etape.label);
        break;
      case 'drawProgressive':
        await this.drawProgressive(etape.layer, dur);
        break;
      case 'showPopup':
        this.showScenarioPopup(etape.content);
        await this.wait(500 / this.speed);
        break;
      case 'wait':
        await this.wait(dur);
        break;
      case 'reset':
        await this.reset();
        break;
      default:
        console.warn('Action inconnue:', etape.action);
    }
  }

  async flyTo(target, pitch = 45, zoom = 10, duration = 2000) {
    const coords = this.getTargetCoords(target);
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this.map.off('moveend', done);
        resolve();
      };
      this.map.on('moveend', done);
      this.map.flyTo({ center: coords, zoom, pitch, bearing: 0, duration, essential: true });
      setTimeout(done, duration + 400);
    });
  }

  getTargetCoords(target) {
    const centers = {
      'AKNOUL': [-3.86, 34.65],
      'TAINASTE': [-4.20, 34.55],
      'AJDIR': [-3.97, 34.74],
      'MSILA': [-4.18, 34.43],
      'PROVINCE': CONFIG.center
    };
    return centers[target] || centers['PROVINCE'];
  }

  async staggeredAppear(layerId, delay = 50, duration = 2000) {
    const layer = this.map.getLayer(layerId);
    if (!layer) return;
    const prop = layer.type === 'line' ? 'line-opacity'
      : layer.type === 'fill' ? 'fill-opacity' : 'circle-opacity';
    if (!this.originalOpacity.has(layerId)) {
      const current = this.map.getPaintProperty(layerId, prop);
      this.originalOpacity.set(layerId, typeof current === 'number' ? current : 0.85);
    }
    const finalOpacity = this.originalOpacity.get(layerId);
    this.map.setPaintProperty(layerId, prop, 0);
    const steps = Math.max(1, Math.ceil(duration / 32));
    for (let i = 0; i <= steps; i++) {
      if (!this.running) break;
      const progress = i / steps;
      this.map.setPaintProperty(layerId, prop, Math.min(finalOpacity, progress * finalOpacity * 1.5));
      await this.wait(Math.max(8, (duration / steps) / this.speed));
    }
    this.map.setPaintProperty(layerId, prop, finalOpacity);
  }

  async extrude(layerId, heightField, factor = 1, duration = 2000) {
    const layer = this.map.getLayer(layerId);
    if (!layer) return;
    const field = heightField || '_sup';
    const steps = Math.max(1, Math.ceil(duration / 40));
    for (let i = 0; i <= steps; i++) {
      if (!this.running) break;
      const progress = i / steps;
      this.map.setPaintProperty(layerId, 'fill-extrusion-height', [
        'interpolate', ['linear'], ['coalesce', ['get', field], 0],
        0, 0,
        1, factor * 120 * progress,
        5, factor * 600 * progress,
        20, factor * 1800 * progress
      ]);
      await this.wait(Math.max(10, (duration / steps) / this.speed));
    }
  }

  getPointCoord(feature) {
    if (feature.properties?._coords) return feature.properties._coords;
    const g = feature.geometry;
    if (!g) return null;
    if (g.type === 'Point') return g.coordinates;
    if (g.type === 'GeometryCollection') {
      for (const sub of g.geometries || []) {
        if (sub.type === 'Point') return sub.coordinates;
      }
    }
    return null;
  }

  /** Lignes de flux explicitement qualifiées de « potentiel non documenté ». */
  async drawFlux(fromSource, toSource, color = '#4CAF50', duration = 2000, label) {
    const fromFeatures = this.getLayerFeatures(fromSource);
    const toFeatures = this.getLayerFeatures(toSource);
    if (fromFeatures.length === 0 || toFeatures.length === 0) return;

    const targets = toFeatures.map(f => this.getPointCoord(f)).filter(Boolean);
    if (targets.length === 0) return;

    const fluxFeatures = [];
    for (const src of fromFeatures) {
      const srcCoord = this.getPointCoord(src);
      if (!srcCoord) continue;
      let nearest = null;
      let minDist = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t[0] - srcCoord[0], t[1] - srcCoord[1]);
        if (d < minDist) { minDist = d; nearest = t; }
      }
      if (nearest && minDist < 1) {
        fluxFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [srcCoord, nearest] },
          properties: { _flux: true }
        });
      }
    }

    const limited = fluxFeatures.slice(0, 60);
    const sourceId = `flux-${fromSource}-${toSource}`;
    const layerId = `flux-${fromSource}-${toSource}-line`;
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
    this.map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: limited } });
    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': color,
        'line-width': 1.4,
        'line-opacity': 0.55,
        'line-dasharray': [2, 2]
      }
    });
    this.fluxLayers.push({ layerId, sourceId });
    if (label) this.setFluxNote(label);
  }

  /** Supprime uniquement les lignes de flux (sans réinitialiser la carte). */
  clearFluxLayers() {
    for (const { layerId, sourceId } of this.fluxLayers) {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
      if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
    }
    this.fluxLayers = [];
    this.clearFluxNote();
  }

  setFluxNote(text) {
    const el = document.getElementById('flux-note');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
  }

  clearFluxNote() {
    const el = document.getElementById('flux-note');
    if (el) el.style.display = 'none';
  }

  async drawProgressive(layerId, duration = 3000) {
    const layer = this.map.getLayer(layerId);
    if (!layer) return;
    if (!this.originalOpacity.has(layerId)) {
      const current = this.map.getPaintProperty(layerId, 'line-opacity');
      this.originalOpacity.set(layerId, typeof current === 'number' ? current : 0.85);
    }
    const steps = Math.max(1, Math.ceil(duration / 50));
    for (let i = 0; i <= steps; i++) {
      if (!this.running) break;
      const progress = i / steps;
      this.map.setPaintProperty(layerId, 'line-opacity', this.originalOpacity.get(layerId) * progress);
      await this.wait(Math.max(10, (duration / steps) / this.speed));
    }
    this.map.setPaintProperty(layerId, 'line-opacity', this.originalOpacity.get(layerId));
  }

  showScenarioPopup(content) {
    const html = typeof content === 'string'
      ? `<div class="popup-title">Scénario en cours</div><div style="font-size:12px;line-height:1.5;">${content}</div>`
      : `<div class="popup-title">Scénario en cours</div><div style="font-size:12px;line-height:1.5;">${content?.text || ''}</div>`;
    const center = this.map.getCenter();
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
      .setLngLat([center.lng, center.lat])
      .setHTML(html)
      .addTo(this.map);
    setTimeout(() => popup.remove(), 6000 / this.speed);
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async reset() {
    this.running = false;

    for (const { layerId, sourceId } of this.fluxLayers) {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
      if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
    }
    this.fluxLayers = [];

    for (const layerId of ['plantations-extrusion', 'sous-bassins-extrusion']) {
      if (this.map.getLayer(layerId)) {
        this.map.setPaintProperty(layerId, 'fill-extrusion-height', 0);
      }
    }

    for (const layerId of ['seuils-line', 'pistes-line']) {
      if (this.map.getLayer(layerId)) {
        this.map.setPaintProperty(layerId, 'line-opacity', 0.85);
      }
    }

    this.clearFilters();
    for (const [layerId, opacity] of this.originalOpacity) {
      const layer = this.map.getLayer(layerId);
      if (!layer) continue;
      const prop = layer.type === 'line' ? 'line-opacity'
        : layer.type === 'fill' ? 'fill-opacity' : 'circle-opacity';
      this.map.setPaintProperty(layerId, prop, opacity);
    }
    this.originalOpacity.clear();
    this.clearFluxNote();

    this.layers.hideAll();
    for (const layerId of this.layers.initialVisible) this.layers.show(layerId);

    this.map.flyTo({
      center: CONFIG.center,
      zoom: CONFIG.zoom,
      pitch: CONFIG.pitch,
      bearing: CONFIG.bearing,
      duration: 1200 / this.speed
    });

    await this.wait(1200 / this.speed);
  }

  getFeaturesBySource(sourceId) {
    if (this.featuresBySource[sourceId]) return this.featuresBySource[sourceId];
    const catMap = {
      'plantations': 'C1', 'ravins': 'C2', 'seuils': 'C3',
      'sous-bassins': 'C4', 'pistes': 'C5', 'uv': 'C6',
      'pfc': 'C7', 'mer': 'C8', 'cooperatives': 'C9',
      'tamkin': 'C10', 'mfr': 'C11', 'communes': 'C12',
      'perimetres': 'C14', 'bassins': 'C15'
    };
    const cat = catMap[sourceId];
    if (!cat) return [];
    const result = this.features.filter(f => f.properties._category === cat);
    this.featuresBySource[sourceId] = result;
    return result;
  }

  getLayerFeatures(layerName) {
    const sourceId = layerName in this.getSourceMap() ? layerName : this.getSourceMap()[layerName];
    if (!sourceId) return [];
    let feats = this.getFeaturesBySource(sourceId);
    // Respecte le filtre de scénario actif (ex. filière amandier)
    const layerId = `${sourceId}-circle`;
    const filter = this.filters.get(layerId) || this.filters.get(layerId === 'plantations-circle' ? 'plantations-circle' : sourceId);
    if (filter) feats = feats.filter(f => matchesFilter(f, filter));
    return feats;
  }

  getSourceMap() {
    return {
      plantations: 'plantations', ravins: 'ravins', seuils: 'seuils',
      'sous-bassins': 'sous-bassins', pistes: 'pistes', uv: 'uv',
      pfc: 'pfc', mer: 'mer', cooperatives: 'cooperatives',
      tamkin: 'tamkin', mfr: 'mfr', communes: 'communes',
      perimetres: 'perimetres', bassins: 'bassins'
    };
  }

  applyFilter(layerId, filter) {
    this.filters.set(layerId, filter);
    const expression = filterToExpression(filter);
    if (!expression) return;
    for (const id of PAIRS[layerId] || [layerId]) {
      if (this.map.getLayer(id)) this.map.setFilter(id, expression);
    }
  }

  clearFilters() {
    const layerIds = new Set();
    for (const [layerId] of this.filters) {
      for (const id of PAIRS[layerId] || [layerId]) layerIds.add(id);
    }
    for (const id of layerIds) {
      if (this.map.getLayer(id)) this.map.setFilter(id, null);
    }
    this.filters.clear();
  }

  setOpacity(layerId, opacity) {
    const layer = this.map.getLayer(layerId);
    if (!layer) return;
    const type = layer.type;
    if (type === 'circle') this.map.setPaintProperty(layerId, 'circle-opacity', opacity);
    else if (type === 'line') this.map.setPaintProperty(layerId, 'line-opacity', opacity);
    else if (type === 'fill') this.map.setPaintProperty(layerId, 'fill-opacity', opacity);
    else if (type === 'fill-extrusion') this.map.setPaintProperty(layerId, 'fill-extrusion-opacity', opacity);
  }
}

function filterToExpression(filter) {
  const conditions = [];
  for (const [key, value] of Object.entries(filter)) {
    if (Array.isArray(value)) {
      conditions.push(['in', ['get', key], ['literal', value]]);
    } else {
      conditions.push(['==', ['get', key], value]);
    }
  }
  if (conditions.length === 1) return conditions[0];
  if (conditions.length > 1) return ['all', ...conditions];
  return null;
}

export function matchesFilter(feature, filter) {
  for (const [key, value] of Object.entries(filter)) {
    const v = feature.properties[key];
    if (Array.isArray(value)) {
      if (!value.includes(v)) return false;
    } else if (v !== value) {
      return false;
    }
  }
  return true;
}
