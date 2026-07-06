import type { PlayerState, MonsterDef, Element, DamageType } from './types';
import { deriveStats, grantXp, addItem, cooldownLeft, reduceDurability, luckyDropMult } from './player';
import { simulateCombat } from './combat';
import { talentMods } from './talents';
import { addQuestMetric } from './quests';
import { sendAutoAnnounce } from '../firebase/chatService';

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
  /** Raid : pas de limite de joueurs, réservé aux fenêtres d'inscription. */
  raid?: boolean;
}

interface MobOpts {
  element?: Element;
  dmgType?: DamageType;
  weaknesses?: DamageType[];
  resistances?: DamageType[];
}

/**
 * Auparavant tous les monstres de donjon étaient tagués `earth`/`physical` en
 * dur, peu importe leur thème (un "Golem de lave" tapait comme un gobelin) →
 * aucune synergie élémentaire possible en donjon, contrairement à la chasse.
 * `opts` permet désormais de leur donner de vrais éléments/faiblesses,
 * cohérents avec les monstres du même thème dans `monsters.ts`. Les boss de
 * fin (dernier stage) résistent volontairement aux deux types de dégâts sans
 * aucune faiblesse (comme lava_titan/voidling en monde ouvert) : impossible à
 * trivialiser via un simple choix d'arme, seuls les stages intermédiaires
 * offrent un vrai bonus/malus élémentaire.
 */
