// valorisation.js — Composante 2 (Valorisation) : les MER.
//
// Deux familles d'entités C8 dans le jeu public :
//
//   • 17 UNITÉS MER : points nommés (TLAYLA, TAFZA, CHABAB OULED HADOU…)
//     porteurs du champ « N°-MER : MER-00X » et du « Code » de spécialité ;
//   • 214 ADHÉRENTS : points nommés « MER-00X » (leur unité), porteurs du
//     genre, du drapeau jeune et de l'identifiant anonyme du jeu public.
//
// La spécialité est LUE dans le champ `Code` de la source, jamais déduite :
// MER-001 est l'unité apicole (10 adhérents, « MER-001-API-Miel-… »), les 16
// autres sont des micro-entreprises arboricoles (204 adhérents, « MER-…-EM-… »).
//
// L'unité est affichée à la position de SA PROPRE entité source (pas un
// centroïde calculé) ; le centroïde ne sert que de repli si l'entité unité
// venait à manquer.
//
// Aucune donnée nominative n'est conservée : uniquement le code d'unité,
// le genre, le drapeau jeune et l'identifiant anonyme du jeu public.
// Le CIN n'atteint ni les couches, ni le menu, ni la fiche.

export const MER_COLORS = {
  // Hors palette plantation (Amandier #E65100 / Figuier #2E7D32 /
  // Caroubier #795548 / Olivier #1565C0) : les anciens #F4A261 / #6A994E
  // se confondaient avec les points plantation → MER « invisibles »
  // (bug diagnostiqué navigateur réel, 25/10 — v j).
  apiculture: '#C2185B',    // rose — couleur MER officielle (config C8)
  arboriculture: '#7B1FA2'  // violet — aucun autre calque ne l'utilise
};

export const MER_LABELS = {
  apiculture: 'Apiculture',
  arboriculture: 'Arboriculture'
};

const UNIT_NAME_RE = /^MER-(\d{3})$/i;

/** Cercle → initiale : AKNOUL → A, TAINASTE → T (sans accent, pas de sensibilité). */
function cercleLetter(circle) {
  const c = String(circle || '').trim().toUpperCase();
  if (c.startsWith('AKNOUL')) return 'A';
  if (c.startsWith('TAINASTE')) return 'T';
  return null;
}

/** Code d'unité porté par le nom de l'entité. */
function unitOf(props, parsed) {
  const m = UNIT_NAME_RE.exec(String(props.name || '').trim());
  if (m) return 'MER-' + m[1];
  const code = String(props._code || (parsed && (parsed['N°-MER'] || parsed['N°MER'])) || '');
  const m2 = code.match(/MER-(\d{3})/i);
  return m2 ? 'MER-' + m2[1] : null;
}

/**
 * Spécialité lue dans le champ `Code` de la source :
 * « MER-001-API-Miel-… » = apiculture · « MER-…-EM-… » = arboriculture.
 * Repli sur le code d'unité si le champ manque.
 */
export function specialiteOf(props, unit) {
  const code = String(props._code || props['Code'] || props['N°-MER'] || '');
  if (/API|MIEL/i.test(code)) return 'apiculture';
  if (/EM|AGR|ARB/i.test(code)) return 'arboriculture';
  return unit === 'MER-001' ? 'apiculture' : 'arboriculture';
}

function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Agrège les entités MER (C8) en unités.
 *
 * @returns {object} {
 *   units: Array,        // 17 unités triées par code (stats + point + nom + année)
 *   byUnit: Map,         // 'MER-001' → unité (adhérents : liste de coordonnées)
 *   unitsFC: object,     // FeatureCollection : 17 points d'unité
 *   adherentsFC: object, // FeatureCollection : 214 adhérents (mini-propriétés)
 *   total: number,       // nombre d'adhérents
 *   parSpecialite: object // { apiculture: { unites, adherents }, arboriculture: {…} }
 * }
 */
