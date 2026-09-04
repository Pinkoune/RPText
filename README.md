<div align="center">

# RPText

**Un RPG textuel multijoueur qui tient dans une barre de commande.**

Tu tapes `hunt`, une carte s'ouvre, tu combats. Tu tapes `close`, l'écran redevient
vide. La progression, elle, reste.

Vite · React · TypeScript · Tailwind · Zustand · Firebase

</div>

---

## Ce que c'est

Un jeu de rôle textuel dans le navigateur, dans l'esprit d'**EPIC RPG** — mais avec
un vrai combat tactique, un arbre de talents par classe, des saisons, et de quoi
continuer à jouer une fois le niveau maximum atteint.

L'interface n'est pas un menu : c'est **une barre de commande** au centre de
l'écran. Chaque commande ouvre une **fenêtre flottante** qu'on déplace, empile ou
ferme. Rien n'est permanent à l'écran, tout est à un mot de distance.

> **Ça marche sans rien installer côté serveur.** Sans configuration Firebase, le jeu
> bascule en mode local : ton héros vit dans le `localStorage`. Le multijoueur
> s'active en ajoutant des clés.

---

## La boucle de jeu

```
  hunt ──▶ combat au tour par tour ──▶ butin + XP ──▶ craft / équipement
    ▲                │                                        │
    │                └──▶ série de chasse (+40% max)           │
    └────────────────────── plus fort ◀──────────────────────┘
```

Le combat n'est pas un échange de clics. Le monstre **annonce son intention** au tour
précédent — coup lourd, garde, incantation — et tu réponds :

| Action | Effet | Quand |
|---|---|---|
| ⚔️ **Attaquer** | dégâts normaux | par défaut |
| 🛡️ **Parer** | n'encaisse qu'un quart, et **riposte** avec 70% de ce qui a été bloqué | sans risque, d'autant meilleur que le coup est gros |
| ⚡ **Interrompre** | **annule** le coup annoncé et étourdit | un pari : s'il ne préparait rien, tu prends +50% |

S'ajoutent les compétences actives de ta spécialisation, les ressources d'archétype
(Rage, Combo, Mana, Âmes, Présage…), les éléments, les altérations, et la **Faille** —
une fenêtre de dégâts ×1.5 qui s'ouvre quand l'ennemi est gelé ou étourdi.

---

## Progression : six jauges, et une seule qui compte pour la saison

C'est la partie qui distingue RPText d'un jeu de commandes classique. Chaque jauge
monte avec des choses différentes et sert à des choses différentes.

| Jauge | Monte avec | Sert à |
|---|---|---|
| ⭐ **Niveau** (1 → 50) | combat, donjon, récolte, forge, camp | statistiques, 1 point de talent par niveau |
| 🔮 **Artefact** | la **même XP** que ton niveau, **plus le PvP** | ta saison : mods, rang, paliers de passe |
| 🔨 **Métiers** | récolter, forger, concocter | recettes et ressources de meilleur niveau |
| ✧ **Éclats** | succès, passe de saison, artefact au-delà de sa grille | les étoiles de ta Relique |
| 🏅 **Maîtrise** | tes kills, comptés par zone | bonus d'XP et d'or permanent dans cette zone |
| ⚡ **Puissance** | rien — c'est la somme de tout le reste | ta place au classement |

**L'artefact EST la saison.** Il monte sur tout ce que tu fais, donne ton rang
(Bronze → Maître) et remplit la passe. À la rotation, il repart à zéro avec les
classements — mais **ton personnage n'est jamais touché**.

---

## Choisir sa voie

**4 classes de base**, et au niveau 20 une **ascension** vers l'une des 4
spécialisations de ta famille — soit **20 classes** en tout, chacune avec son arbre de
talents complet et sa ressource propre.

| Famille | Spécialisations |
|---|---|
| ⚔️ **Guerrier** | Paladin · Berserker · Chevalier Noir · Sentinelle |
| 🔮 **Mage** | Pyromancien · Cryomancien · Arcaniste · Nécromancien |
| 🏹 **Archer** | Voleur · Barde · Chasseur · Piégeur |
| ❤️ **Soigneur** | Prêtre de l'Aube · Druide · Moine · Oracle |

**3 personnages par compte** : tester une autre voie ne détruit plus celle qu'on a
montée.

---

## Le end-game

Une fois le niveau 50 atteint, la progression continue ailleurs.

- 🕳️ **Le Rituel du Néant** — un boss unique calibré sur un build **parfait**. Ton
  équipement réel ne baisse jamais la barre : si tu n'es pas optimisé, tu perds.
- ✦ **La Renaissance** — repartir du niveau 1 contre un niveau de Prestige
  (+8% ATK/DEF/PV et +10% XP/Or, cumulables 5 fois) et un jeton de changement de
  classe. Familiers, titres, succès, maîtrises et Relique traversent.
- 💠 **La Relique** — **le seul objet qui survit à la renaissance ET aux saisons.**
  Ses cinq premières étoiles donnent des statistiques ; les cinq suivantes donnent
  **un effet au choix parmi trois**, alors deux Reliques ★10 ne jouent pas pareil.
  Elle change de nom et d'apparence en montant, jusqu'à *Relique primordiale*.
- 🌀 **La Faille de la semaine** — un biome et un monstre du jeu revisités par un
  modificateur qui change tous les lundis : Enragé, Colossal, Carapacé, Cœur de
  givre, Voile d'ombre, Verre et lames. Chacun demande d'adapter son build, pas
  seulement d'être plus fort.
- 🎟️ **La passe de saison**, gratuite : dix paliers qui donnent des Éclats, des fonds
  de profil et des titres saisonniers qu'on ne pourra plus jamais regagner.

---

## Le contenu

