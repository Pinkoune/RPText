# RPText ⚔️🎲

Un RPG textuel **multijoueur** dans le navigateur, inspiré de **EPIC RPG**, **World of Warcraft** et **Final Fantasy XIV**.

Une seule barre de commande au centre (comme un site d'IA) : on tape des commandes
(`hunt`, `profile`, `map`, `casino`…) qui ouvrent des **cartes flottantes** éphémères.
Au rechargement de la page, l'interface revient à son état neutre — mais la progression
est sauvegardée dans Firebase.

## ✨ Fonctionnalités

- **Connexion Google** (Firebase Auth) — avec un **mode local** automatique si Firebase n'est pas configuré (pratique pour développer sans clés).
- **Cycle jour/nuit en temps réel** : le fond d'écran (soleil, lune, étoiles) et les monstres/loot changent selon l'heure réelle (Aube / Jour / Crépuscule / Nuit).
- **Biomes** débloqués par niveau (forêt, plaines, montagnes, désert, marais, abysse gelé). Le fond change selon le biome.
- **Combat interactif** au tour par tour (`hunt`, cooldown 90s) : Attaquer, **capacité de classe**, Potion, Fuir — les monstres frappent fort. Montée de niveau, inventaire, boutique.
- **Classes distinctes et équilibrées** : armes restreintes par classe + **trait inné** (Guerrier −10% dégâts subis, Mage +6% critique, Archer +6% double frappe, Soigneur +5 PV/tour). Carte d'équipement dédiée.
- **Card-Jitsu** : mini-jeu de cartes PvP (feu>neige>eau>feu) avec mise en or, contre une IA.
- **Carte du monde** visuelle : régions reliées par un chemin, débloquées par niveau, voyage au clic, le décor change selon le biome.
- **Récolte de ressources** (à la EPIC RPG) : bûcheronnage, minage, pêche, cueillette selon le biome (bois, pierre, fer, mithril, cristal, poisson, herbes…). **Une seule récolte à la fois** (cooldown partagé) qui fait monter un **niveau de farm global** débloquant les ressources rares et le rendement. Carte `experience` dédiée (aventure + farm).
- **Donjons** à étapes : enchaînement de combats (PV non régénérés entre les salles) + boss final, gros butin, longue récupération.
- **Talents par classe** : 1 point de talent par niveau, à investir dans des passifs (critique, réduction de dégâts, esquive, double frappe, régénération, furie…) qui modifient le combat.
- **Craft / Forge** : transforme matériaux de chasse **et ressources récoltées** en équipement, potions et nourriture (recettes exigeantes — progression longue).
- **Marché entre joueurs** (trade non abusif) : vente/achat d'objets avec **taxe de 10%** (puits d'or), max 5 annonces, niveau 5+ requis.
- **Quêtes** journalières et hebdomadaires + récompense de connexion quotidienne.
- **Gambling — le « Casino du Destin »** : pile/face, **blackjack**, machine à sous, et une **roue liée au cycle jour/nuit** (segments x10 la nuit). Monnaie premium « Fate Coins ».
- **Multijoueur** :
  - **Duels PvP** au pile/face avec mise en or (le gagnant rafle tout).
  - **Boss mondial** partagé : **une attaque puissante toutes les 2h** par joueur, PV synchronisés, butin partagé au prorata des dégâts, classement des assaillants.
  - **Chat mondial** temps réel.
  - **Présence** (qui est en ligne) + **classement** global.
- **Sons + musique d'ambiance** procéduraux (Web Audio, aucun asset) : l'ambiance musicale change selon le biome et la phase. Bouton mute.
- **Capacités actives de classe** : chaque classe a une capacité spéciale (gros dégâts, soin) déclenchable manuellement dans le combat de boss mondial.
- **100% responsive** (mobile, tablette, desktop).

