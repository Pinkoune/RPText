import { useGame } from '../store/gameStore';
import { isFirebaseConfigured } from '../firebase/config';

export default function Login() {
  const signIn = useGame((s) => s.signIn);

  return (
    <div className="grid h-full place-items-center bg-gradient-to-b from-[#0b1020] via-[#101a36] to-[#1a2b52] px-6">
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center animate-floatIn">
        <div className="mb-2 text-5xl">⚔️🎲</div>
        <h1 className="text-3xl font-bold tracking-tight text-glow">RPText</h1>
        <p className="mt-2 text-sm text-slate-300">
          Un RPG textuel multijoueur. Chasse, monte en niveau, et tente le
          destin au casino. Le monde vit au rythme du jour et de la nuit.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-slate-800 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.5 6.1 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 18.9 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.5 6.1 28.9 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.6 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
            </svg>
            Se connecter avec Google
          </button>
          
          <button
            onClick={() => signIn('github')}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#24292e] px-4 py-3 font-medium text-white transition hover:bg-[#2f363d] active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            Se connecter avec GitHub
          </button>
        </div>

        {!isFirebaseConfigured && (
          <p className="mt-4 text-xs text-amber-300/90">
            Mode local actif (Firebase non configuré) : la connexion crée un
            héros stocké sur cet appareil. Ajoute tes clés dans
            <code className="mx-1 rounded bg-black/30 px-1">.env.local</code>
            pour activer Google + le multijoueur.
          </p>
        )}
      </div>
    </div>
  );
}
