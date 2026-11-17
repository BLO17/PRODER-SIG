// market.js — Numéros de marché : normalisation et agrégats par marché
//
// Le GeoJSON écrit le numéro de marché sous plusieurs graphies :
//   plantation : "M06/21"                      (préfixe M, année sur 2 chiffres)
//   périmètre  : "06/2021/DPA/32/SMOPFPA"      (année sur 4 chiffres, suffixe technique)
//   périmètre  : "M31/2022"  ·  "AO 48/2024"
//
// Une égalité littérale entre ces formes ne renvoie aucune correspondance.
// On normalise en extrayant le couple (numéro, année), qui est le même
// identifiant écrit de deux manières. Ce n'est pas une inférence spatiale :
// la clé est portée explicitement par les deux côtés (lien documenté).

const pad2 = (n) => String(n).padStart(2, '0');

/** Extrait (numéro, année) d'une graphie de numéro de marché. */
export function parseMarket(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // « 06/2021/DPA/32/SMOPFPA », « M31/2022 », « AO 48/2024 »
  let m = s.match(/(\d{1,3})\s*\/\s*(\d{4})/);
  if (m) return { num: m[1], year: m[2] };
  // « M06/21 » — année sur deux chiffres
  m = s.match(/(\d{1,3})\s*\/\s*(\d{2})(?!\d)/);
  if (m) return { num: m[1], year: String(2000 + parseInt(m[2], 10)) };
  return null;
}

/**
 * Alias de clé de marché : deux graphies de la source s'écrivent différemment
 * du côté des lignes de plantation et du côté des polygones de périmètre.
 * L'alias unifie la clé de jointure ; l'année affichée est celle VALIDÉE par
 * le responsable du projet (le polygone de périmètre portait la graphie source).
 *   « 14/2026 » (périmètre) → 14/2025 (lignes) ; « 33/2023 » (périmètre) → 33/2024 (lignes)
 * La graphie d'origine reste disponible via `_marcheRaw` (traçabilité).
 */
const MARKET_KEY_ALIASES = {
  '14/2026': '14/2025',
  '33/2023': '33/2024'
};

/** Clé canonique « NN/AAAA » — sert de jointure entre les couches. */
export function normalizeMarket(raw) {
  const p = parseMarket(raw);
  if (!p) return null;
  const key = `${pad2(p.num)}/${p.year}`;
  return MARKET_KEY_ALIASES[key] || key;
}

/**
 * Libellé d'affichage : même normalisation, en conservant le préfixe porté par
 * la source (M, AO…). À défaut de préfixe, `fallbackPrefix` est appliqué —
 * c'est la convention retenue pour les marchés de plantation.
 */
export function marketLabel(raw, fallbackPrefix = 'M') {
  const p = parseMarket(raw);
  if (!p) return raw ? String(raw).trim() : '—';
  const orig = String(raw).trim();
  const found = (orig.match(/^\s*([A-Za-z]{1,3})\s*/) || [])[1] || '';
  const pre = found || fallbackPrefix || '';
  const spaced = pre && pre.length > 1 ? pre + ' ' : pre;
  return `${spaced}${pad2(p.num)}/${p.year}`;
}

/** Graphie d'origine, affichée en second rang (traçabilité de la source). */
export function marketSourceLabel(raw) {
  const s = raw === null || raw === undefined ? '' : String(raw).trim();
  return s || '—';
}

/**
 * Suffixe technique affiché après le numéro de marché.
 *
 * La source écrit deux graphies pour le même service :
 *   « …/DPA/32/SMOPFPA » (amandier, figuier, olivier)
 *   « …/DPA/SMOPFA »    (caroubier)
 * L'affichage retient une forme unique, sur une seule ligne, pour que tous
 * les marchés se lisent de la même façon. La graphie d'origine reste
 * disponible via `marketSourceLabel()`.
 */
const DISPLAY_SUFFIX = '/DPA/32/SMOPFPA';

/**
 * Numéro de marché normalisé pour l'affichage : « NN/AAAA/DPA/32/SMOPFPA ».
 *
 * L'année est systématique (4 chiffres), le préfixe de la source est retiré :
 * « M06/21 », « 06/2021/DPA/32/SMOPFPA » et « AO 48/2024 » donnent tous une
 * forme unique, comparable d'un marché à l'autre.
 */
