import { useState } from 'react';
import { COMMANDS, type CommandDef } from '../../game/commands';
import { useGame } from '../../store/gameStore';

const CATEGORIES: { id: CommandDef['category']; icon: string }[] = [
  { id: 'Jeu', icon: '🎮' },
  { id: 'Combat', icon: '⚔️' },
  { id: 'Récolte', icon: '🌿' },
  { id: 'Casino', icon: '🎰' },
  { id: 'Multijoueur', icon: '👥' },
  { id: 'Système', icon: '⚙️' },
];

/**
 * Les jauges du jeu, expliquées une fois pour toutes.
 *
 * Il y a beaucoup de compteurs (niveau, artefact, métiers, Éclats, maîtrises) et
 * rien ne disait lequel monte avec quoi ni à quoi il sert. C'est la première
 * chose que voit quelqu'un qui ouvre l'aide parce qu'il est perdu.
 */
const GAUGES: { icon: string; name: string; feeds: string; gives: string; note?: string }[] = [
  {
    icon: '⭐', name: 'Niveau (1 → 50)',
    feeds: 'Combat, donjons, récolte, forge, camp.',
    gives: 'Des statistiques et un point de talent par niveau.',
  },
  {
    icon: '🔮', name: 'Artefact = ta saison',
    feeds: 'La MÊME XP que ton niveau, plus les victoires PvP.',
    gives: 'Les mods de la grille, ton rang de saison et les paliers de la passe.',
    note: 'Repart à zéro à chaque saison. Continue de monter après le Nv.50.',
  },
  {
    icon: '🔨', name: 'Métiers',
    feeds: 'Récolter, forger, concocter.',
    gives: 'Accès aux recettes et aux ressources de meilleur niveau.',
  },
  {
    icon: '✧', name: 'Éclats de Relique',
    feeds: 'Succès accomplis, paliers de la passe, artefact au-delà de la grille.',
    gives: 'Les étoiles de ta Relique.',
    note: 'La Relique traverse les renaissances ET les saisons.',
  },
  {
    icon: '🏅', name: 'Maîtrise de biome',
    feeds: 'Tes kills, comptés par zone.',
    gives: 'Un bonus d\'XP et d\'or permanent dans cette zone, et un titre.',
  },
  {
    icon: '⚡', name: 'Puissance',
    feeds: 'Rien directement — c\'est la somme de tout le reste.',
    gives: 'Ta place au classement.',
  },
];

export default function HelpCard() {
  const p = useGame((s) => s.player);
  const lvl = p?.level ?? 0;
  const ignoreReq = p?.ignoreRestrictions ?? false;
  const [q, setQ] = useState('');
  const [showLocked, setShowLocked] = useState(false);
  const [showGauges, setShowGauges] = useState(false);

  const needle = q.trim().toLowerCase();
  const isLocked = (c: CommandDef) => !ignoreReq && (c.reqLevel ?? 1) > lvl && !(p && c.alsoIf?.(p));
  const matches = (c: CommandDef) =>
    !needle
    || c.name.includes(needle)
    || c.aliases.some((a) => a.includes(needle))
    || c.desc.toLowerCase().includes(needle);

  const visible = COMMANDS.filter((c) => !c.hidden && matches(c) && (showLocked || needle || !isLocked(c)));
  const lockedCount = COMMANDS.filter((c) => !c.hidden && isLocked(c)).length;

  return (
    <div className="space-y-3">
      {/* Les jauges : repliées par défaut, parce que l'aide sert d'abord à
          retrouver une commande. Mais présentes, parce que « quelle jauge monte
          avec quoi » n'était expliqué nulle part. */}
      <button
        onClick={() => setShowGauges((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl bg-black/25 px-3 py-2.5 text-left hover:bg-white/5"
      >
        <span className="text-sm font-semibold text-slate-200">📊 Les jauges du jeu — qui monte avec quoi</span>
        <span className="text-slate-500">{showGauges ? '▾' : '▸'}</span>
      </button>
      {showGauges && (
        <div className="space-y-1.5">
          {GAUGES.map((g) => (
            <div key={g.name} className="rounded-lg bg-black/25 p-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-base leading-none">{g.icon}</span>
                <span className="text-sm font-semibold text-slate-100">{g.name}</span>
              </div>
              <div className="mt-1 space-y-0.5 pl-6 text-[11px] leading-snug">
                <div className="text-slate-400"><span className="text-slate-500">Monte avec </span>{g.feeds}</div>
                <div className="text-slate-400"><span className="text-slate-500">Sert à </span>{g.gives}</div>
                {g.note && <div className="text-sky-300/80">{g.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recherche : 63 commandes en liste plate, c'était un mur. */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher une commande…"
          className="min-w-0 flex-1 rounded-lg bg-black/35 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-sky-400/60"
        />
        {q && (
          <button onClick={() => setQ('')} className="shrink-0 rounded-lg bg-black/30 px-2.5 py-2 text-xs text-slate-400 hover:bg-white/10">
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          <kbd className="rounded bg-black/40 px-1">Tab</kbd> complète ·{' '}
          <kbd className="rounded bg-black/40 px-1">↑ ↓</kbd> historique
        </span>
        {lockedCount > 0 && !needle && (
          <button onClick={() => setShowLocked((v) => !v)} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-white/10">
            {showLocked ? 'Masquer' : 'Afficher'} les {lockedCount} verrouillées
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl bg-black/25 py-6 text-center text-sm text-slate-500">Aucune commande ne correspond.</p>
      )}

      {CATEGORIES.map(({ id: cat, icon }) => {
        const cmds = visible
          .filter((c) => c.category === cat)
          .sort((a, b) => (a.reqLevel ?? 1) - (b.reqLevel ?? 1) || a.name.localeCompare(b.name));
        if (cmds.length === 0) return null;
        return (
          <div key={cat}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon} {cat}</div>
            <div className="space-y-1">
              {cmds.map((c) => {
                const locked = isLocked(c);
                return (
                  <div
                    key={c.name}
                    title={c.aliases.length ? `Alias : ${c.aliases.join(', ')}` : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${locked ? 'bg-black/10 opacity-50' : 'bg-black/20'}`}
                  >
                    <span className={`w-24 shrink-0 font-mono text-[13px] font-semibold ${locked ? 'text-slate-400' : 'text-sky-300'}`}>
                      {locked && '🔒 '}{c.name}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-300">{c.desc}</span>
                    {locked && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">Nv.{c.reqLevel}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
