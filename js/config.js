// config.js — Constantes de l'application PRODER Taza 3D
export const CONFIG = {
  // Fond de carte (OpenFreeMap — gratuit, sans clé API)
  style: 'https://tiles.openfreemap.org/styles/liberty',
  // Fallback style
  fallbackStyle: 'https://demotiles.maplibre.org/style.json',
  // Terrain (AWS Terrarium — gratuit)
  terrain: {
    source: 'terrain-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 14
  },
  // Centre initial (province de Taza)
  center: [-4.0, 34.6],
  zoom: 9,
  pitch: 0,
  bearing: 0,
  // Jeu de données public (pseudonymisé — voir scripts/build-public-data.mjs).
  // Le fichier source nominatif ne doit jamais être publié.
  geojsonUrl: 'data/proder-public.geojson',
    // Calque plantation — source d'ORIGINE (SIG PRODER-COMPLEMENTARITE), chargée
  // et fusionnée à l'exécution.
  //
  // Ce fichier est la référence du calque plantation : la source Neatogeo
  // d'origine, complète (projet entier : plantation, ravins, seuils, pistes,
  // coopératives, bassins). Seules ses ENTITÉS PLANTATION sont projetées sur
  // la carte (C1 lignes de plantation, C14 polygones de périmètre) : le
  // chargeur catégorise chaque entité et n'en retient que celles-ci, sans
  // dupliquer le reste, déjà porté par le jeu public. Il remplace, à la
  // lecture, les entités plantation du jeu public : l'ancien découpage n'est
  // donc plus dessiné.
  //
  // Il est chargé ici, au même titre que le jeu public, parce qu'il est la
  // source de vérité du responsable du projet : aucun script intermédiaire n'a
  // à être lancé, et une mise à jour du fichier suffit à mettre la carte à jour.
  //
  // ATTENTION — ce fichier contient des données nominatives (CIN, PRENOM, NOM,
  // Age) : data-loader.js les retire à la lecture, avant tout affichage.
  plantationUrl: '_source/neatogeo_SIG-PRODER-COMPLEMENTARITE.geojson',
  // Millésime de référence des calculs (dernière année de plantation recensée)
  referenceYear: 2025,
  // Limites coordonnées valides (WGS84)
  validCoords: { lonMin: -6, lonMax: -3, latMin: 34, latMax: 35 },
  // Couleurs par filière (libellés normalisés)
  filiereColors: {
    'Plantation Amandier': '#E65100',
    'Plantation Figuier': '#2E7D32',
    'Plantation Caroubier': '#795548',
    'Plantation Olivier': '#1565C0'
  },
  // Variantes d'orthographe rencontrées dans la source
  filiereAliases: {
    'Plantation caroubier': 'Plantation Caroubier'
  },
  typeColors: {
    plantation: '#4CAF50',
    ravin: '#FF9800',
    seuil: '#F57C00',
    sousBassin: '#1A237E',
    bassin: '#0D47A1',
    perimetre: '#8D6E63',
    piste: '#FFD600',
    pisteTainaste: '#87CEEB',
    uv: '#9C27B0',
    pfc: '#0288D1',
    mer: '#C2185B',
    cooperative: '#0097A7',
    tamkin: '#795548',
    mfr: '#558B2F',
    commune: '#455A64'
  },
  influenceColors: {
    'Grande Influence': '#D32F2F',
    'Moyenne influence': '#FF9800',
    'faible influence': '#1976D2'
  },
  // Coefficients de simulation — VALEURS INDICATIVES À VALIDER avec les
  // services techniques avant toute communication de résultats.
  carbonCoeffs: {
    'Plantation Amandier': 2.35,
    'Plantation Figuier': 1.90,
    'Plantation Caroubier': 3.10,
    'Plantation Olivier': 2.60
  },
  yieldCoeffs: {
    'Plantation Amandier': 0.8,
    'Plantation Figuier': 3.0,
    'Plantation Caroubier': 1.5,
    'Plantation Olivier': 1.2
  },
  priceCoeffs: {
    'Plantation Amandier': 45000,
    'Plantation Figuier': 8000,
    'Plantation Caroubier': 6000,
    'Plantation Olivier': 12000
  },
  growthK: {
    'Plantation Amandier': 0.2,
    'Plantation Figuier': 0.25,
    'Plantation Caroubier': 0.15,
    'Plantation Olivier': 0.18
  },
  maturityAge: {
    'Plantation Amandier': 4.5,
    'Plantation Figuier': 3.5,
    'Plantation Caroubier': 7.0,
    'Plantation Olivier': 6.0
  }
};

export const CATEGORIES = {
  C1: { name: 'Points de plantation', color: '#4CAF50', icon: '📍' },
  C2: { name: 'Ravins CES', color: '#FF9800', icon: '🪨' },
  C3: { name: 'Tronçons de seuils CES', color: '#F57C00', icon: '🧱' },
  C4: { name: 'Sous-bassins versants', color: '#1A237E', icon: '💧' },
  C5: { name: 'Pistes sous marché', color: '#FFD600', icon: '🛣️' },
  C6: { name: 'UV (Miel)', color: '#9C27B0', icon: '🍯' },
  C7: { name: 'PFC', color: '#0288D1', icon: '🏪' },
  C8: { name: 'MER', color: '#C2185B', icon: '🤝' },
  C9: { name: 'Coopératives', color: '#0097A7', icon: '🐝' },
  C10: { name: 'TAMKIN (classes)', color: '#795548', icon: '📚' },
  C11: { name: 'MFR (bénéficiaires)', color: '#558B2F', icon: '🎓' },
  C12: { name: 'Communes', color: '#455A64', icon: '🗺️' },
  C13: { name: 'Références / autres', color: '#9E9E9E', icon: '📍' },
  C14: { name: 'Polygones de plantation', color: '#8D6E63', icon: '🟢' },
  C15: { name: 'Bassins versants', color: '#0D47A1', icon: '🌊' }
};

// Champs personnels qui ne doivent jamais être exposés dans l'interface publique.
export const PII_FIELDS = [
  'PRENOM', 'NOM', 'CIN', 'TLF', 'Tél', 'ADRESSE', 'SUPERVISEUR',
  'FORMATRICE/FORMATEUR', 'techniciein',
  'Année Naissance', 'Annés de naissance', 'ANNEE DE NAISSANCE',
  'ANNEES DE NAISSANCE', 'Année de naissance', 'Date de naissance'
];
