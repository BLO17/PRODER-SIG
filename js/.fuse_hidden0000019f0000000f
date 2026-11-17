// story-hotspots.js — Mise en évidence des entités citées par la narration
//
// Deux mécanismes complémentaires :
//  - un "halo" (cercle lumineux) pose sur l'entité dont la voix parle ;
//  - un popup ancré sur cette entité, reprenant la fiche descriptive déjà
//    utilisée par le mode classique (UIManager.buildPopup).

export class StoryHotspots {
  constructor(map, layerManager, uiManager, features) {
    this.map = map;
    this.layers = layerManager;
    this.ui = uiManager;
    this.features = features || [];
    this.popup = null;
    this.pulseTimer = null;
    this._ensureHaloLayer();
  }

  /** Couche de halo, ajoutee dynamiquement au-dessus des couches metier. */
  _ensureHaloLayer() {
    if (!this.map.getSource('story-halo')) {
      this.map.addSource('story-halo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!this.map.getLayer('story-halo')) {
      this.map.addLayer({
        id: 'story-halo',
        type: 'circle',
        source: 'story-halo',
        paint: {
          'circle-radius': 16,
          'circle-color': '#FFD600',
          'circle-opacity': 0.32,
          'circle-blur': 0.45,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFE57F'
        }
      });
    }
  }

  /** Coordonnees representative d'une entite (point, centroide d'anneau, ou 1er point). */
  static coordOf(feature) {
    const g = feature?.geometry;
    if (!g) return null;
    if (g.type === 'Point') return g.coordinates;
    if (g.type === 'MultiPoint') return g.coordinates?.[0] || null;
    if (g.type === 'LineString') return g.coordinates?.[0] || null;
    if (g.type === 'Polygon' && g.coordinates?.[0]?.length) {
      const ring = g.coordinates[0];
      const sum = ring.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
      return [sum[0] / ring.length, sum[1] / ring.length];
    }
    if (g.type === 'MultiPolygon' && g.coordinates?.[0]?.[0]?.length) {
      const ring = g.coordinates[0][0];
      const sum = ring.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
      return [sum[0] / ring.length, sum[1] / ring.length];
    }
    if (g.type === 'GeometryCollection' && g.geometries?.length) {
      return StoryHotspots.coordOf({ geometry: g.geometries[0] });
    }
    return null;
  }

  /** Recherche les entites correspondant a un predicat. */
  find(predicate, limit = 1) {
    const found = [];
    for (const f of this.features) {
      if (predicate(f)) {
        found.push(f);
        if (found.length >= limit) break;
      }
    }
    return found;
  }

  /** Pose le halo sur une ou plusieurs entites. */
  setHalo(features) {
    const source = this.map.getSource('story-halo');
    if (!source) return;
    const feats = (features || [])
      .map(f => {
        const c = StoryHotspots.coordOf(f);
        if (!c) return null;
        return { type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} };
      })
      .filter(Boolean);
    source.setData({ type: 'FeatureCollection', features: feats });
    this._startPulse();
  }

  clearHalo() {
    const source = this.map.getSource('story-halo');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
    this._stopPulse();
  }

  _startPulse() {
    this._stopPulse();
    let t = 0;
    this.pulseTimer = setInterval(() => {
      if (!this.map.getLayer('story-halo')) return this._stopPulse();
      t += 0.09;
      const radius = 14 + Math.sin(t) * 5;
      const opacity = 0.22 + (Math.sin(t) * 0.5 + 0.5) * 0.3;
      this.map.setPaintProperty('story-halo', 'circle-radius', radius);
      this.map.setPaintProperty('story-halo', 'circle-opacity', opacity);
    }, 60);
  }

  _stopPulse() {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  /**
   * Affiche un popup ancre sur l'entite citee.
   * @param {object} feature  entite GeoJSON
   * @param {object} extra    lignes supplementaires [{label, value}]
   */
  showPopup(feature, extra = []) {
    this.closePopup();
    if (!feature) return;
    const coord = StoryHotspots.coordOf(feature);
    if (!coord) return;

    let html = '';
    if (this.ui?.buildPopup) {
      html = this.ui.buildPopup(feature);
    } else {
      html = '<div class="popup-title">' + (feature.properties?.name || 'Entité') + '</div>';
    }
    if (extra.length) {
      const rows = extra
        .filter(r => r.value !== null && r.value !== undefined && r.value !== '')
        .map(r => '<div class="popup-row"><span class="popup-label">' + r.label + '</span><span class="popup-value">' + r.value + '</span></div>')
        .join('');
      if (rows) html += '<div class="popup-divider"></div>' + rows;
    }

    this.popup = new maplibregl.Popup({
      maxWidth: '340px',
      closeButton: true,
      closeOnClick: false,
      className: 'story-popup'
    })
      .setLngLat(coord)
      .setHTML(html)
      .addTo(this.map);
  }

  /** Affiche un popup non ancre (donnees agregees, pas d'entite unique). */
  showSummaryPopup(coord, title, rows = []) {
    this.closePopup();
    if (!coord) return;
    const body = rows
      .filter(r => r.value !== null && r.value !== undefined && r.value !== '')
      .map(r => '<div class="popup-row"><span class="popup-label">' + r.label + '</span><span class="popup-value">' + r.value + '</span></div>')
      .join('');
    this.popup = new maplibregl.Popup({
      maxWidth: '340px',
      closeButton: true,
      closeOnClick: false,
      className: 'story-popup'
    })
      .setLngLat(coord)
      .setHTML('<div class="popup-title">' + title + '</div>' + body)
      .addTo(this.map);
  }

  closePopup() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }
}
