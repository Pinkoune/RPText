# CLAUDE.md — RPText

RPG textuel multijoueur web. **Vite + React + TypeScript + Tailwind + Zustand**, backend **Firebase** (Auth, Firestore, Realtime DB) avec **repli localStorage** complet (`isFirebaseConfigured`). Utilisateur FR. Vérif = `npm run build` (le preview live est bloqué par le popup OAuth).

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

- **Firebase apiKey/config = publics par design** (`import.meta.env.VITE_*`, `.env` gitignoré, seul `.env.example` versionné). La sécurité repose **entièrement sur les règles** (`firestore.rules`, `database.rules.json`), pas sur le secret des clés.
- ⚠️ **NE JAMAIS** autoriser un joueur à écrire `isAdmin` sur son propre doc. `firestore.rules` : `players/{uid}` write = `isAdminUser()` OU (`auth.uid==uid` ET `adminFlagUntouched()`) → le flag `isAdmin` ne peut être introduit/modifié que par un admin déjà confirmé (ou la console). Sinon = **prise de contrôle totale** (wipe, écriture sur tous les comptes). Bootstrap du 1er admin = console Firebase. Le re-grant post-wipe marche car l'ancien doc admin (isAdmin=true) existe encore quand `isAdminUser()` le lit.
- `system/*` write = admin only ; `teams`/`guilds` **delete** = host/owner ou admin ; `endlessScores*` write = son propre uid ou admin (pour le wipe).
- **Risque résiduel accepté** = *jeu client-authoritative* : un client modifié peut falsifier ses propres stats/or (Firestore fait confiance au doc) et griefer les sessions RTDB partagées (chat/dungeons/endlessSessions/pvpDuels/world = `.write: auth != null`, les règles RTDB ne peuvent pas lire `isAdmin` de Firestore). Mitigation optionnelle = déplacer les actions à enjeu dans `functions/` (Cloud Functions, plan Blaze, non déployé). Ne pas prétendre que c'est « sécurisé » côté triche solo.

## Règles pour agents

- Toujours `item(id)` (jamais `ITEMS[id]`). Ajouter l'icône dans `icons.ts` en même temps qu'un nouvel objet.
- Toute écriture de save passe par `mutate` (gameStore) ; migrations dans `migratePlayer`.
- Restriction de classe : les objets listent les **classes de base** ; `canEquip` compare à la classe **de base** du joueur (ascension incluse).
- `npx tsc -b` doit passer avant de conclure. Ne pas prétendre « vérifié en jeu » (preview OAuth bloqué) — dire « vérif build seulement ».
- Respecter la répartition Claude/Gemini ci-dessus pour éviter les conflits de merge.
