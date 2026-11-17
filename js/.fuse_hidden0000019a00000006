// dashboard.js — Tableau de bord interactif
const nf = (n, d = 0) => Number(n || 0).toLocaleString('fr-FR', {
  minimumFractionDigits: d, maximumFractionDigits: d
});

const badge = (level) => {
  const map = {
    1: ['Obs./calculé', 'confidence-1'],
    2: ['Estimé', 'confidence-2'],
    3: ['À renseigner', 'confidence-3']
  };
  const [label, cls] = map[level] || map[3];
  return `<span class="indicator-confidence ${cls}">${label}</span>`;
};

export class DashboardManager {
  constructor(indicatorEngine, getJoinStats = null) {
    this.engine = indicatorEngine;
    this.getJoinStats = getJoinStats;
    this.container = document.getElementById('dashboard-content');
  }

  render() {
    const ind = this.engine.getAllIndicators();
    const g = ind.global;
    const p = g.plantation;
    const q = ind.quality;

    let html = '';

    // ---------- Volet 1 ----------
    html += `<div class="dashboard-section"><h3>🌱 Volet 1 — Production & commercialisation</h3>`;
    html += `<div class="dashboard-grid">`;
    html += this.card('Parcelles recensées', nf(p.parcelles), `${nf(p.entites)} lignes`);
    html += this.card('Bénéficiaires identifiés', nf(p.beneficiaires), 'identifiants uniques');
    html += this.card('Surface plantée nette', nf(p.surfaceHa), 'ha (dédoublonnée)');
    html += this.card('Femmes bénéficiaires', nf(p.femmes), `${nf(p.tauxFeminisation, 1)} %`);
    html += this.card('Jeunes bénéficiaires', nf(p.jeunes), `${nf(p.tauxJeunesse, 1)} %`);
    html += this.card('Périmètres sous marché', nf(g.per.count), `${nf(g.per.surface)} ha`);
    html += this.card('Pistes hors étude', nf(ind.pistes.kmHorsEtude, 1), `${nf(ind.pistes.count)} tronçons · km`);
    html += this.card('GVP estimée', nf(ind.production.totalValue / 1e6, 1), 'M DH/an');
    html += `</div>`;
    html += `<div class="indicator-formula" style="margin-top:8px;">Surface nette = somme des SUP par ID-M unique. Surface brute = ${nf(q.surfaceBrute)} ha, soit ${nf(q.perteSurface, 1)} % de surestimation évitée.</div></div>`;

    // Filières
    html += `<div class="dashboard-section"><h3>Filières arboricoles</h3>`;
    for (const [fil, data] of Object.entries(p.byFiliere)) {
      const name = fil.replace('Plantation ', '');
      html += `<div class="indicator-card">
        <div class="indicator-name">${name}</div>
        <div class="indicator-value">${nf(data.parcelles)} <span class="indicator-unit">parcelles · ${nf(data.surface)} ha</span></div>
        <div class="indicator-formula">${nf(data.beneficiaires)} bénéficiaires · ${nf(data.femmes)} femmes · ${nf(data.jeunes)} jeunes</div>
      </div>`;
    }
    html += `</div>`;

    // Chaîne de valeur
    html += `<div class="dashboard-section"><h3>Chaîne de valeur & structuration</h3><div class="dashboard-grid">`;
    html += this.card('MER', nf(ind.mer.total), `${nf(ind.mer.apicole.count)} apicoles · ${nf(ind.mer.em.count)} EM`);
    html += this.card('Coopératives', nf(ind.coop.count), `${nf(ind.coop.adherents)} adhérents`);
    html += this.card('Unions', nf(ind.coop.unions.length), 'recensées');
    const pfcuv = this.engine.getPFC_UV();
    html += this.card('UV (miel)', nf(pfcuv.uv.length), 'unités de valorisation');
    html += this.card('PFC', nf(pfcuv.pfc.length), 'plateformes');
    html += this.card('Femmes en responsabilité', nf(ind.coop.postes.femmesResponsabilites), `${nf(ind.coop.postes.responsabilites)} postes recensés`);
    html += `</div></div>`;

    // ---------- Volet 2 ----------
    html += `<div class="dashboard-section"><h3>🌍 Volet 2 — Impacts</h3><div class="dashboard-grid">`;
    html += this.card('Volume CES déclaré', nf(ind.ces.volumeTotal), 'm³');
    html += this.card('Seuils CES', nf(ind.ces.seuilsDeclares), `${nf(ind.ces.seuils)} tronçons`);
    html += this.card('Ravins recensés', nf(ind.ces.ravins), `${nf(ind.ces.marches)} marchés`);
    html += this.card('Sous-bassins', nf(ind.sb.count), `${nf(ind.sb.totalSurface)} ha`);
    html += this.card('Bassins versants', nf(ind.bv.count), `${nf(ind.bv.totalSurface / 1000)} km²`);
    html += this.card('Couverture végétale', nf(ind.veg.coverage, 1), '% des sous-bassins');
    html += this.card('Stock carbone estimé', nf(g.carbon.totalStock), 't C');
    html += this.card('Séquestration estimée', nf(g.carbon.totalAnnual), 't C/an');
    html += `</div>`;
    html += `<div class="indicator-formula" style="margin-top:8px;">Lame d'eau théorique retenue : ${nf(ind.water.retention, 2)} mm (volume traité / surface des sous-bassins). Le carbone et la GVP sont des estimations paramétrées, non des mesures.</div></div>`;

    // ---------- Formation & inclusion ----------
    html += `<div class="dashboard-section"><h3>🎓 Formation & inclusion</h3><div class="dashboard-grid">`;
    html += this.card('TAMKIN — classes', nf(ind.tamkin.centers), 'sessions');
    html += this.card('TAMKIN — bénéficiaires', nf(ind.tamkin.benef), 'personnes');
    html += this.card('TAMKIN — femmes', nf(ind.tamkin.femmes), `${nf(ind.tamkin.tauxFeminisation, 1)} %`);
    html += this.card('MFR — bénéficiaires', nf(ind.mfr.beneficiaires), `${ind.mfr.duree}`);
    html += this.card('Coop. — femmes', nf(ind.coop.femmes), `${nf(ind.coop.tauxFeminisation, 1)} % des adhérents`);
    html += this.card('Coop. — jeunes', nf(ind.coop.jeunes), `${nf(ind.coop.tauxJeunesse, 1)} %`);
    html += `</div></div>`;

    // ---------- Niveaux de preuve ----------
    html += `<div class="dashboard-section"><h3>🔎 Niveaux de preuve</h3>`;
    const proof = [
      ['Entités, surfaces, bénéficiaires, adhérents, linéaires', 'Observé', 1],
      ['Parcelles uniques, surfaces nettes, taux, couverture végétale', 'Calculé', 1],
      ['Stock carbone, séquestration annuelle, GVP, lame d\'eau', 'Estimé', 2],
      ['Survie des plants, rendements/prix validés, volumes de miel vendus', 'À renseigner', 3],
      ['Réception des travaux CES et des pistes, diamètre des seuils', 'À renseigner', 3],
      ['Population desservie, emplois, érosion évitée, VAN', 'À renseigner', 3]
    ];
    for (const [label, level, code] of proof) {
      html += `<div class="indicator-card"><div class="indicator-name">${label}</div>
        <div class="indicator-value" style="font-size:13px;">${level}</div>${badge(code)}</div>`;
    }
    html += `</div>`;

    // ---------- Qualité des données ----------
    html += `<div class="dashboard-section"><h3>⚙️ Contrôles de qualité</h3>
      <div style="font-size:11px;color:#99a9bb;line-height:1.7;">
      ${this.joinLine()}
      <p><strong>${nf(q.entites)}</strong> entités classées (${Object.keys(q.categories).length} catégories), dont <strong>${nf(q.categories.C13 || 0)}</strong> références non rattachées à une composante.</p>
      <p><strong>${nf(q.lignesPlantation)}</strong> lignes de plantation → <strong>${nf(q.parcelles)}</strong> parcelles uniques (ID-M) → <strong>${nf(q.beneficiaires)}</strong> bénéficiaires identifiés.</p>
      <p><strong>${nf(q.lignesDupliquees)}</strong> lignes partagent une parcelle existante. Surface corrigée : ${nf(q.surfaceBrute)} ha → <strong>${nf(q.surfaceNette)} ha</strong> (−${nf(q.perteSurface, 1)} %).</p>
      <p><strong>${nf(q.benefSansId)}</strong> ligne(s) sans identifiant bénéficiaire ; <strong>${nf(q.genreConflicts)}</strong> identifiants avec un genre contradictoire et <strong>${nf(q.jeuneConflicts)}</strong> avec un statut « jeune » contradictoire.</p>
      <p><strong>${nf(q.pistesEnEtude)}</strong> piste(s) en étude exclue(s) du linéaire validé. Statut de réception des travaux CES : <strong>non disponible</strong> (marché attribué ≠ travaux achevés).</p>
      <p>Modèle hydrologique, taux de survie des plants et volumes commercialisés : <strong>données à collecter</strong>.</p>
      </div></div>`;

    // ---------- Méthodologie ----------
    html += `<div class="dashboard-section"><h3>📋 Méthode, hypothèses & références</h3>
      <div style="font-size:11px;color:#8899aa;line-height:1.65;">
      <p><strong>Périmètre :</strong> GeoJSON PRODER du 09/10/2026 — ${nf(q.entites)} entités. Jeu public pseudonymisé : ni nom, ni CIN, ni téléphone.</p>
      <p><strong>Hypothèses de simulation :</strong> rendements (amandier 0,8 ; figuier 3,0 ; caroubier 1,5 ; olivier 1,2 t/ha/an), prix producteur (45 000 ; 8 000 ; 6 000 ; 12 000 DH/t) et coefficients carbone : valeurs indicatives à valider par les services techniques avant diffusion.</p>
      <p><strong>Limites :</strong> la proximité géographique n'est pas une preuve de desserte ni de causalité ; un marché attribué n'est pas un ouvrage réceptionné ; une plantation recensée n'est pas un plant vivant.</p>
      <p><strong>Références :</strong> FIDA (Managing for Results ; Core Outcome Indicators) · GIEC/IPCC 2006, vol. 4 (AFOLU) · FAO (érosion, eau) · Banque mondiale (accès rural) · MapLibre GL JS.</p>
      <p style="margin-top:8px;font-style:italic;">Les valeurs « estimées » ne doivent pas être présentées comme des résultats comptables ou évaluatifs officiels.</p>
      </div></div>`;

    this.container.innerHTML = html;
  }

