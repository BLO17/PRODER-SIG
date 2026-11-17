// data-loader.js — Chargement, parsing et catégorisation des données
import { CONFIG, PII_FIELDS } from './config.js';
import { normalizeMarket, parseMarket } from './market.js';

const BR_RE = /<br\s*\/?>/i;

// `PII_FIELDS` (config.js) est un TABLEAU : il faut un Set pour tester une
// appartenance en O(1) et, surtout, pour que `.has()` existe. Utiliser
// directement `PII_FIELDS.has(...)` lève « PII_FIELDS.has is not a function »
// et fait échouer tout le chargement du calque plantation.
const PII_SET = new Set(PII_FIELDS);

/** Transforme les lignes "clé: valeur" d'une description en objet. */
export function parseDescription(desc) {
  const result = {};
  if (!desc) return result;
  for (const part of String(desc).split(BR_RE)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();
    if (key && value) {
      result[key] = value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
    }
  }
  return result;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Certains champs mêlent deux valeurs ("53,4/1020") : on retient la première.
  const first = String(value).split('/')[0];
  const cleaned = first.replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Surface en ha à partir de "199.4 ha", "424 km²" ou "98,7 km²". */
export function parseSurfaceHa(desc) {
  if (!desc) return null;
  const m = String(desc).replace(',', '.').match(/([\d.]+)\s*(km²|km2|ha)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  return /km/i.test(m[2]) ? value * 100 : value;
}

function isValidCoord(lon, lat) {
  return typeof lon === 'number' && typeof lat === 'number' &&
    lon >= CONFIG.validCoords.lonMin && lon <= CONFIG.validCoords.lonMax &&
    lat >= CONFIG.validCoords.latMin && lat <= CONFIG.validCoords.latMax;
}

/** Coordonnée ponctuelle d'une entité (sans détruire les lignes/polygones). */
function getPointCoords(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  if (geom.type === 'Point') {
    const [lon, lat] = geom.coordinates || [];
    return isValidCoord(lon, lat) ? [lon, lat] : null;
  }
  if (geom.type === 'GeometryCollection') {
    for (const g of geom.geometries || []) {
      if (g.type === 'Point') {
        const [lon, lat] = g.coordinates || [];
        if (isValidCoord(lon, lat)) return [lon, lat];
      }
    }
  }
  return null;
}

/** Coordonnée X/Y de secours, uniquement pour les entités ponctuelles. */
function getFallbackCoords(parsed) {
  const pairs = [
    ['X', 'Y'],
    ['X(BENEF)', 'Y(BENEF)'],
    ['X DE LOCAL', 'Y DE LOCAL'],
    ['X (Coop)', 'Y (Coop)'],
    ['x', 'y'],
    ['Coordonnée lieu de formation Gegraphique X', 'Coordonnée lieu de formation Gegraphique Y'],
    ['Coordonnée lieu de  formation Gegraphique X', 'Coordonnée lieu de  formation Gegraphique Y'],
    ['Coordonnée lieu de formation Gegraphique X', 'Coordonnée lieu  de formation Gegraphique Y']
  ];
  for (const [xk, yk] of pairs) {
    const lon = toNumber(parsed[xk]);
    const lat = toNumber(parsed[yk]);
    if (isValidCoord(lon, lat)) return [lon, lat];
  }
  return null;
}

function normalizeFiliere(value) {
  if (!value) return null;
  return CONFIG.filiereAliases[value] || value;
}

/**
 * Nom du périmètre porté par le nom du polygone lui-même.
 *
 * Graphie observée dans le fichier par calque :
 *   « M06-Périmetre Tizi Abdellah Yaakoub-Taduiret-Amandier-100ha »
 *   « M07-Périmeter Bni Boujtou-Amandier-100ha »
 *   « M12-Périmeter IZEKRITEN 2--Amandier-100ha »
 *
 * Le nom du périmètre est donc disponible SANS aucune jointure : on retire le
 * préfixe « M06-Périmetre » et la queue « -Amandier-100ha ». Rien n'est déduit
 * de l'extérieur, le champ existe dans la source.
 */
function perimetreFromName(name) {
  if (!name) return null;
  // Accepte le nom du polygone (« M16-Périmètre TAMJOUNET-Amandier-75ha »)
  // comme le champ « nom: » de la description (« Périmetre TAMJOUNET »).
  const m = String(name).match(/^\s*(?:M?\d+-)?P[eé]rimet[a-z]*\s*(.+)$/i);
  if (!m) return null;
  let rest = m[1];
  rest = rest.replace(/\s*-\s*(Amandier|Figuier|Caroubier|Olivier)\s*-\s*\d+(?:[.,]\d+)?\s*ha\s*$/i, '');
  rest = rest.replace(/\s*-\s*\d+(?:[.,]\d+)?\s*ha\s*$/i, '');
  rest = rest.replace(/^[\s\-–]+|[\s\-–]+$/g, '').replace(/\s{2,}/g, ' ');
  return rest || null;
}

/**
 * Filière déduite du NOM de l'entité.
 *
 * Les lignes caroubier de la source simplifiée n'ont aucun champ de filière :
 * ni `Action PRODER`, ni `Plantation`. Leur nom, en revanche, la porte —
 * `M29/24-1`, et pour les polygones `M29-Caroubier-60ha`. On ne devine rien :
 * on lit un mot réellement présent dans la source.
 */
function filiereDepuisNom(nom) {
  const s = String(nom || '');
  if (/amandier/i.test(s)) return 'Plantation Amandier';
  if (/figuier/i.test(s)) return 'Plantation Figuier';
  if (/caroubier/i.test(s)) return 'Plantation Caroubier';
  if (/olivier/i.test(s)) return 'Plantation Olivier';
  return null;
}

/**
 * Aplatit une géométrie en Polygon / MultiPolygon / Point.
 *
 * **Pourquoi c'est indispensable.** Les polygones de la source simplifiée sont
 * des `GeometryCollection` : un marché y est l'assemblage de ses périmètres.
 * MapLibre n'accepte ni `fill` ni `line` sur ce type — le calque resterait donc
 * **vide à l'écran sans la moindre erreur affichée**, ce qui est le pire cas
 * pour une démonstration devant un expert.
 *
 * La conversion ne perd rien : les anneaux sont exactement les mêmes.
 */
/**
 * ÉCLATE une géométrie en une liste de géométries simples.
 *
 * **Pourquoi éclater plutôt que fusionner.** Un marché de la source simplifiée
 * est une `GeometryCollection` qui contient plusieurs polygones — un par
 * périmètre. La version précédente les fondait en un seul `MultiPolygon`.
 * Deux défauts en découlaient :
 *
 *   1. MapLibre refuse `fill` et `line` sur une `GeometryCollection` : sans
 *      conversion, le marché n'était pas dessiné du tout ;
 *   2. en cas de fusion, UN contour mal formé peut faire rejeter l'ensemble —
 *      donc faire disparaître TOUS les périmètres d'un marché d'un coup.
 *
 * En rendant chaque polygone indépendant, un contour défectueux ne peut plus
 * entraîner les autres : c'est exactement le symptôme constaté (« des
 * polygones manquent sur certains marchés »).
 *
 * Rien n'est inventé ni supprimé : chaque anneau de la source ressort tel quel.
 */
function eclaterGeometrie(geom) {
  if (!geom) return [];

  const out = [];
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'Polygon' || g.type === 'LineString' || g.type === 'Point') {
      out.push(g);
    } else if (g.type === 'MultiPolygon') {
      for (const c of g.coordinates || []) out.push({ type: 'Polygon', coordinates: c });
    } else if (g.type === 'MultiLineString') {
      for (const c of g.coordinates || []) out.push({ type: 'LineString', coordinates: c });
    } else if (g.type === 'MultiPoint') {
      for (const c of g.coordinates || []) out.push({ type: 'Point', coordinates: c });
    } else if (g.type === 'GeometryCollection') {
      for (const s of g.geometries || []) walk(s);
    }
  };
  walk(geom);
  return out;
}