export function marketDisplayLabel(raw) {
  const p = parseMarket(raw);
  if (!p) return marketSourceLabel(raw);
  return `${pad2(p.num)}/${p.year}${DISPLAY_SUFFIX}`;
}

/**
 * Agrège, par numéro de marché normalisé, les lignes de plantation :
 * bénéficiaires distincts, genre, statut jeune, périmètre majoritaire.
 * Les populations ne sont jamais additionnées à celles d'un autre marché.
 */
export function buildMarketAggregates(features) {
  const idx = new Map();

  for (const f of features || []) {
    const p = f.properties;
    if (p?._category !== 'C1') continue;
    const key = p._marcheKey;
    if (!key) continue;

    let rec = idx.get(key);
    if (!rec) {
      rec = newBucket(key);
      idx.set(key, rec);
    }
    addToBucket(rec, f);
  }

  const out = new Map();
  for (const [key, rec] of idx) out.set(key, summarize(key, rec));
  return out;
}

// ---------------------------------------------------------------- agrégation

/**
 * Clé de comparaison d'un nom de territoire : insensible à la casse, aux
 * accents et aux espaces superflus.
 *
 * **Pourquoi c'est indispensable.** Dans la source, la même commune s'écrit
 * `JBARNA` sur certaines lignes et `Jbarna` sur d'autres. En comptant les
 * valeurs brutes, l'application affichait « Jbarna +1 » — c'est-à-dire deux
 * communes là où il n'y en a qu'une. C'est le responsable du projet qui l'a
 * relevé. Toute agrégation de noms passe donc par cette clé.
 */
