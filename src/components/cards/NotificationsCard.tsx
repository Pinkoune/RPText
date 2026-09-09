import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import type { PlayerState } from '../../game/types';
import { pendingAchievements, pendingQuests } from '../../game/completions';
import { PATCH_HISTORY } from '../../game/patchnotes';
import { hasUnreadPatch, markPatchSeen } from '../PatchNotesModal';

interface Entry {
  id: string;
  icon: string;
  title: string;
  /**
   * Une ligne courte. ⚠️ Elle est rendue en `truncate` dans une fenêtre qui
   * peut être étroite : au-delà d'une quarantaine de caractères elle se coupe
   * au milieu d'un mot et ne dit plus rien. Le titre porte l'information, le
   * détail ne fait que la préciser.
   */
  detail: string;
  color: string;
  onOpen: () => void;
}

/**
 * Centre de notifications — un seul endroit pour tout ce qui réclame l'attention.
 *
 * Avant, chaque source avait son propre bouton apparaissant et disparaissant de
 * la barre du haut (💬 seulement s'il y avait un message, 📰 seulement s'il y
 * avait une version non lue), ce qui faisait bouger la barre en permanence. Ici
 * le bouton est fixe et cette carte dit ce qu'il y a — y compris rien.
 */
export default function NotificationsCard() {
  const hasUnreadChat = useGame((s) => s.hasUnreadChat);
  const chatNotifs = useGame((s) => s.chatNotifs);
  const player = useGame((s) => s.player);
  const open = useUi((s) => s.open);

  const latest = PATCH_HISTORY[0];
  const entries: Entry[] = [];

  if (latest && hasUnreadPatch()) {
    entries.push({
      id: 'patch',
      icon: '📰',
      title: 'Mise à jour du jeu',
      detail: `Version ${latest.version}`,
      color: '#8cb4ff',
      onOpen: () => { markPatchSeen(); open('news', undefined, { singleton: true }); },
    });
  }

  // Récompenses en attente. Dérivées (pas une file) : elles disparaissent d'
  // elles-mêmes dès qu'on réclame, sans registre à tenir à jour.
  const ach = player ? pendingAchievements(player) : 0;
  if (ach > 0) {
    entries.push({
      id: 'achievements',
      icon: '🏆',
      title: ach > 1 ? `${ach} succès à réclamer` : 'Un succès à réclamer',
      detail: 'Récompense à récupérer.',
      color: '#f0b543',
      onOpen: () => open('achievements', undefined, { singleton: true }),
    });
  }

  const quests = player ? pendingQuests(player) : 0;
  if (quests > 0) {
    entries.push({
      id: 'quests',
      icon: '📜',
      title: quests > 1 ? `${quests} quêtes terminées` : 'Une quête terminée',
      detail: 'Récompense à récupérer.',
      color: '#5fd0a0',
      onOpen: () => open('quests', undefined, { singleton: true }),
    });
  }

  if (hasUnreadChat) {
    const last = chatNotifs[chatNotifs.length - 1];
    entries.push({
      id: 'chat',
      icon: '💬',
      title: 'Nouveaux messages',
      detail: last ? `${last.name} : ${last.text.slice(0, 28)}` : 'Messages non lus.',
      color: '#5fd0a0',
      onOpen: () => open('chat', undefined, { singleton: true }),
    });
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <div className="rounded-xl bg-black/25 py-8 text-center">
          <div className="text-2xl opacity-40">🔔</div>
          <div className="mt-1 text-sm text-slate-500">Aucune notification</div>
        </div>
      ) : (
        entries.map((e) => (
          <button
            key={e.id}
            onClick={e.onOpen}
            className="flex w-full items-center gap-3 rounded-xl bg-black/25 p-3 text-left transition hover:bg-white/10"
          >
            <span className="text-xl leading-none">{e.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: e.color }}>{e.title}</div>
              <div className="truncate text-[11px] text-slate-400">{e.detail}</div>
            </div>
            <span className="shrink-0 text-slate-600">›</span>
          </button>
        ))
      )}
    </div>
  );
}

/**
 * Nombre de notifications en attente — pilote la pastille de la barre du haut.
 * ⚠️ Doit rester aligné sur les `entries` ci-dessus, sinon la pastille annonce
 * un nombre que la carte ne montre pas.
 */
export function notificationCount(hasUnreadChat: boolean, player: PlayerState | null): number {
  return (hasUnreadPatch() ? 1 : 0)
    + (hasUnreadChat ? 1 : 0)
    + (player && pendingAchievements(player) > 0 ? 1 : 0)
    + (player && pendingQuests(player) > 0 ? 1 : 0);
}
