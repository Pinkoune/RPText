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
    version: 'chat-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '💬 Système de Chat Avancé',
        items: [
          'Nouveaux canaux de discussion : Global, Équipe, Guilde et Privé.',
          'Les messages privés et de guilde ont des couleurs de fond distinctes.',
          'Cliquez sur le nom d\'un joueur dans le chat pour lui envoyer un message privé (/w Nom).',
          'Notifications intégrées : recevez une petite alerte en jeu quand on vous parle sur un autre canal !',
        ],
      }
    ]
  },
  {
    version: 'qol-v1',
    date: '2026-07-02',
    sections: [
      {
        title: '⚙️ Améliorations',
        items: [
          'Ajout d\'un bouton pour quitter un donjon en cours (avec demande de confirmation).',
          'Si un donjon dure plus de 20 minutes, il est désormais considéré comme un échec automatique.',
          'Ajout d\'un onglet "Tout" dans la Forge pour voir l\'ensemble des recettes.',
          'L\'Inventaire bénéficie désormais des mêmes filtres que la Forge (Ressources, Consommables, Armures, Armes, Bijoux) pour s\'y retrouver plus facilement.',
        ],
      }
    ]
  },
  {
    version: 'events-v1',
    date: '2026-07-02',
    sections: [
      {
        title: '⚠️ IMPORTANT : Réinitialisation des talents',
        items: [
          '<span class="text-rose-400 font-bold">Avertissement : Les points de compétence de tous les joueurs ont été réinitialisés.</span>',
          'Suite à un bug où des joueurs avaient conservé des points excédentaires après la refonte de l\'arbre, tous les talents ont été remis à zéro.',
          'Vous avez reçu exactement le nombre de points correspondants à votre niveau (Niveau - 1). Répartissez-les judicieusement !',
        ],
      },
      {
        title: '🌍 Événements Dynamiques',
        items: [
          'Le monde est désormais soumis à des événements mondiaux (affectant tous les joueurs) et régionaux (selon le biome où vous vous trouvez).',
          'Ces événements tournent automatiquement toutes les 3 heures et appliquent des bonus (ex: +10% XP) ou des malus (ex: -8% PV).',
          'Rendez-vous sur la carte (commande `map`) pour voir les événements en cours !',
        ],
      }
    ]
  },
  {
    version: 'regions-v1',
    date: '2026-07-06',
    sections: [
      {
        title: '🗺️ Régions plus vivantes',
        items: [
          '7 nouvelles ressources exclusives à un seul biome : fil de soie (Sylvebois), fleur des plaines, éclat solaire (Dunes), pulpe de cactus, racine des tourbières et poisson des vases (Marais), lotus des glaces (Abysse Gelé).',
          'Mithril réservé aux Pics de Givre-Cime, cristal réservé à l\'Abysse Gelé — plus de doublon entre biomes.',
          'Nouvelle cueillette disponible dans l\'Abysse Gelé (auparavant minage uniquement).',
          '6 nouvelles recettes qui valorisent ces ressources : robe de soie, cuirasse solaire, croc venimeux, hydromel, eau de cactus, élixir du phénix (le plus gros soin du jeu).',
          'Voyager d\'un biome à l\'autre a maintenant un vrai intérêt : chaque région a un ingrédient qu\'on ne trouve qu\'elle.',
        ],
      },
      {
        title: '🔨 Forge réorganisée',
        items: [
          'Les recettes sont maintenant groupées par onglets : Ressources, Consommables, Armures, Armes, Bijoux.',
          'Plus facile de retrouver une recette dans la longue liste.',
        ],
      },
    ],
  },
  {
    version: 'familiars-v1',
    date: '2026-07-01',
    sections: [
      {
        title: '🐾 Familiers',
        items: [
          'Adopte un familier (commun/rare/épique en boutique de familiers, légendaire en butin rare de boss mondial).',
          'Équipe-le pour un petit bonus de stat (ATK, DEF ou PV) qui grandit avec ses victoires à tes côtés, jusqu\'au niveau 10.',
          'Bonus volontairement modeste : un compagnon, pas une arme secrète.',
          'Commande : « familiar » (ou « pet », « compagnon »).',
        ],
      },
      {
        title: '🌳 Arbre de talents refait',
        items: [
          '3 paliers par classe (9 talents + 1 capstone), déblocage progressif à 5 puis 10 points investis.',
          'Nouveaux effets : vol de vie, perce-armure, dégâts d\'exécution sur cible affaiblie, épines, multiplicateur de critique, et bonus permanents ATK/DEF/PV%.',
          'Coût pour tout maximiser une classe : 23 points (~niveau 24) — une vraie progression de fond.',
          'Tes points déjà investis sont conservés (rien n\'est perdu par le remaniement).',
        ],
      },
    ],
  },
];

/** Dernière version publiée — comparée au flag local pour l'affiche de première ouverture. */
export const PATCH_VERSION = PATCH_HISTORY[0].version;

/** Sections de la dernière version (annoncées une fois à l'ouverture). */
export const PATCH_NOTES = PATCH_HISTORY[0].sections;
