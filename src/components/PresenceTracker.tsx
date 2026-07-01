import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { trackPresence } from '../firebase/socialService';

export default function PresenceTracker() {
  const status = useGame((s) => s.status);
  const player = useGame((s) => s.player);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    
    // Le callback vide suffit car LeaderboardCard fait sa propre écoute.
    // L'important est que ce tracker tourne en arrière-plan pour maintenir notre statut en ligne.
    const unsub = trackPresence(
      { uid: player.uid, name: player.name, level: player.level },
      () => {}
    );
    return () => unsub();
  }, [status, player?.uid, player?.level, player?.name]);

  return null;
}
