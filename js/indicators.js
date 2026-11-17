// indicators.js — Calcul des indicateurs PRODER Taza
import { CONFIG } from './config.js';

/**
 * Moteur d'indicateurs.
 *
 * Règles de calcul :
 * - une « entité » est une ligne du GeoJSON ;
 * - une « parcelle » est un identifiant ID-M unique (plusieurs bénéficiaires
 *   peuvent partager une parcelle) ; la surface est prise une seule fois par
 *   parcelle (valeur maximale observée) pour éviter le double comptage ;
 * - un « bénéficiaire » est un identifiant pseudonymisé unique (_benefId) ;
 * - aucune population (plantations, coopératives, TAMKIN, MER) n'est additionnée
 *   à une autre : les ensembles ne sont pas disjoints.
 */
export class IndicatorEngine {
  constructor(features) {
    this.features = features || [];
    this._memo = new Map();
  }

  _once(key, fn) {
    if (!this._memo.has(key)) this._memo.set(key, fn());
    return this._memo.get(key);
  }

  filter(pred) { return this.features.filter(pred); }

  getPlantations() {
    return this._once('plantations', () =>
      this.features.filter(f => f.properties._category === 'C1'));
  }

  /** Parcelles dédoublonnées par ID-M (ou par ligne si ID-M absent). */
  getParcels() {
    return this._once('parcels', () => {
      const parcels = new Map();
      for (const f of this.getPlantations()) {
        const p = f.properties;
        const key = p['ID-M'] || `row-${p._rowId}`;
        let rec = parcels.get(key);
        if (!rec) {
          rec = {
            key,
            sup: p._sup || 0,
            filiere: p._filiere,
            annee: p._annee,
            commune: p._commune,
            benefIds: new Set(),
            femmes: new Set(),
            jeunes: new Set(),
            rows: 0
          };
          parcels.set(key, rec);
        }
        rec.rows++;
        rec.sup = Math.max(rec.sup, p._sup || 0);
        if (!rec.filiere && p._filiere) rec.filiere = p._filiere;
        if (p._annee) rec.annee = rec.annee ? Math.min(rec.annee, p._annee) : p._annee;
        if (p._benefId) {
          rec.benefIds.add(p._benefId);
          if (p._genre === 'F') rec.femmes.add(p._benefId);
          if (p._jeune === '1') rec.jeunes.add(p._benefId);
        }
      }
      return parcels;
    });
  }

  /** Statistiques de plantation : entités, parcelles, bénéficiaires, surface. */
  getPlantationStats() {
    return this._once('plantationStats', () => {
      const rows = this.getPlantations();
      const parcels = this.getParcels();
      const benefIds = new Set();
      const femmes = new Set();
      const jeunes = new Set();
      let surfaceRaw = 0;
      let surface = 0;
      let anneeMin = null;
      let anneeMax = null;

      for (const f of rows) {
        const p = f.properties;
        surfaceRaw += p._sup || 0;
        if (p._benefId) {
          benefIds.add(p._benefId);
          if (p._genre === 'F') femmes.add(p._benefId);
          if (p._jeune === '1') jeunes.add(p._benefId);
        }
        if (p._annee) {
          anneeMin = anneeMin === null ? p._annee : Math.min(anneeMin, p._annee);
          anneeMax = anneeMax === null ? p._annee : Math.max(anneeMax, p._annee);
        }
      }
      for (const rec of parcels.values()) surface += rec.sup;

      const byFiliere = {};
      for (const rec of parcels.values()) {
        const fil = rec.filiere || 'Non renseigné';
        if (!byFiliere[fil]) {
          byFiliere[fil] = { parcelles: 0, surface: 0, beneficiaires: new Set(), femmes: new Set(), jeunes: new Set(), rows: 0 };
        }
        const b = byFiliere[fil];
        b.parcelles++;
        b.surface += rec.sup;
        b.rows += rec.rows;
        for (const id of rec.benefIds) b.beneficiaires.add(id);
        for (const id of rec.femmes) b.femmes.add(id);
        for (const id of rec.jeunes) b.jeunes.add(id);
      }
      for (const b of Object.values(byFiliere)) {
        b.beneficiaires = b.beneficiaires.size;
        b.femmes = b.femmes.size;
        b.jeunes = b.jeunes.size;
      }

      return {
        entites: rows.length,
        parcelles: parcels.size,
        beneficiaires: benefIds.size,
        femmes: femmes.size,
        jeunes: jeunes.size,
        surfaceHa: surface,
        surfaceBruteHa: surfaceRaw,
        tauxFeminisation: benefIds.size ? (femmes.size / benefIds.size) * 100 : 0,
        tauxJeunesse: benefIds.size ? (jeunes.size / benefIds.size) * 100 : 0,
        anneeMin,
        anneeMax,
        byFiliere
      };
    });
  }

