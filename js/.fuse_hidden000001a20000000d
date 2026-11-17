// story-complementarity.js — Mesure spatiale de la complémentarité des actions
//
// Le discours « les actions se complètent » ne convainc un expert que s'il est
// mesuré. Ce module calcule, pour chaque ligne de plantation, trois distances
// au plus proche dispositif :
//   - accès   : piste sous marché retenue (marché + année, hors étude) ;
//   - CES     : ouvrage de conservation des eaux et des sols (seuil ou ravin) ;
//   - marché  : plate-forme de commercialisation (PFC).
//
// Les seuils (5 km, 2 km, 15 km) sont des hypothèses explicites : environ une
// heure de marche pour l'accès, la portée d'un ouvrage anti-érosif sur son
// versant, et un bassin de collecte pour le marché. Le résultat est donc un
// indicateur de proximité (niveau de preuve 2), pas une mesure d'usage réel.
//
// Le calcul est découpé en tranches pour ne pas bloquer l'interface.

const THRESHOLDS = { accessKm: 5, cesKm: 2, marketKm: 15 };
const CELL = 0.02; // ~2,2 km : maille de l'index spatial
const EARTH_KM = 111.32;

export const COMPLEMENTARITY_METHOD = {
  thresholds: THRESHOLDS,
  level: 2,
  formula: 'd = min(distance orthodromique point → sommet de l\'ouvrage) ; levier actif si d ≤ seuil',
  note: 'Proximité géographique calculée sur les géométries du jeu public. Ne mesure ni l\'usage réel, ni la qualité de l\'ouvrage.'
};

function pointOf(feature) {
  const p = feature?.properties || {};
  if (Array.isArray(p._coords)) return p._coords;
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  if (g.type === 'GeometryCollection') {
    for (const sub of g.geometries || []) {
      if (sub.type === 'Point') return sub.coordinates;
    }
  }
  return null;
}

function verticesOf(features) {
  const out = [];
  const walk = (coords) => {
    if (typeof coords?.[0] === 'number') { out.push(coords); return; }
    if (Array.isArray(coords)) for (const c of coords) walk(c);
  };
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'GeometryCollection') {
      for (const sub of g.geometries || []) walk(sub.coordinates);
    } else {
      walk(g.coordinates);
    }
  }
  return out;
}

function buildGrid(points) {
  const cells = new Map();
  for (const p of points) {
    if (!p) continue;
    const key = Math.floor(p[0] / CELL) + '_' + Math.floor(p[1] / CELL);
    let arr = cells.get(key);
    if (!arr) { arr = []; cells.set(key, arr); }
    arr.push(p);
  }
  return cells;
}

function kmBetween(a, b) {
  const dx = (a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy) * EARTH_KM;
}

