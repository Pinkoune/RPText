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
    version: 'dungeons-v2',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '⚔️ Le Grand Rééquilibrage des Donjons',
        items: [
          'Le système de défense absurde des boss en multijoueur (où on ne faisait plus que 1 de dégât) a été complètement repensé !',
          'Désormais, jouer à plusieurs augmente drastiquement les PV du boss, mais très peu son armure. Vous ferez enfin de vrais dégâts !'
        ]
      },
      {
        title: '🛡️ Classes et Tactiques',
        items: [
          'Le **Guerrier** bénéficie maintenant d\'une vraie provocation qui force le boss à l\'attaquer pendant **2 tours complets**.',
          'Le **Soigneur** voit ses vagues de soin se baser sur son Attaque et ses PV Max : mieux il est équipé, plus il soignera !',
          'Le **Mage** lance maintenant de lourdes "Bombes Élémentaires" d\'un coup, tandis que l\'**Archer** tire des rafales de flèches rapides pour contrer les boss cuirassés.'
        ]
      },
      {
        title: '🔥 Mécaniques de Raid',
        items: [
          '**Attaques de Zone (AoE)** : Les boss frappent désormais tous les membres de l\'équipe tous les 4 tours. Préparez la provocation ou un soin de groupe !',
          '**Mode Enragé** : Ne traînez pas, si un donjon dure plus de 15 tours, le boss s\'enrage (+50% Dégâts).',
          '**Dernier Espoir** : S\'il reste moins de 2 minutes au chrono (20 minutes max), tout le groupe gagne +30% de dégâts pour conclure d\'urgence !',
          '**Système de Brèche** : Frapper un boss avec son élément de faiblesse à 3 reprises le "Brise", le forçant à passe son prochain tour.',
          '**Affixes** : Chaque boss généré en donjon recevra une mutation aléatoire : Vampirique (Vol de vie), Cuirassé, Agile, etc.',
          '**Réanimation** : Nouveau consommable légendaire "Plume de Phénix", permettant à un joueur vivant de réanimer un allié mort en combat.'
        ]
      }
    ]
  },
  {
    version: 'combat-craft-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '⚔️ Les duels deviennent de vrais combats',
        items: [
          'Fini le pile ou face : le duel PvP est désormais un combat basé sur tes stats (ATK / DEF / PV). Le plus fort est favorisé, mais l\'outsider garde une vraie chance.',
          'Un journal de combat s\'affiche à l\'issue du duel.',
        ],
      },
      {
        title: '🏅 Récompenses de saison PvP',
        items: [
          'À la fin de chaque saison (chaque mois), tu reçois une récompense selon ton rang atteint : or, Fate Coins, gemmes, matrices d\'amélioration et clés de donjon.',
          'Plus ton rang est élevé (jusqu\'à Maître), meilleure est la récompense. Le détail est visible dans la carte Saison (« saison »).',
        ],
      },
      {
        title: '🔨 Forge rééquilibrée',
        items: [
          'Les premiers niveaux d\'artisanat montent bien plus vite (courbe adoucie + XP de base par craft).',
          '6 nouvelles armes intermédiaires comblent le vide entre le niveau 3 et 12 : Lame de bronze, Arc de chêne, Baguette d\'acolyte, Épée de soldat, Arc de rôdeur, Bâton d\'adepte.',
          'Les objets les plus puissants exigent désormais un niveau d\'artisanat plus élevé.',
        ],
      },
      {
        title: '🐲 Boss & Donjons',
        items: [
          'Boss mondial : le butin se réclame maintenant via un bouton (pour les participants) au lieu d\'être automatique.',
          'Donjons : les gains d\'or et d\'XP sont désormais affichés (aperçu et récap de victoire).',
          'Donjons en groupe : le bonus de récompenses à plusieurs a été réduit (et la clé de donjon peut toujours tout doubler).',
        ],
      },
    ],
  },
  {
    version: 'pvp-guild-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🏅 Saisons PvP',
        items: [
          'Nouveau système de saison mensuelle : gagne des points de rang en PvP (duel gagné +25, Card-Jitsu gagné +20).',
          '6 rangs à gravir : Bronze, Argent, Or, Platine, Diamant et Maître.',
          'Un ladder classe les meilleurs joueurs de la saison. Tout se réinitialise chaque mois — à toi de viser le sommet !',
          'Commande : « saison » (ou « ladder », « rang »).',
        ],
      },
      {
        title: '⚔️ Boss de guilde',
        items: [
          'Chaque semaine, un boss coopératif apparaît pour ta guilde. Tous les membres l\'attaquent ensemble (une attaque toutes les 30 min).',
          'À sa défaite, chaque participant peut réclamer une récompense (or, Fate Coins, gemme) et la guilde gagne de l\'XP.',
          'Un nouveau boss, plus coriace selon la taille et le niveau de la guilde, revient chaque semaine.',
        ],
      },
      {
        title: '🐾 Familiers plus vivants',
        items: [
          'Ton familier équipé a maintenant une capacité de combat qui se déclenche parfois : les familiers d\'attaque frappent, ceux de défense te protègent, ceux de vie te soignent.',
          'La puissance et la fréquence augmentent avec le niveau et la rareté du familier.',
          'Retrouve le détail de la capacité sur la carte Familiers.',
        ],
      },
    ],
  },
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
