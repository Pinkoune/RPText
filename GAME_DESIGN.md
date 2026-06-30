# RPText — Conception & Architecture

## Vision

RPG textuel multijoueur jouable au clavier. Une barre de commande centrale fait
apparaître des **fenêtres-cartes** flottantes (draggables, fermables). L'UI est
*sans état persistant* : au rechargement, on repart d'un écran neutre, mais toute
la progression vit dans Firebase. Le monde est rythmé par un **cycle jour/nuit en
temps réel** et découpé en **biomes** qui changent le décor et le contenu.

## Architecture du code

```
src/
  firebase/        Couche backend (abstraite : Firebase OU localStorage)
    config.ts        init + détection "Firebase configuré ?"
    auth.ts          Google sign-in (+ user local simulé)
    playerService.ts load/save du joueur (Firestore ou localStorage)
    socialService.ts présence temps réel (RTDB) + classement (Firestore)
  game/            Logique de jeu PURE (testable, sans React)
    types.ts         types partagés
    classes.ts       classes/jobs + courbe d'XP
    biomes.ts        biomes + dégradés de fond par phase
    monsters.ts      bestiaire + sélection selon biome/phase
    items.ts         objets (armes, armures, conso, matériaux)
    player.ts        fabrique de joueur, stats dérivées, XP, inventaire
    combat.ts        combat tour par tour
    gambling.ts      coinflip / dés / slots / roue
    daynight.ts      phase selon l'heure réelle + modificateurs
    commands.ts      parseur + dispatcher de commandes
  store/           État client (Zustand)
    gameStore.ts     auth + joueur + sauvegarde auto (debounce) + toasts
    uiStore.ts       fenêtres ouvertes (z-index, singleton, TTL)
  components/      Présentation React
    cards/           une carte par commande
  hooks/useClock.ts horloge réactive (re-render par minute)
```

**Principe clé** : la logique de jeu (`src/game/*`) ne dépend ni de React ni de
Firebase. Les services backend ont tous un **fallback localStorage**, donc le jeu
tourne sans credentials puis bascule sur Firebase dès que `.env.local` est rempli.

## Modèle de données (Firestore)

- `players/{uid}` — document complet du joueur (`PlayerState`). Lecture publique
  (pour PvP/classement), écriture réservée au propriétaire.
- `leaderboard/{uid}` — projection légère pour le classement (niveau, kills, or…).
- `duels/{duelId}` — réservé aux duels coinflip PvP (voir roadmap).
- Realtime Database `presence/{uid}` — présence en ligne, nettoyée via `onDisconnect`.

Les règles de sécurité sont dans [`firestore.rules`](firestore.rules).

## Systèmes implémentés

- **Classes** : Guerrier, Mage, Archer, Soigneur (stats de base + croissance/niveau).
- **Cycle jour/nuit** : Aube (5-8h) / Jour (8-18h) / Crépuscule (18-21h) / Nuit (21-5h).
  Modificateurs d'XP/or par phase ; la nuit double les chances de loot rare et fait
  apparaître des monstres nocturnes.
- **Biomes** : 6 zones débloquées par niveau, chacune avec 4 variantes de fond (une
  par phase) + couleur d'accent.