function mob(id: string, name: string, emoji: string, hp: number, atk: number, def: number, xp: number, opts: MobOpts = {}): MonsterDef {
  return {
    id, name, emoji, hp, atk, def, xp, gold: [0, 0], biomes: [], loot: {},
    element: opts.element ?? 'earth',
    dmgType: opts.dmgType ?? 'physical',
    weaknesses: opts.weaknesses,
    resistances: opts.resistances,
  };
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
      mob('gob1', 'Gobelin', '👺', 50, 7, 2, 22, { element: 'earth', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('gob2', 'Gobelin', '👺', 60, 8, 3, 24, { element: 'earth', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('gob_arch', 'Gobelin archer', '🏹', 45, 10, 1, 29, { element: 'earth', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('gob_chief', 'Chef gobelin', '👹', 120, 14, 5, 90, { element: 'earth', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] }),
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
      mob('skel1', 'Squelette', '💀', 135, 18, 7, 60, { element: 'dark', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('skel2', 'Garde squelette', '🦴', 165, 21, 10, 72, { element: 'dark', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('ghoul', 'Goule', '🧟', 180, 24, 9, 82, { element: 'dark', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] }),
      mob('lich', 'Liche', '🪦', 450, 33, 15, 240, { element: 'dark', dmgType: 'magical', resistances: ['physical', 'magical'] }),
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
      mob('drakeling1', 'Dragonnet', '🦎', 270, 30, 13, 150, { element: 'fire', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('drakeling2', 'Garde drakonide', '🐲', 315, 34, 16, 172, { element: 'fire', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] }),
      mob('wyrm', 'Wyrm de flamme', '🔥', 360, 39, 18, 210, { element: 'fire', dmgType: 'magical', weaknesses: ['physical'] }),
      mob('dragon_lord', 'Seigneur Dragon', '🐉', 900, 56, 22, 750, { element: 'fire', dmgType: 'physical', resistances: ['physical', 'magical'] }),
    ],
    reward: { gold: 1000, fateCoins: 10, gems: 2, loot: { mithril_ore: 0.8, crystal: 0.6, mithril_blade: 0.2, crystal_charm: 0.15, void_reaver: 0.05 } },
  },
  {
    id: 'infernal_forge',
    name: 'Forge Infernale',
    emoji: '🌋',
    minLevel: 30,
    cooldownMs: 120 * 60 * 1000,
    desc: 'Les entrailles du volcan abritent des démons forgeurs. Équipement volcanique en récompense.',
    stages: [
      mob('flame_imp1', 'Diablotin de feu', '🔥', 800, 60, 25, 400, { element: 'fire', dmgType: 'magical', weaknesses: ['physical'] }),
      mob('lava_golem', 'Golem de lave', '🌋', 1100, 75, 35, 550, { element: 'fire', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] }),
      mob('infernal_guard', 'Garde infernal', '👹', 950, 80, 30, 500, { element: 'fire', dmgType: 'physical', weaknesses: ['magical'] }),
      mob('forge_lord', 'Seigneur de la Forge', '🔥', 2800, 110, 50, 1800, { element: 'fire', dmgType: 'physical', resistances: ['physical', 'magical'] }),
    ],
    reward: { gold: 3500, fateCoins: 15, gems: 3, loot: { lava_crystal: 0.9, ember_stone: 0.8, infernal_shard: 0.6, lava_blade: 0.15, volcanic_armor: 0.12, upgrade_matrix: 0.2 } },
  },
  {
    id: 'abyssal_citadel',
    name: 'Citadelle Abyssale',
    emoji: '🏰',
    minLevel: 40,
    cooldownMs: 180 * 60 * 1000,
    desc: 'Forteresse à la frontière du vide. Seuls les plus puissants en reviennent.',
    stages: [
      mob('void_sentinel1', 'Sentinelle du Vide', '💀', 1800, 130, 55, 900, { element: 'dark', dmgType: 'magical', weaknesses: ['physical'], resistances: ['magical'] }),
      mob('void_sentinel2', 'Archonte du Vide', '🌑', 2200, 150, 65, 1100, { element: 'dark', dmgType: 'magical', weaknesses: ['physical'], resistances: ['magical'] }),
      mob('abyssal_knight', 'Chevalier Abyssal', '🗡️', 2600, 165, 70, 1300, { element: 'dark', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] }),
      mob('void_king', 'Roi Abyssal', '👑', 7000, 220, 90, 5000, { element: 'dark', dmgType: 'magical', resistances: ['physical', 'magical'] }),
    ],
    reward: { gold: 6000, fateCoins: 25, gems: 5, loot: { void_dust: 0.9, infernal_shard: 0.8, boss_soul: 0.4, void_mantle: 0.2, primordial_crown: 0.08, upgrade_matrix: 0.35, phoenix_feather: 0.05 } },
  },
];

// ── Raid : trois donjons enchaînés (12 étages), stats renforcées ×1.4, illimité
// en joueurs, ouvert seulement pendant les fenêtres d'inscription (voir raid.ts).
// Récompense généreuse mais bornée (le multiplicateur de groupe/niveau du
// DungeonCard s'applique déjà par-dessus).
(() => {
  const src = ['goblin_cave', 'cursed_crypt', 'dragon_shrine']
    .map((id) => DUNGEONS.find((d) => d.id === id)!)
    .filter(Boolean);
  const stages: MonsterDef[] = [];
  src.forEach((d, di) => {
    d.stages.forEach((m, mi) => {
      const finalBoss = di === src.length - 1 && mi === d.stages.length - 1;
      const mult = finalBoss ? 2.2 : 1.4;
      stages.push({
        ...m,
        id: `raid_${d.id}_${m.id}`,
        hp: Math.floor(m.hp * mult),
        atk: Math.floor(m.atk * (finalBoss ? 1.6 : 1.3)),
        def: Math.floor(m.def * 1.3),
        xp: Math.floor(m.xp * 1.5),
      });
    });
  });
  DUNGEONS.push({
    id: 'raid_trials',
    name: 'Épreuves du Raid',
    emoji: '🔱',
    minLevel: 22,
    cooldownMs: 0, // Le rythme est fixé par les fenêtres d'inscription, pas un CD perso.
    desc: 'Trois donjons enchaînés sans répit. Réservé aux inscriptions de raid (10h / 20h).',
    stages,
    raid: true,
    reward: { gold: 3200, fateCoins: 20, gems: 6, loot: { mithril_ore: 1, crystal: 0.9, void_dust: 0.7, mithril_blade: 0.35, crystal_charm: 0.3, void_reaver: 0.12, boss_soul: 0.1 } },
  });
})();

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
  const lucky = luckyDropMult(p);
  for (const [id, chance] of Object.entries(def.reward.loot)) {
    if (Math.random() < chance * lucky) {
      addItem(p, id, mult);
      for (let k = 0; k < mult; k++) run.loot.push(id);
    }
  }
  p.dungeonClears[def.id] = (p.dungeonClears[def.id] ?? 0) + 1;
  addQuestMetric(p, 'dungeons', 1);
  // Annonce si premier donjon
  const totalClears = Object.values(p.dungeonClears).reduce((s, n) => s + n, 0);
  if (totalClears === 1) {
    sendAutoAnnounce(`🏏 ${p.name} vient de terminer son premier donjon !`);
  }
  return run;
}