export function buildMERUnits(features) {
  const byUnit = new Map();
  const adherents = [];

  for (const f of features || []) {
    const p = f.properties || {};
    if (p._category !== 'C8') continue;

    const coords = (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates)
      || p._coords || null;
    if (!coords) continue;

    const parsed = p._parsed || {};
    const nmer = parsed['N°-MER'] || parsed['N°MER'] || p['N°-MER'] || p['N°MER'];
    const unit = unitOf(p, parsed);
    if (!unit) continue;

    // Entité UNITÉ : nom propre (pas « MER-NNN ») + champ N°-MER.
    if (!UNIT_NAME_RE.test(String(p.name || '').trim()) && nmer) {
      if (!byUnit.has(unit)) {
        byUnit.set(unit, {
          unit, specialite: specialiteOf(p, unit),
          nom: String(p.name || '').trim() || null,
          annee: toNum(parsed['Année de création']),
          cercle: parsed['Cercle'] || p['Cercle'] || null,
          count: 0, femmes: 0, jeunes: 0,
          adherents: [],
          _sumLon: 0, _sumLat: 0
        });
      } else {
        // Enrichit l'unité déjà créée par ses adhérents.
        const u = byUnit.get(unit);
        if (!u.nom) u.nom = String(p.name || '').trim() || null;
        if (!u.annee) u.annee = toNum(parsed['Année de création']);
        u.specialite = specialiteOf(p, unit);
      }
      if (!byUnit.get(unit)._point) byUnit.get(unit)._point = coords;
      continue;
    }

    // Adhérent (nom « MER-NNN ») : rattaché à son unité.
    const genre = String(p._genre || parsed['GENRE (H/F)'] || parsed['Genre (H/F)'] || '').toUpperCase();
    const jeune = (p._jeune === '1' || p._jeune === 1) ? '1' : '0';
    const specialite = specialiteOf(p, unit);

    if (!byUnit.has(unit)) {
      byUnit.set(unit, {
        unit,
        specialite,
        nom: null,
        annee: null,
        count: 0,
        femmes: 0,
        jeunes: 0,
        adherents: [],
        _sumLon: 0,
        _sumLat: 0
      });
    }
    const u = byUnit.get(unit);
    if (!u.cercle) u.cercle = parsed['Cercle'] || p['Cercle'] || null;
    u.count++;
    if (genre === 'F') u.femmes++;
    if (jeune === '1') u.jeunes++;
    u._sumLon += coords[0];
    u._sumLat += coords[1];
    u.adherents.push(coords);

    adherents.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        name: unit,
        _unit: unit,
        _specialite: specialite,
        _genre: (genre === 'F' || genre === 'H') ? genre : '',
        _jeune: jeune,
        _benefId: p._benefId || null
      }
    });
  }

  const units = [];
  for (const u of byUnit.values()) {
    // Position : l'entité unité de la source, repli sur le centroïde.
    u.centroid = u._point
      ? u._point
      : [u._sumLon / Math.max(1, u.count), u._sumLat / Math.max(1, u.count)];
    u.isEntite = Boolean(u._point);
    u.cercleLetter = cercleLetter(u.cercle);
    u.femmesPct = u.count ? Math.round((u.femmes / u.count) * 100) : 0;
    u.jeunesPct = u.count ? Math.round((u.jeunes / u.count) * 100) : 0;
    delete u._sumLon;
    delete u._sumLat;
    delete u._point;
    units.push(u);
  }
  units.sort((a, b) => a.unit.localeCompare(b.unit));

  const parSpecialite = {
    apiculture: { unites: 0, adherents: 0 },
    arboriculture: { unites: 0, adherents: 0 }
  };
  for (const u of units) {
    parSpecialite[u.specialite].unites++;
    parSpecialite[u.specialite].adherents += u.count;
  }

  return {
    units,
    byUnit,
    unitsFC: {
      type: 'FeatureCollection',
      features: units.map((u) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: u.centroid },
        properties: {
          name: u.nom || u.unit,
          _unit: u.unit,
          _nom: u.nom || null,
          _annee: u.annee || null,
          _cercle: u.cercle || null,
          _cercleLetter: u.cercleLetter || null,
          _specialite: u.specialite,
          _count: u.count,
          _femmes: u.femmes,
          _jeunes: u.jeunes,
          _femmesPct: u.femmesPct,
          _jeunesPct: u.jeunesPct
        }
      }))
    },
    adherentsFC: { type: 'FeatureCollection', features: adherents },
    total: adherents.length,
    parSpecialite
  };
}