  getTotalSurface() { return this.getPlantationStats().surfaceHa; }

  // Repartition des plantations par annee de plantation (pour la timeline de la story).
  getPlantationByYear() {
    return this._once('plantationByYear', () => {
      const rows = this.getPlantations();
      const out = {};
      for (const f of rows) {
        const p = f.properties;
        const y = p._annee;
        if (!y) continue;
        if (!out[y]) out[y] = { annee: y, entites: 0, surface: 0, benefIds: new Set(), femmes: new Set(), jeunes: new Set(), byFiliere: {} };
        const o = out[y];
        o.entites++;
        o.surface += p._sup || 0;
        if (p._benefId) {
          o.benefIds.add(p._benefId);
          if (p._genre === 'F') o.femmes.add(p._benefId);
          if (p._jeune === '1') o.jeunes.add(p._benefId);
        }
        const fil = p._filiere || 'Non renseigne';
        o.byFiliere[fil] = (o.byFiliere[fil] || 0) + 1;
      }
      for (const o of Object.values(out)) {
        o.beneficiaires = o.benefIds.size;
        o.femmes = o.femmes.size;
        o.jeunes = o.jeunes.size;
        o.surface = Math.round(o.surface * 10) / 10;
        delete o.benefIds; delete o.femmes; delete o.jeunes;
      }
      return Object.values(out).sort((a, b) => a.annee - b.annee);
    });
  }

  // Nombre d'unites MER (fiches unite) par type : distingue unite et adherents.
  getMERUnits() {
    return this._once('merUnits', () => {
      const out = { apicole: 0, em: 0, apicoleAdherents: 0, emAdherents: 0 };
      for (const f of this.features) {
        if (f.properties._category !== 'C8') continue;
        const d = f.properties._parsed || {};
        const isUnit = d["Nbre d'adhérents Total"] !== undefined;
        const type = f.properties._merType === 'AGR' ? 'apicole' : 'em';
        if (isUnit) {
          out[type]++;
          out[type + 'Adherents'] += parseInt(d["Nbre d'adhérents Total"] || 0, 10) || 0;
        }
      }
      return out;
    });
  }

  getMERByType() {
    return this._once('mer', () => {
      const units = this.features.filter(f => f.properties._category === 'C8');
      const result = {
        total: units.length,
        apicole: { count: 0, adherents: 0, femmes: 0, jeunes: 0 },
        em: { count: 0, adherents: 0, femmes: 0, jeunes: 0 },
        avancement: {}
      };
      for (const f of units) {
        const p = f.properties;
        const d = p._parsed || {};
        const type = p._merType === 'AGR' ? 'apicole' : 'em';
        result[type].count++;
        result[type].adherents += parseInt(d["Nbre d'adhérents Total"] || 0, 10) || 0;
        result[type].femmes += parseInt(d["Nbre d'adhérents FEMMES"] || 0, 10) || 0;
        result[type].jeunes += parseInt(d["Nbre d'adhérents JEUNES"] || 0, 10) || 0;
        const av = p._avancement || 'Non renseigné';
        result.avancement[av] = (result.avancement[av] || 0) + 1;
      }
      return result;
    });
  }