/** Distance au plus proche point de l'index (Infinity si hors de portée). */
function nearestKm(cells, point, maxRadius = 20) {
  const cx = Math.floor(point[0] / CELL);
  const cy = Math.floor(point[1] / CELL);
  let best = Infinity;
  for (let r = 0; r <= maxRadius; r++) {
    for (let i = cx - r; i <= cx + r; i++) {
      for (let j = cy - r; j <= cy + r; j++) {
        // Ne parcourt que le périmètre de l'anneau.
        if (r > 0 && Math.abs(i - cx) !== r && Math.abs(j - cy) !== r) continue;
        const arr = cells.get(i + '_' + j);
        if (!arr) continue;
        for (const p of arr) {
          const d = kmBetween(point, p);
          if (d < best) best = d;
        }
      }
    }
    // Une fois qu'on a trouvé un point dans un rayon plus petit que l'anneau
    // suivant, aucun point plus proche ne peut apparaître.
    if (best < r * CELL * EARTH_KM) return best;
  }
  return best;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(v) {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export class ComplementarityModel {
  constructor(features) {
    this.features = features || [];
    this.results = null;
    this.running = false;
    this._promise = null;
  }

  get hasResults() { return !!this.results; }

  /** Calcule (une seule fois) les indicateurs de proximité. */
  async compute(onProgress) {
    if (this.results) return this.results;
    if (this.running) return this._promise;
    this.running = true;
    this._promise = this._compute(onProgress).finally(() => { this.running = false; });
    return this._promise;
  }

  async _compute(onProgress) {
    const byCat = (cat) => this.features.filter(f => f.properties?._category === cat);

    const plantations = byCat('C1');
    const pistes = byCat('C5').filter(f => !f.properties?._enEtude && f.properties?._hasMarcheYear);
    const seuils = byCat('C3');
    const ravins = byCat('C2');
    const pfcs = byCat('C7');
    const uvs = byCat('C6');
    const coops = byCat('C9');
    const mfrApi = byCat('C11').filter(f => f.properties?._formation === 'APICULTURE');
    const merApi = byCat('C8').filter(f => f.properties?._merType === 'AGR');

    onProgress?.('Indexation des ouvrages...', 5);
    const accessGrid = buildGrid(verticesOf(pistes));
    const cesGrid = buildGrid([...verticesOf(seuils), ...verticesOf(ravins)]);
    const marketGrid = buildGrid(pfcs.map(pointOf).filter(Boolean));

    const rows = plantations.map(f => {
      const p = pointOf(f);
      if (!p) return null;
      return {
        lon: Math.round(p[0] * 1e5) / 1e5,
        lat: Math.round(p[1] * 1e5) / 1e5,
        filiere: f.properties?._filiere || 'Non renseigné',
        accessKm: null,
        cesKm: null,
        marketKm: null
      };
    }).filter(Boolean);

    const chunk = 350;
    for (let start = 0; start < rows.length; start += chunk) {
      const end = Math.min(rows.length, start + chunk);
      for (let i = start; i < end; i++) {
        const r = rows[i];
        const p = [r.lon, r.lat];
        r.accessKm = round1(nearestKm(accessGrid, p));
        r.cesKm = round1(nearestKm(cesGrid, p));
        r.marketKm = round1(nearestKm(marketGrid, p));
      }
      onProgress?.(
        `Calcul des proximités ${end}/${rows.length}...`,
        10 + Math.round((end / rows.length) * 70)
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    onProgress?.('Agrégation...', 84);

    const statsFor = (list) => {
      const total = list.length;
      let access = 0, ces = 0, market = 0, three = 0, two = 0, one = 0, zero = 0;
      const accessList = [], cesList = [], marketList = [];
      for (const r of list) {
        const a = r.accessKm !== null && r.accessKm <= THRESHOLDS.accessKm;
        const c = r.cesKm !== null && r.cesKm <= THRESHOLDS.cesKm;
        const m = r.marketKm !== null && r.marketKm <= THRESHOLDS.marketKm;
        if (a) access++;
        if (c) ces++;
        if (m) market++;
        const n = (a ? 1 : 0) + (c ? 1 : 0) + (m ? 1 : 0);
        if (n === 3) three++;
        else if (n === 2) two++;
        else if (n === 1) one++;
        else zero++;
        if (r.accessKm !== null) accessList.push(r.accessKm);
        if (r.cesKm !== null) cesList.push(r.cesKm);
        if (r.marketKm !== null) marketList.push(r.marketKm);
      }
      return {
        total,
        access: { count: access, pct: pct(access, total) },
        ces: { count: ces, pct: pct(ces, total) },
        market: { count: market, pct: pct(market, total) },
        combined: {
          three: { count: three, pct: pct(three, total) },
          two: { count: two, pct: pct(two, total) },
          one: { count: one, pct: pct(one, total) },
          zero: { count: zero, pct: pct(zero, total) }
        },
        median: {
          accessKm: round1(median(accessList)),
          cesKm: round1(median(cesList)),
          marketKm: round1(median(marketList))
        }
      };
    };

    const plantation = statsFor(rows);

    // Ventilation par filière : met en évidence les écarts de desserte.
    const byFiliere = {};
    for (const r of rows) {
      if (!byFiliere[r.filiere]) byFiliere[r.filiere] = [];
      byFiliere[r.filiere].push(r);
    }
    plantation.byFiliere = {};
    for (const [fil, list] of Object.entries(byFiliere)) {
      const s = statsFor(list);
      plantation.byFiliere[fil] = {
        total: s.total,
        three: s.combined.three,
        zero: s.combined.zero,
        medianAccessKm: s.median.accessKm,
        medianMarketKm: s.median.marketKm
      };
    }

    // Zone la plus en retrait : parcelles ne cumulant aucun levier.
    const weakest = rows.filter(r =>
      (r.accessKm === null || r.accessKm > THRESHOLDS.accessKm) &&
      (r.cesKm === null || r.cesKm > THRESHOLDS.cesKm) &&
      (r.marketKm === null || r.marketKm > THRESHOLDS.marketKm)
    );
    plantation.weakest = this._clusterOf(weakest);

    // --- Filière apicole : proximité des coopératives aux UV et aux PFC ---
    const coopPoints = coops.map(pointOf).filter(Boolean);
    const uvPoints = uvs.map(pointOf).filter(Boolean);
    const pfcPoints = pfcs.map(pointOf).filter(Boolean);

    const near = (points, targets, thresholdKm) => {
      let count = 0;
      const distances = [];
      for (const p of points) {
        let best = Infinity;
        for (const t of targets) {
          const d = kmBetween(p, t);
          if (d < best) best = d;
        }
        distances.push(best);
        if (best <= thresholdKm) count++;
      }
      return { count, pct: pct(count, points.length), medianKm: round1(median(distances)) };
    };

    const apiculture = {
      coops: coopPoints.length,
      uv: uvPoints.length,
      pfc: pfcPoints.length,
      mfrApi: mfrApi.length,
      merApi: merApi.length,
      coopsNearUv: near(coopPoints, uvPoints, THRESHOLDS.marketKm),
      coopsNearPfc: near(coopPoints, pfcPoints, THRESHOLDS.marketKm),
      uvToPfc: uvPoints.length && pfcPoints.length
        ? round1(Math.min(...uvPoints.map(u => Math.min(...pfcPoints.map(p => kmBetween(u, p))))))
        : null
    };

    this.results = {
      thresholds: { ...THRESHOLDS },
      method: COMPLEMENTARITY_METHOD,
      plantations: rows,
      plantation,
      apiculture,
      computedAt: Date.now()
    };
    onProgress?.('Diagnostic terminé.', 100);
    return this.results;
  }

  /** Centre et emprise d'un ensemble de parcelles (zone à renforcer). */
  _clusterOf(list) {
    if (!list.length) return null;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    let sumLon = 0, sumLat = 0;
    for (const r of list) {
      sumLon += r.lon; sumLat += r.lat;
      if (r.lon < minLon) minLon = r.lon;
      if (r.lon > maxLon) maxLon = r.lon;
      if (r.lat < minLat) minLat = r.lat;
      if (r.lat > maxLat) maxLat = r.lat;
    }
    return {
      count: list.length,
      center: [sumLon / list.length, sumLat / list.length],
      bounds: [[minLon, minLat], [maxLon, maxLat]]
    };
  }

  /** Compte les leviers actifs pour une parcelle selon les seuils choisis. */
  static levelOf(row, active = { access: true, ces: true, market: true }) {
    const a = active.access && row.accessKm !== null && row.accessKm <= THRESHOLDS.accessKm;
    const c = active.ces && row.cesKm !== null && row.cesKm <= THRESHOLDS.cesKm;
    const m = active.market && row.marketKm !== null && row.marketKm <= THRESHOLDS.marketKm;
    return (a ? 1 : 0) + (c ? 1 : 0) + (m ? 1 : 0);
  }

  /** Recalcule les agrégats pour une combinaison de leviers (instantané). */
  countsFor(active) {
    if (!this.results) return null;
    let three = 0, two = 0, one = 0, zero = 0, allActive = 0;
    const activeCount = Object.values(active).filter(Boolean).length;
    for (const r of this.results.plantations) {
      const n = ComplementarityModel.levelOf(r, active);
      if (n === 3) three++;
      else if (n === 2) two++;
      else if (n === 1) one++;
      else zero++;
      if (n === activeCount) allActive++;
    }
    const total = this.results.plantations.length;
    return {
      total,
      activeCount,
      allActive: { count: allActive, pct: pct(allActive, total) },
      three: { count: three, pct: pct(three, total) },
      two: { count: two, pct: pct(two, total) },
      one: { count: one, pct: pct(one, total) },
      zero: { count: zero, pct: pct(zero, total) }
    };
  }
}

export { THRESHOLDS };
