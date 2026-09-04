# Outil d'équilibrage & ajout de classes

Deux harness de simulation qui importent la **logique de combat réelle** du jeu
(pas de recopie). Bundlés par esbuild (`import.meta.env` stubé → pas d'init
Firebase), exécutés par node.

## Lancer

```bash
# passif (auto-combat, mods permanents uniquement — rapide, backbone DPS)
node_modules/.bin/esbuild scripts/balance-sim.ts --bundle --platform=node \
  --format=cjs --define:import.meta.env='{}' --outfile=/tmp/sim.cjs && node /tmp/sim.cjs

# tour-par-tour (compétences actives, ressources, potions, co-op donjon) — LA VÉRITÉ
node_modules/.bin/esbuild scripts/balance-sim-turns.ts --bundle --platform=node \
  --format=cjs --define:import.meta.env='{}' --outfile=/tmp/simt.cjs && node /tmp/simt.cjs
```

- `balance-sim.ts` → écrit `scratchpad/sim-results.json` (DPS, courbes, gear, éléments).
- `balance-sim-turns.ts` → écrit `sim-turns.json` (winrate/survie AVEC skills, donjons co-op).
- CSV pour Excel : `scripts/balance-output/*.csv` (séparateur `;`, décimales `,`).

Sortie par défaut : `scripts/balance-output/`, surchargeable par `BALANCE_OUT=…`.
(C'était un chemin absolu vers le scratchpad d'une session : les trois harnais
plantaient en `ENOENT` sur toute autre machine.)

### Ce que le harness modélise — et ce qu'il ne modélise pas

Il faut lire chaque tableau en sachant sur QUI il porte, sinon on tire les
mauvaises conclusions. Trois pièges corrigés, à ne pas réintroduire :

1. **La référence de chasse ascensionne au Nv.20** (`played()`). Elle restait
   Archer de base jusqu'au Nv.50 — la classe la plus faible du jeu à 50 (2% de
   survie), parce que personne n'est censé y rester. Les taux de chasse Nv.30+
   décrivaient un personnage que plus aucun joueur ne joue.
2. **La composition de groupe est cumulative** (`guerrier → +soigneur → +mage →
   +archer`). L'ancienne rotation ne mettait un soigneur qu'à partir de 3
   joueurs, si bien que la colonne « taille du groupe » mesurait en fait la
   présence d'un soigneur.
3. **Les axes de saison** (artefact, Relique, prestige) s'appliquent via
   `season()`. Sans eux, tout le harness décrivait un joueur de première semaine
   de saison — or ces axes multiplient ATK/DEF/PV par ~2,5 (voir plus bas).

Toujours pas modélisé : le soin de groupe des soigneurs en donjon (les winrates
absolus de donjon restent pessimistes, le relatif reste valide), les familiers,
les enchantements, les événements.

⚠️ **Garder les formules du harness synchronisées avec le jeu** quand tu changes
le scaling. Miroirs à maintenir :
- `scaleHunt` ↔ `pickMonster` (monsters.ts) — exposant `powerFactor`.
- `dungeonScale` ↔ `initMonster` (dungeonService.ts) — `hpMult/atkMult/defMult`.

## Bandes d'équilibrage cibles (Nv.50, gear maxé, mesuré tour-par-tour)

Une classe **saine** doit tomber dans ces fourchettes vs le boss d'attrition
(`gauntlet(50)`, avec compétences+potions) :

| Métrique | Cible | Rouge (à revoir) |
|---|---|---|
| Winrate survie | 100% | < 90% |
| PV restants (endHP) | 35–100% | pic à 100% partout = trop tanky |
| DPS effectif (passif) | 330–900 | > 1000 (glass cannon) ou < 300 (inoffensif) |

Repères actuels : DPS de 214 (Soigneur) à ~1020 (Pyromancien). Les DPS purs
(Pyro/Arcaniste) tolèrent un endHP bas ; les tanks/soigneurs un DPS bas mais
endHP haut. Une classe qui cumule **top DPS + top survie** (comme le Berserker)
est un signal à surveiller, pas forcément à nerfer.

## Empilement de saison — l'échelle qui écrase les autres

Mesuré (Chasseur Nv.50, gear q150 5★, contre les monstres des Abysses) :