  getCooperatives() {
    return this._once('coop', () => {
      const coops = this.features.filter(f => f.properties._category === 'C9');
      const unions = new Set();
      const situations = {};
      const postes = { total: 0, sexeConnu: 0, femmes: 0, responsabilites: 0, femmesResponsabilites: 0 };
      let totalAdh = 0, totalF = 0, totalJ = 0;
      for (const f of coops) {
        const p = f.properties;
        const d = p._parsed || {};
        if (p._appartenanceUnion) unions.add(p._appartenanceUnion);
        totalAdh += parseInt(d["Nbre d'adhérents Total"] || 0, 10) || 0;
        totalF += parseInt(d["Nbre d'adhérents FEMMES"] || 0, 10) || 0;
        totalJ += parseInt(d["Nbre d'adhérents JEUNES"] || 0, 10) || 0;
        const s = p._situationCoop || 'Non renseigné';
        situations[s] = (situations[s] || 0) + 1;

        // Postes déclarés dans les coopératives (SEXE renseigné sur une partie)
        const poste = (p._parsed['POSTE OCCUPE'] || '').trim();
        if (poste) {
          const sexe = (p._parsed['SEXE'] || '').trim().toUpperCase();
          postes.total++;
          if (sexe === 'F' || sexe === 'H') {
            postes.sexeConnu++;
            if (sexe === 'F') postes.femmes++;
          }
          if (/^(pr[ée]sident|tr[ée]sorier|secr[ée]taire|g[ée]rant)/i.test(poste)) {
            postes.responsabilites++;
            if (sexe === 'F') postes.femmesResponsabilites++;
          }
        }
      }
      return {
        count: coops.length,
        adherents: totalAdh,
        femmes: totalF,
        jeunes: totalJ,
        tauxFeminisation: totalAdh ? (totalF / totalAdh) * 100 : 0,
        tauxJeunesse: totalAdh ? (totalJ / totalAdh) * 100 : 0,
        unions: [...unions].filter(u => !/^non/i.test(u)),
        situations,
        postes,
        tauxFemmesPostes: postes.sexeConnu ? (postes.femmes / postes.sexeConnu) * 100 : 0
      };
    });
  }

  getTAMKIN() {
    return this._once('tamkin', () => {
      const centers = this.features.filter(f => f.properties._category === 'C10');
      let benef = 0, femmes = 0, hommes = 0, jeunes = 0;
      for (const f of centers) {
        const p = f.properties;
        benef += p._nbBenefFormation || 0;
        femmes += p._nbFemmesFormation || 0;
        hommes += p._nbHommesFormation || 0;
        jeunes += p._nbJeunesFormation || 0;
      }
      return {
        centers: centers.length, benef, femmes, hommes, jeunes,
        tauxFeminisation: benef ? (femmes / benef) * 100 : 0
      };
    });
  }

  getMFR() {
    return this._once('mfr', () => {
      const mfr = this.features.filter(f => f.properties._category === 'C11');
      const ids = new Set();
      const formations = {};
      for (const f of mfr) {
        const p = f.properties;
        if (p._benefId) ids.add(p._benefId);
        const fo = p._formation || 'Non renseigné';
        formations[fo] = (formations[fo] || 0) + 1;
      }
      return {
        entites: mfr.length,
        beneficiaires: ids.size,
        formations,
        duree: mfr[0]?.properties._dureeFormation || '9 mois'
      };
    });
  }

  /**
   * Hiérarchie MFR (agrégats Tranche → Spécialité → Commune), pré-calculée
   * dans data/mfr-hierarchy.json et rattachée au moteur par app.js.
   * Agrégats uniquement — aucune donnée nominative.
   */
  getMFRHierarchy() {
    return this.mfrHierarchy || null;
  }

