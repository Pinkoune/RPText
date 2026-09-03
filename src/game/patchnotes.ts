// Historique des nouveautés. La dernière entrée (index 0) est annoncée une
// fois à l'ouverture du jeu (voir PatchNotesModal). Tout l'historique reste
// consultable via la commande « news ». Ajoute une nouvelle entrée en tête à
// chaque vague de modifs ; l'utilisateur indique quand marquer une version
// comme "vue" pour tous (au push).

/** Nature d'une section, pour la pastille de couleur dans l'historique. */
export type PatchKind = 'new' | 'content' | 'balance' | 'fix';

export const PATCH_KIND_META: Record<PatchKind, { label: string; color: string }> = {
  new: { label: 'Nouveauté', color: '#5fd0a0' },
  content: { label: 'Contenu', color: '#8cb4ff' },
  balance: { label: 'Équilibrage', color: '#f0b543' },
  fix: { label: 'Correction', color: '#b088ff' },
};

export interface PatchSection {
  title: string;
  items: string[];
  /** Absent = pas de pastille (anciennes entrées). */
  kind?: PatchKind;
}

export interface PatchRelease {
  version: string;
  date: string;
  sections: PatchSection[];
}

/** Historique complet, plus récent en premier. */
export const PATCH_HISTORY: PatchRelease[] = [
  {
    version: 'refonte-saison-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '👥 Trois personnages par compte',
        kind: 'new',
        items: [
          'Tu peux désormais mener <b>jusqu\'à trois héros</b> en parallèle, chacun avec sa classe, son niveau et son équipement.',
          'Envie d\'essayer une autre voie ? On crée un personnage — on ne détruit plus celui qu\'on a monté. Le changement de classe disparaît, remplacé par ça.',
          'Un écran de sélection s\'affiche à la connexion, et on peut changer de personnage à tout moment depuis les <b>Paramètres</b>.',
        ],
      },
      {
        title: '🔮 Saisons et artefact',
        kind: 'new',
        items: [
          'Une <b>Relique de saison</b> accompagne désormais chaque personnage : une jauge unique qui monte sur <b>tout</b> ce que tu fais (chasse, donjon, récolte, forge) et qui, elle, ne s\'arrête jamais.',
          'Chaque niveau donne un point à dépenser dans une grille de 17 mods répartis en 5 colonnes — dont de vraies mécaniques : Propagation (brûlures et poisons +50%), Écho de Faille, Sursis (survivre à un coup fatal), Forge économe, Moisson.',
          'À chaque changement de saison, la Relique repart de zéro et les records sont archivés — mais <b>ton personnage n\'est jamais touché</b> : niveau, équipement et métiers restent acquis.',
        ],
      },
      {
        title: '⚔️ La chasse devient tactique',
        kind: 'new',
        items: [
          'Le monstre <b>annonce son intention</b> pour le tour suivant : coup lourd, garde, incantation ou attaque simple.',
          'Deux nouvelles réponses, aux rôles opposés : <b>Parer</b> n\'encaisse qu\'un quart des dégâts et <b>renvoie 70% de ce qui a été bloqué</b> — sans risque, et d\'autant plus payant contre un gros coup. <b>Interrompre</b> annule le coup annoncé et <b>étourdit</b> (la Faille s\'ouvre), mais si le monstre ne préparait rien tu te découvres et prends 50% de dégâts en plus.',
          'Frapper une garde ne fait que la moitié des dégâts.',
          'Les coups portés, parades et interruptions se voient enfin : nombres qui s\'envolent, secousse sur les gros coups, voile coloré selon l\'issue du tour.',
          'Nouvelle <b>série de chasse</b> : chaque kill consécutif sans mourir renforce l\'XP et l\'or (jusqu\'à +40%). Elle est entièrement perdue si tu tombes.',
        ],
      },
      {
        title: '🏕️ Le camp et le repos',
        kind: 'new',
        items: [
          'Dès le <b>niveau 5</b>, ton camp produit pendant ton absence (or, XP, ressource du biome), jusqu\'à 12h — de quoi récolter le midi et le soir.',
          'Nouvelle commande <b>rest</b> : repos complet gratuit hors combat, toutes les 10 minutes. Plus de blocage quand on n\'a ni potion ni or.',
          'Après une longue absence, un écran de retour résume ce qui t\'attend.',
        ],
      },
      {
        title: '🏰 Donjons à paliers',
        kind: 'content',
        items: [
          'Chaque donjon peut désormais être relancé à des <b>paliers de difficulté croissants</b> : monstres et récompenses montent ensemble. Tout le contenu existant devient rejouable sans fin.',
          'On ne peut tenter qu\'un palier au-dessus du meilleur réussi.',
        ],
      },
      {
        title: '⚖️ Le mur du niveau 40-50 est tombé',
        kind: 'balance',
        items: [
          'La tranche 40→50 représentait <b>81% de tout le grind</b>, et passer du 45 au 50 coûtait à lui seul 1,3 fois le trajet du niveau 1 au 45. La courbe a été adoucie : le trajet complet est divisé par deux.',
          'Les niveaux que ton XP déjà accumulée vaut sous la nouvelle courbe te sont rendus à la connexion, avec les points de talent correspondants.',
          'Vaincre le <b>Néant Originel ne remet plus rien à zéro</b> : tu gardes tout et gagnes un titre. La Renaissance devient un choix, à saisir quand tu veux depuis la carte Prestige.',
          'La série de connexion tolère désormais un jour manqué.',
        ],
      },
      {
        title: '🌀 La Faille de la semaine',
        kind: 'new',
        items: [
          'Un défi qui <b>change tous les lundis</b> : un biome et un monstre du jeu, revisités par un modificateur qui t\'oblige à changer quelque chose. Enragé (frappe deux fois plus fort mais tombe vite), Colossal, Carapacé (sans pénétration d\'armure tes coups s\'écrasent), Cœur de givre et Voile d\'ombre (change d\'arme ou souffre), Verre et lames.',
          '<b>Aucun cooldown</b> : réessaie autant que tu veux, la mort te coûte déjà ta série. Mais la prime — <b>2 ✧ Éclats de Relique</b> et de l\'or — ne tombe qu\'au premier passage de la semaine.',
          'Tape « rift » (ou « faille ») à partir du niveau 20. Une pastille apparaît en bas à droite tant que tu ne l\'as pas franchie, et disparaît une fois validée.',
        ],
      },
      {
        title: '🏅 Les saisons prennent enfin du poids',
        kind: 'new',
        items: [
          'Il y avait <b>deux systèmes de saison</b> qui ne se parlaient pas : le ladder PvP tournait au mois calendaire, l\'artefact tournait quand l\'admin le décidait. Il n\'y en a plus qu\'un — la Saison N fait autorité pour tout.',
          'Une rotation remet désormais à zéro <b>d\'un seul coup</b> : l\'artefact, les points de saison PvP et les <b>classements d\'Abysses</b> (solo et multi). Les records redeviennent contestables au lieu de traîner d\'une saison sur l\'autre.',
          '<b>Ton personnage n\'est jamais touché</b> : niveau, équipement, métiers, maîtrises et Relique traversent la rotation.',
          '<b>Passe de saison gratuite</b> — dix paliers, aucune piste payante. Elle se remplit sur ton niveau d\'artefact, donc sur tout ce que tu fais. Au menu : des Éclats de Relique, des <b>fonds de profil</b> à collectionner (Aube, Braise, Abysse, Primordial…) et des <b>titres saisonniers</b> nommés d\'après le thème — « Champion · Automne » ne se regagnera plus jamais.',
        ],
      },
      {
        title: '✦ La Relique — l\'objet qui traverse tout',
        kind: 'new',
        items: [
          'Un objet unique, lié à ton personnage, qui <b>survit à la renaissance ET au changement de saison</b>. C\'est la seule chose du jeu dans ce cas : quand tout repart à zéro, elle reste.',
          '<b>Étoiles 1 à 5</b> : +2% ATK/DEF/PV chacune. <b>Étoiles 6 à 10</b> : pas de statistiques, mais un <b>effet au choix parmi trois</b> à chaque palier — critique, pénétration, esquive, ronces, vol de vie, Sursis, Propagation… Deux Reliques ★10 ne jouent pas pareil.',
          'Elle change de nom, d\'icône et de couleur en montant : Éclat sans nom, Fragment éveillé, Relique ascendante, Relique souveraine, puis <b>Relique primordiale</b>.',
          'Elle se grave avec des <b>Éclats</b> : +3 par succès accompli, +1 par niveau d\'artefact <b>au-delà de la grille pleine</b> (ces niveaux ne servaient plus à rien), et des paliers de la passe de saison.',
          'Tape « relic » à partir du niveau 20.',
        ],
      },
      {
        title: '⚡ Cote de Puissance — le classement ne se fige plus',
        kind: 'new',
        items: [
          'Le classement triait sur le niveau. Le jour où plusieurs joueurs atteignent le Nv.50 (plafond dur), il se figeait et tout le monde se retrouvait ex æquo — au pire moment.',
          'Il classe désormais sur la <b>Puissance</b> : une seule note qui additionne niveau, prestige, niveau d\'artefact, étoiles de l\'équipement porté, paliers de maîtrise et meilleur étage d\'Abysses. En début de partie le niveau domine, donc rien ne change ; au plafond, ce sont les autres axes qui départagent.',
          'Une <b>renaissance ne te fait pas chuter au fond du tableau</b> : le prestige pèse autant que le trajet 1→50 qu\'il te fait recommencer.',
          'Le détail de ta Puissance est affiché dans ton <b>Profil</b> — chaque ligne est un levier sur lequel tu peux agir.',
        ],
      },
      {
        title: '✦ Prestige : on te dit enfin ce que ça rapporte',
        kind: 'balance',
        items: [
          'La carte Prestige affiche en permanence <b>tes bonus chiffrés</b> : +8% ATK/DEF/PV et +10% XP/Or par renaissance, et le nombre de jetons de classe qu\'il te reste. Avant, « bonus permanent » n\'était accompagné d\'aucun nombre — impossible de savoir ce qu\'on avait gagné.',
          'L\'écran de renaissance présente le marché terme à terme : ce que tu perds, ce que tu gagnes (avec les valeurs avant / après), et surtout <b>ce qui est conservé</b> — familiers, titres, succès, artefact de saison et maîtrises de biome.',
          '<b>Correction</b> : renaître en tant que sous-classe te laissait « Berserker niveau 1 », un état impossible, et tu redevenais Guerrier au chargement suivant sans explication. La renaissance ramène désormais franchement à ta classe de base, à ré-ascensionner au Nv.20.',
          '<b>Le Néant</b> tient compte de la moitié de ton prestige. Il ignorait complètement ces bonus : à prestige 5 le mur de fin de partie n\'en était plus un. Chaque renaissance reste ressentie, mais le combat reste un combat.',
          '<b>Correction</b> : le garde-fou anti-triche ramenait au niveau 30 (l\'ancien maximum) au lieu du niveau que l\'XP légitime valait vraiment.',
          '<b>Correction</b> : après une renaissance, les cartes <b>Aura</b> (Nv.30) et <b>Relique</b> (Nv.20) redevenaient inaccessibles jusqu\'à ce que tu aies remonté ces niveaux — alors que tu gardes justement ton prestige, ton aura et ta Relique. Elles restent ouvertes tant que tu possèdes ce qu\'elles servent à gérer.',
        ],
      },
      {
        title: '✨ Interface',
        kind: 'new',
        items: [
          'La carte <b>Équipement</b> est entièrement refaite : ta fiche et tes stats en tête, tes cinq emplacements visibles d\'un seul coup d\'œil, et le détail de celui que tu choisis juste en dessous — avec la comparaison des stats avant d\'équiper.',
          'L\'<b>arbre de talents</b> est réorganisé en onglets (arbre, compétences, ascension) : l\'arbre entier tient désormais à l\'écran, trace ses liens de prérequis et affiche le gain réel du prochain point dans un panneau fixe.',
          'Un bouton <b>🔔 Notifications</b> regroupe messages et mises à jour au même endroit, et ne s\'affiche que s\'il y a quelque chose à lire.',
          'La barre du haut est allégée : son, changement de personnage et déconnexion ont rejoint les <b>Paramètres</b>, et l\'artefact y gagne un accès direct.',
          'Un petit rail d\'infos apparaît en bas à droite : équipe, joueurs en ligne, artefact, raid ouvert.',
        ],
      },
    ],
  },
  {
    version: 'new-subclasses-v1',
    date: new Date().toLocaleDateString('fr-FR'),
    sections: [
      {
        title: '🌟 Quatre nouvelles voies d\'ascension',
        items: [
          'Au Niveau 20, ta classe de base peut désormais s\'élever vers une spécialisation inédite — une par famille, avec son propre arbre de talents complet :',
          '🛡️ Sentinelle (Guerrier) — le tank qui PUNIT au lieu de simplement protéger. Rempart d\'épines te blinde et force l\'aggro, Épines renforcées renvoie jusqu\'à +21% des dégâts subis, Représailles transforme chaque coup encaissé en riposte. La plus haute DEF/PV des guerriers.',
          '💀 Nécromancien (Mage) — le maître du poison et des âmes. Là où le Pyromancien explose et le Cryomancien gèle, lui empoisonne, perce l\'armure et draine la vie. Ses dégâts continus ignorent les boss les mieux cuirassés.',
          '🪤 Piégeur (Archer) — le traqueur toxique. Pièges empoisonnés qui rongent la cible + esquive cumulée (jusqu\'à +21%) pour sa survie. Use les gros PV des boss là où les autres archers cherchent le pic de dégâts.',
          '🔮 Oracle (Soigneur) — le prophète protecteur. Boucliers posés AVANT le coup, la meilleure DEF/réduction de dégâts des soigneurs, et un Jugement de lumière qui mêle dégâts et soin. Le protecteur d\'équipe le plus fiable en donjon.',
          'Toutes sont jouables, équilibrées et déjà dans le Wiki (onglet Classes) et l\'écran d\'ascension.',
        ],
      },
      {
        title: '⚡ Une ressource d\'archétype pour chacune',
        items: [
          'Comme les sous-classes existantes, les quatre nouvelles ont leur propre jauge à gérer — fini le simple cooldown :',
          '🌵 Sentinelle — Vindicte : se charge en ENCAISSANT des coups (le tank vengeur transforme la douleur en riposte). Alimente Représailles.',
          '👻 Nécromancien — Âmes : se charge à chaque fois que le POISON ronge la cible. Poser le poison arme directement ta Vague d\'âmes.',
          '🪤 Piégeur — Pièges : se charge en FRAPPANT une cible déjà empoisonnée (le piège se referme). Déclenche Embuscade.',
          '🔮 Oracle — Présage : se charge quand un BOUCLIER absorbe un coup ou qu\'un SOIN passe (l\'anticipation nourrit la prophétie). Alimente Jugement.',
        ],
      },
      {
        title: '🧟 Nécromancien — Lever un mort',
        items: [
          'Nouvelle compétence d\'invocation : dresse un serviteur qui frappe automatiquement le monstre en fin de tour pendant 4 tours, en plus de tes propres attaques.',
          'Disponible en chasse, aventure et Abysses solo.',
        ],
      },
      {
        title: '⚖️ Équilibrage & corrections',
        items: [
          'Correction : la Vague d\'âmes du Nécromancien affichait un coût de ressource mais la jauge ne se chargeait jamais — l\'ultime était injouable. C\'est réglé (elle tourne maintenant sur les Âmes).',
          'Les 18 sous-classes ont été repassées à la simulation de combat (des milliers de combats au Nv.50) : toutes survivent à 100% et restent dans la fourchette saine. Aucune n\'est laissée de côté.',
          'Rappel : les 4 classes de base (Guerrier/Mage/Archer/Soigneur) restent volontairement en retrait à haut niveau — on ascensionne dès le Niveau 20.',
        ],
      },
    ],
  },
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