| Profil | ATK | Abysses |
|---|---|---|
| nu (saison 1, semaine 1) | 478 | 48% |
| artefact, grille complète (Nv.62) | 715 | **100%** |
| + Relique ★5 | 786 | 100% |
| + Relique ★10 | 850 | 100% |
| + prestige 5 | 1190 | 100% |
| artefact Nv.300 (fin de saison) | 1393 | 100% |

Soit **×2,9 sur l'ATK** entre un joueur nu et un joueur de fin de saison, et la
**grille d'artefact à elle seule** fait passer le biome final de 48% à 100%.
Toute lecture de difficulté doit préciser à quel profil elle s'applique : le même
contenu est un mur en semaine 1 et une formalité en semaine 8.

## Rituel du Néant

`computeAscensionBoss` se calibre sur un joueur idéal dérivé du joueur réel
(`structuredClone`), donc le boss suit l'artefact et la Relique — mais il ne
compte que **la moitié** du prestige, et l'idéal n'a pas la grille de mods du
joueur. Résultat mesuré : dès l'artefact + Relique ★5, les 16 sous-classes le
battent à ≥97%, et six d'entre elles (Berserker, Chevalier Noir, Cryomancien,
Prêtre de l'Aube, Moine, Oracle) le battent à 100% **sans aucune progression de
saison**. Les combats longs favorisent mécaniquement le sustain : c'est là qu'il
faut agir si on veut que le mur en reste un, pas sur ses PV.

## Ajouter une classe (checklist)

Une classe = une entrée `CLASSES` + son arbre `TALENTS` + câblage. Ordre :

1. **`src/game/types.ts`** — ajouter l'id à `ClassId`.
2. **`src/game/classes.ts`** — entrée `CLASSES` : `base` (maxHp/atk/def), `growth`
   (par niveau), `parent` si c'est une ascension, `desc`/`playstyle`. Comparer les
   `base`/`growth` aux classes existantes de la même famille pour rester dans la bande.
3. **`src/game/talents.ts`** — nœuds `TALENTS` avec `classId` = la nouvelle classe :
   - passifs (`perRank` : crit, dmgReduction, atkPct…),
   - 1 compétence active (`activeSkill`) minimum,
   - viser **~48 rangs dépensables** au total (base+sous-classe) pour absorber les
     49 points d'un Nv.50 (voir l'équilibrage des arbres dans CLAUDE.md).
   - ressource d'archétype optionnelle : `classResourceType()` + `RESOURCE_INFO` +
     la logique de gain dans `combatTurn` (chercher `resourceType ===`).
4. **`src/game/player.ts`** — `talentMods` : bonus inné de classe (ligne des `if
   (p.classId === ...)`). `starterWeapon` si nouvelle famille.
5. **Icône/UI** — emoji dans `CLASSES`, sélecteur de création, Wiki (auto via
   `CLASS_LIST`).
6. **VALIDER** — ajouter la classe au harness tourne automatiquement (`CLASS_LIST`).
   Lancer `balance-sim-turns.ts`, vérifier que la nouvelle classe tombe dans les
   bandes ci-dessus. Ajuster `base`/`growth`/talents et relancer jusqu'à ce que
   ce soit le cas. **Ne pas** publier une classe hors bande.

Le harness teste chaque classe de `CLASS_LIST` sans code supplémentaire — c'est
le garde-fou d'équilibrage pour toute classe future.

---

## `check-talent-layout.ts` — disposition des arbres de talents

    npx tsx scripts/check-talent-layout.ts

Passe les **20 arbres** (4 classes de base + 16 sous-classes, base et
spécialisation) dans `layoutTree` (`src/components/cards/talentLayout.ts`) et
vérifie trois choses qu'une capture d'écran d'un seul arbre ne peut pas
garantir :

- **aucune superposition** — deux nœuds sur la même case ;
- **aucun croisement** de liens de prérequis (les liens partageant un nœud ne
  comptent évidemment pas) ;
- **largeur ≤ 7 colonnes**, pour que l'arbre tienne dans la fenêtre (680px)
  sans défilement horizontal.

À relancer après tout ajout ou modification de nœud dans `talents.ts`. La
disposition étant déduite du graphe de prérequis (et non des `pos.x`/`pos.y`
écrits à la main), un nœud ajouté se place tout seul — ce script confirme que
le résultat reste propre.