  getPistes() {
    return this._once('pistes', () => {
      const pistes = this.features.filter(f => f.properties._category === 'C5' && f.properties._hasMarcheYear === true && f.properties._enEtude !== true);
      let totalKm = 0, etudeKm = 0;
      const statuts = {};
      for (const f of pistes) {
        const p = f.properties;
        const km = p._longueurKm != null ? p._longueurKm : (p._longueur || 0) / 1000;
        totalKm += km;
        if (p._enEtude) etudeKm += km;
        const s = p._statutPiste || 'Statut non renseigné';
        statuts[s] = (statuts[s] || 0) + km;
      }
      // Les statistiques de statut sont calculees sur l'ensemble des pistes
      // recensees (y compris etudes), alors que totalKm ne retient que les
      // pistes sous marche : le volume etude est ainsi explicite.
      const toutes = this.features.filter(f => f.properties._category === 'C5');
      const nbEtude = toutes.filter(f => f.properties._enEtude).length;
      const nbSansMarche = toutes.filter(f => f.properties._enEtude !== true && f.properties._hasMarcheYear !== true).length;
      const statutsAll = {};
      for (const f of toutes) {
        const s = f.properties._statutPiste || 'Statut non renseigne';
        statutsAll[s] = (statutsAll[s] || 0) + 1;
      }
      return {
        count: pistes.length,
        totalKm: Math.round(totalKm * 10) / 10,
        kmHorsEtude: Math.round((totalKm - etudeKm) * 10) / 10,
        etudeKm: Math.round(etudeKm * 10) / 10,
        nbEtude,
        nbSansMarche,
        nbRecensees: toutes.length,
        statuts: statutsAll
      };
    });
  }

  getPFC_UV() {
    return {
      pfc: this.features.filter(f => f.properties._category === 'C7')
        .map(f => ({ name: f.properties.name, coords: f.properties._coords || f.geometry.coordinates })),
      uv: this.features.filter(f => f.properties._category === 'C6')
        .map(f => ({ name: f.properties.name, coords: f.properties._coords || f.geometry.coordinates }))
    };
  }

  getCES() {
    return this._once('ces', () => {
      const ravins = this.features.filter(f => f.properties._category === 'C2');
      const seuils = this.features.filter(f => f.properties._category === 'C3');
      const marches = new Set();
      let volumeTotal = 0, longueurTotal = 0, seuilsDeclares = 0;
      const influence = { grande: 0, moyenne: 0, faible: 0 };
      for (const f of ravins) {
        const p = f.properties;
        const m = p._parsed['N° De Marché'] || p._marche;
        if (m) marches.add(m);
      }
      for (const f of seuils) {
        const p = f.properties;
        volumeTotal += p._volume || 0;
        longueurTotal += p._longueur || 0;
        seuilsDeclares += p._nbSeuils || 0;
        const inf = p._influence;
        if (inf === 'Grande Influence') influence.grande++;
        else if (inf === 'Moyenne influence') influence.moyenne++;
        else if (inf === 'faible influence') influence.faible++;
      }
      return {
        ravins: ravins.length,
        seuils: seuils.length,
        seuilsDeclares,
        marches: marches.size,
        volumeTotal: Math.round(volumeTotal),
        longueurTotal: Math.round(longueurTotal),
        influence
      };
    });
  }

  getSousBassins() {
    return this._once('sousBassins', () => {
      const sb = this.features.filter(f => f.properties._category === 'C4');
      const groups = {};
      let totalSurface = 0;
      for (const f of sb) {
        const name = f.properties.name || 'Non nommé';
        const surface = f.properties._surfaceHa || 0;
        if (!groups[name]) groups[name] = { count: 0, surface: 0 };
        groups[name].count++;
        groups[name].surface += surface;
        totalSurface += surface;
      }
      return {
        count: sb.length,
        groups,
        totalSurface: Math.round(totalSurface * 10) / 10
      };
    });
  }

  getBassinsVersants() {
    return this._once('bassins', () => {
      const bv = this.features.filter(f => f.properties._category === 'C15');
      const groups = {};
      let totalSurface = 0;
      for (const f of bv) {
        const name = f.properties.name || 'Non nommé';
        const surface = f.properties._surfaceHa || 0;
        groups[name] = { count: 1, surface };
        totalSurface += surface;
      }
      return { count: bv.length, groups, totalSurface: Math.round(totalSurface) };
    });
  }

