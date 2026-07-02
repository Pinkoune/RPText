import { spendTalent } from './src/game/talents';
import { PlayerState } from './src/game/types';

const player = {
  classId: 'healer',
  level: 5,
  talentPoints: 4,
  talents: undefined, // Simulating the undefined issue
} as any as PlayerState;

console.log('Before:', player.talentPoints, player.talents);
const ok = spendTalent(player, 'h_vitality');
console.log('After:', ok, player.talentPoints, player.talents);
