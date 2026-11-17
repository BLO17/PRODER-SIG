// scenarios.js — Définition des 11 scénarios d'animation
export const SCENARIOS = [
  {
    id: 'S1', title: 'Amandier : du champ au PFC', volet: 1,
    description: 'Parcours complet de la filière amandier : plantations → périmètres → marchés → PFC',
    composantes: ['C1', 'C7'], filtre: { '_filiere': 'Plantation Amandier' },
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.15 },
      { action: 'showLayer', layer: 'plantations-circle', filter: { '_filiere': 'Plantation Amandier' } },
      { action: 'staggeredAppear', layer: 'plantations-circle', delay: 30, duration: 2500 },
      { action: 'extrude', layer: 'plantations-extrusion', heightField: '_sup', factor: 3, duration: 2000 },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'plantations', to: 'pfc', color: '#E65100', duration: 2500 },
      { action: 'showPopup', contentFrom: 'amandier' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S2', title: 'Figuier : du champ au PFC', volet: 1,
    description: 'Parcours complet de la filière figuier : plantations → périmètres → marchés → PFC',
    composantes: ['C1', 'C7'], filtre: { '_filiere': 'Plantation Figuier' },
    etapes: [
      { action: 'flyTo', target: 'TAINASTE', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.15 },
      { action: 'showLayer', layer: 'plantations-circle', filter: { '_filiere': 'Plantation Figuier' } },
      { action: 'staggeredAppear', layer: 'plantations-circle', delay: 30, duration: 2500 },
      { action: 'extrude', layer: 'plantations-extrusion', heightField: '_sup', factor: 3, duration: 2000 },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'plantations', to: 'pfc', color: '#2E7D32', duration: 2500 },
      { action: 'showPopup', contentFrom: 'figuier' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S3', title: 'Caroubier : du champ au PFC', volet: 1,
    description: 'Parcours complet de la filière caroubier : plantations → périmètres → marchés → PFC',
    composantes: ['C1', 'C7'], filtre: { '_filiere': 'Plantation Caroubier' },
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.15 },
      { action: 'showLayer', layer: 'plantations-circle', filter: { '_filiere': 'Plantation Caroubier' } },
      { action: 'staggeredAppear', layer: 'plantations-circle', delay: 30, duration: 2500 },
      { action: 'extrude', layer: 'plantations-extrusion', heightField: '_sup', factor: 3, duration: 2000 },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'plantations', to: 'pfc', color: '#795548', duration: 2500 },
      { action: 'showPopup', contentFrom: 'caroubier' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S4', title: 'Olivier : du champ au PFC', volet: 1,
    description: 'Parcours complet de la filière olivier : plantations → périmètres → marchés → PFC',
    composantes: ['C1', 'C7'], filtre: { '_filiere': 'Plantation Olivier' },
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.15 },
      { action: 'showLayer', layer: 'plantations-circle', filter: { '_filiere': 'Plantation Olivier' } },
      { action: 'staggeredAppear', layer: 'plantations-circle', delay: 30, duration: 2500 },
      { action: 'extrude', layer: 'plantations-extrusion', heightField: '_sup', factor: 3, duration: 2000 },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'plantations', to: 'pfc', color: '#1565C0', duration: 2500 },
      { action: 'showPopup', contentFrom: 'olivier' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S5', title: 'Miel : MER → UV → PFC', volet: 1,
    description: 'Circuit complet de la filière apicole : rassemblements locaux → valorisation → commercialisation',
    composantes: ['C8', 'C6', 'C7'],
    etapes: [
      { action: 'flyTo', target: 'AJDIR', pitch: 50, zoom: 11, duration: 2000 },
      { action: 'showLayer', layer: 'mer-circle', filter: { '_merType': 'AGR' } },
      { action: 'staggeredAppear', layer: 'mer-circle', delay: 100, duration: 1500 },
      { action: 'showLayer', layer: 'uv-circle' },
      { action: 'drawFlux', from: 'mer', to: 'uv', color: '#C2185B', duration: 2000 },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'uv', to: 'pfc', color: '#9C27B0', duration: 2000 },
      { action: 'showPopup', contentFrom: 'miel' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S6', title: 'CES : ravins → seuils → sous-bassins', volet: 2,
    description: 'Travaux de conservation des eaux et des sols : protection des sous-bassins',
    composantes: ['C2', 'C3', 'C4'],
    etapes: [
      { action: 'flyTo', target: 'TAINASTE', pitch: 50, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'sous-bassins-fill' },
      { action: 'showLayer', layer: 'sous-bassins-outline' },
      { action: 'extrude', layer: 'sous-bassins-extrusion', heightField: '_surfaceHa', factor: 0.3, duration: 2000 },
      { action: 'showLayer', layer: 'ravins-circle' },
      { action: 'staggeredAppear', layer: 'ravins-circle', delay: 20, duration: 2000 },
      { action: 'showLayer', layer: 'seuils-line' },
      { action: 'drawProgressive', layer: 'seuils-line', duration: 4000 },
      { action: 'showPopup', contentFrom: 'ces' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S7', title: 'MFR : formation diplomante → filières', volet: 1,
    description: 'Formation technique des jeunes ruraux liée aux unités de machinisme',
    composantes: ['C11', 'C8', 'C1'],
    etapes: [
      { action: 'flyTo', target: 'TAINASTE', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'mfr-circle' },
      { action: 'staggeredAppear', layer: 'mfr-circle', delay: 80, duration: 2000 },
      { action: 'showLayer', layer: 'mer-circle', filter: { '_merType': 'EM' } },
      { action: 'drawFlux', from: 'mfr', to: 'mer', color: '#558B2F', duration: 2000 },
      { action: 'showLayer', layer: 'plantations-circle' },
      { action: 'showPopup', contentFrom: 'mfr' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S8', title: 'Coopératives → PFC', volet: 1,
    description: 'Rassemblements coopératifs apicoles et leur lien avec les PFC',
    composantes: ['C9', 'C6', 'C7'],
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'cooperatives-circle' },
      { action: 'staggeredAppear', layer: 'cooperatives-circle', delay: 10, duration: 2000 },
      { action: 'showLayer', layer: 'uv-circle' },
      { action: 'showLayer', layer: 'pfc-circle' },
      { action: 'drawFlux', from: 'cooperatives', to: 'uv', color: '#0097A7', duration: 2000 },
      { action: 'drawFlux', from: 'uv', to: 'pfc', color: '#0288D1', duration: 2000 },
      { action: 'showPopup', contentFrom: 'coop' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S9', title: 'TAMKIN : alphabétisation → autonomie', volet: 2,
    description: 'Formation transversale et autonomisation des femmes rurales',
    composantes: ['C10'],
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 45, zoom: 10, duration: 2000 },
      { action: 'showLayer', layer: 'tamkin-circle' },
      { action: 'staggeredAppear', layer: 'tamkin-circle', delay: 20, duration: 2000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.2 },
      { action: 'showPopup', contentFrom: 'tamkin' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S10', title: 'Pistes : désenclavement', volet: 2,
    description: 'Infrastructure d\'accès et désenclavement des communes rurales',
    composantes: ['C5'],
    etapes: [
      { action: 'flyTo', target: 'AKNOUL', pitch: 30, zoom: 9, duration: 2000 },
      { action: 'showLayer', layer: 'pistes-line' },
      { action: 'drawProgressive', layer: 'pistes-line', duration: 4000 },
      { action: 'showLayer', layer: 'communes-fill', opacity: 0.15 },
      { action: 'showPopup', contentFrom: 'pistes' },
      { action: 'wait', duration: 3000 },
      { action: 'reset' }
    ]
  },
  {
    id: 'S11', title: 'Impact environnemental global', volet: 2,
    description: 'Synthèse de l\'impact environnemental : séquestration, protection des sols, couverture végétale',
    composantes: ['C1', 'C2', 'C3', 'C4'],
    etapes: [
      { action: 'flyTo', target: 'TAINASTE', pitch: 50, zoom: 9, duration: 2000 },
      { action: 'showLayer', layer: 'sous-bassins-fill' },
      { action: 'extrude', layer: 'sous-bassins-extrusion', heightField: '_surfaceHa', factor: 0.3, duration: 2000 },
      { action: 'showLayer', layer: 'plantations-circle' },
      { action: 'staggeredAppear', layer: 'plantations-circle', delay: 20, duration: 2000 },
      { action: 'showLayer', layer: 'ravins-circle' },
      { action: 'showLayer', layer: 'seuils-line' },
      { action: 'drawProgressive', layer: 'seuils-line', duration: 3000 },
      { action: 'showPopup', contentFrom: 'environnement' },
      { action: 'wait', duration: 4000 },
      { action: 'reset' }
    ]
  }
];

export function getScenario(id) {
  return SCENARIOS.find(s => s.id === id);
}

export function getScenariosByVolet(volet) {
  return SCENARIOS.filter(s => s.volet === volet);
}