/**
 * Types de géométrie secondaires présents dans une collection, en plus de la
 * géométrie principale retenue par `aplatirGeometrie`.
 *
 * Sert à DIRE ce qui existe au lieu de le faire disparaître en silence : un
 * marché dont le contour est saisi en `LineString` ne peut pas être rempli, et
 * l'application doit le signaler plutôt que de laisser croire à une absence.
 */
function geometriesSecondaires(geom) {
  if (!geom || geom.type !== 'GeometryCollection') return [];
  const types = new Set();
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'GeometryCollection') { for (const s of g.geometries || []) walk(s); return; }
    types.add(g.type);
  };
  walk(geom);
  return [...types];
}

/**
 * Aplatit une géométrie en UNE géométrie simple, rendable par MapLibre.
 *
 * C'est la fonction réellement appelée par `traiterFeature` (ci-dessous, branche
 * « entité non ponctuelle ») sur TOUTES les lignes et polygones de toutes les
 * sources — y compris la source simplifiée. Elle doit donc :
 *
 *   1. LAISSER PASSER les géométries simples rendables telles quelles
 *      (Polygon, MultiPolygon, LineString, MultiLineString, Point, MultiPoint).
 *      La version du script de build ne faisait PAS passer les lignes : 573
 *      tronçons de ravins / seuils / pistes du jeu public auraient été réduits
 *      à `null`, vidant ces calques en plus des polygones de plantation.
 *
 *   2. FONDRE une `GeometryCollection` en la géométrie DOMINANTE rendable.
 *      Un marché de la source simplifiée est une collection de polygones (un
 *      par périmètre) ; MapLibre refuse le `fill` et le `line` sur une
 *      `GeometryCollection`, sans cette fusion le calque plantation resterait
 *      **vide à l'écran, SANS aucune erreur affichée** — le défaut signalé.
 *
 * Priorité polygones > lignes > points : une collection mélangeant des
 * polygones et un contour en ligne garde ses polygones ; le contour secondaire
 * est porté par `geometriesSecondaires` plutôt que masqué.
 */
function aplatirGeometrie(geom) {
  if (!geom) return null;

  // Géométries simples : rendables par MapLibre telles quelles.
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon' ||
      geom.type === 'LineString' || geom.type === 'MultiLineString' ||
      geom.type === 'Point' || geom.type === 'MultiPoint') {
    return geom;
  }

  // GeometryCollection : fusion par type dominant.
  const polys = [];
  const lines = [];
  const points = [];
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'Polygon') polys.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polys.push(...(g.coordinates || []));
    else if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') lines.push(...(g.coordinates || []));
    else if (g.type === 'Point') points.push(g.coordinates);
    else if (g.type === 'MultiPoint') points.push(...(g.coordinates || []));
    else if (g.type === 'GeometryCollection') for (const s of g.geometries || []) walk(s);
  };
  walk(geom);

  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  if (polys.length > 1) return { type: 'MultiPolygon', coordinates: polys };
  if (lines.length === 1) return { type: 'LineString', coordinates: lines[0] };
  if (lines.length > 1) return { type: 'MultiLineString', coordinates: lines };
  if (points.length === 1) return { type: 'Point', coordinates: points[0] };
  if (points.length > 1) return { type: 'MultiPoint', coordinates: points };
  return null;
}

/**
 * Tranche d'âge, pour ne pas publier un âge exact.
 *
 * Même découpage que `scripts/build-public-data.mjs` : si les deux divergent,
 * la pyramide des âges du calque plantation ne serait plus comparable à celle
 * des autres composantes.
 */
function trancheAge(ligne) {
  // Idempotence : si la valeur est déjà une tranche (cas d'une source
  // pré-assainie à la construction), la renvoyer telle quelle au lieu de
  // la dégrader (« moins de 18 ans » deviendrait « Non renseigné »).
  const val = String(ligne).split(':').slice(1).join(':').trim();
  if (/^(moins de 18 ans|\d+-\d+ ans|65 ans et plus|Non renseigné)$/.test(val)) {
    return 'Age: ' + val;
  }
  const v = parseInt(val, 10);
  if (!Number.isFinite(v)) return 'Age: Non renseigné';
  if (v < 18) return 'Age: moins de 18 ans';
  if (v < 25) return 'Age: 18-24 ans';
  if (v < 35) return 'Age: 25-34 ans';
  if (v < 45) return 'Age: 35-44 ans';
  if (v < 55) return 'Age: 45-54 ans';
  if (v < 65) return 'Age: 55-64 ans';
  return 'Age: 65 ans et plus';
}

