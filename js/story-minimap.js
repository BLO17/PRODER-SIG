// story-minimap.js — Mini-carte d'orientation (canvas 2D)
//
// Un second contexte WebGL serait lourd et instable : la mini-carte est
// dessinee en canvas 2D a partir des geometries deja chargees. Elle donne
// les reperes essentials : sous-bassins, communes, noeuds structurants
// (PFC / UV) et le rectangle de la vue courante.

const PAD = 6;

export class StoryMinimap {
  constructor(map, features, host) {
    this.map = map;
    this.features = features || [];
    this.host = host;
    this.canvas = null;
    this.ctx = null;
    this.bounds = null;
    this._onMove = null;
  }

  init() {
    if (!this.host) return;
    this.host.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.host.appendChild(this.canvas);

    this.bounds = this._computeBounds();
    this._resize();
    this._drawStatic();
    this.render();

    this._onMove = () => this.render();
    if (this.map) this.map.on('move', this._onMove);
    this._onResize = () => { this._resize(); this._drawStatic(); this.render(); };
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    if (this.map && this._onMove) this.map.off('move', this._onMove);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  _computeBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (coords) => {
      if (typeof coords?.[0] === 'number') {
        const [x, y] = coords;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        return;
      }
      if (Array.isArray(coords)) for (const c of coords) visit(c);
    };
    for (const f of this.features) {
      const cat = f.properties?._category;
      if (!['C4', 'C12', 'C6', 'C7', 'C15'].includes(cat)) continue;
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'GeometryCollection') {
        for (const gg of g.geometries || []) visit(gg.coordinates);
      } else {
        visit(g.coordinates);
      }
    }
    if (!Number.isFinite(minX)) return { minX: -4.2, minY: 34.3, maxX: -3.6, maxY: 34.9 };
    // Marge relative de 4 %.
    const dx = (maxX - minX) * 0.04 || 0.05;
    const dy = (maxY - minY) * 0.04 || 0.05;
    return { minX: minX - dx, minY: minY - dy, maxX: maxX + dx, maxY: maxY + dy };
  }

  _resize() {
    if (!this.canvas || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(60, Math.round(rect.width));
    const h = Math.max(60, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.cssW = w;
    this.cssH = h;
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;
  }

  /** Convertit des coordonnees lon/lat en pixels de la mini-carte. */
  _project([lon, lat]) {
    const b = this.bounds;
    const w = this.cssW - PAD * 2;
    const h = this.cssH - PAD * 2;
    const x = PAD + ((lon - b.minX) / (b.maxX - b.minX)) * w;
    const y = PAD + (1 - (lat - b.minY) / (b.maxY - b.minY)) * h;
    return [x, y];
  }

  _drawStatic() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.85)';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // Sous-bassins et bassins
    for (const f of this.features) {
      const cat = f.properties?._category;
      if (cat !== 'C4' && cat !== 'C15') continue;
      const g = f.geometry;
      const polys = g?.type === 'GeometryCollection'
        ? g.geometries.filter(x => x.type === 'Polygon')
        : (g?.type === 'Polygon' ? [g] : []);
      ctx.beginPath();
      for (const poly of polys) {
        const ring = poly.coordinates?.[0];
        if (!ring?.length) continue;
        ring.forEach((c, i) => {
          const [x, y] = this._project(c);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = cat === 'C4' ? 'rgba(26, 35, 126, 0.55)' : 'rgba(13, 71, 161, 0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 140, 255, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Communes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 0.6;
    for (const f of this.features) {
      if (f.properties?._category !== 'C12') continue;
      const g = f.geometry;
      const polys = g?.type === 'GeometryCollection'
        ? g.geometries.filter(x => x.type === 'Polygon')
        : (g?.type === 'Polygon' ? [g] : []);
      for (const poly of polys) {
        const ring = poly.coordinates?.[0];
        if (!ring?.length) continue;
        ctx.beginPath();
        ring.forEach((c, i) => {
          const [x, y] = this._project(c);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Noeuds structurants
    for (const f of this.features) {
      const cat = f.properties?._category;
      if (cat !== 'C6' && cat !== 'C7') continue;
      const c = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
      if (!c) continue;
      const [x, y] = this._project(c);
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = cat === 'C7' ? '#0288D1' : '#9C27B0';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  /** Redessine le rectangle de la vue courante. */
  render() {
    if (!this.ctx || !this.map) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this._drawStatic();

    const b = this.map.getBounds();
    const nw = this._project([b.getWest(), b.getNorth()]);
    const se = this._project([b.getEast(), b.getSouth()]);
    const x = Math.min(nw[0], se[0]);
    const y = Math.min(nw[1], se[1]);
    const w = Math.abs(se[0] - nw[0]);
    const h = Math.abs(se[1] - nw[1]);
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
    ctx.fillRect(x, y, w, h);
  }
}