export function territoireKey(name) {
  return String(name || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Graphie d'AFFICHAGE d'un nom de territoire.
 *
 * La source écrit le même cercle tantôt `Aknoul`, tantôt `AKNOUL`. Sans cette
 * normalisation, la fiche afficherait « AKNOUL » à côté de « Tainaste » — une
 * incohérence de présentation dans un document destiné à des experts.
 *
 * La règle est volontairement étroite : **seules** les chaînes entièrement en
 * capitales sont rétablies en casse de lecture. `Tizi Ousli`, `Oulad
 * Bousaadan` ou `Bni Boujttou` passent donc inchangés, sans risque d'abîmer une
 * graphie correcte. C'est une correction d'affichage, pas de donnée : le libellé
 * source reste dans les propriétés de l'entité.
 */
export function territoireLabel(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(
    /(^|[\s\-'’])(\p{L})/gu,
    (_, sep, ch) => sep + ch.toUpperCase()
  );
}

function newBucket(key) {
  return {
    key,
    rows: 0,
    persons: new Map(),    // id -> { genre, jeune }
    perimetres: new Map(), // nom -> occurrences
    // Cercle (Aknoul, Tainaste…) : clé normalisée -> { libellé, lignes }.
    // Un marché n'est pas forcément dans un seul cercle ; on conserve donc les
    // occurrences, et le libellé le plus fréquent sert à l'affichage (la casse
    // de la source est irrégulière, on ne veut pas afficher « JBARNA »).
    cercles: new Map(),
    raws: new Set(),
    annees: new Set()
  };
}

function addToBucket(bucket, feature) {
  const p = feature.properties;
  bucket.rows++;
  if (p._marcheRaw) bucket.raws.add(String(p._marcheRaw).trim());
  else if (p._marche) bucket.raws.add(String(p._marche).trim());
  if (p._annee) bucket.annees.add(p._annee);

  const cercle = p._cercle ? String(p._cercle).trim() : null;
  if (cercle) {
    const k = territoireKey(cercle);
    const rec = bucket.cercles.get(k) || { labels: new Map(), lignes: 0 };
    rec.lignes++;
    rec.labels.set(cercle, (rec.labels.get(cercle) || 0) + 1);
    bucket.cercles.set(k, rec);
  }

  addPerson(bucket, p);

  // Sous-agrégat par périmètre : un marché couvre plusieurs polygones,
  // les bénéficiaires y sont répartis par périmètre.
  const label = p._perimetre;
  if (label) {
    if (!bucket.perimetres.has(label)) bucket.perimetres.set(label, newBucket(bucket.key));
    const sub = bucket.perimetres.get(label);
    sub.rows++;
    addPerson(sub, p);
  }
}

/**
 * Bénéficiaire distinct : identifiant pseudonymisé, à défaut la ligne elle-même.
 *
 * L'identité vient du CIN dans la source nominative ; le build le remplace par
 * `_benefId` (SHA-256 tronqué), donc deux lignes de même `_benefId` sont bien
 * la même personne. Les lignes sans CIN exploitable n'ont pas d'identifiant :
 * elles retombent sur `row-N` et ne peuvent pas être regroupées.
 *
 * `sup` accumule les parcelles : le champ SUP de la source est la superficie
 * d'UNE parcelle, pas de l'exploitation. Un bénéficiaire qui a trois parcelles
 * de 2, 3 et 4 ha a une superficie cumulée de 9 ha.
 */
function addPerson(bucket, p) {
  const pid = p._benefId || `row-${p._rowId}`;
  let person = bucket.persons.get(pid);
  if (!person) {
    person = { genre: null, jeune: false, sup: 0, parcelles: 0 };
    bucket.persons.set(pid, person);
  }
  if (Number.isFinite(p._sup) && p._sup > 0) {
    person.sup += p._sup;
    person.parcelles++;
  }
  if (p._genre === 'F' || p._genre === 'H') person.genre = p._genre;
  if (p._jeune === '1') person.jeune = true;
}

/** Normalisation d'un nom de périmètre (accents, casse, ponctuation). */
export function normalizePerimetre(name) {
  return String(name || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Squelette sans voyelles : tolère les fautes d'orthographe entre le nom du
 * polygone et le champ PERIMETRE des lignes.
 *
 * Observé sur le calque arboriculture :
 *   polygone « Bni Boujttou 4 »  →  BNI BOUJTTOU 4
 *   ligne    « BNI BOUJETTOU 4 » →  BNI BOUJETTOU 4     ← ne s'apparie pas
 *   sans voyelles : « BNBJTT4 » des deux côtés ✓
 */
export function perimetreSkeleton(name) {
  const base = normalizePerimetre(name);
  return base ? base.replace(/[AEIOUY]/g, '') : null;
}

function summarize(key, bucket) {
  let femmes = 0, hommes = 0, jeunes = 0, genreConnus = 0;
  // Classes de superficie cumulée par bénéficiaire (parcelles additionnées).
  // Bornes : [0 ; 2[ , [2 ; 5[ , [5 ; +∞[. Une personne sans SUP connu n'est
  // classée dans aucune : elle est comptée à part, jamais rangée en 0-2 ha.
  const supClasses = { p0_2: 0, p2_5: 0, p5plus: 0, sansSup: 0 };
  for (const person of bucket.persons.values()) {
    if (person.genre) {
      genreConnus++;
      if (person.genre === 'F') femmes++; else hommes++;
    }
    if (person.jeune) jeunes++;

    if (person.parcelles > 0) {
      const s = person.sup;
      // Bornes demandées : 0-2 ha, 2-5 ha, plus de 5 ha. Une exploitation de
      // exactement 5 ha reste donc dans « 2-5 ha ».
      if (s < 2) supClasses.p0_2++;
      else if (s <= 5) supClasses.p2_5++;
      else supClasses.p5plus++;
    } else {
      supClasses.sansSup++;
    }
  }

  let perimetre = null, best = 0;
  const perimetreNames = [];
  const byPerimetre = {};
  for (const [name, sub] of bucket.perimetres) {
    if (name && !perimetreNames.includes(name)) perimetreNames.push(name);
    if (sub.rows > best) { best = sub.rows; perimetre = name; }
    const summary = summarize(name, sub);
    const exact = normalizePerimetre(name);
    if (exact) byPerimetre[exact] = summary;
    const sk = perimetreSkeleton(name);
    if (sk && !byPerimetre[sk]) byPerimetre[sk] = summary;
  }

  // Cercles du marché, du plus représenté au moins représenté.
  //
  // Le regroupement passe par `territoireKey` — insensible à la casse et aux
  // accents — sinon `JBARNA` et `Jbarna` compteraient pour deux cercles.
  // Le libellé affiché est celui qui revient le PLUS SOUVENT dans la source
  // (à égalité, le premier par ordre alphabétique) : la casse de la source
  // étant irrégulière, on ne peut pas prendre la première valeur rencontrée.
  const cerclesSorted = [...bucket.cercles.values()]
    .map((rec) => ({
      lignes: rec.lignes,
      // Graphie la plus fréquente dans la source, puis rétablie en casse de
      // lecture si elle était entièrement en capitales (`AKNOUL` → `Aknoul`).
      label: territoireLabel([...rec.labels.entries()]
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'fr'))[0][0])
    }))
    .sort((a, b) => (b.lignes - a.lignes) || a.label.localeCompare(b.label, 'fr'))
    .map((c) => c.label);

  const persons = bucket.persons.size;
  return {
    key,
    label: key,
    raws: [...bucket.raws],
    annees: [...bucket.annees].sort((a, b) => a - b),
    rows: bucket.rows,
    persons,
    femmes, hommes, jeunes,
    genreConnus,
    // `cercle` est le cercle principal, `cercles` les liste tous. La commune
    // n'est plus affichée (choix du responsable du projet : le cercle est un
    // repère de lecture plus utile), mais elle reste dans les propriétés des
    // entités pour les popups des autres calques.
    cercle: cerclesSorted[0] || null,
    cercles: cerclesSorted,
    cerclesCount: cerclesSorted.length,
    // Taux « métier ». La bande qui les affichait a été retirée de la fiche du
    // marché (demande du responsable du projet) : `pctFemmes`, `pctHommes` et
    // `pctJeunes` n'ont donc PLUS AUCUN CONSOMMATEUR dans le code — vérifié par
    // recherche sur tout `js/`. Ils sont conservés car ils décrivent le marché
    // de façon exacte, et parce que les effectifs bruts (`femmes`, `hommes`,
    // `jeunes`) restent affichés dans les barres GENRE et JEUNES. À supprimer
    // sans crainte si l'on veut réduire la surface d'agrégats.
    pctFemmes: genreConnus ? (femmes / genreConnus) * 100 : null,
    pctHommes: genreConnus ? (hommes / genreConnus) * 100 : null,
    pctJeunes: persons ? (jeunes / persons) * 100 : null,
    supClasses,
    perimetre,
    perimetres: perimetreNames.sort(),
    byPerimetre
  };
}

// ---------------------------------------------------------------- géométrie

function ringsOf(feature) {
  const out = [];
  const walk = (geom) => {
    if (!geom) return;
    if (geom.type === 'Polygon') out.push(geom.coordinates || []);
    else if (geom.type === 'MultiPolygon') for (const p of geom.coordinates || []) out.push(p);
    else if (geom.type === 'GeometryCollection') for (const g of geom.geometries || []) walk(g);
  };
  walk(feature?.geometry);
  return out;
}

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of rings) {
    const outer = poly[0];
    if (!outer) continue;
    for (const c of outer) {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    }
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/** Algorithme du nombre de croisements (ray casting). */
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function inRings(x, y, rings) {
  for (const poly of rings) {
    if (!poly[0] || !inRing(x, y, poly[0])) continue;
    let hole = false;
    for (let k = 1; k < poly.length; k++) {
      if (inRing(x, y, poly[k])) { hole = true; break; }
    }
    if (!hole) return true;
  }
  return false;
}

function pointOf(feature) {
  const p = feature?.properties;
  if (Array.isArray(p?._coords)) return p._coords;
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  if (g.type === 'GeometryCollection') {
    for (const sub of g.geometries || []) if (sub.type === 'Point') return sub.coordinates;
  }
  return null;
}

/**
 * Rattachement des lignes de plantation aux polygones.
 *
 * Deux voies, dans cet ordre, chacune étiquetée par son niveau de preuve :
 *
 *  1. **Spatial** (niveau 2 — calculé) : la ligne de plantation est *à l'intérieur*
 *     du polygone. Un point n'appartient qu'à un seul polygone : les totaux
 *     s'additionnent, aucun double comptage n'est possible.
 *  2. **Marché** (niveau 1 — lien documenté) : le numéro de marché normalisé
 *     est commun au polygone et à la ligne. Un marché peut couvrir plusieurs
 *     polygones : les mêmes bénéficiaires peuvent alors figurer sur chacun,
 *     l'affichage le signale.
 *
 * Rien n'est inventé : ni géométrie, ni champ, ni valeur.
 */
export function attachPlantationsToPolygons(polygons, plantations) {
  const polyList = (polygons || []).map(f => ({
    id: f.properties?._rowId,
    feature: f,
    rings: ringsOf(f),
    bbox: null
  })).map(p => { p.bbox = bboxOf(p.rings); return p; });

  const byPoly = new Map();
  const getBucket = (id) => {
    let b = byPoly.get(id);
    if (!b) { b = { id, spatial: false, market: false, key: null, bucket: newBucket('') }; byPoly.set(id, b); }
    return b;
  };

  // --- 1. Voie spatiale --------------------------------------------------
  let pointsSpatial = 0;
  let pointsWithoutCoord = 0;
  let pointsOutside = 0;

  for (const f of plantations || []) {
    const c = pointOf(f);
    if (!c) { pointsWithoutCoord++; continue; }
    const [x, y] = c;
    let hit = null;
    for (const p of polyList) {
      const b = p.bbox;
      if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (inRings(x, y, p.rings)) { hit = p; break; }
    }
    if (hit) {
      addToBucket(getBucket(hit.id).bucket, f);
      pointsSpatial++;
    } else {
      pointsOutside++;
    }
  }
  for (const rec of byPoly.values()) {
    if (rec.bucket.rows > 0) { rec.spatial = true; rec.market = false; }
  }

  // --- 2. Voie « numéro de marché » pour les polygones restés vides -------
  const plantByMarket = new Map();
  for (const f of plantations || []) {
    const k = f.properties?._marcheKey;
    if (!k) continue;
    if (!plantByMarket.has(k)) plantByMarket.set(k, []);
    plantByMarket.get(k).push(f);
  }

  const polyByMarket = new Map();
  for (const p of polyList) {
    const k = p.feature.properties?._marcheKey;
    if (!k) continue;
    if (!polyByMarket.has(k)) polyByMarket.set(k, []);
    polyByMarket.get(k).push(p.id);
  }

  let pointsMarket = 0;
  for (const p of polyList) {
    const existing = byPoly.get(p.id);
    if (existing && existing.spatial) continue;

    const k = p.feature.properties?._marcheKey;
    const rows = k ? plantByMarket.get(k) : null;
    if (!rows || !rows.length) continue;

    const bucket = newBucket(k);
    for (const f of rows) addToBucket(bucket, f);
    if (!bucket.rows) continue;
    pointsMarket += bucket.rows;

    const rec = existing || getBucket(p.id);
    rec.market = true;
    rec.spatial = false;
    rec.key = k;
    rec.bucket = bucket;
    rec.shared = (polyByMarket.get(k) || []).length;
  }

  // --- Bilan -------------------------------------------------------------
  let spatial = 0, market = 0, none = 0;
  for (const p of polyList) {
    const r = byPoly.get(p.id);
    if (r && r.spatial) spatial++;
    else if (r && r.market) market++;
    else { none++; byPoly.delete(p.id); }
  }

  const stats = {
    polygons: polyList.length,
    spatial,
    market,
    none,
    coverage: polyList.length ? ((spatial + market) / polyList.length) * 100 : 0,
    pointsSpatial,
    pointsMarket,
    pointsWithoutCoord,
    pointsOutside,
    points: (plantations || []).length
  };

  // Les polygones sans rattachement sont signalés séparément (jamais 0).
  const unattached = polyList.filter(p => !byPoly.has(p.id)).map(p => p.id);

  const result = new Map();
  for (const [id, rec] of byPoly) {
    result.set(id, {
      id,
      mode: rec.spatial ? 'spatial' : 'market',
      key: rec.key,
      shared: rec.shared || 1,
      stats: summarize(rec.key || '', rec.bucket)
    });
  }

  return { byPoly: result, unattached, stats };
}