  getPerimetres() {
    return this._once('perimetres', () => {
      const per = this.features.filter(f => f.properties._category === 'C14');
      let surface = 0;
      const marches = new Set();
      const filieres = {};
      for (const f of per) {
        const d = f.properties._parsed;
        surface += parseFloat(String(d['SUP-Périmètre(ha)'] || d['SUP-total-Marché(ha)'] || '0').replace(',', '.')) || 0;
        if (d['N° Marché']) marches.add(d['N° Marché']);
        const fil = d.Plantation || 'Non renseigné';
        filieres[fil] = (filieres[fil] || 0) + 1;
      }
      return { count: per.length, surface: Math.round(surface), marches: marches.size, filieres };
    });
  }

  // --- Estimations (niveau de preuve « estimé ») ---

  getCarbonSequestration() {
    return this._once('carbon', () => {
      const parcels = this.getParcels();
      const result = {};
      let totalAnnual = 0, totalStock = 0;
      for (const rec of parcels.values()) {
        const fil = rec.filiere;
        if (!fil) continue;
        const age = Math.max(0, CONFIG.referenceYear - (rec.annee || CONFIG.referenceYear));
        const coeff = CONFIG.carbonCoeffs[fil] || 2.0;
        const k = CONFIG.growthK[fil] || 0.2;
        const ageFactor = 1 - Math.exp(-k * age);
        const stock = rec.sup * coeff * ageFactor;
        const annual = age > 0 ? stock / age : 0;
        if (!result[fil]) result[fil] = { parcelles: 0, surface: 0, annual: 0, stock: 0 };
        result[fil].parcelles++;
        result[fil].surface += rec.sup;
        result[fil].annual += annual;
        result[fil].stock += stock;
        totalAnnual += annual;
        totalStock += stock;
      }
      return { byFiliere: result, totalAnnual: Math.round(totalAnnual), totalStock: Math.round(totalStock) };
    });
  }

  getProductionEstimate() {
    return this._once('production', () => {
      const parcels = this.getParcels();
      const result = {};
      let totalProd = 0, totalValue = 0;
      for (const rec of parcels.values()) {
        const fil = rec.filiere;
        if (!fil) continue;
        const age = Math.max(0, CONFIG.referenceYear - (rec.annee || CONFIG.referenceYear));
        const yieldCoeff = CONFIG.yieldCoeffs[fil] || 1.0;
        const maturityAge = CONFIG.maturityAge[fil] || 5;
        const yieldFactor = age >= maturityAge ? 1 : Math.max(0, (age - 1) / (maturityAge - 1));
        const prod = rec.sup * yieldCoeff * yieldFactor;
        const price = CONFIG.priceCoeffs[fil] || 5000;
        const value = prod * price;
        if (!result[fil]) result[fil] = { parcelles: 0, surface: 0, production: 0, value: 0 };
        result[fil].parcelles++;
        result[fil].surface += rec.sup;
        result[fil].production += prod;
        result[fil].value += value;
        totalProd += prod;
        totalValue += value;
      }
      return { byFiliere: result, totalProduction: Math.round(totalProd), totalValue: Math.round(totalValue) };
    });
  }

  getVegetationCoverage() {
    return this._once('veg', () => {
      const sb = this.getSousBassins();
      const planted = this.getPlantationStats().surfaceHa;
      return {
        coverage: sb.totalSurface ? (planted / sb.totalSurface) * 100 : 0,
        plantedSurface: Math.round(planted),
        basinSurface: sb.totalSurface
      };
    });
  }

  // --- Indicateurs altimetriques (terrain.reearth.land, niveau 1 : mesure) ---