## 🚀 Démarrage rapide

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173. **Sans configuration Firebase**, le jeu démarre en
*mode local* : la connexion crée un héros stocké dans le `localStorage` de l'appareil.
Idéal pour tester immédiatement.

## 🔥 Activer Firebase (Google + multijoueur)

1. Crée un projet sur [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → active le fournisseur **Google**.
3. **Firestore Database** → crée la base (mode production), puis déploie les règles de [`firestore.rules`](firestore.rules).
4. **Realtime Database** → crée la base (pour la présence multijoueur). Note son URL.
5. **Project settings → Tes applications → Web** : copie la config SDK.
6. Crée `.env.local` à partir de [`.env.example`](.env.example) et colle tes valeurs.
7. Relance `npm run dev`. La connexion Google et le multijoueur sont actifs.

> Pense à ajouter ton domaine de prod (et `localhost`) dans
> *Authentication → Settings → Authorized domains*.

## 🕹️ Commandes

| Commande | Alias | Effet |
|---|---|---|
| `hunt` | chasse, h | Combat un monstre du biome/phase actuels |
| `dungeon` | donjon, dj | Donjons à étapes (gros butin) |
| `talents` | skills, competences | Arbre de talents de ta classe |
| `profile` | profil, p | Profil détaillé, éditable (nom + titre) |
| `experience` | xp, exp, level | Niveaux d'aventure et de farm |
| `map` | carte, m | Voyage entre biomes |
| `inventory` | inv, sac | Inventaire : utiliser / vendre |
| `equipment` | equip, gear | Gérer l'équipement (arme/armure/bijou) |
| `cooldown` | cd, recup | Récupérations en cours |
| `craft` | forge | Forger équipement, potions et nourriture |
| `gather` | farm, recolte | Vue d'ensemble des récoltes du biome |
| `chop`/`mine`/`fish`/`forage` | bois/miner/peche/cueillette | Récolter directement une ressource |
| `quests` | quetes, daily | Quêtes journalières/hebdo + récompense quotidienne |
| `casino` | gamble, pari | Casino du Destin |
| `shop` | boutique | Acheter potions & équipement |
| `market` | marche, hv, vente | Marché entre joueurs (vendre/acheter) |
| `heal` | soin | Boire une potion |
| `duel` | pvp | Défier un joueur au pile/face (mise en or) |
| `cardjitsu` | cj, ninja, cartes | Duel de cartes Card-Jitsu (feu/eau/neige) |
| `boss` | raid | Attaquer le boss mondial avec les autres |
| `chat` | tchat | Chat mondial |
| `leaderboard` | classement, top | Joueurs en ligne + classement |
| `help` | aide, ? | Liste des commandes |
| `close` | clear (Échap) | Ferme toutes les fenêtres |

Astuces : `Tab` complète la commande, `↑/↓` rappelle l'historique, `Échap` ferme tout.

## 🏗️ Stack

Vite · React · TypeScript · Tailwind CSS · Framer Motion · Zustand · Firebase
(Auth / Firestore / Realtime Database).

Voir [`GAME_DESIGN.md`](GAME_DESIGN.md) pour l'architecture et la feuille de route.

## 📦 Build & déploiement

```bash
npm run build      # génère dist/
npm run preview    # prévisualise le build

# Déploiement Firebase (firebase.json est déjà fourni)
npm i -g firebase-tools
firebase login
firebase use --add                         # sélectionne ton projet
firebase deploy --only hosting,firestore,database   # site + règles Firestore + règles RTDB
```

Les règles de sécurité Firestore ([`firestore.rules`](firestore.rules)) et Realtime
Database ([`database.rules.json`](database.rules.json)) sont versionnées et déployées
par la commande ci-dessus.

### Cloud Functions (optionnel, anti-triche)

L'état est calculé côté client. Pour une version compétitive, le dossier
[`functions/`](functions/) contient un exemple de **résolution sécurisée de duel**
côté serveur. Nécessite le plan Blaze :

```bash
cd functions && npm install && npm run deploy
```
