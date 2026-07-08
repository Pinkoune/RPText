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
    version: 'dungeon-resource-fix-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🐛 Correction : les compétences à ressource étaient castables en illimité en donjon',
        items: [
          'Depuis l\'ajout des ressources d\'archétype (Rage, Combo, Mana, Corruption, Ferveur, Tempo, Surcharge, Traque, Grâce, Sève), le donjon multijoueur n\'avait jamais été branché dessus : les compétences comme Enfer (Pyromancien) n\'étaient gatées QUE par le cooldown de base (~1 tour), donc castables à chaque tour sans aucune restriction de ressource.',
          'La jauge est maintenant suivie et affichée en donjon comme en chasse, avec les mêmes conditions de charge (encaisser des coups pour la Rage, toucher pour le Combo, régén passive pour le Mana, etc.) et de dépense.',
          'Corrigé au passage : les Épines du Druide (renvoi de dégâts) ne faisaient jamais rien en donjon, `thorns` n\'était jamais lu dans le calcul des dégâts encaissés.',
        ],
      },
    ],
  },
  {
    version: 'monk-stun-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '👊 Moine — Coup du Dragon frappe un point vital',
        items: [
          'Lancé à Combo PLEIN (5/5), Coup du Dragon étourdit le monstre en plus de ses dégâts croissants : il passe son tour suivant. Récompense enfin le fait de monter le combo au maximum plutôt que de le dépenser dès 3 points (le minimum requis).',
          'Nouvel effet « étourdissement » dans le moteur de combat (chasse). Le monstre ne peut ni attaquer ni esquiver pendant ce tour.',
        ],
      },
    ],
  },
  {
    version: 'resource-combo-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🔥 Une ressource propre à chaque sous-classe (fini le cooldown pour tous)',
        items: [
          'Berserker — Rage : se charge en encaissant des coups, Exécution coûte 50 Rage au lieu d\'un long cooldown.',
          'Chevalier Noir — Corruption : contrairement à la Rage, ne se charge QUE si tu INFLIGES des dégâts sous 30% PV (même seuil que le passif Douleur, les deux se nourrissent ensemble) — récompense l\'agressivité au bord de la mort, pas juste l\'encaissement. Drain Noir coûte 45 Corruption.',
          'Voleur & Moine — Combo : chaque coup porté charge 1 point (max 5), l\'ultime (Assassinat / Coup du Dragon) consomme tout le combo accumulé (min. 3 points) pour des dégâts qui grandissent avec.',
          'Prêtre de l\'Aube — Grâce : chaque soin lancé la charge (max 100), Nova sacrée consomme toute la Grâce (min. 30) pour un soin qui grandit avec — jusqu\'à un vrai heal massif si t\'as beaucoup soigné avant de la lâcher.',
          'Pyromancien & Cryomancien — Mana : se régénère passivement (+15/tour) quelle que soit l\'action, gestion par patience. L\'ultime (Enfer / Blizzard) coûte 40 Mana.',
          'Druide — Sève : les Épines chargent la Sève à chaque riposte (renvoi de dégâts), Colère consomme 40 Sève — récompense d\'encaisser des coups plutôt que de les éviter.',
          'Paladin — Ferveur : se charge uniquement quand SON PROPRE bouclier (Rempart) absorbe un coup, pas en encaissant n\'importe quel coup — récompense la protection active. Châtiment coûte 40 Ferveur.',
          'Barde — Tempo : se charge en ALTERNANT ses actions d\'un tour à l\'autre plutôt qu\'en répétant la même — récompense la variété, littéralement "garder le rythme". Crescendo coûte 60 Tempo.',
          'Arcaniste — Surcharge : se charge à chaque compétence lancée (n\'importe laquelle), contrairement au Mana qui régénère seul — récompense le rythme de sorts rapide. Distorsion coûte 50 Surcharge.',
          'Chasseur (nouveau) — Traque : se charge quand un tir CRIT, en vraie synergie avec Concentration/Mise à mort (jusqu\'à +24% crit cumulé) — plus tu investis dans le critique, plus vite revient Tir de précision (60 Traque).',
          'Guerrier, Archer, Soigneur et Mage (les 4 classes de base) gardent le cooldown classique.',
          'Correction : le gain de Rage était basé sur les dégâts bruts encaissés (qui explosent avec le niveau) et est maintenant plafonné par tour — évite qu\'elle reste bloquée au maximum en permanence dans les combats difficiles.',
        ],
      },
      {
        title: '💥 Combos élémentaires en donjon & abysses coop',
        items: [
          'Si deux joueurs DIFFÉRENTS posent Brûlure et Poison sur le même monstre, les deux se combinent en une explosion bonus (dégâts supplémentaires instantanés).',
          'Coordonnez vos compétences avec votre équipe pour déclencher le combo !',
        ],
      },
      {
        title: '🩸 Équilibrage des auras de prestige',
        items: [
          'Correction : l\'aura Sanguinaire (+5% ATK, -1% DEF) était strictement pire que l\'aura Ardent (+5% ATK sans malus) — aucune raison de jamais la choisir. Elle passe à +8% ATK, -3% DEF : un vrai choix offensif à haut risque plutôt qu\'une aura piège.',
        ],
      },
    ],
  },
  {
    version: 'classes-depth-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🎭 Des compétences plus fidèles à leur classe',
        items: [
          'Voleur — Assassinat vole désormais de l\'or instantanément à sa cible en plus de ses dégâts (légèrement réduits en contrepartie) : un vrai vol de butin en plein combat.',
          'Arcaniste — Distorsion manipule enfin le temps : elle réduit de 2 tours le cooldown de toutes tes autres compétences équipées.',
          'Barde — Crescendo galvanise le groupe (+15% ATK pour le reste du combat, toute l\'équipe en donjon/abysses coop) : le premier vrai buff de groupe actif du jeu.',
          'Guerrier — Fendoir brise désormais l\'armure de la cible (-20% DEF, 3 tours).',
          'Chasseur — Morsure affaiblit désormais la cible via ton familier (-25% ATK, 3 tours).',
          'Paladin — Rempart force maintenant l\'aggro du monstre sur toi en donjon, même s\'il ne fait pas de dégâts.',
        ],
      },
      {
        title: '🏰 Plus de profondeur en donjon',
        items: [
          'Les boss de fin de donjon peuvent désormais charger une attaque dévastatrice, télégraphiée un tour à l\'avance — soignez-vous ou posez un bouclier avant qu\'elle tombe !',
          'Cette charge peut être interrompue en encaissant un gros coup dessus pendant sa préparation (≥15% de ses PV max en un coup).',
          'Nouveaux affaiblissements de monstre en donjon : bris d\'armure (DEF réduite) et affaiblissement (ATK réduite), désormais visibles sur la fiche du monstre aux côtés de la brûlure/poison/gel.',
        ],
      },
    ],
  },
  {
    version: 'endless-enchant-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '✨ Système d\'Enchantement',
        items: [
          'Les Gemmes gagnent une vraie utilité ! Dépensez-les pour sertir des Runes sur votre équipement (commande « enchant »).',
          'Chaque pièce (arme, armure, bijou) possède jusqu\'à 2 emplacements de rune.',
          'Les runes offrent des bonus permanents en pourcentage (+5% ou +10%) en Attaque, Défense ou Points de Vie.',
        ],
      },
      {
        title: '🕳️ Abysses Infinis (Mode Endless)',
        items: [
          'Nouveau mode de jeu solo : descendez aussi profondément que possible dans la tour infinie (commande « endless »).',
          'La difficulté et les récompenses (Or, XP, Gemmes) augmentent à chaque étage. Boss tous les 5 étages.',
          'Vos Points de Vie ne se régénèrent pas entre les combats. Si vous mourez, le run se termine (sans perdre vos gains accumulés).',
          'Classement mondial intégré pour voir qui ira le plus profond !',
        ],
      },
    ],
  },
  {
    version: 'classes-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🌟 Refonte complète des Classes & Talents',
        items: [
          'Un tout nouveau système d\'arbre de talents (commande « talents ») pour chaque classe.',
          'Gagne 1 point de talent à chaque niveau. Investis-les pour débloquer des bonus passifs ou des capacités actives puissantes (SKILL).',
          'Nouveau système d\'Ascension : au niveau 20, utilise une Âme de Boss pour faire évoluer ta classe (ex: Guerrier devient Paladin ou Berserker) et accéder à un nouvel arbre de spécialisation massif.',
        ],
      },
      {
        title: '🛡️ Nouvelles compétences de combat',
        items: [
          'Chaque arbre propose des compétences uniques à équiper (jusqu\'à 4).',
          'Utilise-les pendant tes chasses, donjons ou combats de boss pour déclencher des effets puissants : soins, boucliers, attaques lourdes, esquive, etc.',
        ],
      },
      {
        title: '⚔️ Le Grand Rééquilibrage des Donjons',
        items: [
          'Les monstres en donjon ont reçu des ajustements de difficulté (pv, attaque et faiblesses) pour s\'adapter aux nouvelles compétences de classe.',
        ],
      },
    ],
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
