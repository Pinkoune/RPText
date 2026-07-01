import type { PlayerState, QuestMetric, QuestPeriodState } from './types';
import { freshQuestState } from './player';

export type QuestPeriod = 'daily' | 'weekly';

export interface QuestReward {
  gold?: number;
  fateCoins?: number;
  gems?: number;
  items?: Record<string, number>;
}

export interface QuestDef {
  id: string;
  period: QuestPeriod;
  label: string;
  metric: QuestMetric;
  target: number;
  reward: QuestReward;
}

export const DAILY_MS = 24 * 60 * 60 * 1000;
export const WEEKLY_MS = 7 * DAILY_MS;

export const QUESTS: QuestDef[] = [
  // Journalières
  { id: 'd_hunt', period: 'daily', label: 'Chasser 10 fois', metric: 'hunts', target: 10, reward: { gold: 120, fateCoins: 2 } },
  { id: 'd_kill', period: 'daily', label: 'Vaincre 8 monstres', metric: 'kills', target: 8, reward: { gold: 100 } },
  { id: 'd_gamble', period: 'daily', label: 'Gagner 3 paris au casino', metric: 'gambleWins', target: 3, reward: { fateCoins: 3 } },
  { id: 'd_gather', period: 'daily', label: 'Récolter 8 fois', metric: 'gathers', target: 8, reward: { gold: 90, items: { repair_kit: 1 } } },
  // Hebdomadaires
  { id: 'w_kill', period: 'weekly', label: 'Vaincre 100 monstres', metric: 'kills', target: 100, reward: { gold: 1000, gems: 1, items: { repair_kit: 3, upgrade_matrix: 1 } } },
  { id: 'w_boss', period: 'weekly', label: 'Infliger 500 dégâts au boss mondial', metric: 'bossHits', target: 500, reward: { fateCoins: 10, items: { upgrade_matrix: 1 } } },
  { id: 'w_craft', period: 'weekly', label: 'Forger 5 objets', metric: 'crafts', target: 5, reward: { gold: 800, gems: 1, items: { repair_kit: 2, upgrade_matrix: 1 } } },
  { id: 'w_gather', period: 'weekly', label: 'Récolter 60 ressources', metric: 'gathers', target: 60, reward: { gold: 700, gems: 1 } },
];

/** Réinitialise les périodes expirées. Retourne true si quelque chose a changé. */
export function ensureQuestPeriods(p: PlayerState, now = Date.now()): boolean {
  if (!p.quests) {
    p.quests = freshQuestState(now);
    return true;
  }
  let changed = false;
  if (now - p.quests.daily.start >= DAILY_MS) {
    p.quests.daily = { start: now, counters: {}, claimed: [] };
    changed = true;
  }
  if (now - p.quests.weekly.start >= WEEKLY_MS) {
    p.quests.weekly = { start: now, counters: {}, claimed: [] };
    changed = true;
  }
  return changed;
}

/** Incrémente une métrique sur les deux périodes (journalière + hebdo). */
export function addQuestMetric(p: PlayerState, metric: QuestMetric, n = 1): void {
  ensureQuestPeriods(p);
  for (const period of ['daily', 'weekly'] as const) {
    const c = p.quests[period].counters;
    c[metric] = (c[metric] ?? 0) + n;
  }
}

export interface QuestView {
  def: QuestDef;
  progress: number;
  complete: boolean;
  claimed: boolean;
}

export function questViews(p: PlayerState): QuestView[] {
  ensureQuestPeriods(p);
  return QUESTS.map((def) => {
    const ps: QuestPeriodState = p.quests[def.period];
    const progress = Math.min(def.target, ps.counters[def.metric] ?? 0);
    return {
      def,
      progress,
      complete: progress >= def.target,
      claimed: ps.claimed.includes(def.id),
    };
  });
}

/** Réclame la récompense d'une quête terminée. Retourne la récompense ou null. */
export function claimQuest(p: PlayerState, id: string): QuestReward | null {
  const def = QUESTS.find((q) => q.id === id);
  if (!def) return null;
  ensureQuestPeriods(p);
  const ps = p.quests[def.period];
  const progress = ps.counters[def.metric] ?? 0;
  if (progress < def.target || ps.claimed.includes(id)) return null;
  ps.claimed.push(id);
  if (def.reward.gold) p.gold += def.reward.gold;
  if (def.reward.fateCoins) p.fateCoins += def.reward.fateCoins;
  if (def.reward.gems) p.gems += def.reward.gems;
  if (def.reward.items) {
    for (const [itemId, qty] of Object.entries(def.reward.items)) {
      p.inventory[itemId] = (p.inventory[itemId] ?? 0) + qty;
    }
  }
  return def.reward;
}

/** Temps restant avant reset (ms). */
export function periodResetIn(p: PlayerState, period: QuestPeriod, now = Date.now()): number {
  const span = period === 'daily' ? DAILY_MS : WEEKLY_MS;
  return Math.max(0, p.quests[period].start + span - now);
}
