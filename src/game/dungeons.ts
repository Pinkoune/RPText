import type { PlayerState, MonsterDef } from './types';
import { deriveStats, grantXp, addItem, cooldownLeft, reduceDurability } from './player';
import { simulateCombat } from './combat';
import { talentMods } from './talents';

export interface DungeonReward {
  gold: number;
  fateCoins: number;
  gems: number;
  /** id objet -> probabilité 0..1 */
  loot: Record<string, number>;
}

export interface DungeonDef {
  id: string;
  name: string;
  emoji: string;
  minLevel: number;
  cooldownMs: number;
  desc: string;
  stages: MonsterDef[];
  reward: DungeonReward;
}

function mob(id: string, name: string, emoji: string, hp: number, atk: number, def: number, xp: number): MonsterDef {
  return { id, name, emoji, hp, atk, def, xp, gold: [0, 0], biomes: [], loot: {}, element: 'earth', dmgType: 'physical' };
}

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'goblin_cave',
    name: 'Caverne des Gobelins',
    emoji: '🟩',
    minLevel: 5,
    cooldownMs: 20 * 60 * 1000,
    desc: 'Un repaire grouillant. Idéal pour s\'aguerrir.',
    stages: [
      mob('gob1', 'Gobelin', '👺', 90, 14, 5, 30),
      mob('gob2', 'Gobelin', '👺', 100, 15, 6, 32),
      mob('gob_arch', 'Gobelin archer', '🏹', 85, 20, 4, 38),
      mob('gob_chief', 'Chef gobelin', '👹', 280, 26, 11, 120),
    ],
    reward: { gold: 220, fateCoins: 3, gems: 0, loot: { iron_ore: 0.8, wood: 0.8, iron_blade: 0.2, iron_mail: 0.15 } },
  },
  {
    id: 'cursed_crypt',
    name: 'Crypte Maudite',
    emoji: '⚰️',
    minLevel: 12,
    cooldownMs: 40 * 60 * 1000,
    desc: 'Les morts y refusent le repos.',
    stages: [
      mob('skel1', 'Squelette', '💀', 180, 24, 10, 80),
      mob('skel2', 'Garde squelette', '🦴', 220, 28, 14, 95),
      mob('ghoul', 'Goule', '🧟', 240, 32, 12, 110),
      mob('lich', 'Liche', '🪦', 600, 44, 20, 320),
    ],
    reward: { gold: 480, fateCoins: 5, gems: 1, loot: { frost_shard: 0.7, void_dust: 0.4, steel_plate: 0.2, crystal: 0.3 } },
  },
  {
    id: 'dragon_shrine',
    name: 'Sanctuaire du Dragon',
    emoji: '🐉',
    minLevel: 22,
    cooldownMs: 90 * 60 * 1000,
    desc: 'L\'antre d\'un dragon ancestral. Réservé aux vétérans.',
    stages: [
      mob('drakeling1', 'Dragonnet', '🦎', 360, 40, 18, 200),
      mob('drakeling2', 'Garde drakonide', '🐲', 420, 46, 22, 230),
      mob('wyrm', 'Wyrm de flamme', '🔥', 480, 52, 24, 280),
      mob('elder_dragon', 'Dragon ancestral', '🐉', 1200, 70, 30, 700),
    ],
    reward: { gold: 1000, fateCoins: 10, gems: 2, loot: { mithril_ore: 0.8, crystal: 0.6, mithril_blade: 0.2, crystal_charm: 0.15, void_reaver: 0.05 } },
  },
];

export interface StageResult {
  monster: MonsterDef;
  rounds: { text: string; playerHp: number; monsterHp: number }[];
  victory: boolean;
  endHp: number;
}

export interface DungeonRun {
  def: DungeonDef;
  stages: StageResult[];
  success: boolean;
  failedAt?: number;
  xp: number;
  levelsGained: number;
  gold: number;
  fateCoins: number;
  gems: number;
  loot: string[];
  /** Récompenses doublées par une clé de donjon consommée. */
  doubled?: boolean;
}

export function dungeonCooldownLeft(p: PlayerState, def: DungeonDef): number {
  return cooldownLeft(p, `dungeon:${def.id}`, def.cooldownMs);
}

/**
 * Lance un donjon : combats enchaînés, les PV se reportent d'une étape à l'autre.
 * Mort = échec, pas de récompense. Mute le joueur.
 */
export function runDungeon(p: PlayerState, def: DungeonDef): DungeonRun | { error: string } {
  if (p.level < def.minLevel) return { error: `Niveau ${def.minLevel} requis.` };
  if (dungeonCooldownLeft(p, def) > 0) return { error: 'Donjon en récupération.' };
  if (p.hp <= 0) return { error: 'Tu es K.O. Soigne-toi avant d\'entrer.' };

  const stats = deriveStats(p);
  const mods = talentMods(p);
  p.cooldowns[`dungeon:${def.id}`] = Date.now();

  const run: DungeonRun = {
    def, stages: [], success: false, xp: 0, levelsGained: 0, gold: 0, fateCoins: 0, gems: 0, loot: [],
  };

  let hp = p.hp;
  let totalXp = 0;
  let totalHitsDealt = 0;
  let totalHitsTaken = 0;

  for (let i = 0; i < def.stages.length; i++) {
    const m = def.stages[i];
    const sim = simulateCombat(stats, hp, m, mods);
    totalHitsDealt += sim.hitsDealt;
    totalHitsTaken += sim.hitsTaken;
    const res: StageResult = { monster: m, rounds: sim.rounds, victory: sim.victory, endHp: sim.endHp };
    run.stages.push(res);
    hp = res.endHp;
    totalXp += def.stages[i].xp;
    if (!res.victory) {
      run.failedAt = i;
      p.hp = 0;
      reduceDurability(p, totalHitsTaken, totalHitsDealt);
      return run; // échec : pas de récompense
    }
  }

  reduceDurability(p, totalHitsTaken, totalHitsDealt);

  // Succès
  run.success = true;
  p.hp = hp;
  p.kills += def.stages.length;
  run.xp = totalXp;
  run.levelsGained = grantXp(p, totalXp);

  // Clé de donjon : si le joueur en possède, elle est consommée pour doubler
  // toutes les récompenses de fin (or, Fate Coins, gemmes et butin).
  const useKey = (p.inventory['dungeon_key'] ?? 0) > 0;
  const mult = useKey ? 2 : 1;
  if (useKey) {
    p.inventory['dungeon_key'] -= 1;
    if (p.inventory['dungeon_key'] <= 0) delete p.inventory['dungeon_key'];
    run.doubled = true;
  }

  run.gold = def.reward.gold * mult;
  run.fateCoins = def.reward.fateCoins * mult;
  run.gems = def.reward.gems * mult;
  p.gold += run.gold;
  p.fateCoins += run.fateCoins;
  p.gems += run.gems;
  for (const [id, chance] of Object.entries(def.reward.loot)) {
    if (Math.random() < chance) {
      addItem(p, id, mult);
      for (let k = 0; k < mult; k++) run.loot.push(id);
    }
  }
  p.dungeonClears[def.id] = (p.dungeonClears[def.id] ?? 0) + 1;
  return run;
}
