import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { PATCH_HISTORY } from '../../game/patchnotes';
import { hasUnreadPatch, markPatchSeen } from '../PatchNotesModal';

interface Entry {
  id: string;
  icon: string;
  title: string;
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
  const open = useUi((s) => s.open);

  const latest = PATCH_HISTORY[0];
  const entries: Entry[] = [];

  if (latest && hasUnreadPatch()) {
    entries.push({
      id: 'patch',
      icon: '📰',
      title: 'Mise à jour du jeu',
      detail: `Version ${latest.version} — découvre les nouveautés.`,
      color: '#8cb4ff',
      onOpen: () => { markPatchSeen(); open('news', undefined, { singleton: true }); },
    });
  }

  if (hasUnreadChat) {
    const last = chatNotifs[chatNotifs.length - 1];
    entries.push({
      id: 'chat',
      icon: '💬',
      title: 'Nouveaux messages',
      detail: last ? `${last.name} : ${last.text.slice(0, 60)}` : 'Tu as reçu des messages non lus.',
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

/** Nombre de notifications en attente — pilote la pastille de la barre du haut. */
export function notificationCount(hasUnreadChat: boolean): number {
  return (hasUnreadPatch() ? 1 : 0) + (hasUnreadChat ? 1 : 0);
}