  /** Rattachement des bénéficiaires aux polygones : bilan chiffré et vérifiable. */
  joinLine() {
    const s = this.getJoinStats ? this.getJoinStats() : null;
    if (!s) return '';
    const cov = s.coverage.toFixed(1);
    const tone = s.coverage >= 80 ? '#66BB6A' : s.coverage >= 50 ? '#FFB300' : '#EF5350';
    return `<p><strong>Rattachement polygones ↔ bénéficiaires :</strong> ` +
      `<span style="color:${tone};font-weight:700">${cov} %</span> ` +
      `(${s.spatial + s.market}/${s.polygons} polygones) — ` +
      `<strong>${s.spatial}</strong> par position géographique (niveau 2), ` +
      `<strong>${s.market}</strong> par numéro de marché (niveau 1), ` +
      `<strong>${s.none}</strong> sans objet. ` +
      `Plantations : ${nf(s.pointsSpatial)} à l'intérieur d'un polygone, ` +
      `${nf(s.pointsOutside)} hors polygone, ${nf(s.pointsWithoutCoord)} sans coordonnées.</p>`;
  }

  card(label, value, unit) {
    return `<div class="dashboard-card"><div class="value">${value}</div><div class="label">${label}</div>${unit ? `<div class="unit">${unit}</div>` : ''}</div>`;
  }
}