/**
 * Normalisation d'écriture du descriptif d'une entité plantation.
 *
 * Deux graphies de la source simplifiée empêchent la lecture du marché :
 *
 *   « N°: 14/2025/DPA/SMOPFA »   ← clé « N° » nue ; le parseur cherche
 *                                  « N° Marché » et ne trouve RIEN
 *   « Sup: 660 ha »              ← surface sous un autre nom que les champs
 *                                  attendus (« SUP-total-Marché(ha) »)
 *
 * Sans cette réécriture, le marché 14/2025 serait chargé mais resterait
 * « non rattaché » : il serait retiré de la carte par le filtre des marchés
 * sans données. Aucune VALEUR n'est modifiée — seule la clé est réécrite.
 */
function normaliserDescriptifPlantation(desc) {
  return String(desc || '')
    .split(/<br\s*\/?>/i)
    .map((ligne) => {
      const i = ligne.indexOf(':');
      if (i === -1) return ligne;
      const cle = ligne.slice(0, i).replace(/\s+/g, ' ').trim();
      const val = ligne.slice(i + 1).trim();
      if (/^N\s*°$/.test(cle)) return `N° Marché : ${val}`;
      if (/^Sup$/i.test(cle) && /ha/i.test(val)) {
        return `SUP-total-Marché(ha): ${parseFloat(val)}`;
      }
      if (/^Ent$/i.test(cle)) return `Entreprise: ${val}`;
      return `${cle}: ${val}`;
    })
    .join('<br>');
}

/**
 * Nombre de périmètres réellement dessinés dans un polygone de marché.
 *
 * Depuis la bascule sur la source simplifiée, un marché n'est plus représenté
 * par un polygone par périmètre mais par **un seul polygone** assemblant tous
 * les siens. Le fichier les écrit sous forme de `GeometryCollection` : chaque
 * `Polygon` qu'elle contient EST un périmètre. On peut donc compter un fait
 * exact — « ce marché couvre 8 périmètres » — au lieu de dire « 1 polygone »,
 * qui serait vrai mais trompeur pour l'expert.
 *
 * Compte les anneaux EXTÉRIEURS : un trou (anneau intérieur) n'est pas un
 * périmètre de plus.
 */
function compterPerimetres(geometry) {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).length;
  if (geometry.type === 'GeometryCollection') {
    let n = 0;
    for (const g of geometry.geometries || []) n += compterPerimetres(g);
    return n;
  }
  return 0;
}

/** Rattache la valeur « Plantation » d'un polygone de périmètre à une filière. */
function filiereOfPoly(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v.includes('amandi')) return 'Plantation Amandier';
  if (v.includes('figui')) return 'Plantation Figuier';
  if (v.includes('caroub')) return 'Plantation Caroubier';
  if (v.includes('olivi')) return 'Plantation Olivier';
  return null;
}

/** Nombre décimal tolérant (« 174.02 », « 100 », « 1 250,5 »). */
function decimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Numéro de marché porté par la description, quelles que soient les graphies
 * rencontrées dans le fichier par calque :
 *
 *   « N° Marché : 06/2021/DPA/32/SMOPFPA »
 *   « N° Marché: 24/2022/DPA/32/SMOPFPA »
 *   « N° Marché/: 24/2023/DPA/32/SMOPFPA »   ← slash avant les deux-points
 *   « N ° Marché: 28/2022/DPA/32/SMOPFPA »   ← espace avant le °
 *   « MARCHE: M06/21 »                       ← plantations
 *
 * parseDescription trime les clés mais conserve le slash terminal : sans ce
 * traitement, les marchés 2023/2024 ne sont jamais trouvés et les polygones
 * correspondants affichent « Non rattachable » à tort.
 */
function marketFromDescription(parsed) {
  if (!parsed) return null;
  let fallback = null;
  for (const [rawKey, value] of Object.entries(parsed)) {
    if (!value) continue;
    const key = rawKey.replace(/\/+$/, '').trim();
    if (/^n\s*°\s*march/i.test(key)) {
      // « N° Marché : 1 » porte parfois le numéRO DE LIGNE, pas le marché :
      // si la valeur ne se parse pas en numéro de marché, on ne se fige pas
      // dessus — le champ « marché » (ex. MARCHE: 14/2025) reste lisible.
      const v = String(value).trim();
      if (parseMarket(v)) return v;
      continue;
    }
    if (/^march/i.test(key) && !fallback) fallback = String(value).trim();
  }
  return fallback;
}