|  |  |
|---|---|
| 🗺️ **8 biomes** | Forêt, Plaines, Montagnes, Désert, Marais, Volcan, Nécropole de Cristal, Abysses du Vide |
| 🐺 **28 monstres** | avec éléments, faiblesses, résistances et phases d'apparition |
| ⚗️ **215 objets** · **149 recettes** | armes, armures, bijoux, consommables, matériaux |
| 🌟 **147 talents** | répartis sur les 20 arbres de classe |
| 🐣 **11 familiers** | avec leurs capacités passives en combat |
| 🏆 **29 succès** | qui donnent titres et Éclats de Relique |
| 🏰 **5 donjons** | à paliers de difficulté, plus un raid à 12 étages |

Et aussi : cycle jour/nuit réel qui change le décor et les monstres, événements
mondiaux et régionaux, camp hors-ligne, marché entre joueurs, casino, Card-Jitsu,
Abysses infinis, boss mondial partagé, équipes, guildes et objectifs collectifs.

---

## Démarrage

```bash
npm install
npm run dev
```

Ouvre <http://localhost:5173>. **Sans configuration Firebase**, la connexion crée un
héros local — tout le solo est jouable immédiatement.

### Activer le multijoueur

<details>
<summary>Configuration Firebase (6 étapes)</summary>

1. Crée un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication** → active le fournisseur **Google**
3. **Firestore Database** → crée la base, puis déploie [`firestore.rules`](firestore.rules)
4. **Realtime Database** → crée la base (présence, chat, sessions temps réel)
5. **Paramètres du projet → Applications Web** → copie la config SDK
6. Crée `.env.local` à partir de [`.env.example`](.env.example)

> Ajoute ton domaine de production **et** `localhost` dans
> *Authentication → Settings → Authorized domains*.

</details>

---

## Les commandes

Une seule barre, en bas. `Tab` complète, `↑` `↓` rappellent l'historique, `Échap`
ferme tout. La carte `help` cherche parmi les commandes et explique les jauges.

<details open>
<summary><b>Progresser</b></summary>

| Commande | Effet |
|---|---|
| `hunt` | Combattre un monstre du biome et de la phase actuels |
| `rest` | Récupérer ses PV (10 min de récupération) |
| `map` | Voyager entre les biomes |
| `talents` | Arbre de talents, compétences équipées, ascension |
| `equipment` | Équipement, étoiles, comparaison avant d'équiper |
| `craft` · `gather` | Forger · récolter (bois, minerai, poisson, herbes) |
| `experience` · `profile` | Progression et fiche de personnage |

</details>

<details>
<summary><b>Se mesurer</b></summary>

| Commande | Effet |
|---|---|
| `miniboss` | Colosse des Abysses (12 h de récupération) |
| `rift` | 🌀 La Faille de la semaine |
| `mercenary` · `sanctuary` | Contrats et épreuves de fin de jeu |
| `dungeon` · `raid` | Donjons à paliers · raid à 12 étages |
| `endless` | Abysses infinis, solo ou en groupe |
| `boss` | Boss mondial partagé |
| `duel` · `cardjitsu` | Duels PvP temps réel (1v1, 2v2) · Card-Jitsu |

</details>

<details>
<summary><b>La saison et l'après-50</b></summary>

| Commande | Effet |
|---|---|
| `season` | Rang, passe de saison, classement |
| `artifact` | Grille de mods de l'artefact |
| `relic` | Ta Relique et ses Éclats |
| `aura` | Aura de prestige et renaissance |
| `prestige` | *(secret — niveau 50, depuis les Abysses)* |

</details>

<details>
<summary><b>Vivre ensemble</b></summary>

| Commande | Effet |
|---|---|
| `chat` | Chat mondial, canaux et messages privés |
| `team` · `guild` | Équipe (4 max) · guilde et objectifs collectifs |
| `leaderboard` | Qui est en ligne et classement par Puissance |
| `market` · `shop` · `casino` | Marché entre joueurs · boutique · Casino du Destin |
| `quests` · `achievements` | Quêtes et succès |

</details>

---

## Architecture

```
src/
├── game/          Logique pure — aucun React. Le cœur du jeu.
│                  combat, classes, talents, items, saison, artefact, relique…
├── firebase/      Services : joueur, social, donjons, duels, saison…
├── components/    Interface. `cards/` = une carte par fenêtre.
└── store/         Zustand : gameStore (joueur) · uiStore (fenêtres) · fxStore
```

`src/game/` ne dépend jamais de React ni de Firebase : le combat, l'équilibrage et
la progression sont des fonctions pures, testables en Node. C'est ce qui permet
[les harnais de simulation](scripts/README-balance.md) qui font tourner des milliers
de combats pour valider l'équilibrage avant de toucher au jeu.

Les notes de conception détaillées sont dans [`GAME_DESIGN.md`](GAME_DESIGN.md), et
les conventions du projet dans [`CLAUDE.md`](CLAUDE.md).

---

## Build et déploiement

```bash
npx tsc -b && npm run build   # vérification + génération de dist/
npm run preview               # prévisualiser le build

firebase deploy --only hosting,firestore,database
```

Les règles de sécurité [`firestore.rules`](firestore.rules) et
[`database.rules.json`](database.rules.json) sont versionnées et déployées avec le
site.

> **Note honnête sur la sécurité.** L'état du jeu est calculé côté client : un client
> modifié peut falsifier sa propre progression. Les règles empêchent d'écrire chez
> les autres et de s'attribuer les droits d'administration, mais RPText n'est pas
> protégé contre la triche solo. Le dossier [`functions/`](functions/) montre comment
> déplacer une action sensible côté serveur.

---

<div align="center">
<sub>Fait pour une classe de copains, un été.</sub>
</div>