- **Combat** : automatique au tour par tour, butin, mort = perte d'or + résurrection à 30% PV.
- **Économie** : or (combat/vente), Fate Coins (gambling premium), gemmes, boutique, inventaire, **marché joueurs** (taxe 10% = puits d'or, limites anti-abus dans `marketService.ts`).
- **Récolte** (`gathering.ts`) : 4 métiers (bûcheronnage, minage, pêche, cueillette) par biome, **cooldown UNIQUE partagé** (une récolte à la fois) et **niveau de farm global** (`farmXp`) débloquant les ressources rares + rendement. Carte `experience` (aventure vs farm).
- **Donjons** (`dungeons.ts`) : runs solo instanciés à étapes (combats enchaînés, PV reportés, boss final), gated par niveau, longue récupération, gros butin + compteur de clears.
- **Talents** (`talents.ts`) : 1 point/niveau, passifs par classe (crit, réduction, esquive, double frappe, régén, furie, dégâts plats) agrégés en `CombatMods`, appliqués au combat.
- **Combat interactif** (`combat.ts → combatTurn`) : chasse au tour par tour (Attaquer / capacité de classe / potion / fuir), monstres plus dangereux (la DEF ne mitige qu'à 60%). `simulateCombat` reste pour les donjons.
- **Classes cohérentes** (`items.ts` champ `classes`, `player.ts → canEquip/equipItem`) : armes restreintes par classe ; bâtons/sceptres pour mage & soigneur, mêlée pour guerrier & archer. Carte d'équipement dédiée. Migration auto.
- **Équilibrage des classes** (`talents.ts → CLASS_BASE_MODS`) : stats retunées + **trait inné** par classe (guerrier réduction, mage crit, archer double frappe, soigneur régén) appliqué en combat dès le niveau 1.
- **Card-Jitsu** (`cardjitsu.ts`) : RPS élémentaire (feu/eau/neige) + valeurs, conditions de victoire 3-même / un-de-chaque, IA adverse, mise en or. PvP temps réel = étape future (matchmaking).
- **Casino** : pile/face, **blackjack** (croupier tire jusqu'à 17, blackjack ×1.5), machine, roue jour/nuit.
- **Craft** (`crafting.ts`) : recettes transformant matériaux de chasse **et ressources récoltées** en équipement, potions et nourriture ; coûts élevés pour étirer la progression.
- **Quêtes** : journalières + hebdomadaires, suivi de métriques (kills, hunts, gambleWins,
  bossHits, crafts…) avec reset périodique (`quests.ts`) + récompense de connexion quotidienne.
- **Gambling** : 4 jeux ; la roue dépend de la phase (jackpot x10 la nuit).
- **Multijoueur** :
  - **Duels PvP** (Firestore `duels`) avec mise en séquestre et encaissement automatique.
  - **Boss mondial** (RTDB `world/boss`) via transactions atomiques : **1 attaque/2h** par
    joueur (`BOSS_ATTACK_CD`), contributions, classement, butin partagé au prorata.
  - **Chat mondial** (RTDB `chat`).
  - Présence temps réel + classement global.
- **Sons + musique d'ambiance** procéduraux (`sound.ts`, Web Audio) : pad + arpège variant selon phase/biome, mute persistant.
- **Capacités actives** (`talents.ts → ABILITIES`) : une compétence par classe, cooldown propre, déclenchée manuellement dans le combat de boss.

## Équilibrage (réglages rapides)

- XP par niveau : `classes.ts → xpToNext`.
- Cooldowns : `commands.ts → HUNT_COOLDOWN`, `DAILY_COOLDOWN`.
- Drop rates : table `loot` de chaque monstre dans `monsters.ts`.
- Payouts casino : `gambling.ts` (`SLOT_PAYOUT`, segments de la roue).

## Roadmap

Fait ✅ : duels coinflip PvP · boss mondial · quêtes journalières/hebdo · craft ·
chat mondial · sons · récolte de ressources · marché joueurs · carte du monde
visuelle · décors de biome + level-up FX · niveaux de métiers de récolte ·
donjons à étapes · Cloud Functions (`resolveDuel` + `buyMarketListing`) ·
talents par classe · **musique d'ambiance** · **capacités actives (boss)**.

Reste à explorer :

1. **Donjons en groupe** : party via RTDB (les donjons actuels sont solo instanciés ;
   le world boss couvre déjà le combat partagé).
2. **Câbler le client aux Cloud Functions** déployées (au lieu du calcul client) pour
   verrouiller totalement l'anti-triche, + restreindre l'écriture du doc joueur.
3. **Capacités actives en chasse/donjon** (combat interactif au tour par tour avec
   choix d'actions, au-delà du combat auto actuel).
4. **Familiers/montures**, **achievements/titres**, **enchantement d'équipement**.

## Équilibrage (rappel)

Progression volontairement longue : `xpToNext = 70·niveau^1.55 + 70` (`classes.ts`),
hunt 90s, récolte 120s/métier (`gathering.ts`), recettes gourmandes en ressources,
biomes échelonnés (Nv. 1/3/8/14/20/28). Le marché applique une taxe de 10% pour
éviter le transfert d'or abusif entre comptes.

## Anti-triche (note)

L'état est actuellement calculé côté client. Pour une vraie production compétitive,
déplacer les actions à enjeu (combat, gambling, échanges) dans des **Cloud Functions**
et restreindre l'écriture directe du document joueur via les règles Firestore.
