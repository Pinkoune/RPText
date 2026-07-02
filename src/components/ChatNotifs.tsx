import { useGame, type ChatChannelKind } from '../store/gameStore';
import { useUi } from '../store/uiStore';

const STYLE: Record<ChatChannelKind, { label: string; icon: string; cls: string }> = {
  global:  { label: 'Global',  icon: '🌐', cls: 'bg-sky-500/20 border-sky-400/50 text-sky-100' },
  team:    { label: 'Équipe',  icon: '👥', cls: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100' },
  guild:   { label: 'Guilde',  icon: '🏰', cls: 'bg-purple-500/20 border-purple-400/50 text-purple-100' },
  private: { label: 'Privé',   icon: '✉️', cls: 'bg-pink-500/20 border-pink-400/50 text-pink-100' },
};

/** Notifications de chat empilées en haut à droite, colorées par canal. */
export default function ChatNotifs() {
  const notifs = useGame((s) => s.chatNotifs);
  const dismiss = useGame((s) => s.dismissChatNotif);
  const open = useUi((s) => s.open);

  if (notifs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-16 z-40 flex w-[min(88vw,300px)] flex-col gap-2">
      {notifs.map((n) => {
        const st = STYLE[n.channel];
        return (
          <button
            key={n.id}
            onClick={() => { open('chat', undefined, { singleton: true }); dismiss(n.id); }}
            className={`pointer-events-auto animate-floatIn rounded-xl border px-3 py-2 text-left backdrop-blur transition hover:brightness-110 ${st.cls}`}
          >
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide opacity-80">
              <span>{st.icon} {st.label}</span>
              <span
                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                className="cursor-pointer opacity-60 hover:opacity-100"
              >
                ✕
              </span>
            </div>
            <div className="mt-0.5 text-sm">
              <span className="font-semibold">{n.name}</span>{' '}
              <span className="opacity-90">{n.text.slice(0, 40)}{n.text.length > 40 ? '…' : ''}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
