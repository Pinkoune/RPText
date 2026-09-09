// ─── Abandon de combat ───────────────────────────────────────────────────────
//
// Défaut signalé en jeu : « on peut fermer les cartes de combat avec la petite
// croix (ou en rafraîchissant la page) et ça annule le combat ».
//
// C'était exact, et gratuit. L'état d'un combat solo vit entièrement dans le
// composant React (`HuntCard`, `AscensionCard`) : démonter le composant
// effaçait le monstre, ses PV et le tour en cours. En chasse on échappait donc
// à `applyDeathPenalty` (-10% d'or, série de chasse perdue) en cliquant sur ✕
// au moment de mourir. Et au **Rituel du Néant**, c'était pire : le combat ne
// touche PAS `d.hp` pendant les tours, donc fermer la fenêtre annulait la
// totalité du risque — ni perte de 1 à 3 niveaux, ni cooldown de 8h, pas même
// les PV perdus. L'écran de confirmation promet « il n'y a pas de retour en
// arrière une fois le regard du Néant posé sur toi » : c'était faux.
//
// Règle posée : **abandonner un combat engagé, c'est le perdre.** C'est la règle
// classique du combat-log dans les jeux en ligne, et la seule qui ne demande pas
// de rejouer le combat côté serveur (le jeu reste client-authoritative).
//
// Deux chemins mènent à l'abandon, et il en faut donc DEUX pour le rattraper :
//  - la croix ✕ → le composant se démonte, la carte résout elle-même (voir
//    `resolveAbandon` appelé au démontage) ;
//  - le rechargement / la fermeture de l'onglet / un plantage → aucun code React
//    ne tourne, mais `pendingCombat` est resté dans la sauvegarde : `gameStore`
//    le voit à la connexion suivante et résout à ce moment-là.
//
// ⚠️ Ce fichier ne doit être importé QUE par les cartes de combat et le store.
// Il dépend de `combat.ts` ET d'`ascension.ts` ; le placer dans `player.ts`
// créerait le cycle `player → ascension → player` (même piège que
// `backfillAchievementShards`, cf. CLAUDE.md).

import type { PlayerState } from './types';
import { applyDeathPenalty, breakHuntStreak } from './combat';
import { ascensionOutcome, applyAscensionResult } from './ascension';

/**
 * Version du marqueur d'engagement. **À incrémenter si la sémantique change.**
 * Un `pendingCombat` d'une autre version est effacé SANS pénalité : c'est la
 * seule façon de distinguer un vrai abandon d'un résidu laissé par un bug.
 */
const ABANDON_VERSION = 2;

/**
 * Marque un combat comme engagé. À appeler dans `mutate` au tout début.
 *
 * ⚠️ `id` doit identifier CETTE rencontre (l'`encounter.id` côté chasse).
 * Il sert deux fois :
 *  - engager un NOUVEAU combat alors qu'un autre traîne, c'est avoir fui le
 *    précédent : la carte de chasse est un singleton, donc relancer `hunt`
 *    pendant un combat perdu d'avance remplaçait le monstre sans rien coûter —
 *    troisième porte de sortie, à côté de la croix et du rechargement ;
 *  - mais réengager le MÊME id ne doit rien coûter, sinon le double-montage de
 *    React StrictMode tuerait le joueur à chaque ouverture, en dev seulement.
 */
export function beginCombat(d: PlayerState, kind: 'hunt' | 'ascension', label: string, id: string): string | null {
  const previous = d.pendingCombat && d.pendingCombat.id !== id ? resolveAbandon(d) : null;
  d.pendingCombat = { kind, label, id, at: Date.now(), v: ABANDON_VERSION };
  return previous;
}

/**
 * Efface l'engagement : le combat s'est terminé normalement (gagné/perdu/fui).
 *
 * ⚠️⚠️ `delete`, PAS `= undefined`. Firestore REFUSE une valeur `undefined`
 * (`ignoreUndefinedProperties` est faux par défaut) : `setDoc` lève, donc la
 * sauvegarde entière échouait — silencieusement, puisque `gameStore` l'appelle
 * en `void savePlayer(p)`. Conséquences observées en production :
 *  - le nettoyage n'était jamais persisté, donc `pendingCombat` restait dans le
 *    doc Firestore et CHAQUE rechargement rejouait un abandon (avec sa vraie
 *    pénalité de mort) alors que le joueur n'était pas en combat ;
 *  - et comme le champ restait `undefined` en mémoire, **toutes** les
 *    sauvegardes suivantes échouaient à leur tour.
 * ⚠️ Invisible en local : le repli `localStorage` passe par `JSON.stringify`,
 * qui SUPPRIME les clés `undefined`. Le mode local « répare » donc exactement
 * ce que Firestore rejette — c'est pour ça que la vérif en jeu était verte.
 */
export function endCombat(d: PlayerState): void {
  delete d.pendingCombat;
}

/**
 * Résout un combat abandonné comme une DÉFAITE, et efface l'engagement.
 * Renvoie le message à afficher, ou `null` s'il n'y avait rien en cours.
 */
export function resolveAbandon(d: PlayerState): string | null {
  const pending = d.pendingCombat;
  if (!pending) return null;
  delete d.pendingCombat;

  // ⚠️ Engagement écrit par une version qui ne savait pas l'effacer (voir
  // `endCombat`) : il est resté coincé dans le doc Firestore et ne décrit AUCUN
  // abandon réel. On le nettoie sans rien faire payer — la pénalité de mort a
  // déjà été infligée à tort à chaque rechargement de ces joueurs.
  if (pending.v !== ABANDON_VERSION) return null;

  if (pending.kind === 'ascension') {
    // Même barème que la défaite normale, avec les PV du boss au dernier tour
    // joué. Un abandon au premier tour coûte donc le maximum, et quelqu'un qui
    // avait presque gagné garde le traitement de justesse — on ne punit pas
    // l'abandon plus qu'une défaite, on refuse juste qu'il ne coûte rien.
    const res = ascensionOutcome(pending.bossHpFrac ?? 1, false);
    applyAscensionResult(d, res);
    // `ascensionOutcome(_, false)` renvoie toujours la branche « perdu », mais
    // le type est une union : on repasse par `res.won` pour que TS le sache.
    const lost = res.won ? 0 : res.levelsLost;
    return lost
      ? `🕳️ Tu as fui le Néant Originel. Il te reprend ${lost} niveau${lost > 1 ? 'x' : ''} et se referme pour 8h.`
      : '🕳️ Tu as rampé hors du Néant. Il se referme pour 8h.';
  }

  applyDeathPenalty(d);
  breakHuntStreak(d);
  return `💀 Combat abandonné (${pending.label}) : compté comme une défaite.`;
}
