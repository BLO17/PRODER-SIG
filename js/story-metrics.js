// story-metrics.js — Résolution dynamique des indicateurs des Story Maps
//
// Aucun chiffre n'est codé en dur dans les chapitres : chaque valeur est
// résolue à l'exécution depuis l'IndicatorEngine, ce qui garantit la
// cohérence avec le tableau de bord et supprime toute dérive de données.

import { CATEGORIES } from './config.js';

/**
 * Table de résolution.
 * Chaque entrée : { path, label, unit, level, formula, ref, format }
 *  - path   : chemin dans l'objet retourné par IndicatorEngine.getAllIndicators()
 *  - level  : 1 = observé/calculé, 2 = estimé, 3 = à renseigner
 *  - format : 'int' | 'dec1' | 'dec2' | 'pct' | 'km' | 'ha' | 'text'
 */
export const METRICS = {
  // --- Volet 1 : Production ---
  'plantation.entites': { path: 'plantation.entites', label: 'Lignes de plantation', unit: '', level: 1, format: 'int' },
  'plantation.parcelles': { path: 'plantation.parcelles', label: 'Parcelles uniques', unit: '', level: 1, format: 'int' },
  'plantation.beneficiaires': { path: 'plantation.beneficiaires', label: 'Bénéficiaires identifiés', unit: '', level: 1, format: 'int' },
  'plantation.surfaceHa': { path: 'plantation.surfaceHa', label: 'Surface nette', unit: 'ha', level: 1, format: 'dec1' },
  'plantation.surfaceBruteHa': { path: 'plantation.surfaceBruteHa', label: 'Surface brute', unit: 'ha', level: 1, format: 'dec1' },
  'plantation.femmes': { path: 'plantation.femmes', label: 'Femmes', unit: '', level: 1, format: 'int' },
  'plantation.jeunes': { path: 'plantation.jeunes', label: 'Jeunes', unit: '', level: 1, format: 'int' },
  'plantation.tauxFeminisation': { path: 'plantation.tauxFeminisation', label: 'Taux de féminisation', unit: '%', level: 1, format: 'pct' },
  'plantation.tauxJeunesse': { path: 'plantation.tauxJeunesse', label: 'Taux de jeunesse', unit: '%', level: 1, format: 'pct' },
  'plantation.anneeMin': { path: 'plantation.anneeMin', label: 'Première année', unit: '', level: 1, format: 'text' },
  'plantation.anneeMax': { path: 'plantation.anneeMax', label: 'Dernière année', unit: '', level: 1, format: 'text' },

  // --- CES ---
  'ces.ravins': { path: 'ces.ravins', label: 'Ravins traités', unit: '', level: 1, format: 'int' },
  'ces.seuils': { path: 'ces.seuils', label: 'Tronçons de seuils', unit: '', level: 1, format: 'int' },
  'ces.seuilsDeclares': { path: 'ces.seuilsDeclares', label: 'Seuils déclarés', unit: '', level: 1, format: 'int' },
  'ces.marches': { path: 'ces.marches', label: 'Marchés CES', unit: '', level: 1, format: 'int' },
  'ces.volumeTotal': { path: 'ces.volumeTotal', label: 'Volume traité', unit: 'm³', level: 1, format: 'int' },
  'ces.longueurTotal': { path: 'ces.longueurTotal', label: 'Longueur traitée', unit: 'm', level: 1, format: 'int' },
  'ces.longueurKm': { path: 'ces.longueurTotal', scale: 0.001, label: 'Longueur traitée', unit: 'km', level: 1, format: 'dec1' },
  'ces.influence.grande': { path: 'ces.influence.grande', label: 'Grande influence', unit: '', level: 1, format: 'int' },
  'ces.influence.moyenne': { path: 'ces.influence.moyenne', label: 'Moyenne influence', unit: '', level: 1, format: 'int' },
  'ces.influence.faible': { path: 'ces.influence.faible', label: 'Faible influence', unit: '', level: 1, format: 'int' },

  // --- Bassins ---
  'sb.count': { path: 'sb.count', label: 'Sous-bassins', unit: '', level: 1, format: 'int' },
  'sb.totalSurface': { path: 'sb.totalSurface', label: 'Surface sous-bassins', unit: 'ha', level: 1, format: 'dec1' },
  'bv.count': { path: 'bv.count', label: 'Bassins versants', unit: '', level: 1, format: 'int' },

  // --- Pistes ---
  'pistes.count': { path: 'pistes.count', label: 'Pistes recensées', unit: '', level: 1, format: 'int' },
  'pistes.totalKm': { path: 'pistes.totalKm', label: 'Linéaire total', unit: 'km', level: 1, format: 'dec1' },
  'pistes.kmHorsEtude': { path: 'pistes.kmHorsEtude', label: 'Linéaire sous marché', unit: 'km', level: 1, format: 'dec1' },
  'pistes.nbEtude': { path: 'pistes.nbEtude', label: 'Pistes en étude', unit: '', level: 1, format: 'int' },

  // --- MER / Coopératives / MFR / TAMKIN ---
  'mer.total': { path: 'mer.total', label: 'Entités MER', unit: '', level: 1, format: 'int' },
  'mer.em.count': { path: 'mer.em.count', label: 'MER arboriculture', unit: '', level: 1, format: 'int' },
  'mer.em.adherents': { path: 'mer.em.adherents', label: 'Adhérents MER EM', unit: '', level: 1, format: 'int' },
  'mer.em.femmes': { path: 'mer.em.femmes', label: 'Femmes MER EM', unit: '', level: 1, format: 'int' },
  'mer.em.jeunes': { path: 'mer.em.jeunes', label: 'Jeunes MER EM', unit: '', level: 1, format: 'int' },
  'mer.apicole.count': { path: 'mer.apicole.count', label: 'MER apicole', unit: '', level: 1, format: 'int' },
  'mer.apicole.adherents': { path: 'mer.apicole.adherents', label: 'Adhérents MER apicole', unit: '', level: 1, format: 'int' },
  'mer.apicole.femmes': { path: 'mer.apicole.femmes', label: 'Femmes MER apicole', unit: '', level: 1, format: 'int' },
  'mer.apicole.jeunes': { path: 'mer.apicole.jeunes', label: 'Jeunes MER apicole', unit: '', level: 1, format: 'int' },
  'coop.count': { path: 'coop.count', label: 'Coopératives apicoles', unit: '', level: 1, format: 'int' },
  'coop.adherents': { path: 'coop.adherents', label: 'Adhérents coopératives', unit: '', level: 1, format: 'int' },
  'coop.femmes': { path: 'coop.femmes', label: 'Femmes coopératives', unit: '', level: 1, format: 'int' },
  'coop.jeunes': { path: 'coop.jeunes', label: 'Jeunes coopératives', unit: '', level: 1, format: 'int' },
  'mfr.beneficiaires': { path: 'mfr.beneficiaires', label: 'Stagiaires MFR', unit: '', level: 1, format: 'int' },
  'mfr.arbo': { path: 'merUnits.em', label: 'MFR arboriculture', unit: '', level: 1, format: 'int' },
  'mfr.api': { path: 'merUnits.apicole', label: 'MFR apiculture', unit: '', level: 1, format: 'int' },
  'tamkin.benef': { path: 'tamkin.benef', label: 'Bénéficiaires TAMKIN', unit: '', level: 1, format: 'int' },
  'tamkin.femmes': { path: 'tamkin.femmes', label: 'Femmes TAMKIN', unit: '', level: 1, format: 'int' },
  'tamkin.hommes': { path: 'tamkin.hommes', label: 'Hommes TAMKIN', unit: '', level: 1, format: 'int' },
  'tamkin.jeunes': { path: 'tamkin.jeunes', label: 'Jeunes TAMKIN', unit: '', level: 1, format: 'int' },
  'tamkin.centres': { path: 'tamkin.centers', label: 'Centres TAMKIN', unit: '', level: 1, format: 'int' },
  'tamkin.tauxFemmes': { ratio: ['tamkin.femmes', 'tamkin.benef'], label: 'Taux de féminisation TAMKIN', unit: '%', level: 1, format: 'pct' },

  // --- Détail par filière (parcelles uniques) ---
  'filiere.amandier.parcelles': { path: 'plantation.byFiliere.Plantation Amandier.parcelles', label: 'Parcelles amandier', unit: '', level: 1, format: 'int' },
  'filiere.figuier.parcelles': { path: 'plantation.byFiliere.Plantation Figuier.parcelles', label: 'Parcelles figuier', unit: '', level: 1, format: 'int' },
  'filiere.caroubier.parcelles': { path: 'plantation.byFiliere.Plantation Caroubier.parcelles', label: 'Parcelles caroubier', unit: '', level: 1, format: 'int' },
  'filiere.olivier.parcelles': { path: 'plantation.byFiliere.Plantation Olivier.parcelles', label: 'Parcelles olivier', unit: '', level: 1, format: 'int' },

  // --- Impact environnemental (estimations) ---
  'carbon.totalAnnual': { path: 'carbon.totalAnnual', label: 'Séquestration carbone', unit: 't C/an', level: 2, format: 'int', formula: 'C = A x R_e x (1-R) x CF', ref: 'IPCC 2006, Vol.4 AFOLU' },
  'carbon.totalStock': { path: 'carbon.totalStock', label: 'Stock carbone', unit: 't C', level: 2, format: 'int', formula: 'Stock = C_annuel x age', ref: 'IPCC 2006' },
  'veg.coverage': { path: 'veg.coverage', label: 'Couverture végétale', unit: '%', level: 1, format: 'dec1', formula: 'Surface plantee / Surface sous-bassin x 100', ref: 'FAO 2017' },
  'water.retention': { path: 'water.retention', label: 'Lame d\'eau retenue', unit: 'mm', level: 1, format: 'dec2', formula: 'L = V_traite / A_sous_bassin', ref: 'FAO 2017' },
  'production.totalProduction': { path: 'production.totalProduction', label: 'Production estimée', unit: 't/an', level: 2, format: 'int', formula: 'P = A x Y x (1-L)', ref: 'FAO 2020' },
  'production.totalValue': { path: 'production.totalValue', label: 'GVP estimé', unit: 'DH/an', level: 2, format: 'int', formula: 'GVP = P x p', ref: 'World Bank 2018' },

  // --- Périmètres / catégories ---
  'per.count': { path: 'per.count', label: 'Périmètres de marché', unit: '', level: 1, format: 'int' },
  'per.surface': { path: 'per.surface', label: 'Surface des périmètres', unit: 'ha', level: 1, format: 'dec1' },
  'per.marches': { path: 'per.marches', label: 'Marchés de plantation', unit: '', level: 1, format: 'int' },
  'mer.em.unites': { path: 'merUnits.em', label: 'Unites MER EM', unit: '', level: 1, format: 'int' },
  'mer.apicole.unites': { path: 'merUnits.apicole', label: 'Unites MER apicole', unit: '', level: 1, format: 'int' },
  'mfr.arbo.stagiaires': { path: 'mfr.formations.ARBORICULTURE', label: 'Stagiaires MFR arboriculture', unit: '', level: 1, format: 'int' },
  'mfr.api.stagiaires': { path: 'mfr.formations.APICULTURE', label: 'Stagiaires MFR apiculture', unit: '', level: 1, format: 'int' },
  'mfr.duree': { path: 'mfr.duree', label: 'Duree de formation', unit: '', level: 1, format: 'text' },
  'coop.unions': { path: 'coop.unions', label: 'Unions apicoles', unit: '', level: 1, format: 'int' },
  'coop.postes.responsabilites': { path: 'coop.postes.responsabilites', label: 'Postes de responsabilite', unit: '', level: 1, format: 'int' },
  'coop.postes.femmes': { path: 'coop.postes.femmes', label: 'Femmes en responsabilite', unit: '', level: 1, format: 'int' },
  'pfc.uv.total': { path: '__pfcuv.total', label: 'UV + PFC', unit: '', level: 1, format: 'int' },
  'pfc.uv.pfc': { path: '__pfcuv.pfc', label: 'Plates-formes (PFC)', unit: '', level: 1, format: 'int' },
  'pfc.uv.uv': { path: '__pfcuv.uv', label: 'Unites de valorisation', unit: '', level: 1, format: 'int' },
  'cat.communes': { path: '__categories.C12', label: 'Communes', unit: '', level: 1, format: 'int' },
  'cat.filieres': { path: '__categories.C1', label: 'Filières', unit: '', level: 1, format: 'int' }
};

