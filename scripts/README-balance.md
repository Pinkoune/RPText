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
- `balance-sim-turns.ts` → écrit `scratchpad/sim-turns.json` (winrate/survie AVEC skills, donjons co-op).
- CSV pour Excel : `scripts/balance-output/*.csv` (séparateur `;`, décimales `,`).

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

Repères actuels : DPS de 240 (Soigneur) à ~1020 (Pyromancien). Les DPS purs
(Pyro/Arcaniste) tolèrent un endHP bas ; les tanks/soigneurs un DPS bas mais
endHP haut. Une classe qui cumule **top DPS + top survie** (comme le Berserker)
est un signal à surveiller, pas forcément à nerfer.

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
