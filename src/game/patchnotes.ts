// Historique des nouveautés. La dernière entrée (index 0) est annoncée une
// fois à l'ouverture du jeu (voir PatchNotesModal). Tout l'historique reste
// consultable via la commande « news ». Ajoute une nouvelle entrée en tête à
// chaque vague de modifs ; l'utilisateur indique quand marquer une version
// comme "vue" pour tous (au push).

export interface PatchSection {
  title: string;
  items: string[];
}

export interface PatchRelease {
  version: string;
  date: string;
  sections: PatchSection[];
}

/** Historique complet, plus récent en premier. */
export const PATCH_HISTORY: PatchRelease[] = [
  {
    version: 'balance-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '⚖️ Grand Équilibrage',
        items: [
          'La Poudre Magique est désormais craftable dès le niveau 4 avec des matériaux de début de jeu (gel de slime, poussière du vide).',
          'La régénération du Soigneur n\'est plus aléatoire : elle se déclenche à chaque tour d\'attaque et s\'adapte à son niveau.',
          'L\'efficacité de la défense (DEF) de l\'équipement a été largement augmentée (mitige 80% des dégâts ennemis contre 60% avant).',
          'La difficulté des Monstres Furieux (Aventure) et des Donjons a été globalement réduite d\'environ 25%.',
          'Le choix de la classe est désormais définitif : impossible de changer de classe en cours de route. Assume ta destinée !'
        ],
      },
      {
        title: '✨ Nouveaux Équipements',
        items: [
          'De nouveaux petits objets ont été ajoutés pour faciliter la montée de niveau des artisans débutants (Bouclier en bois, Couronne de fleurs).',
          'L\'arsenal magique s\'agrandit ! 3 nouvelles armes ont été ajoutées à la Forge pour les Mages et Soigneurs : Grimoire des Ombres (Nv 12), Bâton de l\'Arbre-Monde (Nv 20) et l\'Orbe Stellaire (Nv 24).'
        ]
      }
    ],
  }
];

/** Dernière version publiée — comparée au flag local pour l'affiche de première ouverture. */
export const PATCH_VERSION = PATCH_HISTORY[0].version;

/** Sections de la dernière version (annoncées une fois à l'ouverture). */
export const PATCH_NOTES = PATCH_HISTORY[0].sections;
