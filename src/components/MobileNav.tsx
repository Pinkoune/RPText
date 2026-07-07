import { useState } from 'react';
import { useUi, type WindowKind } from '../store/uiStore';
import { useGame } from '../store/gameStore';
import { runCommand, COMMANDS } from '../game/commands';
import { playSound } from '../game/sound';

// Niveau requis par fenêtre = celui de la commande homonyme (même gating que la
// barre de commande). Garantit que le menu mobile bloque comme les commandes.
const REQ_LEVEL: Partial<Record<WindowKind, number>> = Object.fromEntries(
  COMMANDS.filter((c) => c.reqLevel && c.reqLevel > 1).map((c) => [c.name as WindowKind, c.reqLevel!]),
);

/** Entrée de menu : emoji + libellé + fenêtre à ouvrir (ou commande à lancer). */
interface NavItem { kind: WindowKind; emoji: string; label: string; cmd?: string; reqLevel?: number }

const NAV: { cat: string; items: NavItem[] }[] = [
  {
    cat: 'Aventure', items: [
      { kind: 'hunt', emoji: '⚔️', label: 'Chasse' },
      { kind: 'map', emoji: '🗺️', label: 'Carte' },
      { kind: 'dungeon', emoji: '🏰', label: 'Donjons' },
      { kind: 'endless', emoji: '🕳️', label: 'Abysses' },
      { kind: 'boss', emoji: '🐲', label: 'Boss' },
      { kind: 'hunt', cmd: 'adventure', emoji: '🗡️', label: 'Aventure', reqLevel: 10 },
      { kind: 'hunt', cmd: 'miniboss', emoji: '👹', label: 'Mini-boss', reqLevel: 15 },
      { kind: 'hunt', cmd: 'mercenary', emoji: '🎯', label: 'Mercenaire', reqLevel: 25 },
      { kind: 'hunt', cmd: 'sanctuary', emoji: '🗿', label: 'Sanctuaire', reqLevel: 40 },
      { kind: 'gather', emoji: '🌿', label: 'Récolte' },
    ],
  },
  {
    cat: 'Personnage', items: [
      { kind: 'profile', emoji: '👤', label: 'Profil' },
      { kind: 'inventory', emoji: '🎒', label: 'Sac' },
      { kind: 'equipment', emoji: '🛡️', label: 'Équip.' },
      { kind: 'enchant', emoji: '✨', label: 'Enchant' },
      { kind: 'talents', emoji: '🌟', label: 'Talents' },
      { kind: 'experience', emoji: '📈', label: 'XP' },
      { kind: 'familiar', emoji: '🐾', label: 'Familiers' },
      { kind: 'experience', cmd: 'expedition', emoji: '🧭', label: 'Expédition', reqLevel: 35 },
      { kind: 'prestige', cmd: 'aura', emoji: '✨', label: 'Aura', reqLevel: 30 },
      { kind: 'quests', emoji: '📜', label: 'Quêtes' },
      { kind: 'achievements', emoji: '🏆', label: 'Succès' },
    ],
  },
  {
    cat: 'Artisanat & Boutiques', items: [
      { kind: 'craft', emoji: '🔨', label: 'Forge' },
      { kind: 'forgeron', emoji: '🧔‍♂️', label: 'Renold', reqLevel: 10 },
      { kind: 'concoction', emoji: '🧪', label: 'Concoc.' },
      { kind: 'shop', emoji: '🛒', label: 'Boutique' },
      { kind: 'market', emoji: '🏪', label: 'Marché' },
      { kind: 'fateshop', emoji: '🎲', label: 'Destin' },
      { kind: 'casino', emoji: '🎰', label: 'Casino' },
    ],
  },
  {
    cat: 'Multijoueur', items: [
      { kind: 'chat', emoji: '💬', label: 'Chat' },
      { kind: 'leaderboard', emoji: '🏅', label: 'Classt' },
      { kind: 'team', emoji: '👥', label: 'Équipe' },
      { kind: 'guild', emoji: '🏯', label: 'Guilde' },
      { kind: 'duel', emoji: '⚔️', label: 'Duels' },
      { kind: 'cardjitsu', emoji: '🥷', label: 'Card-J.' },
      { kind: 'season', emoji: '🏅', label: 'Saison' },
      { kind: 'dungeon', cmd: 'raid', emoji: '🔱', label: 'Raid', reqLevel: 22 },
    ],
  },
  {
    cat: 'Infos & Système', items: [
      { kind: 'cooldown', emoji: '⏳', label: 'Récup.' },
      { kind: 'events', emoji: '🌍', label: 'Events' },
      { kind: 'stats', emoji: '📊', label: 'Stats' },
      { kind: 'wiki', emoji: '📚', label: 'Wiki' },
      { kind: 'help', emoji: '❔', label: 'Aide' },
      { kind: 'settings', emoji: '⚙️', label: 'Options' },
    ],
  },
];