const LEVEL_LABEL = {
  1: 'Observé / Calculé',
  2: 'Estimé (coefficients standard)',
  3: 'À renseigner'
};

const LEVEL_CLASS = { 1: 'confidence-1', 2: 'confidence-2', 3: 'confidence-3' };

/** Lit une valeur cheminée dans un objet. */
function readPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Formate une valeur selon la convention déclarée. */
export function formatValue(value, format = 'int') {
  if (value === null || value === undefined) return '—';
  if (format === 'text') return String(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (format === 'dec1') return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (format === 'dec2') return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (format === 'pct') return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return Math.round(value).toLocaleString('fr-FR');
}

/**
 * Résout une clé de métrique vers sa valeur affichable.
 * @returns {{ value, label, unit, level, levelLabel, formula, ref, className, key }}
 */
export function resolveMetric(key, context) {
  const def = METRICS[key];
  if (!def) {
    return {
      key, value: '—', label: key, unit: '', format: 'int',
      level: 3, levelLabel: LEVEL_LABEL[3], formula: null, ref: null,
      className: LEVEL_CLASS[3], missing: true
    };
  }
  const source = context?.indicators || {};
  let raw;
  if (Array.isArray(def.ratio) && def.ratio.length === 2) {
    const num = readPath(source, def.ratio[0]);
    const den = readPath(source, def.ratio[1]);
    raw = (typeof num === 'number' && typeof den === 'number' && den !== 0)
      ? (num / den) * 100
      : undefined;
  } else {
    raw = readPath(source, def.path);
  }
  if (typeof raw === 'number' && Number.isFinite(def.scale)) raw *= def.scale;
  // Les métriques de catégorie utilisent un contexte particulier.
  if (def.path && def.path.startsWith('__categories.')) {
    const cat = def.path.split('.')[1];
    const stats = context?.stats?.categories || {};
    raw = stats[cat];
  }
  // Compteurs derives des noeuds structurants (PFC / UV).
  if (def.path && def.path.startsWith('__pfcuv.')) {
    const puv = source.pfc_uv || { pfc: [], uv: [] };
    const key = def.path.split('.')[1];
    raw = key === 'pfc' ? (puv.pfc || []).length
        : key === 'uv' ? (puv.uv || []).length
        : (puv.pfc || []).length + (puv.uv || []).length;
  }
  const level = def.level ?? 1;
  return {
    key,
    value: formatValue(raw, def.format),
    numeric: typeof raw === 'number' ? raw : null,
    label: def.label,
    unit: def.unit,
    format: def.format,
    level,
    levelLabel: LEVEL_LABEL[level],
    formula: def.formula || null,
    ref: def.ref || null,
    className: LEVEL_CLASS[level]
  };
}

/** Résout un tableau de descripteurs { key | label+value } en cartes d'indicateurs. */
export function resolveIndicators(descriptors, context) {
  if (!Array.isArray(descriptors)) return [];
  return descriptors.map(d => {
    if (d.key) return resolveMetric(d.key, context);
    // Descripteur libre : la valeur reste déclarative (rare, documenté comme tel).
    return {
      key: d.key || null,
      value: formatValue(d.value, d.format || 'int'),
      numeric: typeof d.value === 'number' ? d.value : null,
      label: d.label,
      unit: d.unit || '',
      format: d.format || 'int',
      level: d.level ?? 1,
      levelLabel: LEVEL_LABEL[d.level ?? 1],
      formula: d.formula || null,
      ref: d.ref || null,
      className: LEVEL_CLASS[d.level ?? 1]
    };
  });
}

/**
 * Vérifie que toutes les clés référencées par les chapitres existent.
 * Utilisé par scripts/check-indicators.mjs comme garde-fou.
 */
export function validateMetricKeys(chapters) {
  const missing = [];
  const walk = (list) => {
    for (const ch of list || []) {
      for (const ind of ch.indicators || []) {
        if (ind.key && !METRICS[ind.key]) missing.push({ chapter: ch.id, key: ind.key });
      }
      for (const cue of ch.cues || []) {
        for (const ind of cue.indicators || []) {
          if (ind.key && !METRICS[ind.key]) missing.push({ chapter: ch.id, cue: cue.text, key: ind.key });
        }
      }
    }
  };
  walk(chapters);
  return missing;
}

export { LEVEL_LABEL, LEVEL_CLASS, CATEGORIES };