  getAltitudeIndicators() {
    return this._once('altitude', () => {
      const rows = this.getPlantations();
      const byFiliere = {};
      const byCommune = {};
      const allAlts = [];
      for (const f of rows) {
        const p = f.properties;
        const alt = p._altitude;
        if (alt === null || alt === undefined) continue;
        const fil = p._filiere || 'Non renseigne';
        if (!byFiliere[fil]) byFiliere[fil] = { n: 0, sum: 0, min: Infinity, max: -Infinity };
        const b = byFiliere[fil];
        b.n++; b.sum += alt;
        if (alt < b.min) b.min = alt;
        if (alt > b.max) b.max = alt;
        const com = p._commune || 'Inconnu';
        if (!byCommune[com]) byCommune[com] = { n: 0, sum: 0, min: Infinity, max: -Infinity };
        const c = byCommune[com];
        c.n++; c.sum += alt;
        if (alt < c.min) c.min = alt;
        if (alt > c.max) c.max = alt;
        allAlts.push(alt);
      }
      const filiereStats = {};
      for (const [fil, b] of Object.entries(byFiliere)) {
        filiereStats[fil] = {
          n: b.n,
          altMoyenne: Math.round(b.sum / b.n),
          altMin: Math.round(b.min),
          altMax: Math.round(b.max),
          gradient: Math.round(b.max - b.min)
        };
      }
      const communeStats = {};
      for (const [com, c] of Object.entries(byCommune)) {
        communeStats[com] = {
          n: c.n,
          altMoyenne: Math.round(c.sum / c.n),
          altMin: Math.round(c.min),
          altMax: Math.round(c.max)
        };
      }
      const global = allAlts.length ? {
        n: allAlts.length,
        altMoyenne: Math.round(allAlts.reduce((a, b) => a + b, 0) / allAlts.length),
        altMin: Math.round(Math.min(...allAlts)),
        altMax: Math.round(Math.max(...allAlts)),
        gradient: Math.round(Math.max(...allAlts) - Math.min(...allAlts))
      } : null;

      const penteReelle = {};
      for (const [fil, b] of Object.entries(byFiliere)) {
        penteReelle[fil] = b.n > 1 ? Math.round((b.max - b.min) / Math.sqrt(b.n) * 10) / 10 : 0;
      }

      const agroEcologique = {};
      const optimalRanges = {
        'Plantation Amandier': [600, 1200],
        'Plantation Figuier': [400, 1000],
        'Plantation Caroubier': [0, 600],
        'Plantation Olivier': [200, 800]
      };
      for (const [fil, b] of Object.entries(byFiliere)) {
        const range = optimalRanges[fil] || [0, 2000];
        const inRange = rows.filter(f => f.properties._filiere === fil && f.properties._altitude !== null && f.properties._altitude >= range[0] && f.properties._altitude <= range[1]).length;
        agroEcologique[fil] = {
          optimalMin: range[0],
          optimalMax: range[1],
          inOptimalRange: inRange,
          total: b.n,
          pctOptimal: b.n > 0 ? Math.round((inRange / b.n) * 100) : 0
        };
      }

      const cesPoints = this.features.filter(f => f.properties._category === 'C2' || f.properties._category === 'C3');
      const riskIndex = {};
      for (const [fil, b] of Object.entries(byFiliere)) {
        const filRows = rows.filter(f => f.properties._filiere === fil && f.properties._altitude !== null);
        let highRisk = 0, medRisk = 0, lowRisk = 0;
        for (const f of filRows) {
          const alt = f.properties._altitude;
          const pente = penteReelle[fil] || 0;
          if (alt < 800 && pente > 15) highRisk++;
          else if (alt < 1000 && pente > 8) medRisk++;
          else lowRisk++;
        }
        riskIndex[fil] = { high: highRisk, medium: medRisk, low: lowRisk, total: filRows.length };
      }

      return {
        global,
        byFiliere: filiereStats,
        byCommune: communeStats,
        penteReelle,
        agroEcologique,
        riskIndex
      };
    });
  }

  getWaterRetention() {
    return this._once('water', () => {
      const ces = this.getCES();
      const sb = this.getSousBassins();
      const retention = sb.totalSurface ? (ces.volumeTotal / (sb.totalSurface * 10000)) * 1000 : 0;
      return { retention, volume: ces.volumeTotal, surface: sb.totalSurface };
    });
  }

  // --- Contrôles de qualité ---

