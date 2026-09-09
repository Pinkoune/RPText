// ─── Annonce des succès et quêtes terminés ───────────────────────────────────
//
// Rien ne signalait qu'un succès venait d'être atteint ou qu'une quête venait
// d'être bouclée : il fallait ouvrir la carte concernée pour s'en rendre compte,
// donc les récompenses dormaient. On détecte le franchissement ici, au même
// endroit pour les deux, et `gameStore.mutate` l'appelle après CHAQUE écriture —
// c'est le seul point de passage commun à la chasse, la récolte, la forge, les
// donjons et le casino.
//
// ⚠️ Le registre est PERSISTÉ, et c'est lui qui rend l'opération idempotente :
// un flag de version ne suffirait pas (un succès ajouté plus tard doit pouvoir
// être annoncé à son tour). Même principe que `shardedAchievements`.
//
// ⚠️ Et il s'amorce en SILENCE. Sans ça, la première connexion après cette mise
// à jour cracherait une bulle par succès déjà accompli — un vétéran en aurait
// eu vingt d'un coup. Un registre `undefined` signifie « on n'a jamais annoncé
// pour ce personnage » : on le remplit sans rien dire, et seuls les
// franchissements SUIVANTS parlent.
//
// ⚠️ Ce module ne peut pas vivre dans `player.ts` : il dépend d'`achievements.ts`
// qui dépend de `gathering.ts` qui dépend de `player.ts` — le cycle déjà
// documenté pour `backfillAchievementShards`.

import type { PlayerState } from './types';
import { ACHIEVEMENTS, isUnlocked, isClaimed } from './achievements';
import { questViews } from './quests';

export interface Completion {
  text: string;
  /** Carte à ouvrir depuis le centre de notifications. */
  kind: 'achievement' | 'quest';
}

/**
 * Repère ce qui vient d'être terminé et le marque comme annoncé.
 * ⚠️ MUTE le joueur (les registres) — à appeler dans un `mutate`, sur le
 * brouillon, jamais sur l'état affiché.
 */
export function collectCompletions(p: PlayerState): Completion[] {
  const out: Completion[] = [];

  // ── Succès ──
  const firstRunAch = p.notifiedAchievements === undefined;
  const seen = (p.notifiedAchievements ??= []);
  for (const a of ACHIEVEMENTS) {
    if (!isUnlocked(p, a) || seen.includes(a.id)) continue;
    seen.push(a.id);
    // Un succès déjà réclamé ne peut pas être « nouveau » : il l'a été avant que
    // le registre existe. On l'enregistre sans l'annoncer.
    if (!firstRunAch && !isClaimed(p, a.id)) {
      out.push({ text: `🏆 Succès accompli : ${a.name} — récompense à réclamer !`, kind: 'achievement' });
    }
  }

  // ── Quêtes ──
  // Le registre vit DANS la période (`QuestPeriodState`), donc la rotation
  // journalière/hebdomadaire le vide toute seule : `ensureQuestPeriods`
  // reconstruit l'objet entier.
  for (const v of questViews(p)) {
    const ps = p.quests[v.def.period];
    const firstRunQ = ps.notified === undefined;
    const done = (ps.notified ??= []);
    if (!v.complete || done.includes(v.def.id)) continue;
    done.push(v.def.id);
    if (!firstRunQ && !v.claimed) {
      const label = v.def.period === 'daily' ? 'journalière' : 'hebdomadaire';
      out.push({ text: `📜 Quête ${label} terminée : ${v.def.label} !`, kind: 'quest' });
    }
  }

  return out;
}

/** Succès atteints mais pas encore réclamés. */
export function pendingAchievements(p: PlayerState): number {
  return ACHIEVEMENTS.filter((a) => isUnlocked(p, a) && !isClaimed(p, a.id)).length;
}

/** Quêtes terminées mais pas encore réclamées. */
export function pendingQuests(p: PlayerState): number {
  return questViews(p).filter((v) => v.complete && !v.claimed).length;
}
