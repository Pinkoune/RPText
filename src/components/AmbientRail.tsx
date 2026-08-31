import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { seasonTheme, artifactXpToNext } from '../game/artifact';
import { getRaidWindow } from '../game/raid';

const SETTINGS_KEY = 'rptext.settings';

/** Le rail est masqué par défaut sur mobile : l'écran y est déjà chargé. */
function railEnabled(isMobile: boolean): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const v = raw ? JSON.parse(raw).ambientRail : undefined;
    return v === undefined ? !isMobile : v === true;
  } catch {
    return !isMobile;
  }
}

function Chip({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur transition hover:bg-black/65"
    >
      {children}
    </button>
  );
}

/**
 * Rail d'infos ambiantes — coin bas-droit, au-dessus de la barre de commande.
 *
 * Règle tenue volontairement stricte : QUATRE emplacements maximum, chacun
 * réduit à une pastille cliquable. L'intérêt est de voir d'un coup d'œil ce
 * qui bouge (qui est là, où en est la saison, quand tombe le raid) sans
 * encombrer un écran qui porte déjà une barre du haut et des fenêtres.
 */
export default function AmbientRail() {
  const p = useGame((s) => s.player);
  const open = useUi((s) => s.open);
  const isMobile = useIsMobile();
  // Lecture seule : PresenceTracker est l'unique abonné à la présence.
  const online = useGame((s) => s.onlinePlayers);
  const teams = useGame((s) => s.teams);
  const [, tick] = useState(0);

  // Le compte à rebours du raid doit avancer sans dépendre d'un autre rendu.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!p || !railEnabled(isMobile)) return null;

  const myTeam = teams.find((t) => p.uid in (t.members ?? {}));
  const members = myTeam ? Object.entries(myTeam.members) : [];
  const theme = seasonTheme(p.artifact?.season);
  const art = p.artifact;
  const artPct = art ? Math.min(100, (art.xp / artifactXpToNext(art.level)) * 100) : 0;
  const raid = getRaidWindow();

  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-10 flex flex-col items-end gap-1.5 sm:bottom-20">
      {/* 1. Équipe : têtes des membres, avec leur classe et leur niveau. */}
      {members.length > 1 && (
        <Chip title={`Ton équipe (${members.length})`} onClick={() => open('team', undefined, { singleton: true })}>
          <span className="flex -space-x-1">
            {members.slice(0, 4).map(([uid, m]) => (
              <span
                key={uid}
                title={`${m.name} — Nv.${m.level}`}
                className="grid h-5 w-5 place-items-center rounded-full bg-sky-500/30 text-[9px] font-bold uppercase text-sky-100 ring-1 ring-black/40"
              >
                {m.name.slice(0, 1)}
              </span>
            ))}
          </span>
          <span className="tabular-nums">{members.length}</span>
        </Chip>
      )}

      {/* 2. Qui est en ligne. */}
      {online.length > 0 && (
        <Chip title={online.map((o) => `${o.name} (Nv.${o.level})`).join('\n')} onClick={() => open('leaderboard', undefined, { singleton: true })}>
          🟢 <span className="tabular-nums">{online.length}</span> en ligne
        </Chip>
      )}

      {/* 3. Artefact de saison : la jauge qui monte tout le temps. */}
      {art && (
        <Chip title={`${theme.artifactName} — niveau ${art.level}`} onClick={() => open('artifact', undefined, { singleton: true })}>
          <span>{theme.emoji}</span>
          <span className="tabular-nums" style={{ color: theme.color }}>Nv.{art.level}</span>
          <span className="h-1 w-8 overflow-hidden rounded-full bg-black/60">
            <span className="block h-full rounded-full" style={{ width: `${artPct}%`, background: theme.color }} />
          </span>
        </Chip>
      )}

      {/* 4. Rendez-vous de raid imminent (le seul rendez-vous a heure fixe). */}
      {raid.open && p.level >= 22 && (
        <Chip title="Les inscriptions au raid sont ouvertes" onClick={() => open('dungeon', undefined, { singleton: true })}>
          <span className="animate-pulse">🔱</span> raid ouvert · {Math.max(1, Math.round(raid.msLeft / 60_000))} min
        </Chip>
      )}
    </div>
  );
}
