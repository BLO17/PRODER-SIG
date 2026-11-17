// story-chapters.js — Definition des Story Maps en "cues"
//
// Un chapitre = une suite de cues. Chaque cue associe une phrase prononcee
// et l'action visuelle correspondante. La phrase et l'action demarrent en
// meme temps : ce que la voix dit, la carte le montre.
//
// Aucun chiffre n'est code en dur : les indicateurs sont references par
// une cle de resolution (voir story-metrics.js) et recalcules a l'execution.

export const STORY_PLANTATIONS = {
  id: 'plantations',
  title: 'Filière Plantations — Du champ au marché',
  subtitle: 'Amandier, Figuier, Caroubier, Olivier',
  chapters: [
    // ---------------------------------------------------------------- 1
    {
      id: 1,
      title: 'Le territoire — 4 filières, un même espace',
      message: "Quatre filieres arboricoles se despleguent dans le cercle d'Aknoul : 4 462 parcelles, 11 458 ha brutes, 15 communes.",
      layers: ['communes-fill', 'communes-outline', 'plantations-circle'],
      indicators: [
        { key: 'plantation.parcelles' },
        { key: 'plantation.surfaceHa' },
        { key: 'cat.filieres' },
        { key: 'cat.communes' }
      ],
      cues: [
        {
          text: "Le PRODER Taza intervient dans le cercle d'Aknoul, une zone de montagne du pré-Rif.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-4.05, 34.62], zoom: 8.4, pitch: 0, bearing: 0, duration: 1600 },
              { center: [-3.88, 34.64], zoom: 10, pitch: 42, bearing: 0, duration: 1500 }
            ]
          }
        },
        {
          text: "Quatre filières arboricoles y sont développées : l'amandier, le figuier, le caroubier et l'olivier.",
          action: { type: 'show', layer: 'plantations-circle' }
        },
        {
          text: "L'amandier domine, avec plus de 3 300 parcelles.",
          action: { type: 'staggered', layer: 'plantations-circle', delay: 12, duration: 1800 }
        },
        {
          text: "Les commune du cercle d'Aknoul concentrent l'essentiel des plantations.",
          action: {
            type: 'popup',
            source: 'plantation',
            filiere: 'Plantation Amandier',
            rows: [
              { label: 'Parcelles amandier', metric: 'filiere.amandier.parcelles' },
              { label: 'Filière dominante', value: 'Amandier' }
            ]
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 2
    {
      id: 2,
      title: 'Les plantations — année par année',
      message: "Le projet s'ouvre en 2021 sur l'amandier, s'etend au figuier en 2022, puis au caroubier en 2024-2025.",
      layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'plantations-extrusion'],
      indicators: [
        { key: 'plantation.anneeMin' },
        { key: 'plantation.anneeMax' },
        { key: 'plantation.entites' },
        { key: 'plantation.surfaceBruteHa' }
      ],
      cues: [
        {
          text: "Les plantations se sont déployées de 2021 à 2025.",
          action: {
            type: 'camera',
            target: { center: [-3.88, 34.64], zoom: 10, pitch: 50, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "En 2021, l'amandier démarre : c'est l'année de lancement du projet.",
          action: { type: 'timeline', year: 2021 }
        },
        {
          text: "En 2022, le figuier complète l'amandier.",
          action: { type: 'timeline', year: 2022 }
        },
        {
          text: "En 2024 et 2025, c'est au tour du caroubier, la filière la plus récente.",
          action: { type: 'timeline', year: 2024 }
        },
        {
          text: "La hauteur des colonnes indique la surface plantée par bénéficiaire.",
          action: { type: 'extrude', layer: 'plantations-extrusion', heightField: '_sup', factor: 3, duration: 1600 }
        }
      ]
    },
    // ---------------------------------------------------------------- 3
    {
      id: 3,
      title: 'La protection des sols — CES et sous-bassins',
      message: "555 tronçons de seuils et 267 ravins traités retiennent 96 690 m³ de sédiments et protègent 109 751 ha de bassins versants.",
      layers: ['communes-fill', 'communes-outline', 'sous-bassins-fill', 'sous-bassins-outline', 'seuils-line', 'ravins-circle'],
      indicators: [
        { key: 'ces.seuils' },
        { key: 'ces.ravins' },
        { key: 'ces.volumeTotal' },
        { key: 'sb.totalSurface' }
      ],
      cues: [
        {
          text: "Les plantations sont protégées par des travaux de conservation des eaux et des sols.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-4.0, 34.6], zoom: 9, pitch: 0, bearing: 0, duration: 1400 },
              { center: [-4.15, 34.5], zoom: 10.5, pitch: 50, bearing: 0, duration: 1600 }
            ]
          }
        },
        {
          text: "Des tronçons de seuils en gabion ont été installés sur les ravins.",
          action: { type: 'drawProgressive', layer: 'seuils-line', duration: 3500 }
        },
        {
          text: "Chaque ravin traité est un point de protection du versant.",
          action: { type: 'staggered', layer: 'ravins-circle', delay: 14, duration: 1600 }
        },
        {
          text: "Ces ouvrages retiennent les sédiments et limitent l'érosion.",
          action: {
            type: 'popup',
            source: 'seuil',
            maxLongueur: 600,
            rows: [
              { label: 'Volume traité (ensemble)', metric: 'ces.volumeTotal' },
              { label: 'Longueur traitée', metric: 'ces.longueurKm' }
            ]
          }
        },
        {
          text: "Six sous-bassins versants, couvrant plus de 100 000 hectares, sont ainsi protégés.",
          action: { type: 'extrude', layer: 'sous-bassins-extrusion', heightField: '_surfaceHa', factor: 0.5, duration: 1800 }
        }
      ]
    },
    // ---------------------------------------------------------------- 4
    {
      id: 4,
      title: "L'accès — Les pistes sous marché",
      message: "71,9 km de pistes sous marché (les études exclues) assurent l'accessibilité des périmètres et des sites de production.",
      layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'pistes-line'],
      indicators: [
        { key: 'pistes.kmHorsEtude' },
        { key: 'pistes.count' },
        { key: 'pistes.nbEtude' },
        { key: 'pistes.totalKm' }
      ],
      cues: [
        {
          text: "L'accès aux champs et aux marchés est assuré par les pistes sous marché.",
          action: {
            type: 'camera',
            target: { center: [-3.95, 34.62], zoom: 9, pitch: 28, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "Onze de ces pistes sont réparties entre 2022 et 2026.",
          action: { type: 'drawProgressive', layer: 'pistes-line', duration: 3500 }
        },
        {
          text: "Le linéaire total retenu atteint près de 72 kilomètres.",
          action: {
            type: 'popup',
            layer: 'pistes-line',
            maxLongueur: 8,
            rows: [
              { label: 'Linéaire sous marché', metric: 'pistes.kmHorsEtude' },
              { label: 'Pistes en étude (exclues)', metric: 'pistes.nbEtude' }
            ]
          }
        },
        {
          text: "Les pistes en étude ne sont pas comptabilisées : seuls les marchés de travaux sont retenus.",
          action: { type: 'metric', indicators: [{ key: 'pistes.kmHorsEtude' }, { key: 'pistes.nbEtude' }], emphasize: true }
        }
      ]
    },
    // ---------------------------------------------------------------- 5
    {
      id: 5,
      title: "L'accompagnement — MER et MFR",
      message: "16 MER arboriculture (204 adhérents) et 18 stagiaires MFR (9 mois) organisent l'appui technique et la formation.",
      layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'mer-circle', 'mfr-circle'],
      filters: { 'mer-circle': { '_merType': 'EM' } },
      indicators: [
        { key: 'mer.em.unites' },
        { key: 'mer.em.adherents' },
        { key: 'mfr.arbo.stagiaires' },
        { key: 'mfr.duree' }
      ],
      cues: [
        {
          text: "Les producteurs sont accompagnés par des rassemblements locaux de production.",
          action: {
            type: 'camera',
            target: { center: [-3.9, 34.6], zoom: 10, pitch: 45, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "Seize de ces unités sont dédiées à l'arboriculture.",
          action: { type: 'staggered', layer: 'mer-circle', delay: 40, duration: 1400 }
        },
        {
          text: "Elles apportent l'appui technique et le machinisme aux planteurs.",
          action: {
            type: 'popup',
            source: 'mer',
            merType: 'EM',
            rows: [
              { label: 'Unités MER arboriculture', metric: 'mer.em.unites' },
              { label: 'Adhérents', metric: 'mer.em.adherents' }
            ]
          }
        },
        {
          text: "Les jeunes ruraux sont formés en Maison Familiale Rurale.",
          action: { type: 'staggered', layer: 'mfr-circle', delay: 60, duration: 1200 }
        },
        {
          text: "Dix-huit stagiaires suivent une formation de neuf mois en arboriculture.",
          action: {
            type: 'popup',
            source: 'mfr',
            formation: 'ARBORICULTURE',
            rows: [
              { label: 'Spécialité', value: 'Arboriculture' },
              { label: 'Durée', value: '9 mois' }
            ]
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 6
    {
      id: 6,
      title: 'La commercialisation — Les plates-formes',
      message: "À MSILA, la valorisation et la vente ne sont séparées que de 40 mètres : la chaîne de valeur est continue.",
      layers: ['communes-fill', 'communes-outline', 'plantations-circle', 'pfc-circle'],
      indicators: [
        { key: 'pfc.uv.total' },
        { key: 'plantation.beneficiaires' },
        { key: 'per.marches' },
        { key: 'per.count' }
      ],
      cues: [
        {
          text: "Les produits des quatre filières convergent vers les plates-formes de commercialisation.",
          action: {
            type: 'camera',
            target: { center: [-3.95, 34.58], zoom: 10, pitch: 45, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "PFC-AKNOUL se situe au cœur du cercle d'Aknoul.",
          action: {
            type: 'popup',
            name: 'PFC-AKNOUL',
            rows: [
              { label: 'Fonction', value: 'Regroupement, exposition, vente' },
              { label: 'Filières concernées', value: 'Les 4 filières arboricoles' }
            ]
          }
        },
        {
          text: "PFC-MSILA, à l'est, complète le dispositif.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-3.861733, 34.64423], zoom: 11.5, pitch: 50, bearing: 0, duration: 1400 },
              { center: [-4.175107, 34.426999], zoom: 11.5, pitch: 50, bearing: 0, duration: 1800 }
            ]
          }
        },
        {
          text: "Chaque station de conditionnement est un point de consolidation pour toutes les filières.",
          action: { type: 'popup', name: 'PFC-MSILA', rows: [{ label: 'Fonction', value: 'Plateforme de commercialisation' }] }
        }
      ]
    },
    // ---------------------------------------------------------------- 7
    {
      id: 7,
      title: 'La complémentarité — un système, pas une somme d\'actions',
      message: "Chaque maillon pris seul reste fragile : c'est leur enchaînement qui produit l'effet. La chaîne interactive permet de le vérifier maillon par maillon, puis de mesurer la couverture réelle sur le terrain.",
      chainMode: 'both',
      interactive: true,
      hint: "Cliquez un maillon, comparez les deux filières, puis ouvrez « Diagnostic » pour mesurer la couverture croisée.",
      layers: [
        'communes-fill', 'communes-outline', 'plantations-circle', 'plantations-extrusion',
        'ravins-circle', 'seuils-line', 'sous-bassins-fill', 'sous-bassins-outline',
        'pistes-line', 'mer-circle', 'mfr-circle', 'pfc-circle', 'cooperatives-circle', 'uv-circle'
      ],
      filters: { 'mer-circle': { '_merType': 'EM' } },
      indicators: [
        { key: 'plantation.parcelles' },
        { key: 'ces.ravins' },
        { key: 'pistes.kmHorsEtude' },
        { key: 'pfc.uv.pfc' }
      ],
      cues: [
        {
          text: "Une plantation sans protection, sans piste, sans formation et sans marché reste une parcelle isolée.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-4.0, 34.6], zoom: 9, pitch: 20, bearing: 0, duration: 1400 },
              { center: [-3.9, 34.62], zoom: 10.2, pitch: 52, bearing: 0, duration: 1600 }
            ]
          }
        },
        {
          text: "Le seuil protège le versant, la piste désenclave la récolte, la formation rend le producteur autonome.",
          action: { type: 'show', layer: 'seuils-line' }
        },
        {
          text: "La plate-forme relie cette production au marché : chaque maillon rend le suivant possible.",
          action: { type: 'show', layer: 'pfc-circle' }
        },
        {
          text: "La même plate-forme et le même réseau de formation servent aussi la filière apicole.",
          action: {
            type: 'metric',
            indicators: [
              { key: 'pfc.uv.pfc' },
              { key: 'mfr.beneficiaires' },
              { key: 'tamkin.benef' },
              { key: 'coop.adherents' }
            ],
            emphasize: true
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 8
    {
      id: 8,
      title: 'Le bilan — Impact et résultats',
      message: "Production, protection des sols, accès, accompagnement et marché forment un système cohérent et mesurable.",
      layers: [
        'communes-fill', 'communes-outline', 'plantations-circle', 'plantations-extrusion',
        'ravins-circle', 'seuils-line', 'sous-bassins-fill', 'sous-bassins-outline',
        'pistes-line', 'mer-circle', 'mfr-circle', 'pfc-circle'
      ],
      filters: { 'mer-circle': { '_merType': 'EM' } },
      indicators: [
        { key: 'carbon.totalAnnual' },
        { key: 'veg.coverage' },
        { key: 'pistes.kmHorsEtude' },
        { key: 'plantation.tauxFeminisation' }
      ],
      cues: [
        {
          text: "Le circuit plantations génère un impact mesurable sur l'ensemble du territoire.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-3.9, 34.62], zoom: 10, pitch: 55, bearing: 0, duration: 1400 },
              { center: [-4.0, 34.6], zoom: 8.6, pitch: 25, bearing: 0, duration: 1600 }
            ]
          }
        },
        {
          text: "Les plantations séquestrent du carbone, estimé selon la méthode du GIEC.",
          action: { type: 'metric', indicators: [{ key: 'carbon.totalAnnual' }, { key: 'carbon.totalStock' }], emphasize: true }
        },
        {
          text: "Les travaux de conservation protègent plus de 100 000 hectares de bassins versants.",
          action: { type: 'metric', indicators: [{ key: 'sb.totalSurface' }, { key: 'veg.coverage' }], emphasize: true }
        },
        {
          text: "L'accès est sécurisé par 71,9 kilomètres de pistes sous marché.",
          action: { type: 'metric', indicators: [{ key: 'pistes.kmHorsEtude' }], emphasize: true }
        },
        {
          text: "Ces résultats se lisent ensemble : production, protection, accès et accompagnement forment un système cohérent.",
          action: { type: 'metric', indicators: [{ key: 'plantation.beneficiaires' }, { key: 'mer.em.unites' }, { key: 'mfr.arbo.stagiaires' }], emphasize: true }
        }
      ]
    }
  ]
};

export const STORY_APICULTURE = {
  id: 'apiculture',
  title: 'Filière Apicole — Du rucher au marché',
  subtitle: 'Miel, valorisation et commercialisation',
  chapters: [
    // ---------------------------------------------------------------- 1
    {
      id: 1,
      title: 'La production apicole — Ruches et coopératives',
      message: "1 147 adhérents de coopératives, 9 unions et un MER dédié : la base productive apicole est structurée.",
      layers: ['communes-fill', 'communes-outline', 'cooperatives-circle', 'mer-circle'],
      filters: { 'mer-circle': { '_merType': 'AGR' } },
      indicators: [
        { key: 'coop.adherents' },
        { key: 'coop.unions' },
        { key: 'mer.apicole.unites' },
        { key: 'mer.apicole.adherents' }
      ],
      cues: [
        {
          text: "La filière apicole du PRODER Taza mobilise plus de mille adhérents de coopératives.",
          action: {
            type: 'camera',
            target: { center: [-3.97, 34.72], zoom: 10.5, pitch: 42, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "Ils sont regroupés dans neuf unions de coopératives.",
          action: { type: 'staggered', layer: 'cooperatives-circle', delay: 8, duration: 2000 }
        },
        {
          text: "Un rassemblement local est spécifiquement dédié à la valorisation du miel.",
          action: { type: 'staggered', layer: 'mer-circle', delay: 60, duration: 1200 }
        },
        {
          text: "Ce MER compte dix adhérents, dont trois femmes et cinq jeunes.",
          action: {
            type: 'popup',
            source: 'mer',
            merType: 'AGR',
            rows: [
              { label: 'Spécialité', value: 'Valorisation de miel' },
              { label: 'Adhérents', metric: 'mer.apicole.adherents' },
              { label: 'Femmes', metric: 'mer.apicole.femmes' },
              { label: 'Jeunes', metric: 'mer.apicole.jeunes' }
            ]
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 2
    {
      id: 2,
      title: 'La valorisation — Les unités de miel',
      message: "UV-AJDIR et UV-MSILA organisent la transformation et le conditionnement du miel.",
      layers: ['communes-fill', 'communes-outline', 'cooperatives-circle', 'mer-circle', 'uv-circle'],
      filters: { 'mer-circle': { '_merType': 'AGR' } },
      indicators: [
        { key: 'pfc.uv.total' },
        { key: 'mer.apicole.adherents' },
        { key: 'mer.apicole.femmes' },
        { key: 'mer.apicole.jeunes' }
      ],
      cues: [
        {
          text: "Le miel produit par les apiculteurs est valorisé dans deux unités dédiées.",
          action: {
            type: 'camera',
            target: { center: [-3.97, 34.72], zoom: 11, pitch: 50, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "UV-AJDIR, dans le cercle d'Aknoul, transforme et conditionne le miel.",
          action: {
            type: 'popup',
            name: 'UV-AJDIR',
            rows: [
              { label: 'Fonction', value: 'Unité de valorisation du miel' },
              { label: 'Rattachement', value: 'Cercle d\'Aknoul' }
            ]
          }
        },
        {
          text: "UV-MSILA, à l'est, assure la seconde capacité de transformation.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-3.974984, 34.744607], zoom: 12, pitch: 50, bearing: 0, duration: 1300 },
              { center: [-4.175542, 34.427012], zoom: 12, pitch: 50, bearing: 0, duration: 1900 }
            ]
          }
        },
        {
          text: "Ces deux unités structurent la chaîne de valeur du miel, du rucher au conditionnement.",
          action: { type: 'metric', indicators: [{ key: 'pfc.uv.total' }, { key: 'mer.apicole.adherents' }], emphasize: true }
        }
      ]
    },
    // ---------------------------------------------------------------- 3
    {
      id: 3,
      title: 'La commercialisation — Les plates-formes',
      layers: ['communes-fill', 'communes-outline', 'uv-circle', 'pfc-circle'],
      indicators: [
        { key: 'pfc.uv.total' },
        { key: 'pfc.uv.pfc' },
        { key: 'coop.adherents' },
        { key: 'coop.unions' }
      ],
      cues: [
        {
          text: "Le miel valorisé converge vers les plates-formes de commercialisation.",
          action: {
            type: 'camera',
            target: { center: [-4.0, 34.58], zoom: 10, pitch: 45, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "À l'est, UV-MSILA et PFC-MSILA sont distants de seulement quarante mètres.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-4.175542, 34.427012], zoom: 14, pitch: 55, bearing: 0, duration: 1500 },
              { center: [-4.175107, 34.426999], zoom: 14, pitch: 55, bearing: 0, duration: 1500 }
            ]
          }
        },
        {
          text: "Cette proximité illustre l'articulation directe entre la transformation et la vente.",
          action: {
            type: 'popup',
            name: 'PFC-MSILA',
            rows: [
              { label: 'Distance UV-MSILA', value: '≈ 40 m' },
              { label: 'Fonction', value: 'Plateforme de commercialisation' }
            ]
          }
        },
        {
          text: "PFC-AKNOUL, dans le cercle d'Aknoul, complète le dispositif de commercialisation.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-4.175107, 34.426999], zoom: 11, pitch: 45, bearing: 0, duration: 1400 },
              { center: [-3.861733, 34.64423], zoom: 11, pitch: 45, bearing: 0, duration: 1800 }
            ]
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 4
    {
      id: 4,
      title: "L'accompagnement — MFR et TAMKIN",
      message: "18 stagiaires formés en apiculture et 3 082 bénéficiaires alphabétisés, dont 84 pour cent de femmes.",
      layers: ['communes-fill', 'communes-outline', 'mfr-circle', 'tamkin-circle'],
      filters: { 'mfr-circle': { '_formation': 'APICULTURE' } },
      indicators: [
        { key: 'mfr.api.stagiaires' },
        { key: 'tamkin.benef' },
        { key: 'tamkin.femmes' },
        { key: 'tamkin.centres' }
      ],
      cues: [
        {
          text: "Les jeunes apiculteurs sont formés en Maison Familiale Rurale.",
          action: {
            type: 'camera',
            target: { center: [-3.97, 34.74], zoom: 11, pitch: 45, bearing: 0, duration: 1400 }
          }
        },
        {
          text: "Dix-huit stagiaires suivent neuf mois de formation en apiculture.",
          action: { type: 'staggered', layer: 'mfr-circle', delay: 50, duration: 1200 }
        },
        {
          text: "Parallèlement, le programme TAMKIN alphabétise plus de trois mille bénéficiaires.",
          action: { type: 'staggered', layer: 'tamkin-circle', delay: 14, duration: 1800 }
        },
        {
          text: "Quatre sur cinq de ces bénéficiaires sont des femmes.",
          action: {
            type: 'metric',
            indicators: [{ key: 'tamkin.benef' }, { key: 'tamkin.femmes' }, { key: 'tamkin.centres' }],
            emphasize: true
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 5
    {
      id: 5,
      title: 'La complémentarité — du rucher au marché, et au-delà',
      message: "La filière apicole partage ses plates-formes et son réseau de formation avec l'arboriculture. La chaîne interactive montre ce tronc commun, puis le diagnostic mesure la proximité réelle des coopératives.",
      chainMode: 'both',
      interactive: true,
      hint: "Cliquez un maillon, comparez avec la filière plantation, puis ouvrez « Diagnostic ».",
      layers: [
        'communes-fill', 'communes-outline', 'cooperatives-circle', 'mer-circle',
        'uv-circle', 'pfc-circle', 'mfr-circle', 'tamkin-circle', 'plantations-circle'
      ],
      filters: {
        'mer-circle': { '_merType': 'AGR' },
        'mfr-circle': { '_formation': 'APICULTURE' }
      },
      indicators: [
        { key: 'coop.adherents' },
        { key: 'pfc.uv.uv' },
        { key: 'pfc.uv.pfc' },
        { key: 'tamkin.tauxFemmes' }
      ],
      cues: [
        {
          text: "Le miel ne vaut que s'il est transformé, conditionné et vendu : trois maillons, trois compétences.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-3.97, 34.72], zoom: 9.6, pitch: 25, bearing: 0, duration: 1400 },
              { center: [-4.0, 34.6], zoom: 9.2, pitch: 50, bearing: 0, duration: 1600 }
            ]
          }
        },
        {
          text: "Les unités de valorisation transforment la production des coopératives.",
          action: { type: 'show', layer: 'uv-circle' }
        },
        {
          text: "Les plates-formes de commercialisation ouvrent le marché — les mêmes que pour l'arboriculture.",
          action: { type: 'show', layer: 'pfc-circle' }
        },
        {
          text: "La formation et l'alphabétisation rendent cette chaîne tenable par les acteurs locaux.",
          action: {
            type: 'metric',
            indicators: [
              { key: 'mfr.api.stagiaires' },
              { key: 'tamkin.benef' },
              { key: 'tamkin.tauxFemmes' },
              { key: 'coop.unions' }
            ],
            emphasize: true
          }
        }
      ]
    },
    // ---------------------------------------------------------------- 6
    {
      id: 6,
      title: 'Le bilan — Chaîne de valeur du miel',
      message: "Des ruchers aux points de vente, chaque maillon de la filière apicole est identifié et documenté.",
      layers: ['communes-fill', 'communes-outline', 'cooperatives-circle', 'mer-circle', 'uv-circle', 'pfc-circle', 'mfr-circle', 'tamkin-circle'],
      filters: {
        'mer-circle': { '_merType': 'AGR' },
        'mfr-circle': { '_formation': 'APICULTURE' }
      },
      indicators: [
        { key: 'coop.adherents' },
        { key: 'coop.unions' },
        { key: 'pfc.uv.total' },
        { key: 'mfr.api.stagiaires' }
      ],
      cues: [
        {
          text: "La filière apicole relie les ruchers aux points de vente par une chaîne continue.",
          action: {
            type: 'cameraPath',
            path: [
              { center: [-3.97, 34.72], zoom: 10, pitch: 45, bearing: 0, duration: 1400 },
              { center: [-4.0, 34.58], zoom: 8.8, pitch: 25, bearing: 0, duration: 1600 }
            ]
          }
        },
        {
          text: "Plus de mille adhérents de coopératives, répartis en neuf unions, produisent le miel.",
          action: { type: 'metric', indicators: [{ key: 'coop.adherents' }, { key: 'coop.unions' }], emphasize: true }
        },
        {
          text: "Un rassemblement local et deux unités de valorisation organisent la transformation.",
          action: { type: 'metric', indicators: [{ key: 'mer.apicole.unites' }, { key: 'pfc.uv.total' }], emphasize: true }
        },
        {
          text: "Et deux plates-formes de commercialisation ouvrent l'accès au marché.",
          action: { type: 'metric', indicators: [{ key: 'pfc.uv.pfc' }, { key: 'mfr.api.stagiaires' }], emphasize: true }
        }
      ]
    }
  ]
};

export function getStoryMap(id) {
  if (id === 'plantations') return STORY_PLANTATIONS;
  if (id === 'apiculture') return STORY_APICULTURE;
  return null;
}

export function getAllStoryMaps() {
  return [STORY_PLANTATIONS, STORY_APICULTURE];
}
