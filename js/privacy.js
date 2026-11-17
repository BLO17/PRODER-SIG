// privacy.js — Filtrage des données sensibles avant affichage
import { PII_FIELDS } from './config.js';

const PII_SET = new Set(PII_FIELDS);

/** Retire les lignes nominatives d'une description "clé: valeur<br>...". */
export function redactDescription(desc) {
  if (!desc) return '';
  return String(desc)
    .split(/<br\s*\/?>/i)
    .filter(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return true;
      const key = line.substring(0, idx).trim();
      return !PII_SET.has(key);
    })
    .map(line => {
      // Le lieu de formation contient parfois le nom du propriétaire du local.
      if (/NOM DE LOCAL\s*:/i.test(line)) return 'NOM DE LOCAL: Local de formation';
      return line;
    })
    .join('<br>');
}

/**
 * Prépare une entité pour l'affichage cartographique :
 * - supprime les champs nominatifs (props aplaties et description) ;
 * - conserve `_parsed` (nécessaire aux popups) mais expurgé ;
 * - supprime l'identifiant bénéficiaire (pseudonyme ou CIN).
 */
export function sanitizeFeature(feature) {
  const props = { ...(feature.properties || {}) };
  for (const key of PII_SET) delete props[key];
  delete props._benefId;

  const parsed = { ...(props._parsed || {}) };
  for (const key of PII_SET) delete parsed[key];
  if (parsed['NOM DE LOCAL']) parsed['NOM DE LOCAL'] = 'Local de formation';

  props._parsed = parsed;
  props.description = redactDescription(props.description);

  return { ...feature, properties: props };
}

export function sanitizeFeatures(features) {
  return features.map(sanitizeFeature);
}

export function aggregateByZone(features, zoneField) {
  const result = {};
  for (const f of features) {
    const zone = f.properties[zoneField] || 'Inconnu';
    if (!result[zone]) result[zone] = { count: 0, surface: 0, femmes: 0, jeunes: 0 };
    result[zone].count++;
    if (f.properties._sup) result[zone].surface += f.properties._sup;
    if (f.properties._genre === 'F') result[zone].femmes++;
    if (f.properties._jeune === '1') result[zone].jeunes++;
  }
  return result;
}