  getDataQuality() {
    return this._once('quality', () => {
      const rows = this.getPlantations();
      const parcels = this.getParcels();
      const genreByBenef = new Map();
      const jeuneByBenef = new Map();
      let missingBenefId = 0;
      for (const f of rows) {
        const p = f.properties;
        if (!p._benefId) { missingBenefId++; continue; }
        if (!genreByBenef.has(p._benefId)) genreByBenef.set(p._benefId, new Set());
        genreByBenef.get(p._benefId).add(p._genre);
        if (!jeuneByBenef.has(p._benefId)) jeuneByBenef.set(p._benefId, new Set());
        jeuneByBenef.get(p._benefId).add(p._jeune);
      }
      const genreConflicts = [...genreByBenef.values()].filter(s => s.size > 1).length;
      const jeuneConflicts = [...jeuneByBenef.values()].filter(s => s.size > 1).length;

      const surfaceBrute = this.getPlantationStats().surfaceBruteHa;
      const surfaceNette = this.getPlantationStats().surfaceHa;

      const categories = {};
      for (const f of this.features) {
        categories[f.properties._category] = (categories[f.properties._category] || 0) + 1;
      }

      return {
        entites: this.features.length,
        categories,
        lignesPlantation: rows.length,
        parcelles: parcels.size,
        lignesDupliquees: rows.length - parcels.size,
        beneficiaires: this.getPlantationStats().beneficiaires,
        benefSansId: missingBenefId,
        genreConflicts,
        jeuneConflicts,
        surfaceBrute: Math.round(surfaceBrute),
        surfaceNette: Math.round(surfaceNette),
        perteSurface: surfaceBrute ? ((surfaceBrute - surfaceNette) / surfaceBrute) * 100 : 0,
        pistesEnEtude: this.getPistes().nbEtude,
        statutCES: 'non disponible',
        modeleHydrologique: 'non paramétré',
        surviePlants: 'non disponible'
      };
    });
  }

  getGlobalIndicators() {
    return this._once('global', () => {
      const plantation = this.getPlantationStats();
      const carbon = this.getCarbonSequestration();
      const production = this.getProductionEstimate();
      const mer = this.getMERByType();
      const pistes = this.getPistes();
      const ces = this.getCES();
      const sb = this.getSousBassins();
      const bv = this.getBassinsVersants();
      const coop = this.getCooperatives();
      const mfr = this.getMFR();
      const tamkin = this.getTAMKIN();
      const per = this.getPerimetres();

      return {
        plantation,
        carbon,
        production,
        mer,
        pistes,
        ces,
        sb,
        bv,
        coop,
        mfr,
        tamkin,
        per,
        populations: {
          beneficiairesPlantations: plantation.beneficiaires,
          femmesPlantations: plantation.femmes,
          jeunesPlantations: plantation.jeunes,
          adherentsCoop: coop.adherents,
          femmesCoop: coop.femmes,
          beneficiairesTAMKIN: tamkin.benef,
          femmesTAMKIN: tamkin.femmes,
          adherentsMER: mer.apicole.adherents + mer.em.adherents,
          stagiairesMFR: mfr.beneficiaires
        }
      };
    });
  }

  getAllIndicators() {
    return {
      global: this.getGlobalIndicators(),
      plantation: this.getPlantationStats(),
      carbon: this.getCarbonSequestration(),
      production: this.getProductionEstimate(),
      mer: this.getMERByType(),
      pistes: this.getPistes(),
      ces: this.getCES(),
      sb: this.getSousBassins(),
      bv: this.getBassinsVersants(),
      coop: this.getCooperatives(),
      mfr: this.getMFR(),
      tamkin: this.getTAMKIN(),
      per: this.getPerimetres(),
      veg: this.getVegetationCoverage(),
      water: this.getWaterRetention(),
      quality: this.getDataQuality(),
      altitude: this.getAltitudeIndicators(),
      altitude: this.getAltitudeIndicators(),
      byYear: this.getPlantationByYear(),
      merUnits: this.getMERUnits(),
      pfc_uv: this.getPFC_UV()
    };
  }
}
