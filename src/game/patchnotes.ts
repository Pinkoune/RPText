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
  }
];

/** Dernière version publiée — comparée au flag local pour l'affiche de première ouverture. */
export const PATCH_VERSION = PATCH_HISTORY[0].version;

/** Sections de la dernière version (annoncées une fois à l'ouverture). */
export const PATCH_NOTES = PATCH_HISTORY[0].sections;
