# CLAUDE.md — RPText

RPG textuel multijoueur web. **Vite + React + TypeScript + Tailwind + Zustand**, backend **Firebase** (Auth, Firestore, Realtime DB) avec **repli localStorage** complet (`isFirebaseConfigured`). Utilisateur FR. Vérif = `npx tsc -b` + `npm run build`, **et le jeu tourne réellement
en local** (voir « Vérifier en jeu » ci-dessous).

---

## Refonte saisonnière (branche `feat/Refonte-saison`) — fait (C)

Grosse MAJ de rentrée, conçue à partir des **données réelles de la bêta de juillet**
(Nv.20 en 2-3 jours, Nv.40 en 2,5 semaines, meilleur joueur arrêté au Nv.45).
**Claude possède tout ce lot** (plus de répartition avec Gemini, à la demande de
l'utilisateur). ⚠️ `firestore.rules` a changé → **à redéployer**.

- **Courbe d'XP v5** (`classes.ts`) : end-game ×1.18 → **×1.12**. La tranche 40-50
  pesait 81% du grind et 45→50 coûtait 1,3× le trajet 1→45 (≈7,5 semaines au rythme
  observé). Divisé par ~2. Phases 1-30 inchangées (le Nv.20 ne pèse que 0,5%, sain).
  ×1.10 écarté : il propulsait les joueurs de fin de bêta directement au niveau max.
  Migration `relevel()` dans `migratePlayer` (v3→v4 puis v4→v5) qui **crédite les
  points de talent** des niveaux gagnés — ce que la migration v4 omettait.
- **Multi-personnages ×3** (`player.ts charKey/accountOf`, `CharacterSelect.tsx`,
  `playerService.listCharacters/deleteCharacter`) : le **slot 0 garde la clé nue du
  compte** → aucune migration Firestore. Slots 1-2 suffixés `uid__1`. ⚠️ Toutes les
  règles Firestore passent par `ownsCharacter()` : les services envoient l'id du
  **personnage** (`p.uid`), pas du compte. Statut Vétéran/Admin reste au slot 0.
  **Reprise automatique du dernier personnage joué** : `lastSlotKey` était écrit à
  chaque sélection mais **jamais relu**, donc chaque rechargement de page repassait
  par l'écran de choix — même avec un seul personnage. `initAuth` le relit et entre
  directement en jeu (repli : slot unique, sinon écran de choix). L'écran reste
  atteignable par « Changer de personnage » (Réglages → `backToSelect`), qui pose
  `status: 'select'` sans repasser par cette reprise.
- **Camp** (`game/camp.ts`) : accumulation hors-ligne dès le Nv.5, plafond 12h.
- **Donjons à paliers** (`dungeonService.tierMult`, `p.dungeonTiers`) : +35%/palier.
- **Fin du wipe au boss final** (`ascension.ts`) : la victoire ouvre `applyRebirth`,
  déclenché par le joueur depuis PrestigeCard.
- **Chasse interactive** (`combat.ts`) : `MonsterIntent` (télégraphe annoncé au tour
  précédent) + `parry`/`interrupt` ; **série de chasse** (`huntStreak`, +2%/kill
  plafonné +40%, perdue à la mort).

---

## Progression : les six jauges (⚠️ lire avant d'en ajouter une septième)

L'utilisateur s'est explicitement dit **perdu** (« qui fait quoi et quel exp, ça fait
beaucoup »). On a répondu en SUPPRIMANT un compteur, pas en en ajoutant. Toute
nouvelle mécanique doit se brancher sur l'une de ces jauges plutôt qu'en créer une.
Elles sont expliquées en jeu dans la carte Aide (section « Les jauges du jeu »).

| Jauge | Monte avec | Sert à | Reset |
|---|---|---|---|
| **Niveau** 1→50 | combat, donjon, récolte, forge, camp | stats + 1 point de talent/niveau | renaissance |
| **Artefact = la saison** | la MÊME XP que le niveau, **+ victoires PvP** | mods, rang de saison, paliers de passe | rotation de saison |
| **Métiers** | récolter, forger, concocter | recettes et ressources | renaissance |
| **Éclats ✧** | succès (+3), passe, artefact au-delà de la grille (+1/niv) | étoiles de la Relique | jamais |
| **Maîtrise de biome** | kills par zone (paliers 100/500/1500/4000) | bonus XP/Or permanent + titre | jamais |
| **Puissance ⚡** | somme dérivée de tout | classement uniquement | — |

**Ce qui traverse tout** (ni renaissance ni saison) : Relique, Éclats, maîtrises,
familiers, titres, succès, fonds de profil.

### Saison unifiée (`season.ts` + `artifact.ts`)
Il y avait DEUX saisons : ladder PvP au mois calendaire, et artefact piloté admin.
Fusionnées. `seasonId()` dérive du numéro de saison de l'artefact (`s<N>`) ;
`nextSeasonAt` a disparu (une saison finit quand l'admin la fait tourner).
`seasonPoints` est **retiré du gameplay** (champ conservé pour compat Firestore) :
les rangs Bronze→Maître sont indexés sur le **niveau d'artefact** (0/8/20/35/55/85),
et les victoires PvP versent de l'XP d'artefact (`PVP_ARTIFACT_XP`, ×40/×30 le niveau).
`advanceSeason` balaie artefact + points PvP + classements d'Abysses d'un coup.
La récompense de fin de saison est créditée dans `migratePlayer` depuis l'archive
que rend `rotateSeason` — seul endroit qui connaisse le niveau atteint avant reset.

### Artefact (`game/artifact.ts`)
Puissance `0.35*log10(1+level/10)`, sans plafond mais logarithmique. Grille de
17 mods (**62 points**). Au-delà de `artifactGridCost()`, chaque niveau donne
**1 Éclat** au lieu d'un point mort — la queue de l'artefact valait sinon +0,1%
de puissance par niveau. Mods de combat agrégés dans `talentMods` → `CombatMods`.

### Relique (`game/relic.ts`) — l'axe permanent
Entité autonome (PAS une pièce d'équipement : elle serait détruite par
`applyRebirth`, entrerait en concurrence avec le stuff farmé, et devrait battre
`void_mantle` pour être portée). ★1-5 = **+2%** ATK/DEF/PV chacune (et non +10% :
en autonome ça s'AJOUTE à l'artefact et au prestige). ★6-10 = **un effet au choix
parmi trois**, versé dans `CombatMods`, aucune stat brute. Coûts 8/14/20/26/32.

### Passe de saison (`game/seasonpass.ts`)
Gratuite, 10 paliers indexés sur le **niveau d'artefact** (pas de compteur dédié).
Donne des Éclats (~26/saison, seule source répétable), des fonds de profil et des
titres saisonniers nommés d'après le thème. `ensureSeasonPass` vide la piste à la
rotation ; titres et fonds restent acquis.

### Faille de la semaine (`game/rift.ts`)
Biome + modificateur déduits de l'horloge (`Math.floor(now / RIFT_WEEK_MS)`), zéro
backend. ⚠️ Le pas du modificateur (**5**) doit rester premier avec leur nombre (6) :
avec 3, quatre modificateurs sur six ne sortaient jamais. Calibrée RELATIVEMENT au
mini-boss (0,21-0,40× ses PV, 0,40-1,32× son ATK) — `simulateCombat` sort 0% de
victoire même contre un monstre normal, ses taux absolus sont inutilisables.
Prime (2 Éclats + or) au premier passage de la semaine, pas de cooldown.

### Puissance (`game/power.ts`)
Unité : **1 point ≈ un niveau de personnage d'effort**. Niveau ×1, prestige ×50
(une renaissance ne doit PAS faire chuter au fond du classement), artefact ×1,
étoiles portées ×1, maîtrises ×1, Abysses ×0.5, étoile de Relique ×12, kills et
donjons en **racine carrée** (×0.5 / ×1.5 — en linéaire 60 000 kills écraseraient
tout), meilleure série ×1.
⚠️ Le tri Firestore reste `orderBy('level')` et le classement se fait **côté
client** : un `orderBy` sur `power` exclurait les lignes d'anciens clients qui ne
portent pas le champ. `fallbackPower` leur reconstruit un score. Sur-échantillonnage
×4 avant de trancher, sinon `limit` couperait sur le mauvais critère.

### Panneau admin — saisons
`setSeason(n)` (seasonService) remplace `advanceSeason` : elle écrit n'importe
quel numéro dans `system/season`. Comme les clients comparent
`artifact.season !== saison courante` pour décider de repartir de zéro,
**écrire un numéro DIFFÉRENT suffit à tout réinitialiser** — réécrire le même
numéro ne fait rien. Le thème étant dérivé du numéro (`(n-1) % 4`),
`nextSeasonWithTheme(themeIndex, from)` traduit « je veux l'Hiver » en un numéro,
sans jamais reculer (un numéro qui recule ferait réapparaître des saisons déjà
archivées chez les joueurs). Le bloc vit dans les actions **globales** du panneau
— l'ancien bouton de rotation était enfoui dans l'éditeur d'un joueur.

### Panneau admin — le reste (revue faite, C)
Règle de rangement : **une action qui touche le serveur entier ne va jamais dans
l'éditeur d'un joueur.** Même faute que la rotation de saison, retrouvée une fois
de plus : « Ouvrir une fenêtre de Raid » (`broadcastRaid`, RTDB `world/raid`) y
vivait dans les « Actions Rapides », donc il fallait ouvrir la fiche d'un joueur
au hasard pour lancer un événement mondial. Déplacé dans une section **Monde**.

- **Bug du don d'objet** : la recherche filtrait la liste du `<select>` sans
  jamais toucher `giveItemId`, resté sur sa valeur initiale `'potion'`. On
  cherchait un objet, on lisait son nom en tête de liste, on donnait des potions
  de soin. Un `useEffect` resynchronise la sélection dès qu'elle sort de la liste
  filtrée, et une ligne « Sélection : … » affiche ce qui sera réellement donné.
- **Don/retrait d'objet instanciés** : le don écrivait `inv[baseId] += n`, ce qui
  fabriquait une **pile de gear** alors que chaque pièce doit avoir sa clé unique
  (`baseId:qXXX:i1234`) — la migration d'instanciation étant déjà passée, rien ne
  l'aurait rattrapée (étoiles/durabilité partagées). Passe par
  `addItemToInventory`. Symétriquement le retrait cherchait `inv[baseId]`, absent
  pour du gear, et ne faisait donc **rien** : il balaie maintenant les clés dont
  la base correspond.
- **Bloc « Saison · Relique · Prestige »** (éditeur de joueur) : niveau
  d'artefact, Éclats, prestige, jetons de classe. Ces jauges n'avaient aucun
  levier admin. Les **étoiles de Relique se donnent en Éclats, pas en étoiles** :
  poser une étoile ≥6 de force laisserait `relic.effects` plus court que
  `relic.stars`, et l'achat suivant choisirait un effet du mauvais palier.
- **Hors ligne** : `getAllPlayers`/`updatePlayerAdmin` retombent sur les clés
  `rptext.player.*` du localStorage. Le panneau était vide et inerte en dev — ce
  qui rendait tout le panel invérifiable en local, alors que c'est justement là
  qu'on veut tester.
- **Supprimés** : `📊 Simuler Courbe` (bouton) et la commande `admin_curve`
  (alias `curve`) — même code, formules de stats écrites en dur
  (`100 + 20/niv`, `atk 5 + 2/niv`) qui ne correspondent à **aucune** classe
  (`base.maxHp` 130, `growth` 18-25) et qui ignorent talents, artefact, prestige.
  Les vrais chiffres sont dans `scripts/` (harnais tour-par-tour).
  `🏆 RESET SAISON PVP` aussi : il ne remettait à zéro que `seasonPoints`, champ
  sorti du gameplay quand le rang de saison est passé sur le niveau d'artefact.

### Commandes admin — ne pas fuiter leur existence
`ADMIN_ONLY` (commands.ts) est filtré **au dispatch** : un non-admin reçoit le
message d'une commande inexistante, mot pour mot. Avant, `admin` répondait
« Commande introuvable. » là où l'inconnue répond « Commande inconnue : "x". » —
la différence de formulation révélait l'existence de la commande. Ajouter une
commande admin = l'inscrire dans `ADMIN_ONLY`, rien d'autre.

### Prestige — pièges connus
- Les constantes vivent dans `prestige.ts` (`PRESTIGE_BONUS_PER_LEVEL` 0.08,
  `PRESTIGE_XPGOLD_PER_LEVEL` 0.10, `MAX_PRESTIGE_STACK` 5). Elles étaient
  dupliquées en dur dans `player.ts`, ce qui les avait fait diverger de l'interface
  — **ne jamais les réécrire ailleurs**.
- `applyRebirth` remet `classId` à la classe de BASE. Sans ça un Berserker
  renaissait « Berserker niveau 1 » et le garde-fou de `migratePlayer` le corrigeait
  seulement au chargement suivant, sans explication.
- `computeAscensionBoss` compte **la moitié** du prestige. À 0, un archer passait de
  0% à 97% de victoire entre prestige 0 et 5 ; à plein, la renaissance n'apporterait
  plus rien face au Néant.
- `CommandDef.alsoIf` : dérogation au `reqLevel`. Une renaissance ramène au Nv.1 en
  gardant prestige, aura et Relique — sans ça leurs cartes redevenaient inaccessibles.

### Empilement des buffs (mesuré en simulation, corrigé)
Chasseur Nv.50 gear q150 5★, via `balance-sim-turns.ts` (section « empilement de
saison ») : ATK **478 nu → 1190 tout maxé (×2.49) → 1393 à artefact Nv.300 (×2.91)**.
⚠️ Le chiffre précédemment noté ici (×2.08) était calculé à la main en multipliant
les seuls multiplicateurs de stats (`presMult × artMult × relMult`) : il **oubliait
les mods de la grille d'artefact**, qui ajoutent leur propre `atkPct`/`hpPct` dans
`(1 + mods.atkPct + …)` (art_edge +6%, art_vigor +8%, art_apex +10%). ~20% d'écart.

Conséquence mesurée, plus parlante que le multiplicateur : contre les monstres des
Abysses au Nv.50, **la grille d'artefact seule fait passer de 48% à 100%** de
victoire. Le levier le plus simple à baisser reste la Relique, mais le vrai poids
est dans la grille.

---

## Performances (⚠️ cause de chauffe identifiée)

`.glass` applique un `backdrop-filter` à **chaque fenêtre** plus la barre du haut.
Chaque surface floutée fait ré-échantillonner tout l'arrière-plan à chaque image :
c'est de loin l'effet le plus coûteux du jeu. Ne pas l'étendre à d'autres éléments.

- Flou par défaut **10px** (le fond est opaque à 86%, un flou plus large ne se voit pas).
- `fxStore` reflète son état sur l'élément racine (`fx-reduced`, `fx-compact`) —
  indispensable, car aucune prop React ne peut désactiver une règle CSS.
- `.fx-reduced` retire le flou (`none`, PAS `blur(0)` qui garderait une couche de
  composition), met les particules à 0 et allège les ombres.
- Les réglages doivent faire ce qu'ils annoncent : `muteSound` et `compactMode`
  étaient tous deux sauvegardés et branchés sur rien.

---

## Plan pré-reset (contenu end-game) — en cours

Objectif : rendre le end-game (niv.22→50) attractif. 5 features :
1. ✅ **FAIT (C)** — Courbe XP two-phase + **niveau max 50** (`classes.ts` xpToNext/xpToNextV3/MAX_LEVEL, `player.ts` migrate `curveVersion=4`).
2. ✅ **FAIT (C)** — **Biome Volcanique 🌋 (niv.24)** : type `'volcano'`, biome, 5 monstres, 3 ressources (`lava_crystal`/`ember_stone`/`infernal_shard`), minage volcanique, events, icônes, position carte.
3. ✅ **FAIT (C)** — **Forgeron Renold (niv.10)** : réparation/renforcement garanti/purification en or. **Ouvert vendredi 21h → dimanche 21h uniquement** (`blacksmith.ts` `isBlacksmithOpen`), écran « absent » + compte à rebours sinon (bypass admin `ignoreRestrictions`). Icônes matrice/kit via `ItemIcon` (plus d'emoji).
4. ✅ **FAIT (C)** — **Commandes end-game** : `mercenaire`(25, CD 6h, boss volcanique), `prestige`(30, aura cosmétique → carte + affichage classement), `expedition`(35, familier 4h → ressources), `sanctuaire`(40, CD 24h, boss ultime → primordial_crown/boss_soul). Gating auto (help + level-up + autocomplete) + entrées MobileNav.
5. ✅ **FAIT (C)** — **Recettes end-game (niv.30-45)** : lava_blade, infernal_bow, magma_staff (mage), **seraph_staff (healer)**, volcanic_armor, infernal_elixir, void_mantle, primordial_crown.

**Toutes les features du plan pré-reset sont faites.** Reset global = déjà dans le panel Admin (ne pas retoucher).

**Prestige / Rituel du Néant (C — fondation faite, feel à polir)** : commande **secrète** `prestige` (Nv.50, `hidden:true` → absente du help, « ??? » dans le tuto), **lançable uniquement depuis les Abysses** (`biome==='frozen'`). L'ancienne carte d'aura cosmétique est désormais la commande **`aura`** (Nv.30). Logique dans `game/ascension.ts` : `computeAscensionBoss(p)` calibre le boss « Le Néant Originel » sur un joueur idéal (talents max + meilleure arme q150/5★/runes + `void_mantle` + `primordial_crown` + familier légendaire, via un faux `deriveStats`). **Calibrage costaud** (`hp = idealAtk*36`, `atk = idealMaxHp/6 + idealDef*0.6`, `def = idealAtk*0.15`) — vrai mur de fin de jeu qui dépasse le sustain d'un moine/soigneur ; leviers à ajuster ici si trop dur/facile. `ascensionOutcome(bossHpFrac, won)` + `applyAscensionResult(draft, res)` : **victoire** = prestige (`prestigeLevel++`, **+1 jeton de changement de classe** `classChangeTokens` utilisable depuis le Profil via `changeBaseClass`, reset progression en gardant identité/familiers/titres, arme starter neuve, bonus permanent **+8% ATK/DEF/PV & +10% XP/Or par prestige, cap 5** appliqué dans `deriveStats`/`applyBonuses`, affiché dans ProfileCard) ; **échec** = perte de 1-3 niveaux selon PV restants du boss (>75%/>50%/>25%) + **cooldown 8h** (`ascensionCooldownUntil`), sauf <25% = aucun malus. Insigne `✦N` violet au classement (`prestigeLevel`). Fenêtre `ascension` (`AscensionCard.tsx`) = intro « Affronter le mal » → confirm « Je suis paré ! » (`.animate-shake`) → combat (réutilise `combatTurn`). **Reste à faire (workstream B, feel)** : plein écran noir sans UI (masquer Topbar+dock), trou noir animé + barre PV violette du boss, barre PV joueur + compétences en bas, ambiance sonore.

**Bugfix sous-classes/starter (C)** : `starterWeapon` comparait la classe **littérale** au lieu de la classe de **base** (`CLASSES[classId].parent ?? classId`) → un moine/paladin/etc. tombait dans le mauvais cas et recevait l'épée rouillée au lieu de l'arme de sa vraie famille (mage/healer → baguette). Corrigé. **Garde-fou ajouté dans `migratePlayer`** : si `p.level < 20` et que la classe actuelle est une sous-classe (`CLASSES[p.classId].parent` existe), on la renvoie de force vers la classe de base (reset arbre + points rendus), quelle que soit l'origine du problème (admin, bug futur…) — tourne à chaque connexion. **Panel Admin** : nouveau sélecteur « Changer de classe » (`changeClass`) — reset l'arbre de talents + déséquipe tout le matériel (rendu au sac), fonctionne via le patch `write()` (donc reflète en live si l'admin s'édite lui-même, voir bugfix ci-dessous).

**Bugfix Admin non-instantané (C)** : `AdminModal` écrivait direct sur Firestore (`updatePlayerAdmin`) sans jamais toucher la session locale (`player` du store, pas branché en live) → un admin qui s'auto-éditait devait recharger la page pour voir l'effet. Toutes les actions passent maintenant par un helper `write(patch)` qui écrit Firestore **et** applique le même patch via `mutate` si `editingPlayer.uid === player.uid`. Aussi : **Reset Cooldowns** oubliait `ascensionCooldownUntil`/`combatCooldowns` ; **CooldownCard** n'affichait ni mercenaire/sanctuaire/rituel du Néant (ajoutés) ; **`applyAscensionResult`** oubliait de reset `farmXp`/`gatherXp`/`craftXp`/`concoctionXp` à la victoire du prestige (ajouté).

**Ajustements équilibrage/QoL (C)** : familiers non achetables si collection de la rareté complète (`ownsAllOfRarity`, FamiliarCard). Boss end-game (`miniboss`/`mercenary`/`sanctuary`) : `applyZonePenalty` (commands.ts) réduit XP/or ×0.3 + loot limité à la ressource du biome si invoqués dans une zone `minLevel < 24` (anti-farm). Casino machine 🔔 x5→x8. **Prestige** (`prestige.ts`) : chaque aura donne un **petit bonus passif** (atk/def/hp/xp/gold%) appliqué dans `deriveStats`+`applyBonuses` (plus juste cosmétique). Boss mondial : dégâts **quasi-plats** (`150 + level*3 + atk*0.05`) pour participation équitable. Équipe : bonus désactivé en solo (`getTeamBonus size<=1`), kick des membres **hors ligne** via présence (`PresenceTracker`, onDisconnect ≠ inactif), dissolution du dernier via `leaveTeam` au `logout`. **Résistances phys/mag** : `rune_shift` (Rune de Transmutation, Fate Shop) sertie sur l'arme inverse son `dmgType` (physique↔magique) → contourne la résistance ; lu dans `deriveStats` via `p.enchants[weaponKey]`.

**8e biome — Nécropole de Cristal 🪦 (niv.30, C)** : constat que débloquer les 7 biomes ne demandait que ~2% de l'XP totale jusqu'au niveau 50 (niv.28→50 = 98% du temps de jeu sans nouvelle zone). Ajout d'un biome intermédiaire entre volcan(24) et Abysses, et **Abysses repoussé de niv.28 à niv.38** (`biomes.ts`, xpMult 2.5→2.6) pour rester le 8e et dernier biome — la porte du rituel de prestige (`commands.ts` `biome==='frozen'`) reste inchangée puisque frozen reste bien la zone finale. Contenu complet : type `'crypt'` (`types.ts`), biome + position carte (`MapCard.tsx` POS/ORDER), 5 monstres niv.30-32 dont un mini-boss `crypt_warden` (`monsters.ts` + `monsterIcons.ts`), 3 ressources (`crypt_shard`/`bone_dust`/`wraith_essence`, minage+cueillette dans `gathering.ts`), 6 équipements end-game niv.34-36 (`crypt_edge`/`crypt_bow`/`crypt_scepter`/`crypt_rod`/`crypt_plate`/`soul_ward`) qui comblent le trou de la courbe de craft entre le tier volcanique (30-32) et `void_mantle`/`primordial_crown` (42-45), icônes (`icons.ts`), décor (`Scenery.tsx` silhouettes cristaux/tombes + particules feux follets), événement régional (`events.ts`). Annexes mises à jour : `BIOME_RESOURCE`/`biomeRes` (commands.ts, x2) pour l'anti-farm et l'expédition, achievement Globe-trotteur (`achievements.ts`, goal 6→8, déjà périmé à 7 avant ce patch). **Non touché** (pré-existant, hors scope) : quelques recettes (`crystal_charm`, `divine_scepter`, `phoenix_elixir`, `crystal_staff`, `gambler_ring`) exigent `crystal`/`frost_lotus` (exclusifs à l'Abysse) à des `levelReq` bien inférieurs au niveau d'accès au biome — un écart déjà présent avant ce patch (contournable par le marché), juste élargi par le recul d'Abysses à niv.38.

---

## Pont Epigames (portail)

RPText est listé sur le portail **Epigames** en `kind: 'web'` (onglet séparé).
Quand le joueur le lance **depuis le portail**, un pont `postMessage` s'ouvre
via `window.opener` :

- `index.html` charge le SDK du portail (`epigames-sdk.js`) ;
- `hooks/useEpigames.ts` (appelé une fois dans `App.tsx`) fait deux choses :
  1. **miroite les succès** — l'`id` de `ACHIEVEMENTS` (`game/achievements.ts`)
     EST le `code` côté portail ; on envoie l'état **atteint** (`isUnlocked`,
     `value >= goal`), pas le « réclamé », dédupliqué par un `Set` local ;
  2. **affiche les notifications du portail** (ami en ligne, MP, invitation)
     dans les toasts RPText — obligatoire ici, le portail est dans un AUTRE
     onglet, ses propres bulles sont invisibles pour le joueur.

⚠️ RPText n'écrit **jamais** dans la base du portail : il poste un message, le
portail écrit avec le compte du joueur connecté chez lui. Donc pas de SSO, pas
de Firebase partagé, **rien à configurer** dans ce repo. Hors portail (URL
directe, favori), `Epigames.available` est false et tout devient no-op — un
seul build sert les deux cas.

Ajouter un succès visible sur le portail = créer là-bas un succès avec le
**même code** que l'id RPText, et le faire approuver. Doc complète :
`EpiGames/docs/INTEGRATION.md`.

## Architecture (où vit quoi)

```
src/
├── game/            # Logique pure (pas de React). Cœur du jeu.
│   ├── types.ts         # PlayerState, ItemDef, Stats, ClassId, BiomeId…  (⚠ fichier partagé)
│   ├── player.ts        # deriveStats, migratePlayer, canEquip, grantXp, applyBonuses  (⚠ partagé)
│   ├── classes.ts       # 4 classes de base + 12 sous-classes (ascensions), courbe XP
│   ├── talents.ts       # arbre de talents + compétences actives (ActiveSkillDef) + CombatMods
│   ├── combat.ts        # combatTurn (hunt/adventure), simulateCombat, CombatState (bouclier/états)
│   ├── sets.ts          # procs de set en combat (feu=brûlure, givre=gel…)
│   ├── items.ts         # ITEMS (registre d'objets), item()/getItem() (suffixe qualité :q120)
│   ├── icons.ts         # registre id d'objet → icône react-icons/gi (fallback emoji)
│   ├── crafting.ts      # RECIPES + minijeu (forge). getCraftLevel.
│   ├── gathering.ts     # récolte (chop/mine/fish/forage), farmXp
│   ├── dungeons.ts      # DUNGEONS (défs), DungeonReward
│   ├── enchant.ts       # (Gemini) enchantements via gemmes/runes
│   ├── endless.ts       # (Claude) abysses infinis — monstre/récompenses par étage
│   ├── season.ts, daily.ts, achievements.ts, events.ts, quests.ts, biomes.ts, monsters.ts, familiars.ts, pvp.ts
├── firebase/        # Services : playerService, groupsService (teams/guildes/boss guilde),
│   │                #   dungeonService, bossService, pvpDuelService (Claude), cardjitsuService,
│   │                #   socialService (leaderboard/présence), endlessService, chatService
├── components/
│   ├── ItemIcon.tsx     # <ItemIcon id size /> — icône teintée par rareté (fallback emoji)
│   ├── MonsterIcon.tsx  # <MonsterIcon id emoji size /> — icône monstre (fallback emoji), registre monsterIcons.ts
│   ├── MobileNav.tsx    # <640px : dock bas + menu grille (remplace CommandBar) — voir « Mobile »
│   ├── cards/           # une carte = une fenêtre (Hunt, Craft, Equipment, Talent, Dungeon…)
│   ├── WindowManager.tsx, Window.tsx (plein écran sur mobile), Topbar.tsx, App.tsx, modales
└── store/
    ├── gameStore.ts     # useGame : player, mutate (débounce save), toasts, dailyReward…
    └── uiStore.ts       # useUi : fenêtres (WindowKind), open/close/focus
```

**Patterns clés**
- Ajouter un objet → `ITEMS` dans `items.ts` (+ recette dans `crafting.ts` si craftable, + entrée `icons.ts`). Toujours passer par `item(id)`, jamais `ITEMS[id]`.
- Nouvelle fenêtre → `WindowKind` (uiStore) + `META` (WindowManager) + rendu + commande (`commands.ts`).
- Migration de save → `migratePlayer()` avec un flag de version (ex : `TALENT_RESET_VERSION`).
- Combat interactif (hunt/adventure) = `combatTurn` (pur, ne mute pas le joueur). Donjon multi = `dungeonService` (serveur, chemin séparé).
- Synchro sans backend = fenêtres de temps déterministes (`Math.floor(Date.now()/ROTATION_MS)`), voir `events.ts`, `season.ts`.

---

## Icônes (react-icons/gi = Game Icons)

`icons.ts` mappe `id d'objet → composant react-icons`. `<ItemIcon id size />` le rend **teinté par la couleur de rareté**, avec **repli sur l'emoji** de l'objet si non mappé. Migration progressive : remplacer `{it.icon}` par `<ItemIcon id={id} />` dans les cartes. **Fait partout** : Inventaire, Équipement, Forge, Boutique, Boutique du Destin, Récolte, Chasse (butin+HUD), Wiki (objets+bestiaire), Marché, Concoction (ingrédients), Donjon (picker potion), Profil (équipé), BaitTimer (appât actif). **Tous les objets d'`ITEMS` sont mappés dans `icons.ts` (0 fallback emoji).** Restes = emojis « propres » non-objets (classes, biomes, familiers, succès, paliers saison, événements). Labels texte : `SeasonCard`.

**Monstres** : registre séparé `monsterIcons.ts` (`MONSTER_ICONS: id monstre → icône gi`) + `<MonsterIcon id emoji size />` (repli sur l'emoji du `MonsterDef`). Utilisé dans Hunt (HUD) et Wiki (bestiaire). Endless garde son emoji brut (monstres générés sans id).

---

## Mobile (< 640px) — fait (C)

`useIsMobile()` (`hooks/useIsMobile.ts`, matchMedia). Sous 640px l'app quitte le gestionnaire de fenêtres flottantes :
- `Window.tsx` rend chaque carte **plein écran** (sous la Topbar, gap déterministe `top: 4.75rem`), **sans drag/cascade/minimize**, header + bouton fermer tactiles.
- `App.tsx` : `MobileNav` remplace `CommandBar`. **Dock bas** = onglets des fenêtres ouvertes (focus/fermer) + bouton **☰ Menu** → **grille d'icônes** par catégorie. Catalogue dans `MobileNav.tsx` (`NAV`). **Gating** : chaque icône respecte le `reqLevel` de la commande homonyme (`REQ_LEVEL` dérivé de `COMMANDS`) → icônes **verrouillées** (🔒 + Nv.X, clic bloqué) tant que non débloquées ; bypass admin via `ignoreRestrictions`.
- `Topbar.tsx` : **barres PV/XP compactes** en haut sur mobile (`sm:hidden`). Pastilles **événements cachées <Nv.3**, **Fate Coins cachés <Nv.10** (toujours gagnés, juste non affichés) — l'or reste visible.
- `HelpCard.tsx` : refonte lisible (catégories à icône, tri par niveau, alias affiché). Commandes non débloquées **grisées + 🔒 Nv.X** (référence de ce qui arrive).
- Desktop inchangé (fenêtres flottantes + CommandBar).

## Chat — messagerie (fait, C)

`ChatCard.tsx` : onglet **Privé** = vraie messagerie. Fils dérivés de `chat/inbox/<nom>` (regroupés par interlocuteur), **sélecteur de destinataire** parmi les joueurs en ligne (`trackPresence`), bulles gauche/droite. Clic sur un pseudo (n'importe quel canal) = ouvre le DM. `/w Nom Message` conservé en **raccourci optionnel** (plus jamais obligatoire).

---

## Mini-boss & Raid (fait, C)

- **`miniboss`** (cmd, Nv.15, CD 12h via `cooldowns.miniboss`) : ouvre un combat `hunt` contre un monstre synthétisé très costaud, stats/récompenses ∝ niveau (loot : matrice, âme de boss…). CD posé à l'engagement (anti-farm).
- **`raid`** (cmd, Nv.22) : 3 donjons enchaînés = def `raid_trials` (12 étages, stats ×1.4, boss final ×2.2) poussée dans `DUNGEONS` avec `raid:true`. Lobby raid = **pas de boutons Prêt/Lancer** (démarrage **auto uniquement** à :10 via l'hôte), compte à rebours, « Quitter » (rose) ferme la carte. L'**en-tête de fenêtre** passe dynamiquement à « 🔱 Raid » (jaune) via `useUi.setChrome('dungeon', {title,accent})` (override `GameWindow.title/accent`, lu par WindowManager). **Coffre à clé masqué** pour les raids. Aussi dans le tuto (Nv.22). **Réutilise tout le moteur donjon** (`dungeonService`). Fenêtres d'inscription déterministes (`raid.ts` : 10h00→10h10 et 20h00→20h10 locales) ; lobby **partagé** à id déterministe `raid-<key>` via `joinOrCreateRaid` (1er = hôte, illimité). `RaidBanner.tsx` = grosse notif pendant les inscriptions (Nv.25+), clic = `runCommand('raid')`. Les raids sont **exclus de la liste** DungeonCard (création hors fenêtre impossible).
- **Limite 4 joueurs** sur les donjons normaux (`joinDungeon`), illimitée si `def.raid`.
- **Lobby raid** (DungeonCard) : titre dédié, **compte à rebours** vers :10 (`session.raidStartsAt`) et **auto-start** à échéance (`startDungeon(id, force=true)` ignore le « tous prêts » pour les raids). Cooldown mini-boss listé dans CooldownCard.
- **Admin** : bouton « Ouvrir une fenêtre de Raid » → `raidService.broadcastRaid()` (RTDB `world/raid`) ; `App` écoute via `listenRaidBroadcast` → `setForcedRaid` ; `getRaidWindow` honore la fenêtre forcée (10 min) en priorité. Debug + events.
- **HP < 15 %** clignote (`animate-pulse`) : Topbar (mobile + desktop) et barres joueur en combat (Hunt/Dungeon/Endless).
- 🐛 **Fix** : Topbar/ProfileCard affichaient `player.hp` **brut** (jamais clampé à `maxHp`) au lieu de `deriveStats().hp` (clampé) → barre PV/XP pouvait déborder (`999999/209`) si un admin changeait le niveau après un `full_heal` (qui écrivait un sentinel `hp:999999`). Corrigé : barres avec `overflow-hidden` + % clampés `[0,100]`, `AdminModal` calcule désormais le vrai `maxHp` via `deriveStats` (plus de sentinel) et clampe `hp` au save si le niveau change.

## Équipe (fait, C) — synergie donjon

`TeamCard.tsx` / `groupsService.getTeamBonus` : buff passif +5%/membre XP+Or **désactivé si seul dans l'équipe** (`size<=1` → ×1.0, plus de bonus gratuit en solo) — appliqué aussi au **craft** désormais (`crafting.ts finishCraft` route l'XP via `applyBonuses`, comme récolte/combat ; avant : craftXp ignorait le bonus). En plus, **jonction rapide au donjon d'un coéquipier**, et **mini-chat d'équipe intégré** dans TeamCard (même canal RTDB `chat/team/<id>` que l'onglet Équipe de `ChatCard` — les deux restent synchronisés, aucune duplication de canal). `TEAM_MAX=4` matche exactement le cap 4 joueurs des donjons normaux. Quand un membre ouvre un donjon (`setTeamDungeon` déjà posé côté `DungeonCard`), `TeamCard` écoute la session (`listenDungeon(myTeam.dungeonId)`) et affiche un encart « ⚔️ *Nom du donjon* en attente (n/4) » + bouton **Rejoindre** (masqué si la session n'est plus en lobby ou si déjà dedans) — plus besoin de fouiller la liste des donjons ouverts dans DungeonCard.

## Duels PvP temps réel — 1v1 & 2v2 (fait, C)

Remplace l'ancien duel instantané (pile/face Firestore, `pvp.ts simulateDuel`) par un **vrai combat au tour par tour avec compétences**, calqué sur `dungeonService`/`endlessService` : nouveau service RTDB `pvpDuelService.ts` (`pvpDuels/<id>`), deux camps symétriques `A`/`B` (au lieu d'un groupe vs monstre), même moteur de dégâts que la chasse (crit/critMult/armorPen/execute/lifesteal/doubleHit/berserk/regen via `CombatMods`, éléments arme vs armure via `getElementMult`/`getDmgTypeMult`).
- **Modes** : `1v1` (1 vs 1) et `2v2` (jusqu'à 2 par camp — capacité par camp = `sideCapacity(mode)`). Lobby avec Prêt/Lancer (hôte), impossible de lancer tant qu'un camp n'est pas complet+prêt.
- **2v2 via l'Équipe** : si en équipe, un bouton « 📣 Inviter mon équipe » poste un message dans le chat d'équipe (pas d'auto-fill magique — chacun rejoint via le lobby comme un adversaire normal).
- **Ciblage** : 1v1 auto (un seul adversaire vivant) ; 2v2 cliquable sur la fiche adverse pendant son tour (repli sur une cible aléatoire si aucune sélection).
- **Mise** : payée à la création/jonction (comme l'ancien système) ; le vainqueur double sa mise (`bet*2`) car les deux camps ont toujours le même effectif → pas de calcul de pot nécessaire. Points de saison PvP inchangés (`SEASON_POINTS.duelWin`).
- **Repli hors-ligne** (`!pvpDuelsEnabled`, pas de RTDB) : combat fantôme instantané conservé tel quel (`pvp.ts`), aucune régression du mode local.
- Champs joueur : `pvpDuelSessionId`/`settledPvpDuels` (migration `player.ts`), règle RTDB `pvpDuels` ajoutée à `database.rules.json`.

## Équilibrage arbres de talents (fait, C)

À Nv.50 le joueur gagne 49 points de talent (`level-1`). Un premier passage avait ajouté des passifs « absorbeurs » (2×5 rangs + 1×3 rang) pour les bases Guerrier/Mage/Archer/Soigneur + les sous-classes Moine/Druide/Prêtre de l'Aube, mais **oubliait 9 sous-classes** (Paladin/Berserker/Dark Knight/Pyromancer/Cryomancer/Arcanist/Rogue/Barde/Chasseur), qui plafonnaient à 35 rangs dépensables → **14 points gaspillés** à Nv.50. Corrigé (`talents.ts`) : mêmes gabarits ajoutés à ces 9 sous-classes → toutes à 48 rangs (1 point de marge, comme le Moine). Prêtre de l'Aube/Druide restent à 43 (6 de marge, non touché — pas cassé, juste un peu plus généreux).

## Simulation d'équilibrage & fixes de courbes (fait, C)

Deux harness dans `scripts/` (voir `scripts/README-balance.md`) importent la logique de combat **réelle** (bundlés esbuild, `import.meta.env` stubé → pas de Firebase, exécutés node) : `balance-sim.ts` (passif/auto-combat, DPS backbone) et `balance-sim-turns.ts` (**tour-par-tour avec compétences actives, ressources, potions, co-op donjon N joueurs** — la mesure fiable). Rapport interactif publié en Artifact + CSV Excel dans `scripts/balance-output/`. **Le harness teste chaque classe de `CLASS_LIST` sans code sup → garde-fou pour toute classe future** (bandes cibles Nv.50 dans le README).

Murs de difficulté localisés par la simu et corrigés :
- **Falaise de chasse Nv.24-30** (`monsters.ts` `pickMonster`) : l'exposant de scaling **sautait de 1.5 à 2.0 pile au Nv.20** (+32% stats monstre en un niveau, à l'ascension) puis explosait. Winrate simulé : 100% jusqu'à Nv.20 → 62% volcan(24) → 1% Nécropole(30). Corrigé en **exposant continu 1.75** (ni discontinuité ni explosion) → volcan 80%, crypte 45-53%. L'Abysse (Nv.38+) reste volontairement un mur de fin de jeu.
- **Scaling donjon super-linéaire** (`dungeonService.ts` `initMonster`) : PV boss ∝ `numPlayers^1.4` → part de PV **par joueur** grimpait avec la taille du groupe. Co-op simulé : Sanctuaire du Dragon 100% solo → ~0% à 3-4 joueurs. Corrigé en **quasi-linéaire** (`hpMult = np*(1+(np-1)*0.12)*lvlMult`, atkMult 0.5→0.35), solo inchangé. Aussi : **exposant de niveau `lvlMult` 1.8→1.6** (se composait avec les gros PV de base des boss end-game) et **DEF en `sqrt(lvlMult)`** — la DEF montait au même rythme que les PV et finissait par DÉPASSER l'ATK des joueurs (dégâts `atk-def` floorés à 1 → boss Nv40+ **intouchable**, pas juste tanky). Le raid (même `initMonster`) en bénéficie.
- **Boss finaux surtunés** (`dungeons.ts`) : forge_lord (PV 2800→1600, atk 110→90) et void_king (PV **7000**→2000, atk 220→100) étaient des éponges (void_king scalé à ~180k PV à 4j, combats de 100-300 tours). Leur **double-résistance (phys+mag → ÷2 dégâts pour tous)** réduite à **une seule** (parties mono-type pénalisées, parties mixtes à plein). Forge est désormais jouable par une party équipée ; Citadelle reste le donjon final le plus dur.
- **Nerf Berserker** (`talents.ts`) : vol de vie 15%→12% max (`ber_life` 0.05→0.04/rang) — recadre son auto-suffisance (top DPS + survie parfaite en sim passif) sans toucher son identité DPS.

**Trous de progression d'items comblés** (`analyze-progression.ts` les a localisés) : **aucune arme entre Nv20 et Nv30**, **aucune armure entre Nv15 et Nv32** — on entrait au volcan (Nv24) avec le gear du Nv15, ce qui aggravait le mur. Ajout d'un **set de transition « Marais-Braise » Nv22-24** (`items.ts`+`crafting.ts`+`icons.ts`) : 4 armes (warlord_axe/swiftwind_bow/emberflow_staff/marsh_cane, ATK ~44) + 3 armures par poids (warplate/scout_leathers/mystic_garb), craftables avec des matériaux du marais + entrée du volcan. Courbe lissée : armes 32→46→62, armures 158→204→260.

**Constats de progression (analyse, non « corrigés » — à surveiller)** : courbes d'**artisanat** et de **récolte** saines (~4-5 actions par niveau de métier). Mais l'**XP global est très end-loaded** : Nv40-50 = **81% du grind total** (Nv45→50 seul = 56%), et tous les biomes sont débloqués dès Nv28 → le end-game (Nv40-50) est un très long grind sans nouvelle zone. Piste si trop punitif : adoucir le multiplicateur `1.18` post-Nv30 dans `xpToNext`.

Constats clés (tour-par-tour, Nv.50 maxé) : toutes les **sous-classes** sont saines (100% survie, endHP 36-100%) ; les **bases** Mage/Archer faibles à 50 mais normal (on ascensionne à 20) ; **Berserker** cumule top-3 DPS + survie parfaite (vol de vie passif) = à surveiller sans nerf urgent ; les 4 Soigneurs paraissent 0% en sim **passif** (leur kit est 100% actif) → juger au tour-par-tour uniquement. ⚠️ Le sim co-op ne modélise pas encore le **soin de groupe** des soigneurs en donjon → winrates absolus des donjons Nv.30+ pessimistes (le fix de scaling reste valide, mesuré en relatif).

### Passe de mesure de la refonte saisonnière (fait, C) — trois biais du harness

Le harness disait des choses fausses parce qu'il mesurait les mauvais sujets.
Corrigé, et **à ne pas réintroduire** :

1. **La référence de chasse restait Archer de BASE jusqu'au Nv.50** — la classe
   la plus faible du jeu à 50 (2% de survie), justement parce qu'on ascensionne
   à 20. Elle ascensionne maintenant (`played()`). Effet : Nécropole Nv.30
   **16% → 70%**, volcan 72% → 80%. Le « mur de la crypte » n'existait pas ; il
   décrivait un personnage que personne ne joue.
2. **La composition de groupe n'était pas cumulative** : la rotation
   `[guerrier, mage, soigneur, archer]` ne mettait un soigneur qu'à partir de
   3 joueurs. La Forge Infernale sortait `0% / 6% / 100% / 33%` — une courbe qui
   suivait la présence du soigneur, pas l'effectif. Ordre cumulatif désormais
   (`guerrier → +soigneur → +mage → +archer`).
3. **`turns` renvoyait `maxTurns` en dur** : la colonne affichait 120 pour tout
   le monde, quelle que soit la durée réelle. Les combats font en fait 17 à 46
   tours (et non « 100-300 » comme noté ailleurs dans ce fichier).

Deux mesures ajoutées : `season()` (artefact/Relique/prestige, cf. « Empilement
des buffs ») et le **Rituel du Néant par sous-classe**, jamais simulé jusqu'ici.

**Résultats à traiter** (aucun correctif appliqué, ce sont des constats) :
- **Le Néant ne discrimine plus.** Dès artefact + Relique ★5, les 16
  sous-classes le battent à ≥97% ; six (Berserker, Chevalier Noir, Cryomancien,
  Prêtre de l'Aube, Moine, Oracle) le battent à **100% sans aucune saison**. Il
  est calibré sur la seule montée en stats, or un combat long est gagné par le
  sustain, pas par les stats. Levier : plafonner les soins/vol de vie pendant le
  rituel, pas gonfler ses PV.
- **Les gros groupes sont encore punis.** Forge Infernale en gear de craft :
  `0% / 100% / 99% / 25%` de 1 à 4 joueurs. L'ATK du boss monte de +35% par
  membre (`atkMult`) alors que chaque membre garde une seule barre de vie et que
  le débit du soigneur, lui, ne monte pas. Le passage 0.5 → 0.35 avait réduit le
  problème, pas supprimé.
- ~~**Falaise d'Abysses (endless) au palier 50**~~ — **fausse alerte, deux
  artefacts de mesure cumulés** : la référence était l'Archer de BASE, et la
  liste d'étages testés (10/20/30/40/50…) ne contenait **que des multiples de
  5**, or `generateEndlessMonster` fait un BOSS tous les 5 étages (×2 PV, ×1.5
  ATK). On ne mesurait que des boss. Avec un Chasseur maxé et des étages
  intercalés : 100% jusqu'au 57, boss du 60 à 54%, boss du 75 à 3%. C'est une
  courbe de score, pas une marche. Rien à corriger.
- **Les donjons de fin ne sont PAS cassés** : le `0%` de la Citadelle Abyssale
  mesure un groupe en gear de craft au niveau minimum. Avec un groupe réellement
  équipé (Nv.50 maxé + artefact + ★5), Forge et Citadelle sont à **100% de 1 à
  4 joueurs**. C'est une porte d'entrée, pas un mur.

### Correctifs d'équilibrage end-game (fait, C) — le craft doit suivre jusqu'à 50

Constat de l'utilisateur, confirmé par les données : **un joueur gardait le même
équipement du Nv.36 au Nv.50**. La dernière arme du jeu était le Sceptre
Nécrotique (Nv.36) ; côté armure, plus rien après `void_mantle` (42) ; côté
bijou, plus rien après `primordial_crown` (45). Or la tranche 40-50 pèse la
majorité du temps de jeu : le craft cessait d'exister pile là où le joueur passe
le plus de temps.

**Deux paliers ajoutés** (`items.ts` + `crafting.ts` + `icons.ts`), 11 objets :
- **« Givre du Vide » Nv.40** — 4 armes (78/74/76/70 ATK), 1 armure (51/245),
  1 bijou (12/12/120). Se fabrique avec les ressources de l'**Abysse** (cristal,
  lotus des glaces, poussière du vide) : le biome final s'ouvre au Nv.38, on y
  entre avec le stuff de la Nécropole et on en ressort avec le sien.
- **« Primordial » Nv.46-48** — 4 armes (92/88/90/84 ATK), 1 armure (64/300).
  Coûte des **Âmes de Boss** : la dernière marche se gagne au Sanctuaire (CD 24h)
  ou en Citadelle, pas à la récolte. Volontairement le palier le plus long.

Courbe d'armes lissée : 46 (Nv.22) → 62 (30) → 68 (34) → **78 (40)** → **92 (46)**.
Armures : 198 → 260 → 312 → **340** → 370 → **428** (score `def×2 + hp`).

⚠️ **L'Égide primordiale n'a PAS d'élément**, exprès. Une armure `light` prend
+50% des attaques `dark` (`getElementMult`) et l'Abysse — la zone où on porte ce
set — est intégralement peuplée de monstres sombres : la meilleure armure du jeu
aurait été un handicap là où on la porte (-36 points de winrate, mesuré). Les
ARMES du palier restent `light`, donc +50% contre ces mêmes monstres.

**Rituel du Néant recalibré**, parce qu'il ne faisait plus barrage du tout :
1. `BEST_WEAPON` était une **table écrite en dur** figée sur le palier volcanique
   (Nv.30-32). Le palier Nécropole était sorti sans qu'on y touche : le « joueur
   idéal » sur lequel se calibre le boss se battait avec une arme deux paliers en
   retard, et le mur s'effondrait un peu plus à chaque ajout de contenu. Remplacé
   par `bestGear()`, **dérivé d'`ITEMS`** — tout nouvel objet met le boss à jour
   tout seul.
2. **`ASCENSION_SUSTAIN_MULT = 0.60`** : le Néant draine. Vol de vie,
   régénération, soins de compétence, boucliers et procs de set sont ramenés à
   60% pendant le rituel (`combatTurn` opt `sustainMult`). **Les potions ne sont
   pas touchées** — elles sont en nombre limité, donc elles récompensent la
   préparation sans dériver avec la durée du combat. Un mur calibré sur les
   STATS ne triait que par archétype : sur un combat de centaines de tours, les
   classes à sustain gagnaient quels que soient les PV du boss.
3. **Dégâts du boss +30%** (`s.maxHp / 6` → `/ 4.6`, `s.def * 0.6` → `* 0.78`),
   valeur balayée en simulation (`SWEEP=1`) sur 16 sous-classes × 3 profils.

4. **`NEANT_LEGACY` déplacé de `AscensionCard.tsx` vers `ascension.ts`.** Il
   vivait dans le composant React, donc **les harnais ne pouvaient pas s'en
   servir** : ils mesuraient le rituel avec des ultimes à 3s de cooldown là où
   le jeu les remet à 20-35s. Toutes les mesures du Néant portaient donc sur un
   joueur plus fort que le vrai. Maintenant en logique pure, vu à l'identique
   par le jeu et par la simulation.
5. **Quatre sous-classes manquaient à `NEANT_LEGACY`** — Sentinelle,
   Nécromancien, Piégeur, Oracle, ajoutées après l'écriture de la table. Leur
   finisher restait à 3s pendant le rituel quand les douze autres remontaient à
   20-35s. Ajoutées, et `neutralizeForNeant` neutralise désormais **toute**
   compétence portant une `resource`, listée ou non (repli 25s) : une classe
   future ne peut plus passer au travers.

Résultat mesuré (winrate, 16 sous-classes, règles du rituel appliquées) — avant :
six classes le battaient à **100% sans aucune progression de saison**, tout le
monde à 100% avec. Après :

| Profil | avant | après (min / médiane / max) |
|---|---|---|
| Nv.50 gear maxé, aucune saison | médiane 71% | 0% / **2%** / 72% |
| + artefact grille + Relique ★5 | 100% partout | 0% / 37% / 100% |
| tout maxé (artefact + ★10 + prestige 5) | 100% partout | **88%** / 100% / 100% |

C'est le contrat de la feature : infranchissable sans équipement à jour,
franchissable par **toutes** les classes avec.

⚠️ Le « Prêtre de l'Aube à 100% sans saison » signalé au passage précédent
**n'existait pas** : c'était l'artefact de mesure ci-dessus (sa Nova à 3s au lieu
de 30s). Il est en réalité à 0% sans saison. Ne pas le nerfer.

Écart résiduel assumé : à investissement égal (gear maxé, aucune saison),
Berserker 72%, Piégeur 56%, Voleur 55% et Cryomancien 55% passent là où les
autres sont à 0-15%. Ce sont les quatre profils burst/esquive, qui ne dépendent
pas du sustain bridé. Le choix de classe pèse donc à ce palier — jugé acceptable
plutôt que d'aplatir les identités.

**Donjons : `atkMult` 0.35 → 0.28 par membre** (`dungeonService.initMonster`).
Les PV du boss montent de +12% par membre mais son ATK montait de +35% : à
4 joueurs il frappait 2,05× plus fort alors que chaque membre garde UNE barre de
vie et que le débit du soigneur ne monte pas. Forge Infernale en gear de craft :
`0% / 100% / 99% / 19%` de 1 à 4 joueurs — le groupe complet était puni d'être
complet. Après : **72% à 4 joueurs**, toujours plus dur qu'à 2, sans inverser la
courbe. ⚠️ Miroir à tenir dans `scripts/balance-sim-turns.ts` (`dungeonScale`).

Effet du lot sur la chasse en Abysses (Chasseur en gear de craft, sans saison) :
Nv.40 17% → **25%**, Nv.50 17% → **40%**. Dur, mais plus une porte fermée — et
c'est le craft du biome qui l'ouvre, pas le niveau.

## Amusement — 3 features (fait, C)

- **Maîtrise des biomes** (`game/mastery.ts`, nouveau) : chaque kill compte pour le biome courant (`p.biomeKills`, migré). Paliers 100/500/1500/4000 → titre (`Novice/Familier/Vétéran/Maître/Légende · <Biome>`, ajouté à `unlockedTitles`) + **bonus permanent XP/Or dans ce biome** (+5/10/15/25%, appliqué dans `grantMonsterRewards`). But concret au farm end-game (Nv.40-50 = 81% du temps, sans nouvelle zone). Affiché : bandeau dans HuntCard (biome courant) + liste complète dans MapCard + toast au palier franchi (`HuntRewards.masteryUp`).
- **Faille (combat moins passif)** (`combat.ts` `combatTurn`, `VULN_MULT=1.5`) : quand le monstre est **gelé/étourdi** en début de tour, les dégâts offensifs sont ×1.5. Récompense poser un contrôle puis burst (gel cryo, étourdissement moine à Combo plein, sets givre). Badge « ⚡ FAILLE » clignotant dans HuntCard. Hunt/adventure uniquement (le donjon a déjà son stagger).
- **Lisibilité phys/mag** : indicateur d'**efficacité d'arme** 🟢/⚪/🔴 dans HuntCard (calcul `getElementMult × getDmgTypeMult` de l'arme vs le monstre en cours) — le joueur voit s'il tape fort/faible avant d'agir. Explication (éléments + faille) dans le Wiki (onglet Bestiaire).

## Objectif de guilde collectif (fait, C)

Objectif hebdo partagé par toute la guilde (`groupsService.ts` `GuildGoal`/`freshGuildGoal`/`contributeGuildGoal`, tourne par `weekId % roster`, cible qui s'adapte à la taille de guilde). Métrique = kills. **Écriture Firestore économe** : chaque kill incrémente un compteur LOCAL (`p.guildGoalKills`, combat.ts), flushé par **delta à la sauvegarde débounced** (`savePlayer`, delta capturé+remis à zéro AVANT le `setDoc` joueur pour éviter le double-comptage au reload) — pas une écriture par kill (quota). Atteint → coffre réclamable 1×/membre ayant contribué (`p.settledGuildGoals`, reward or+fateCoins+matrice + XP de guilde), UI dans `GuildCard` (barre de progression + bouton réclamer). Règle RTDB/Firestore `guilds` update déjà permissive.

## Anti-macro chasse retiré (C)

La détection de « rythme de clics robotique » (variance des intervalles) dans `HuntCard` bloquait le spam-clic légitime (annulait le combat + réappliquait le cooldown). Retirée à la demande — le jeu reste client-authoritative de toute façon (voir Sécurité), la triche solo n'était pas empêchée par ça.

## Ressources d'archétype en Endless (fix, C)

Les ressources (mana/rage/combo/ferveur/…) ne fonctionnaient PAS en Abysses : le solo (`EndlessCard`) appelait `combatTurn` **sans** `resourceType`/`resourceAmount`, et le multi (`endlessService`) a un combat maison qui gate les skills au cooldown seul. Corrigé des deux côtés : `RunState.pool`/`lastAction` (solo) et `EndlessPlayer.pool`/`lastAction` (multi) threadés, gating par ressource (bouton grisé si insuffisant), scaling combo/grâce (consomment tout le pool), gains par tour (combo/mana/surcharge/tempo/grâce/corruption/traque au tour joueur ; rage/ferveur/sève au tour du monstre dans `executeEndlessMonsterTurn`). Barres de ressource ajoutées aux UI solo+multi.

## Nouvelles sous-classes (fait, C)

Deux ascensions ajoutées, **entièrement data-driven** (auto dans l'écran d'ascension `TalentCard` et le Wiki via `getAscensions`/`CLASS_LIST`, aucun câblage UI) :
- **Sentinelle** (🛡️, ascension Guerrier) : tank de CONTRÔLE (vs le Paladin protecteur) — épines (renvoi ×6%/rang), Rempart d'épines (bouclier+taunt), Représailles (×2.2+soin). Plus haute DEF/PV des guerriers.
- **Nécromancien** (💀, ascension Mage) : caster DoT/poison + drain (vs Pyro burst / Cryo contrôle) — Éclat nécrotique (poison), Putréfaction (armorPen +6%/rang), Vague d'âmes (×2.8 + poison + 15% drain), **+ invocation « Lever un mort »** (serviteur qui frappe 0.5×ATK/tour, 4 tours).
- **Piégeur** (🪤, ascension Archer) : skirmisher poison/esquive (vs Voleur combo/crit, Chasseur armorPen, Barde support) — Piège explosif (×2.0+poison) → Embuscade (×2.6+poison fort), esquive cumulée +21%. Inné = famille archer (+6% double frappe).
- **Oracle** (🔮, ascension Soigneur) : healer de protection (vs Prêtre grâce, Druide sève, Moine combo) — Bouclier prophétique (18% PV), Clairvoyance/Foi (DEF/réduc, le plus solide), Jugement (×1.8 lumière + 15% soin). Inné = famille soigneur (+5 régén).

**Ressources d'archétype des 4 nouvelles (C)** : elles ont désormais chacune leur jauge exotique (comme les 12 sous-classes d'origine), plus de simple cooldown. Câblé partout (`classResourceType`, `RESOURCE_INFO`, `RESOURCE_META` HuntCard, gains dans `combat.ts` = hunt/aventure/endless-solo + `endlessService.ts` = endless-multi approximé) :
- **Vindicte** 🌵 (Sentinelle) : se charge en encaissant (comme la Rage, tank vengeur) → Représailles 50.
- **Âmes** 👻 (Nécromancien) : se charge quand le **poison ronge** la cible (chaque tick, flag `poisonTicked`) → Vague d'âmes 40. **Corrige le bug** : la Vague coûtait 40 Mana mais `classResourceType('necromancer')` renvoyait `null` → jauge jamais chargée.
- **Pièges** 🪤 (Piégeur) : se charge en **frappant une cible empoisonnée** (`hitsDealt && wasPoisoned`) → Embuscade 60.
- **Présage** 🔮 (Oracle) : se charge quand un **bouclier absorbe** ou qu'un **soin** passe (`shieldAbsorbed || healDone`) → Jugement 50.
En multi (endlessService), Âmes/Pièges approximés sur l'action offensive (le combat multi ne modélise pas le poison sur le monstre), Présage sur le soin, Vindicte sur l'encaissement.

**Invocation Nécromancien (C)** : nouveau mécanisme `CombatState.minion`/`minionPow` dans `combat.ts` — un serviteur frappe en fin de tour (comme brûlure/poison), posé par `ActiveSkillDef.summon`. Actif hunt/aventure/endless-solo (le donjon serveur n'a pas les altérations d'état).

Chaque arbre = **+21 rangs propres** (base 27 → 48, budget cible du Nv.50, cf. équilibrage des arbres ; `necro_grave` 5→4 pour caser le nœud d'invocation). Innés câblés dans `talentMods` (sentinel=guerrier -10% dégâts, necromancer=mage +6% crit ; trapper/oracle héritent des innés de famille). Validés par le harness (finishers gated par ressource) : Sentinelle 100%/endHP 51%, Nécromancien 100%/38%, **Piégeur 100%/46%**, **Oracle 100%/97%** — tous dans les bandes cibles.

## Combat — bouclier & états (fait)

`combat.ts` : `CombatState { shield, burn/burnPow, poison/poisonPow, chill }` threadé dans `combatTurn` (in/out via `TurnResult.state`). Compétences (`ActiveSkillDef.status`) et procs de set (`sets.ts`) posent brûlure/gel/poison/bouclier. **Uniquement hunt/adventure** — le donjon serveur n'a pas encore ces mécaniques.

---

## Collaboration Claude ↔ Gemini (éviter les conflits)

L'utilisateur travaille avec **Claude** (création, rendu, ressenti, UI qui plaît) **et Gemini** (modifications mécaniques, données, logique). **Règle : ne jamais éditer les mêmes fichiers en parallèle.**

- **Claude possède** : rendu/UI/feel → `icons.ts`, `ItemIcon.tsx`, `sets.ts`, `combat.ts`, cartes visuelles existantes (Hunt, Talent, Equipment, Market, Endless UI…), refontes d'UI.
- **Gemini possède** : données/logique isolées → nouveaux fichiers de features, `dungeons.ts`, `biomes.ts`, `monsters.ts`, `enchant.ts`, services firebase, et le **câblage** (`types.ts`, `player.ts`, `uiStore.ts`, `WindowManager.tsx`, `commands.ts`) — sauf indication contraire. **Exceptions : `endless.ts` + `endlessService.ts` (endless solo & multi) = Claude** (voir #12) ; **`pvpDuelService.ts` (duels 1v1/2v2 temps réel) = Claude** (voir #15), remplace l'ancien `duelService.ts` (supprimé, mort).
- **Fichiers partagés à haut risque** (`types.ts`, `player.ts`, `items.ts`) : un seul owner à la fois par tâche ; annoncer avant d'éditer. Gemini ajoute en **append** dans `items.ts`.
- Après chaque lot : `npx tsc -b` doit passer.

---

## Roadmap v2 (le plan d'équilibrage est déjà appliqué)

> ✅ **FAIT** (G) **RESET GLOBAL prévu** : bouton ajouté dans le Panel Admin qui déclenche la réinitialisation (en posant le flag `lastWipe` sur `system/config`). Dans `playerService.ts`, lors du chargement, si un joueur a été créé avant `lastWipe`, il est refusé (ce qui force l'app à le rediriger vers la création de perso).
>
> ✅ **FAIT** (C) **WIPE TOTAL** (`adminService.triggerFullWipe`) : en plus du `lastWipe`, vide `leaderboard`/`guilds`/`endlessScores(+Multi)` (Firestore) et `chat` entier (RTDB) — couvre classement, classement Abysses, saison PvP (dérivée de `leaderboard`), guildes, chat tous canaux. Stats/succès repartent à zéro car portés par le doc joueur, écrasé à la recréation. Statut **Vétéran**/**Admin** transféré via `localStorage` (`rptext.legacy.*`/`rptext.wasAdmin.*`) posé dans `playerService.loadPlayer()` **au moment où l'ancien doc est encore lisible** — d'où `cleanupOrphanedPlayers()` (bouton « 🧹 Purger comptes fantômes ») **volontairement séparé et manuel**, à lancer seulement après un délai de grâce : il supprime les docs `players/*` encore `createdAt < lastWipe` (= pas reconnectés depuis), et un doc supprimé trop tôt ferait perdre Vétéran/Admin à qui revient après coup.

Répartition proposée (C = Claude / G = Gemini) :

| # | Tâche | Owner | Fichiers |
|---|-------|-------|----------|
| 1 | ✅ **FAIT** (C) : profil public en cliquant un nom du classement (PlayerProfileModal + fetchPublicProfile) | — | LeaderboardCard, PlayerProfileModal, socialService |
| 2 | Titres gagnés via succès, donnant de petites stats, **choisis** (plus modifiables) | G données + C UI | achievements.ts, types.ts, ProfileCard |
| 3 | ✅ **FAIT** (G) : Abysses = biome **« vide » sombre** (pas neige), dur pour niv.28 | — | biomes.ts, monsters.ts, Background, Scenery |
| 4 | ✅ **FAIT** (C/G) : Durabilité = montant fixe par **fin de combat** (hunt) / par **manche** (donjon) | C hunt + G donjon | combat/HuntCard, dungeonService, player.ts |
| 5 | ✅ **FAIT** (C) : refonte UI carte **Enchantement** (style verre, ItemIcon, sélecteur de runes) | — | EnchantCard.tsx |
| 6 | ✅ **FAIT** (Claude) : équip après ascension + retrait blocklist OP | — | player.ts |
| 7 | ✅ **FAIT** (G) : Lier récompense quête journalière à la vraie récompense journalière | — | quests.ts, daily.ts, QuestsCard |
| 8 | Succès plus durs, titres en récompense | G | achievements.ts |
| 9 | ✅ **FAIT** (G) : `talents` dans le Help + **cooldowns de skills séparés selon puissance** (hunt+donjon) | G logique + C affichage | commands.ts, HuntCard, dungeonService |
| 10 | ✅ **FAIT** (G) : Donjon : effets d'objets pris en compte, équilibrage, synchro niveau (haut niv. + fort), **init cooldown pour tous les participants**, clé → **popup coffre OUI/NON** en fin (au lieu de doubler) | G | dungeonService, DungeonCard |
| 11 | ✅ **FAIT** (G) : Reset arbre → reset aussi la **sous-classe** (rechoisir) | — | talents.ts resetTalents, player.ts |
| 12 | ✅ **FAIT** (C, tout) : Endless aligné sur le style des autres cartes + **Solo & Multi co-op RTDB** (calqué sur donjon : lobby/prêt/tour par tour, mais **étages infinis** jusqu'au wipe) + classements **Solo/Multi** (double collection Firestore). **C a repris la logique multi** (voir note ownership) | C (UI+logique) | EndlessCard, endlessService (RTDB `endlessSessions/`), endless.ts, types.ts/player.ts (`endlessSessionId`/`settledEndless`) |
| 13 | ✅ **FAIT** (G) : Items du **Fate Shop** un peu plus chers | — | FateShopCard |
| 14 | ✅ **FAIT** (C) : Marché multi-sélection de vente (grille A→Z + icônes, prix ×valeur) | — | MarketCard |
| 15 | ✅ **FAIT** (C) — **vrai duel temps réel** tour par tour avec compétences (1v1 + 2v2, voir section dédiée) | — | pvpDuelService (new), DuelCard |
| 16 | Niveaux de guilde plus clairs, **CD boss de guilde dans la carte Cooldown**, guildes sur **invitation** (pas ouvertes) | G | groupsService, GuildCard, CooldownCard |
| 17 | ✅ **FAIT** (C) : Leaderboard blocs **EN LIGNE** / **INACTIF** séparés | — | LeaderboardCard |
| 18 | ✅ **FAIT** (G) : Carte **« Concoction »** : potions d'appât de mobs, mini-jeu | G logique + C UI | concoction.ts (new), ConcoctionCard (new) |
| 19 | ✅ **FAIT** (G) : Noms des **sous-classes en français** dans le jeu | — | classes.ts / UI |

**Forge** : ✅ **FAIT** (C) — filtres par 4 classes (Guerrier/Archer/Mage/Soigneur) sur armes+armures, badges de poids d'armure (Tissu/Cuir/Plate/Universel), labels de classe précis. Grosses haches = warrior-only via `classes`. (Reste possible : nouvelles armes archer type dagues/petits arcs → **G** dans items.ts si voulu.)

### Reste côté Claude
- ✅ **#12** Endless complet — UI + **co-op multi RTDB** (Claude a repris la logique, cf. ci-dessous) · ✅ icônes partout (0 fallback) + registre monstres (`monsterIcons.ts`/`MonsterIcon`) · ✅ **Équipement** « Dans le sac » repliable · ✅ **Mobile** (dock+menu, plein écran) · ✅ **Chat** messagerie sans `/w` · ✅ **Inventaire** : popup de vente (quantité/validation), recherche+tri, **verrou anti-vente** (`lockedItems`) · ✅ durabilité ajoutée aux 5 gear qui en manquaient.
- ✅ **Objets instanciés (fait)** : chaque pièce de gear a une **clé d'inventaire unique** `baseId[:qXXX]:i<iid>`. Le tag `:i<iid>` est purement identitaire — `getItem` et `id.split(':')[0]` l'ignorent (ni quality `q...` ni baseId), donc ItemIcon/lookups inchangés. Helpers dans `items.ts` : `isGearId`, `hasInstanceTag`, `mintInstanceId`, `addItemToInventory`. `addItem` frappe une clé unique par pièce de gear (jamais empilé) → étoiles/durabilité (`gearStars`/`gearDurability`, toujours keyées par la clé complète) **propres à l'exemplaire** et **conservées à la revente**. `marketService.Listing` transporte `stars`/`durability` ; MarketCard les retire au vendeur et les rend à l'acheteur (badge ★ affiché). Migration `migratePlayer` (flag `instancedGearVersion`) : éclate le gear empilé + instancie l'équipé. Sites de loot/récompense (loot combat, coffre donjon, lootbox, daily/achievements/season/quests) routés via `addItem`/`addItemToInventory`. **Runes/enchants aussi instanciés** : `p.enchants` re-keyé de slot → **clé d'instance** (`enchant.ts`, `deriveStats`, `EnchantCard`, migration flag `enchantsInstancedVersion`) → les runes suivent l'objet (déséquipement + revente marché, `Listing.enchants`). **Étoiles ★ affichées** à côté du nom dans l'inventaire et le sac de la carte Équipement ; icône `upgrade_matrix` (`ItemIcon`) dans le bouton Améliorer. ✅ **Verrou anti-vente** étendu au **marché** et au **craft** (matériau verrouillé bloque la recette).
- **#4** (part hunt) durabilité par fin de combat côté client si **G** ne le prend pas.

> ⚠️ **Ownership modifié (#12)** : à la demande de l'utilisateur, **Claude possède désormais l'endless multi** (logique + UI), y compris `endlessService.ts` (moteur RTDB `endlessSessions/`), calqué sur `dungeonService`. Gemini ne touche plus à endless multi.

### Reste côté Gemini (voir prompts fournis)
- **#2** titres (données) · **#3** biome vide · **#4** durabilité donjon · **#7** quête↔daily · **#8** succès durs+titres · **#9** cooldowns skills séparés (donjon) + `talents` dans Help · **#10** donjon (effets objets, équilibrage, sync niveau, cooldown participants, clé→coffre popup) · **#11** reset arbre = reset sous-classe · **#12** ✅ **repris par Claude** (ne plus toucher) · **#13** ✅ fait · **#15** ✅ fait (Claude) · **#16** guilde (niveaux clairs, CD boss dans Cooldown, invitations) · **#18** Concoction (logique) · **#19** noms sous-classes FR.
- **RESET GLOBAL final** : flag `migratePlayer` → tous les joueurs au choix de classe (niveau 0).

---

## Sécurité (repo public + GitHub Pages)

Audit fait, correctifs appliqués et **testés contre l'émulateur** :
`npm run test:rules` (Firestore, 33 tests). ⚠️ `npm run test:rules:rtdb` existe
mais **l'émulateur RTDB ne démarre pas dans le conteneur de dev** (il échoue
aussi sur le fichier de règles d'origine — c'est l'environnement, pas les
règles) : les règles RTDB sont relues et validées avec le parseur `cjson` de la
CLI, pas exécutées. À faire tourner sur une machine avec un vrai accès réseau.

- **Firebase apiKey/config = publics par design** (`import.meta.env.VITE_*`, `.env` gitignoré, seul `.env.example` versionné). La sécurité repose **entièrement sur les règles** (`firestore.rules`, `database.rules.json`), pas sur le secret des clés. Vérifié : aucun secret n'a jamais été commité.
- ⚠️ **NE JAMAIS** autoriser un joueur à écrire `isAdmin` sur son propre doc. `adminFlagUntouched()` + `isAdminUser()`. Bootstrap du 1er admin = console Firebase.
- ⚠️ **`isAdminUser()` doit tester `'isAdmin' in d` AVANT `d.isAdmin`.** L'accès direct (et même `d.get('isAdmin', false)`) **lève une erreur d'évaluation** sur les documents qui ne portent pas le champ — c'est-à-dire tous les joueurs normaux. Ça passait par court-circuit du `||`, mais une règle qui aurait mis `isAdminUser()` en premier opérande d'un `&&` aurait refusé des écritures légitimes. Vu dans les logs de l'émulateur, pas à la relecture.

### Anti-triche : ce que le serveur refuse désormais (`playerSane`)
Le jeu reste *client-authoritative* — Firestore ne peut pas RECALCULER une
progression. Mais il peut refuser l'absurde, et surtout tout ce qui **déborde
sur les autres**. Vérifié côté serveur, donc incontournable par un client modifié :
- **niveau plafonné à 50** (`MAX_LEVEL`) ; devises ≥ 0 et bornées ;
- **kills et prestige monotones** — ce sont les deux axes qui pèsent le plus au
  classement (`power.ts` : prestige ×50). `applyRebirth` remet l'or à 100 et le
  niveau à 1 mais n'y touche jamais, donc la contrainte ne gêne aucun jeu légitime ;
- **`createdAt` immuable** : il suffisait de réécrire sa date de création pour
  **survivre à un wipe global** (`loadPlayer` compare à `system/config.lastWipe`) ;
- **la ligne de classement doit refléter le doc joueur** (niveau, kills,
  prestige, artefact, via un `get()`). Avant, on pouvait laisser son personnage
  intact et n'envoyer qu'une ligne mensongère — tricher le ladder ne demandait
  même pas de toucher à sa sauvegarde. `savePlayer` écrit le doc AVANT la ligne,
  donc le `get()` voit les bonnes valeurs.

Pas de plafond « par delta » sur l'or : une vente au marché se fait à prix libre,
donc un gain légitime peut être arbitrairement gros. Ce qui reste possible :
monter **lentement des valeurs plausibles**. Pour fermer ça il faut déplacer les
gains dans `functions/` (Cloud Functions, plan Blaze, non déployé) — `resolveDuel`
et `buyMarketListing` y sont déjà écrits comme point de départ.

### Ce qui a été fermé côté joueurs
- **Messagerie privée** : les MP vivaient sous `chat/inbox/<pseudo>` avec
  `.read: auth != null` sur tout le sous-arbre → **toutes les conversations
  privées du serveur étaient lisibles par n'importe quel compte connecté**, les
  clés s'énuméraient depuis le classement, et comme les pseudos sont libres et
  **non uniques** (`ProfileCard`), se renommer comme quelqu'un suffisait à
  recevoir ses messages. Re-keyées par **UID de personnage** (`chatService`,
  `ChatCard`, `App`, `ChatNotifs`) ; la règle vérifie enfin la propriété.
  `findUidByName` (socialService) résout le raccourci `/w Nom` via le classement.
- **Chat vandalisable** : `chat` avait un `.write` racine qui cascadait, donc un
  `set(ref('chat'), null)` vidait le serveur. Réservé aux admins ; les messages
  sont en **création seule** (`!data.exists()`).
- **Actions admin RTDB non protégées** : les règles RTDB ne peuvent pas lire
  `isAdmin` (Firestore). Nouveau nœud **`admins/<uid>`**, lisible par tous et
  écrivable **console uniquement**. ⚠️ **À créer à la main au déploiement**,
  sinon « Vider les chats » et « Ouvrir une fenêtre de Raid » seront refusés.
- ⚠️ **NE PAS verrouiller tout `world` sur les admins** : `world/boss` est écrit
  par CHAQUE joueur qui frappe le boss mondial, `world/dungeonOpen` par quiconque
  ouvre un donjon. Seul `world/raid` est administratif.
- **Marché / équipes / guildes** : l'`update` était ouvert à tout compte connecté
  (annuler l'annonce d'un autre, se déclarer hôte d'une équipe, s'approprier une
  guilde). Champs d'identité figés, et le marché n'accepte que
  `status`/`buyerUid`/`soldAt` — un acheteur ne peut plus baisser le prix.
- **Règles mortes supprimées** : `duels` (remplacé par `pvpDuelService`) et
  `gifts` (jamais branché) laissaient `update`/`delete` ouverts sur des
  collections que plus personne n'écrit.

### Risque résiduel, assumé
Sessions temps réel partagées (`dungeons`/`endlessSessions`/`pvpDuels`) toujours
en `.write: auth != null` : les deux camps y écrivent tour à tour, les verrouiller
demanderait des Cloud Functions. Griefing d'une session en cours possible, pas de
vol. Et `power` reste calculé par le client (les règles ne peuvent pas rejouer
`powerScore`) : seul un plafond l'empêche d'écraser l'affichage.
`dangerouslySetInnerHTML` dans `NewsCard`/`PatchNotesModal` n'est pas un XSS
aujourd'hui (source = constante du dépôt) mais le deviendrait si les patch notes
passaient un jour par Firestore. `npm audit` remonte `undici` (Firebase SDK) :
**absent du bundle navigateur**, donc non exploitable ici.

## Règles pour agents

- Toujours `item(id)` (jamais `ITEMS[id]`). Ajouter l'icône dans `icons.ts` en même temps qu'un nouvel objet.
- Toute écriture de save passe par `mutate` (gameStore) ; migrations dans `migratePlayer`.
- Restriction de classe : les objets listent les **classes de base** ; `canEquip` compare à la classe **de base** du joueur (ascension incluse).
- `npx tsc -b` **et** `npm run build` doivent passer avant de conclure.
- **Vérifier en jeu est possible, et c'est attendu pour tout changement visuel.**
  Sans `.env`, `isFirebaseConfigured` est faux : l'app bascule en mode local
  (localStorage), le bouton « Se connecter avec Google » crée un compte local sans
  aucun popup OAuth, et tout le solo est jouable. `npm run dev` + Playwright
  (`/opt/node22/lib/node_modules/playwright`, Chromium `/opt/pw-browsers/chromium`)
  permet donc de piloter le vrai jeu. Cette session y a trouvé des défauts que le
  typecheck ne voyait pas : nœuds de talents incliquables, boutons de combat hors
  écran, quatre modificateurs de Faille sur six qui ne sortaient jamais.
  Pour forcer un état de test : écrire dans `localStorage` (`rptext.player.<uid>`)
  depuis une page, la FERMER, puis rouvrir une page — sinon la sauvegarde débouncée
  de la page encore ouverte écrase le patch. ⚠️ Penser à donner assez de `kills` :
  l'anti-triche de `migratePlayer` re-nivelle tout personnage dont l'XP dépasse
  `kills*50 + donjons*800 + 3000`, ce qui ramenait les persos de test au Nv.10.
  Ce qui reste invérifiable en local : classements, ladder, chat, donjons multi,
  duels temps réel (tout ce qui demande Firestore/RTDB) — le dire explicitement.
- Respecter la répartition Claude/Gemini ci-dessus pour éviter les conflits de merge.