/**
 * Agrège les entités C6 (UV) et C7 (PFC) du jeu public.
 * Chaque feature = une entité unique (nom + coordonnées), pas d'agrégation.
 *
 * @returns {{ units: Array<{name, coords}>, unitsFC: FeatureCollection }}
 */
export function buildUVUnits(features) {
  const units = [];
  for (const f of features || []) {
    if ((f.properties || {})._category !== 'C6') continue;
    const coords = (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates)
      || null;
    if (!coords) continue;
    units.push({ name: String(f.properties.name || '').trim(), coords });
  }
  return { units, unitsFC: { type: 'FeatureCollection', features: units.map(u => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: u.coords }, properties: { _name: u.name, _type: 'uv' }
  })) } };
}

export function buildPFCUnits(features) {
  const units = [];
  for (const f of features || []) {
    if ((f.properties || {})._category !== 'C7') continue;
    const coords = (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates)
      || null;
    if (!coords) continue;
    units.push({ name: String(f.properties.name || '').trim(), coords });
  }
  return { units, unitsFC: { type: 'FeatureCollection', features: units.map(u => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: u.coords }, properties: { _name: u.name, _type: 'pfc' }
  })) } };
}

/**
 * Agrège les entités C9 (Coopératives apicoles) du jeu public.
 * Chaque coopérative a plusieurs features (résumé + bénéficiaires). On prend
 * la première feature par Code pour avoir le résumé et les coordonnées.
 *
 * @returns {{ units: Array<{code,name,coords}>, unitsFC: FeatureCollection }}
 */
export function buildCoopUnits(features) {
  const byCode = {};
  for (const f of features || []) {
    if ((f.properties || {})._category !== 'C9') continue;
    const p = f.properties || {};
    const code = p.Code || p['Code'] || '';
    if (!code.startsWith('API_')) continue;
    const coords = (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates)
      || null;
    if (!coords) continue;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(f);
  }
  const units = [];
  for (const [code, list] of Object.entries(byCode)) {
    // Le résumé de la coopérative (nom textuel, ex "Ain Snan") et pas un
    // bénéficiaire (nom `1`, `2`, â¦) : une coopérative a 1 résumé + N
    // bénéficiaires, un seul point ne doit pas afficher la fiche "." une
    // seule entité de contactée.
    const summary = list.find(f => !/^\d+$/.test(String(f.properties?.name || ''))) || list[0];
    const p = summary.properties || {};
    const total = parseInt(p["Nbre d'adhérents Total"]) || 0;
    units.push({
      code,
      name: String(p.name || code).trim(),
      coords: summary.geometry.coordinates,
      specialite: specialiteOf(p, code),
      union: p['Appartenant à l\'Union'] || '',
      cercle: p['Cercle'] || '',
      ct: p['CT'] || '',
      annee: p['Année création'] || '',
      total,
      femmes: parseInt(p["Nbre d'adhérents FEMMES"]) || 0,
      jeunes: parseInt(p["Nbre d'adhérents JEUNES"]) || 0,
    });
  }
  return { units, unitsFC: { type: 'FeatureCollection', features: units.map(u => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: u.coords }, properties: { _code: u.code, _name: u.name, _type: 'coop' }
  })) } };
}