// Plusieurs entrées NAV partagent le même kind ('hunt' pour chasse/aventure/
// mini-boss/mercenaire/sanctuaire) : ne garder que la PREMIÈRE occurrence par
// kind, sinon le dernier écrase les autres (bug : tous les combats affichaient
// « Sanctuaire » dans le dock, quel que soit le combat réellement en cours).
const LABEL: Partial<Record<WindowKind, { emoji: string; label: string }>> = {};
for (const g of NAV) for (const it of g.items) if (!LABEL[it.kind]) LABEL[it.kind] = { emoji: it.emoji, label: it.label };

// Libellé générique du dock pour les fenêtres 'hunt' génériques (pas de titre
// contextuel posé par HuntCard.setChrome pour un boss) : "Combat" plutôt que
// "Chasse", qui ne correspond pas à l'aventure/mini-boss/etc.
const DOCK_LABEL_OVERRIDE: Partial<Record<WindowKind, string>> = { hunt: 'Combat' };

export default function MobileNav() {
  const windows = useUi((s) => s.windows);
  const open = useUi((s) => s.open);
  const close = useUi((s) => s.close);
  const focus = useUi((s) => s.focus);
  const level = useGame((s) => s.player?.level ?? 1);
  const ignoreReq = useGame((s) => s.player?.ignoreRestrictions ?? false);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [menuOpen, setMenuOpen] = useState(false);

  // Certaines entrées (hunt, mini-boss, raid) exigent la logique de commande
  // (cooldown, fenêtre d'inscription, payload) → on passe par runCommand.
  const CMD_KIND: Partial<Record<WindowKind, string>> = { hunt: 'hunt' };

  const reqForItem = (it: NavItem) => it.reqLevel ?? REQ_LEVEL[it.kind] ?? 1;
  const isLockedItem = (it: NavItem) => !ignoreReq && level < reqForItem(it);

  // Fenêtres réellement navigables (on ignore les modales internes).
  const tabs = windows.filter((w) => LABEL[w.kind]);
  const activeId = tabs.reduce<string | null>((best, w) => {
    if (!best) return w.id;
    const bestZ = windows.find((x) => x.id === best)?.z ?? 0;
    return w.z > bestZ ? w.id : best;
  }, null);

  function go(it: NavItem) {
    if (isLockedItem(it)) {
      toast(`Se débloque au niveau ${reqForItem(it)}.`, 'bad');
      return;
    }
    playSound('click');
    const cmd = it.cmd ?? CMD_KIND[it.kind];
    if (cmd) {
      runCommand(cmd, { getPlayer: () => useGame.getState().player, mutate, open, toast });
    } else {
      open(it.kind, undefined, { singleton: true });
    }
    setMenuOpen(false);
  }

  return (
    <>
      {/* Feuille de menu plein écran */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1020]/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <span className="text-lg font-bold text-slate-100">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-200 hover:bg-white/10">✕</button>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-8">
            {NAV.map((group) => (
              <div key={group.cat}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.cat}</div>
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map((it) => {
                    const locked = isLockedItem(it);
                    return (
                      <button
                        key={it.label}
                        onClick={() => go(it)}
                        disabled={locked}
                        className={`relative flex flex-col items-center gap-1 rounded-xl py-3 text-center active:scale-95 ${locked ? 'bg-black/20 opacity-45' : 'bg-black/30 hover:bg-white/10'}`}
                      >
                        <span className="text-2xl leading-none">{locked ? '🔒' : it.emoji}</span>
                        <span className="text-[11px] text-slate-300">{it.label}</span>
                        {locked && <span className="absolute right-1 top-1 text-[9px] font-bold text-amber-300">Nv.{reqForItem(it)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dock du bas */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b1020]/90 backdrop-blur-sm px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex shrink-0 flex-col items-center rounded-xl bg-sky-500/30 px-3 py-1.5 text-sky-100 active:scale-95"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="text-[10px]">Menu</span>
          </button>

          {/* Onglets des fenêtres ouvertes */}
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {tabs.length === 0 ? (
              <div className="flex h-full items-center px-2 text-xs text-slate-500">Ouvre une section via le menu ☰</div>
            ) : (
              tabs.map((w) => {
                const meta = LABEL[w.kind]!;
                const active = w.id === activeId;
                // Titre contextuel posé par HuntCard (ex: "🗿 Gardien des Anciens") pour
                // les boss ; sinon libellé générique du dock (ex: "Combat" pour hunt).
                const dockText = w.title ?? DOCK_LABEL_OVERRIDE[w.kind] ?? meta.label;
                return (
                  <div
                    key={w.id}
                    className={`flex shrink-0 items-center rounded-xl ${active ? 'bg-white/20' : 'bg-black/30'}`}
                  >
                    <button onClick={() => focus(w.id)} className="flex items-center gap-1 py-2 pl-3 pr-1.5">
                      {!w.title && <span className="text-base leading-none">{meta.emoji}</span>}
                      <span className="max-w-[7rem] truncate text-xs text-slate-200">{dockText}</span>
                    </button>
                    <button
                      onClick={() => close(w.id)}
                      className="grid h-9 w-9 place-items-center rounded-r-xl text-slate-400 hover:text-rose-300 active:bg-rose-500/20"
                      aria-label="Fermer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