/** Numéro de marché brut, selon la catégorie et la disponibilité des champs. */
function marketRawOf(category, parsed, props) {
  const fromDesc = marketFromDescription(parsed);
  if (fromDesc) return fromDesc;

  if (category === 'C14') {
    // La source simplifiée porte AUSSI le numéro en champ de premier niveau,
    // avec une espace finale dans la clé (« N° Marché »). On balaie donc les
    // graphies en ignorant espaces et barres obliques : sans cela, un polygone
    // dont le descriptif serait écrit autrement resterait sans numéro, donc
    // sans rattachement, donc invisible.
    const norm = (s) => String(s || '').replace(/[\s/]+/g, '').toUpperCase();
    for (const [cle, val] of Object.entries(props || {})) {
      if (norm(cle) === 'N°MARCHÉ' || norm(cle) === 'N°MARCHE') {
        if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();
      }
    }
    for (const k of ['N° Marché ', 'N° Marché', 'N ° Marché', 'N° Marché/', 'MARCHE']) {
      const v = props?.[k];
      if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
    }
    return null;
  }
  for (const k of ['MARCHE', 'N° Marché', 'N° De Marché', 'N° de Marché']) {
    const v = props?.[k];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return null;
}

/** Catégorisation auditée (voir Note de cadrage, §2). */
export function categorize(feature, parsed) {
  const name = feature.properties?.name || '';
  const desc = feature.properties?.description || '';
  const p = parsed || parseDescription(desc);

  // Ligne de plantation (un bénéficiaire par ligne).
  //
  // Le champ `Action PRODER` est l'indice habituel — mais il est ABSENT des
  // lignes caroubier de la source simplifiée (marchés 28 à 33 de 2024, et
  // 33/2023). Ces lignes portent pourtant tout ce qu'il faut : `MARCHE`,
  // `ID-M`, `Genre (H/F)`, `SUP`, des coordonnées. Sans le second indice, elles
  // n'étaient pas reconnues comme plantation, ne comptaient donc aucun
  // bénéficiaire, et leurs marchés affichaient « effectifs non mesurables ».
  if (p['Action PRODER']) return 'C1';
  if (p['ID-M'] && (p['MARCHE'] || p['Genre (H/F)'] || p['Genre'])) return 'C1';
  if (/^M\d+\/20\d{2}-R\d+/.test(name)) return 'C2';
  if (p['Influence sur les périmètres']) return 'C3';
  if (/^Ss\.BV/i.test(name)) return 'C4';
  if (/^BV\s/i.test(name)) return 'C15';
  // Périmètres de plantation sous marché.
  //
  // La source simplifiée n'écrit plus « Périmètre » dans le nom (les polygones
  // s'appellent `M06-Amandier-100ha`), et sa fiche `14/2025` n'a ni
  // `SUP-total-Marché(ha)` ni `SUP-Périmètre(ha)` — d'où trois indices :
  //
  //   1. les champs de surface habituels ;
  //   2. le mot « Périmet… » dans le nom (ancienne source) ;
  //   3. la FORME du nom de la source simplifiée : `M<num>-<Filière>-<N>ha`.
  //
  // Sans le troisième, les polygones sans champ de surface tombaient en C13 et
  // n'étaient jamais dessinés : ils disparaissaient de la carte sans erreur.
  const nomPolygoneMarche = /^\s*M\d{1,2}\s*-\s*(Amandier|Figuier|Caroubier|Olivier)\s*-\s*\d+(?:[.,]\d+)?\s*ha\s*$/i;
  if (p['SUP-total-Marché(ha)'] || p['SUP-Périmètre(ha)']
      || /^M\d+-P[ée]rimet/i.test(name) || nomPolygoneMarche.test(name)) return 'C14';
  // Pistes : detection par nom OU par champ 'nom'/'Piste' dans la description
  // (certaines pistes ne portent le mot « piste » que dans leur champ Objet).
  const nomField = p['nom'] || p['Piste'] || '';
  if (/piste/i.test(name) || /piste/i.test(nomField) || /piste/i.test(p['Objet'] || '')) return 'C5';
  if (name === 'UV-AJDIR' || name === 'UV-MSILA') return 'C6';
  if (name === 'PFC-AKNOUL' || name === 'PFC-MSILA') return 'C7';
  if (p['N°-MER'] || p['N°MER']) return 'C8';
  if (p["Nbre d'adhérents Total"] && !p['N°-MER'] && !p['N°MER']) return 'C9';
  if (p['NOM DE LOCAL']) return 'C10';
  if (name.startsWith('FD-MFR')) return 'C11';
  // Communes : virgule décimale prise en charge ("98,7 km²")
  if (/^\d+([.,]\d+)?\s*(km²|km2|ha)$/i.test(desc.trim())) return 'C12';
  return 'C13';
}

function derivePisteStatus(name, parsed) {
  const explicit = parsed['STATUT'];
  if (explicit) return explicit;
  if (/etude|étude/i.test(name)) return 'En étude';
  if (/en cours/i.test(name)) return 'En cours';
  if (/ouverte/i.test(name)) return 'Ouverte';
  return 'Statut non renseigné';
}

// ─── TAMKIN — hiérarchie menu Cercle → Commune (demande du responsable,
// 13/11/2026) ────────────────────────────────────────────────────────────────
// Le champ `CT` de la description n'est lu QUE pour grouper le menu et la
// fiche — la source n'est jamais modifiée (« laisser le reste tel quel »).
// Étiquettes = noms officiels du CALQUE COMMUNES (C12 du même fichier),
// sauf renommage demandé (14/11/2026) : la commune « BORED » s'affiche « BOURED » (graphie du projet).
// Correspondance insensible à la casse, espaces multiples aplaties.
const TAMKIN_COMMUNES = {
  'AJDIR': 'Ajdir', 'AJDR': 'Ajdir',
  'BORED': 'BOURED', 'BOURED': 'BOURED',
  'GZANAYA ALJANOUBIA': 'Gzenaia El Janoubia',
  'GEZNNAYA EL JANOUBIA': 'Gzenaia El Janoubia',
  'SIDI ALI BOURAKBA': 'Sidi Ali Bourkba',
  'TIZI OUASSLI': 'Tizi Ousli', 'TIZI OUSLI': 'Tizi Ousli',
  'BNI FTAH': 'Bni Ftah', 'BRARHA': 'Brarha',
  'EL GOUZATE': 'El Gouzate', 'ELGOUZAT': 'El Gouzate',
  'HAD MSILA': 'Msila', 'KAHF LGHAR': 'Kaf El Ghar',
  'TAIFA': 'Taifa', 'TAINASTE': 'Tainaste', 'TRAIBA': 'Traiba'
};
// Les 6 classes sans `CT` : commune retrouvée par RECOUPEMENT GÉOGRAPHIQUE
// avec le calque communes (test point-dans-polygone ; chaque point tombe
// dans exactement un polygone — scripts/recoupement_communes.py) :
//   N23 → Bni Ftah · N25, N28 → Tainaste · N30 → El Gouzate
//   N44-C 2/2, N65-C 1/2 → Ajdir (comme la classe N64, même convention)
const TAMKIN_SANS_CT = {
  'AF-T1-TAINASTE-Classe N23': 'Bni Ftah',
  'AF-T1-TAINASTE-Classe N25': 'Tainaste',
  'AF-T1-TAINASTE-Classe N28': 'Tainaste',
  'AF-T1-TAINASTE-Classe N30': 'El Gouzate',
  'AF-A2-AKNOUL-Classe N44-C 2/2': 'Ajdir',
  'AF-A2-AKNOUL-Classe N65-C 1/2': 'Ajdir'
};
function tamkinCercle(parsed) {
  const c = String(parsed['Cercle'] || parsed['cercle'] || '').trim();
  return c ? c.toUpperCase() : null;
}
function tamkinCommune(parsed, name) {
  const raw = String(parsed['CT'] || '').trim().replace(/\s+/g, ' ');
  if (raw) return TAMKIN_COMMUNES[raw.toUpperCase()] || raw;
  return TAMKIN_SANS_CT[String(name || '').trim()] || null;
}

export async function loadData(onProgress) {
  onProgress?.('Chargement du fichier GeoJSON...', 10);

  const response = await fetch(CONFIG.geojsonUrl);
  if (!response.ok) throw new Error(`Fichier GeoJSON introuvable (${response.status}) — ${CONFIG.geojsonUrl}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Le fichier de données renvoyé est une page HTML (données non générées ?). Lancez : npm run build:data');
  }

  onProgress?.('Parsing JSON...', 20);
  const data = await response.json();

  // Chargement des altitudes pré-calculées (terrain.reearth.land, batch 256).
  // Optionnel : si le fichier est absent, _altitude reste null.
  let altitudes = null;
  try {
    onProgress?.('Chargement des altitudes...', 25);
    const altRes = await fetch('data/altitudes.json');
    if (altRes.ok) {
      const altData = await altRes.json();
      altitudes = altData.results || {};
    }
  } catch (_) { altitudes = null; }

  // Hiérarchie MFR (agrégats Tranche → Spécialité → Commune) — fichier pré-calculé
  // depuis le KMZ d'origine, SANS aucune donnée nominative. Optionnel : si le
  // fichier est absent, le volet MFR retombe sur sa feuille simple.
  let mfrHierarchy = null;
  try {
    onProgress?.('Chargement de la hiérarchie MFR...', 30);
    const mfrRes = await fetch('data/mfr-hierarchy.json');
    if (mfrRes.ok) mfrHierarchy = await mfrRes.json();
  } catch (_) { mfrHierarchy = null; }

  onProgress?.('Traitement des features...', 50);
  const features = data.features || [];
  const processed = [];
  const stats = { total: features.length, valid: 0, invalid: 0, categories: {}, geometry: {} };

  // Traitement d'UNE entité. Factorisé parce que le calque plantation vient
  // d'un SECOND fichier, chargé ci-dessous : les deux populations doivent
  // traverser exactement la même chaîne (catégorisation, lecture du marché,
  // filière, géométrie) — sinon le calque plantation se comporterait
  // différemment du reste de la carte.
  function traiterFeature(f, cible) {
    const props = f.properties || {};
    const parsed = parseDescription(props.description);
    const category = categorize(f, parsed);

    // On ne remplace la géométrie que pour les points : lignes et polygones
    // doivent impérativement conserver leur géométrie d'origine.
    let geometry = f.geometry;
    let coords = getPointCoords(f);
    const isPoint = !geometry || geometry.type === 'Point';
    if (isPoint) {
      if (!coords) coords = getFallbackCoords(parsed);
      if (coords) geometry = { type: 'Point', coordinates: coords };
    } else {
      // Les polygones de la source simplifiée sont des `GeometryCollection`
      // (un marché = l'assemblage de ses périmètres). MapLibre n'accepte NI
      // `fill` NI `line` sur ce type : sans aplatissement, le calque plantation
      // resterait vide à l'écran SANS afficher la moindre erreur. On convertit
      // donc en Polygon / MultiPolygon, qui est strictement équivalent.
      geometry = aplatirGeometrie(geometry);
    }

    const valid = Boolean(
      (geometry && geometry.type !== 'Point') ||
      (coords && isValidCoord(coords[0], coords[1]))
    );
    if (valid) stats.valid++; else stats.invalid++;
    const gtype = geometry?.type || 'none';
    stats.geometry[gtype] = (stats.geometry[gtype] || 0) + 1;

    const num = {
      sup: toNumber(parsed['SUP'] ?? parsed['Sup']),
      volume: toNumber(parsed['Volumes à traiter (m3)'] ?? parsed['Quantité Seuil/Total marché (M3)']),
      longueur: toNumber(parsed['Longueur(m)'] ?? parsed['Longeur  ml']),
      longueurKm: (function() { const v = toNumber(parsed['Longueur(Km)'] ?? parsed['Linéaire (km)'] ?? parsed['Linéaire(km)'] ?? parsed['Longueur (km)']); if (v !== null) return v; const ml = toNumber(parsed['Longeur  ml']); return ml !== null ? ml / 1000 : null; })(),
      nbSeuils: toNumber(parsed['nombre de seuils'] ?? parsed['Quantité']),
      pente: toNumber(parsed['Pente en %']),
      annee: toNumber(parsed['Année de Plantation'] ?? parsed['Année création'] ?? parsed['Année de création'] ?? parsed['Année de distribution materiel']),
      nbBenef: toNumber(parsed['NOMBRE DE BENEFECIERS']),
      nbFemmes: toNumber(parsed['Nombre de femmes']),
      nbHommes: toNumber(parsed["nombre d'hommes"]),
      nbJeunes: toNumber(parsed['Nombre de jeunes']),
      surfaceHa: parseSurfaceHa(parsed['surface'] || props.description)
    };

    const statutPiste = category === 'C5' ? derivePisteStatus(props.name || '', parsed) : null;

    const marcheRaw = marketRawOf(category, parsed, props);
    // Clé de jointure polygone de plantation <-> lignes de plantation.
    const marcheKey = normalizeMarket(marcheRaw);

    const featureTraitee = {
      type: 'Feature',
      geometry,
      properties: {
        ...props,
        name: props.name || '',
        styleUrl: props.styleUrl || '',
        _parsed: parsed,
        _category: category,
        _valid: valid,
        _coords: coords,
        // Identifiant de ligne, unique dans le jeu final. Il ne vient plus d'un
        // compteur de boucle (la fonction sert deux fichiers) mais du rang
        // d'insertion : deux entités ne peuvent pas partager le même.
        _rowId: cible.length,
        // Filière de la ligne. Certaines lignes n'ont AUCUN champ de filière
        // (`Action PRODER` absent sur les caroubiers 2023-2024) : elles sont
        // alors rattachées à la filière de leur propre nom de entité, à défaut
        // au champ `Plantation` du premier niveau. Sans cela, la ligne compte
        // bien un bénéficiaire mais reste sans filière, et la fiche affiche
        // « Plantation non renseignée » pour un marché pourtant identifié.
        _filiere: normalizeFiliere(
          parsed['Action PRODER']
          || parsed['Plantation']
          || props['Plantation']
          || filiereDepuisNom(props.name)
        ),
        _filiereRaw: parsed['Action PRODER'] || parsed['Plantation'] || props['Plantation'] || null,
        _cercle: parsed['cercle'] || parsed['Cercle'] || parsed['CERCLE'] || parsed['Cercle (BENEF)'] || parsed['Cercle (Coop)'] || props['CERCLE'] || props['Cercle'] || props['cercle'] || null,
        // TAMKIN — groupage menu (cercle normalisé + commune étiquetée) :
        // lecture du `CT` limitée au menu et à la fiche, jamais à la
        // source. Les 6 classes sans CT suivent la commune de leur
        // recoupement géographique avec le calque communes (13/11/2026).
        _tkCercle: category === 'C10' ? tamkinCercle(parsed) : null,
        _tkCommune: category === 'C10' ? tamkinCommune(parsed, props.name) : null,
        // NB — le champ `CT` de la source (`Cercle: AKNOUL<br>CT: BOURED`) n'est
        // volontairement PAS lu : le responsable du projet a tranché, le cercle
        // suffit comme repère de territoire. `_commune` reste alimenté pour les
        // autres calques (ravins, coopératives, MER) qui l'affichent.
        _commune: parsed['COMMUNE'] || parsed['Commune territoriale'] || parsed['Commune'] || props['Commune territoriale'] || props['Commune'] || props['COMMUNE'] || null,
        _perimetre: parsed['PERIMETRE'] || null,
        _marche: parsed['MARCHE'] || parsed['N° De Marché'] || parsed['N° de Marché'] || parsed['N° Marché'] || parsed['N ° Marché'] || parsed['N° Marché '] || parsed['N° marché'] || props['N° Marché'] || props['N° marché'] || props['N° De Marché'] || null,
_nomPiste: parsed['nom'] || parsed['Piste'] || props['nom'] || props['Piste'] || null,
        // Graphie source retenue pour l'affichage (traçabilité).
        _marcheRaw: marcheRaw,
        // Identifiant normalisé « NN/AAAA » : la clé qui relie le polygone de
        // périmètre à ses lignes de plantation (lien documenté, niveau 1).
        _marcheKey: marcheKey,
        // --- Polygones de plantation (catégorie C14) ---
        _supTotal: decimal(parsed['SUP-total-Marché(ha)'] ?? props['SUP-total-Marché(ha)']),
        _supPerimetre: decimal(parsed['SUP-Périmètre(ha)'] ?? props['SUP-Périmètre(ha)']),
        _plantedType: parsed['Plantation'] || props['Plantation'] || null,
        // Nom du périmètre lu dans le nom du polygone, ou à défaut dans le
        // champ « nom: » de la description (marchés 2022+).
        _nomPerimetre: perimetreFromName(props.name || '') ||
          perimetreFromName(parsed['nom'] || ''),
        _filierePoly: filiereOfPoly(parsed['Plantation'] || props['Plantation']),
        // Nombre de périmètres contenus dans le polygone de ce marché (exact,
        // lu dans la géométrie — voir compterPerimetres ci-dessus).
        _nbPerimetres: compterPerimetres(geometry),
        _entreprisePoly: parsed['Entreprise'] || props['Entreprise'] || null,
        _ctPoly: parsed['CT'] || props['CT'] || null,
        _cerclePoly: parsed['Cercle'] || props['Cercle'] || null,
        _sup: num.sup,
        _annee: num.annee,
        _genre: parsed['Genre (H/F)'] || parsed['GENRE (H/F)'] || null,
        _jeune: parsed['Jeune (1/N)'] || parsed['JEUNE'] || null,
        _trancheAge: parsed['Age'] || null,
        _actionProder: parsed['Action PRODER'] || parsed['ACTION -PRODER'] || null,
        _influence: parsed['Influence sur les périmètres'] || null,
        _longueur: num.longueur,
        _longueurKm: num.longueurKm,
        _volume: num.volume,
        _nbSeuils: num.nbSeuils,
        _pente: num.pente,
        _surfaceHa: num.surfaceHa,
        _statut: parsed['STATUT'] || null,
        _statutPiste: statutPiste,
        _enEtude: category === 'C5' ? (/etude|étude/i.test(props.name || '') || /etude|étude/i.test(parsed['nom'] || '') || /etude|étude/i.test(parsed['Piste'] || '')) : false,
        _hasMarcheYear: category === 'C5' ? (/\d{4}/.test(parsed['N° Marché'] || '') || /\d{4}/.test(parsed['N° marché'] || '') || /\d{4}/.test(props.name || '') || /\d{4}/.test(parsed['nom'] || '')) : false,
        _entreprise: parsed['Société'] || parsed['Entreprise'] || parsed['ENTREPRISE'] || null,
_commentaire: parsed['Commentaire'] || null,
        _code: parsed['Code'] || parsed['N°-MER'] || parsed['N°MER'] || null,
        _merType: parsed['MER  (EM/AGR/AutoEntrepreneur)'] || null,
        _specialite: parsed['Spécialité'] || null,
        _axe: parsed['Axe de dévelopement'] || null,
        _avancement: parsed['Avancement Action Appui'] || null,
        _situationCoop: parsed['Situation Coop'] || null,
        _appartenanceUnion: parsed['Appartenant à l\'Union'] || null,
        _trancheEval: parsed['Tranche Evaluation'] || null,
        _nomCooperative: parsed['Nom Coopérative'] || parsed['Nom de la coopérative'] || parsed['Coopérative'] || null,
        _nomLocal: parsed['NOM DE LOCAL'] || null,
        _douar: parsed['Douar'] || parsed['DOUAR'] || parsed['DOUAR (BENEF)'] || null,
        _ct: parsed['CT'] || parsed['CT (BENEF)'] || parsed['CT (Coop'] || null,
        _formation: parsed['FORMATION'] || null,
        _dureeFormation: parsed['Durée de formation'] || parsed['Durée du Programme'] || null,
        _nbBenefFormation: num.nbBenef,
        _nbFemmesFormation: num.nbFemmes,
        _nbHommesFormation: num.nbHommes,
        _nbJeunesFormation: num.nbJeunes,
        _niveauScolaire: parsed['NIVEAU SCOLAIRE'] || null,
        _association: parsed['Association'] || parsed['association'] || null,
        _etapeProgramme: parsed['ETAPE DE PROGRAMME'] || parsed['Etape du programme'] || parsed['Etape de programme'] || null,
        _dateDemarrage: parsed['Date de démarrage'] || parsed['Date de demarrage'] || null,
        _programme: parsed['programme'] || parsed['Programme'] || null,
        _convention: parsed['Convention'] || parsed['convention'] || parsed['convention n°'] || null,
        _anneeScolaire: parsed['Année scolaire'] || null,
        _resultat: parsed['Résultat'] || null,
        _appartenanceMerEm: parsed['APPARTENANCE MER/EM'] || null,
        // Identifiant pseudonymisé fourni par le jeu public (jamais exposé :
        // privacy.js le retire des couches cartographiques).
        _benefId: props._benefId || null,
        _altitude: (function() {
          if (!coords || !altitudes) return null;
          const key = coords[0].toFixed(6) + ',' + coords[1].toFixed(6);
          const a = altitudes[key];
          return a ? Math.round(a.elevation) : null;
        })()
      }
    };

    stats.categories[category] = (stats.categories[category] || 0) + 1;
    cible.push(featureTraitee);
  }

  for (let i = 0; i < features.length; i++) {
    traiterFeature(features[i], processed);
    if (i % 1000 === 0) {
      onProgress?.(`Traitement ${i}/${features.length}...`, 50 + Math.round((i / features.length) * 40));
    }
  }

  //
  // --- Calque plantation : source d'origine (SIG PRODER-COMPLEMENTARITE) ---
  //
  // Cette source porte le projet COMPLET (9031 entités : plantation, ravins,
  // seuils, pistes, coopératives, bassins…). Seules les ENTITÉS PLANTATION
  // sont projetées sur la carte (C1 lignes, C14 polygones de périmètre) —
  // le reste est déjà porté par le jeu public, qui n'est pas dupliqué. On
  // retire les entités plantation d'origine (C1/C14 du jeu public) pour que
  // les deux découpages ne se superposent pas.
  //
  // Les données nominatives de cette source (CIN, PRENOM, NOM, âge) sont
  // retirées ICI, à la lecture, exactement comme le fait le build du jeu
  // public. Rien de nominatif n'atteint l'affichage ni les couches.
  //
  // Les données nominatives de ce fichier (CIN, PRENOM, NOM, Age) sont retirées
  // ICI, à la lecture, exactement comme le fait le build du jeu public. Rien de
  // nominatif n'atteint donc l'affichage ni les couches cartographiques.
  if (CONFIG.plantationUrl) {
    onProgress?.('Calque plantation...', 92);
    try {
      // Le nom du fichier contient une espace et un accent (« Arboriculture
      // fruitière ») : une URL doit les encoder, sinon `fetch` échoue sur
      // certains serveurs et le calque retombe silencieusement sur l'ancienne
      // source — le navigateur affiche alors une carte plausible, mais fausse.
      const rep = await fetch(encodeURI(CONFIG.plantationUrl));
      if (!rep.ok) throw new Error(`fichier introuvable (${rep.status})`);
      const sj = await rep.json();

      // Identifiant de bénéficiaire : attribué EN MÉMOIRE, à partir du CIN.
      //
      // Le CIN sert de clé le temps du chargement puis est oublié : seule une
      // référence opaque (« b12 ») reste dans les propriétés. Deux lignes du
      // même bénéficiaire reçoivent donc le même identifiant et sont comptées
      // une seule fois — sans qu'aucune donnée d'identité ne soit conservée,
      // ni dans les données, ni dans le DOM, ni dans la console.
      const idParCin = new Map();
      const idBenef = (cin) => {
        const c = String(cin || '').replace(/\s+/g, '').toUpperCase();
        if (!/^[A-Z]\d{4,7}$/.test(c)) return null;
        if (!idParCin.has(c)) idParCin.set(c, 'b' + (idParCin.size + 1));
        return idParCin.get(c);
      };

      const avant = processed.length;
      for (const f of sj.features || []) {
        const p = { ...(f.properties || {}) };
        const benefId = idBenef(p.CIN);
        // Réécriture des graphies de clé qui empêchent la lecture du marché.
        if (p.description) p.description = normaliserDescriptifPlantation(p.description);
        // Retrait des champs personnels AVANT tout traitement.
        for (const k of PII_FIELDS) delete p[k];
        if (benefId) p._benefId = benefId;
        // Le descriptif porte aussi l'identité (« CIN: Z45418<br>… ») et l'âge
        // exact : on retire ces lignes. L'âge est CONSERVÉ sous forme de
        // tranche, comme le fait le build du jeu public — sinon la pyramide
        // des âges serait perdue alors qu'elle n'est pas nominative.
        if (p.description) {
          p.description = String(p.description)
            .split(/<br\s*\/?>/i)
            .filter((l) => {
              const i = l.indexOf(':');
              return i === -1 || !PII_SET.has(l.slice(0, i).trim());
            })
            .map((l) => (/^Age\s*:/i.test(l.trim()) ? trancheAge(l) : l))
            .join('<br>');
        }
        // Le nom technique porte le CIN en suffixe (« M06/21-1-Z45418 »).
        if (p.name) {
          p.name = String(p.name).replace(/-(?:[A-Za-z]\d{4,7})$/, '');
        }
        // Le fichier est le projet COMPLET : ne projeter que les entités
        // plantation (C1 lignes, C14 polygones de périmètre). Tout le reste est
        // déjà dans le jeu public — le traiter ici le dupliquerait en calques.
        const catAjout = categorize({ type: f.type, properties: p, geometry: f.geometry }, parseDescription(p.description || ''));
        if (catAjout !== 'C1' && catAjout !== 'C14') continue;
        traiterFeature({ type: f.type, properties: p, geometry: f.geometry }, processed);
      }
      const ajoutees = processed.length - avant;

      // Retrait des entités plantation d'origine.
      //
      // ATTENTION — l'ordre compte : on ne filtre QUE la portion déjà présente
      // avant l'ajout (indices 0 → `avant`). Filtrer tout `processed` retirerait
      // aussi les entités qu'on vient d'ajouter, puisqu'elles sont elles-mêmes
      // de catégorie C1 / C14 : la carte se retrouverait sans aucun marché.
      const estAnciennePlantation = (feat) => {
        const c = feat.properties?._category;
        return c === 'C1' || c === 'C14';
      };
      const nouvelles = processed.slice(avant);          // les entités ajoutées
      const conservees = processed.slice(0, avant).filter((feat) => !estAnciennePlantation(feat));
      const retirees = avant - conservees.length;
      processed.length = 0;                              // vidé APRÈS les lectures
      processed.push(...conservees, ...nouvelles);

      const cat = { C1: 0, C14: 0 };
      for (const feat of processed) {
        const c = feat.properties?._category;
        if (c === 'C1' || c === 'C14') cat[c]++;
      }

      // Tous les polygones de marché de cette source sont DESTINÉS À ÊTRE
      // AFFICHÉS, qu'ils aient ou non des bénéficiaires rattachés.
      //
      // Le code retirait jusqu'ici de la carte les marchés dépourvus de lignes
      // de plantation (`markMarketsWithData`). Or plusieurs marchés de cette
      // source n'ont aucune ligne : les marchés figuier, caroubier et ceux de
      // 2022. Ils disparaissaient donc de la carte — c'est exactement ce que le
      // responsable du projet signalait. La liste des marchés est portée par la
      // source elle-même : on l'affiche intégralement, et l'absence de
      // bénéficiaires est dite dans la fiche (« effectifs non mesurables »)
      // plutôt que traduite par une disparition silencieuse.
      let sansBenef = 0;
      const marchesAvecLignes = new Set();
      for (const feat of processed) {
        if (feat.properties?._category !== 'C1') continue;
        const k = feat.properties?._marcheKey;
        if (k) marchesAvecLignes.add(k);
      }
      for (const feat of processed) {
        if (feat.properties?._category !== 'C14') continue;
        // Marqueur lu par `markMarketsWithData` (app.js) : ce polygone vient de
        // la source de référence et doit rester visible même sans bénéficiaires.
        feat.properties._sourcePlantation = true;
        const k = feat.properties._marcheKey;
        if (!k || !marchesAvecLignes.has(k)) sansBenef++;
      }

      console.log(
        `%cCalque plantation%c ${ajoutees} entités lues dans la source, ` +
        `${retirees} anciennes retirées — ${cat.C14} polygones de marché, ${cat.C1} lignes de bénéficiaires`,
        'color:#4CAF50;font-weight:700', 'color:#dfe6f2'
      );
      if (sansBenef) {
        console.log(
          `%cCalque plantation%c ${sansBenef} marché(s) sans bénéficiaires rattachés ` +
          `— affichés quand même (liste portée par la source)`,
          'color:#FFB74D;font-weight:700', 'color:#dfe6f2'
        );
      }
      stats.plantation = { ajoutees, retirees, polygones: cat.C14, lignes: cat.C1, sansBenef };
    } catch (e) {
      // Une erreur ici ne doit pas empêcher la carte de s'afficher — mais elle
      // ne doit pas non plus passer inaperçue : sans ce signal, la carte montre
      // l'ancien calque et paraît correcte, ce qui est bien pire qu'une erreur.
      console.error(
        `%cCalque plantation NON CHARGÉ%c ${e.message}\n` +
        `  fichier demandé : ${CONFIG.plantationUrl}\n` +
        `  → la carte affiche l'ANCIEN calque plantation, pas la source demandée.`,
        'color:#FF5252;font-weight:700', 'color:#dfe6f2'
      );
      stats.plantation = { erreur: e.message };
      // Signal visible dans l'interface, pas seulement dans la console.
      const bandeau = document.createElement('div');
      bandeau.style.cssText =
        'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;' +
        'background:#B71C1C;color:#fff;padding:9px 16px;border-radius:8px;' +
        'font:600 12.5px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5);' +
        'max-width:min(680px,92vw);line-height:1.5';
      bandeau.textContent =
        'Calque plantation non chargé — ' + e.message +
        ' · La carte affiche l\'ancien découpage.';
      document.body.appendChild(bandeau);
    }
  }

  onProgress?.('Finalisation...', 95);
  onProgress?.('Terminé', 100);

  return { features: processed, stats, mfrHierarchy };
}

export function getFeaturesByCategory(features, category) {
  return features.filter(f => f.properties._category === category);
}

export function getFeaturesByFiliere(features, filiere) {
  return features.filter(f => f.properties._filiere === filiere);
}

export function getUniqueValues(features, field) {
  const values = new Set();
  for (const f of features) {
    const v = f.properties[field];
    if (v !== null && v !== undefined && v !== '') values.add(v);
  }
  return [...values].sort();
}
