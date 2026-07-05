export function generateEndlessMonster(floor: number) {
  const isBoss = floor % 5 === 0;
  // Courbe douce : linéaire + racine carrée (évite l'explosion quadratique aux étages élevés)
  const hp = Math.floor(150 + 40 * floor + 6 * Math.pow(floor, 1.6)) * (isBoss ? 2 : 1);
  const atk = Math.floor(15 + 3.5 * floor + 0.6 * Math.pow(floor, 1.5)) * (isBoss ? 1.5 : 1);
  const def = Math.floor(5 + 1.5 * floor + 0.25 * Math.pow(floor, 1.4)) * (isBoss ? 1.4 : 1);
  
  return {
    name: isBoss ? `Seigneur Abyssal de l'Étage ${floor}` : `Créature Abyssale (Étage ${floor})`,
    emoji: isBoss ? '💀' : '👿',
    hp,
    maxHp: hp,
    atk,
    def,
    isBoss
  };
}

export function getEndlessRewards(floor: number) {
  if (floor % 10 !== 0) {
    return { gold: 0, xp: 0, gems: 0 };
  }
  
  const gold = Math.floor(10 + floor * 5 + Math.pow(floor, 1.5)) * 5;
  const xp = Math.floor(20 + floor * 10 + Math.pow(floor, 1.8)) * 3;
  const gems = 5;
  
  return { gold, xp, gems };
}
