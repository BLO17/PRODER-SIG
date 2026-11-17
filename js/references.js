// references.js — Références scientifiques et formules
export const REFERENCES = {
  IPCC2006: { id: 1, title: 'IPCC (2006) — Guidelines for National Greenhouse Gas Inventories, Vol. 4: AFOLU', url: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol4.html' },
  IPCC2019: { id: 2, title: 'IPCC (2019) — Refinement to the 2006 IPCC Guidelines', url: 'https://www.ipcc.ch/report/2019-refinement-to-the-2006-ipcc-guidelines-for-national-greenhouse-gas-inventories/' },
  FAO2017: { id: 3, title: 'FAO (2017) — Water for Sustainable Food and Agriculture', url: 'https://www.fao.org/3/i7959e/i7959e.pdf' },
  FAO2018: { id: 4, title: 'FAO (2018) — The Future of Food and Agriculture', url: 'https://www.fao.org/3/i8429en/i8429en.pdf' },
  FAO2020: { id: 5, title: 'FAO (2020) — The State of Food and Agriculture 2020', url: 'https://www.fao.org/3/cb1447en/cb1447en.pdf' },
  FAO2013: { id: 6, title: 'FAO (2013) — Climate-Smart Agriculture Sourcebook', url: 'https://www.fao.org/3/i3325e/i3325e.pdf' },
  IFAD2012: { id: 7, title: 'IFAD (2012) — Social, Environmental and Climate Assessment Procedures (SECAP)', url: 'https://www.ifad.org/en/web/knowledge/publication/asset/39286044' },
  IFAD2014: { id: 8, title: 'IFAD (2014) — Approach to Climate Change Adaptation and Mitigation', url: 'https://www.ifad.org/en/web/knowledge/publication/asset/39310928' },
  IFAD2019: { id: 9, title: 'IFAD (2019) — Rural Development Report 2019', url: 'https://www.ifad.org/en/rural-development-report' },
  RUSLE: { id: 10, title: 'Renard et al. (1997) — RUSLE (USDA Handbook 703)', url: 'https://www.ars.usda.gov/ARSUserFiles/64080530/RUSLE/AH_703.pdf' },
  WB2018: { id: 11, title: 'World Bank (2018) — Cost-Benefit Analysis in World Bank Projects', url: 'https://openknowledge.worldbank.org/handle/10986/29320' },
  WB2016: { id: 12, title: 'World Bank (2016) — Measuring Rural Access', url: 'https://www.worldbank.org/en/topic/transport/publication/measuring-rural-access' },
  Montagnini: { id: 13, title: 'Montagnini & Nair (2004) — Carbon Sequestration in Agroforestry Systems', url: 'https://doi.org/10.1023/B:AGFO.0000029005.92691.79' },
  Nair2009: { id: 14, title: 'Nair et al. (2009) — Agroforestry as Carbon Sequestration Strategy', url: 'https://doi.org/10.1002/jpln.200800030' },
  Albrecht: { id: 15, title: 'Albrecht & Kandji (2003) — Carbon Sequestration in Tropical Agroforestry', url: 'https://doi.org/10.1016/S0167-8809(03)00138-5' },
  Battle: { id: 16, title: 'Battle & Tous (1997) — Carob Tree (IPGRI)', url: 'https://www.bioversityinternational.org/e-library/publications/detail/carob-tree/' },
  UNWomen: { id: 17, title: 'UN Women (2018) — Turning Promises into Action', url: 'https://www.unwomen.org/en/digital-library/publications/2018/2/gender-equality-in-the-2030-agenda-for-sustainable-development-2018' },
  MAPMDREF: { id: 18, title: 'MAPMDREF (2020) — Statistiques Agricoles Régionales, Province de Taza', url: 'https://www.agriculture.gov.ma/' },
  FAOSTAT: { id: 19, title: 'FAOSTAT (2020) — Crop Production Statistics: Morocco', url: 'https://www.fao.org/faostat/en/#data/QCL' }
};

export const FORMULAS = {
  carbon: {
    name: 'Séquestration carbone (IPCC Tier 1)',
    formula: 'C_annuel = A × R_e × (1 - R) × CF',
    description: 'A = surface plantée (ha), R_e = taux de croissance annuel (t MS/ha/an), R = fraction perdue (0,1-0,3), CF = fraction carbone (0,47-0,50)',
    ref: 'IPCC2006',
    confidence: 2
  },
  carbonAge: {
    name: 'Facteur d\'âge (IPCC)',
    formula: 'C_âge = C_mature × (1 - e^(-k × t))',
    description: 't = âge de la plantation (ans), k = constante de croissance (0,1-0,3)',
    ref: 'IPCC2006',
    confidence: 2
  },
  production: {
    name: 'Production estimée (FAO)',
    formula: 'P = A × Y × (1 - L)',
    description: 'A = surface (ha), Y = rendement (t/ha/an), L = perte post-récolte (0,05-0,15)',
    ref: 'FAO2020',
    confidence: 2
  },
  productionAge: {
    name: 'Facteur d\'âge (production)',
    formula: 'Y_âge = Y_mature × (1 - e^(-k × (t - t0)))',
    description: 't0 = âge de mise en production, k = constante de croissance (0,2-0,4)',
    ref: 'FAO2020',
    confidence: 2
  },
  gvp: {
    name: 'Valeur brute de production (GVP)',
    formula: 'GVP = P × p',
    description: 'P = production (t/an), p = prix unitaire (DH/t)',
    ref: 'WB2018',
    confidence: 2
  },
  van: {
    name: 'Valeur ajoutée nette (VAN)',
    formula: 'VAN = GVP - C_i - C_m',
    description: 'C_i = coûts intermédiaires, C_m = coûts de maintenance',
    ref: 'WB2018',
    confidence: 2
  },
  rusle: {
    name: 'Érosion des sols (RUSLE)',
    formula: 'A = R × K × LS × C × P',
    description: 'R = érosivité pluie, K = érodabilité sol, LS = pente/longueur, C = couverture végétale, P = pratiques conservation',
    ref: 'RUSLE',
    confidence: 2
  },
  waterRetention: {
    name: 'Lame d\'eau retenue',
    formula: 'L = V_traité / A_sous_bassin',
    description: 'V = volume traité (m³), A = surface sous-bassin (ha) → convertir en m²',
    ref: 'FAO2017',
    confidence: 1
  },
  vegetation: {
    name: 'Couverture végétale',
    formula: 'CV = Surface_plantée / Surface_sous_bassin × 100',
    description: 'Surface plantée (ha) / surface sous-bassin (ha)',
    ref: 'FAO2017',
    confidence: 1
  },
  gender: {
    name: 'Taux de féminisation',
    formula: 'F% = F / (F + H) × 100',
    description: 'F = nombre de femmes, H = nombre d\'hommes',
    ref: 'IFAD2012',
    confidence: 1
  },
  youth: {
    name: 'Taux de jeunesse',
    formula: 'J% = J / (J + N) × 100',
    description: 'J = nombre de jeunes, N = nombre de non-jeunes',
    ref: 'IFAD2019',
    confidence: 1
  },
  connectivity: {
    name: 'Indice de désenclavement',
    formula: 'IC = (Σ L_piste × N_communes) / A_zone',
    description: 'L = longueur piste (km), N = communes desservies, A = surface zone (km²)',
    ref: 'WB2016',
    confidence: 1
  },
  productivity: {
    name: 'Productivité par hectare',
    formula: 'Prod_ha = P / A',
    description: 'P = production (t), A = surface (ha)',
    ref: 'FAO2020',
    confidence: 2
  },
  valuePerHa: {
    name: 'Valeur ajoutée par hectare',
    formula: 'VA_ha = VAN / A',
    description: 'VAN = valeur ajoutée nette (DH), A = surface (ha)',
    ref: 'WB2018',
    confidence: 2
  },
  irrigation: {
    name: 'Indice de structuration',
    formula: 'IS = (Coop + Unions + MER) / Communes × 100',
    description: 'Structures d\'organisation / nombre de communes',
    ref: 'IFAD2012',
    confidence: 1
  }
};

export const CONFIDENCE_LEVELS = {
  1: { label: 'Observé/Calculé', color: '#4CAF50', description: 'Donnée directe ou formule reproductible sur données vérifiées' },
  2: { label: 'Estimé (coefficients standard)', color: '#FF9800', description: 'Formule scientifique avec coefficients agronomiques standard' },
  3: { label: 'À renseigner', color: '#F44336', description: 'Données insuffisantes, collecte nécessaire' }
};
