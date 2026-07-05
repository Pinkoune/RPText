import type { IconType } from 'react-icons';
import {
  GiSlime, GiWolfHead, GiBat, GiOakLeaf, GiBoarTusks, GiRobberMask, GiWaveCrest,
  GiMammoth, GiGhost, GiStoneTower, GiScorpion, GiFlame, GiSunPriest, GiHydra,
  GiTroll, GiVortex, GiShadowFollower, GiEyeball,
  // Nécropole de Cristal
  GiGhostAlly, GiBoneKnife, GiHoodedAssassin, GiCrystalCluster, GiTombstone,
} from 'react-icons/gi';

// Registre id de monstre -> icône Game Icons (react-icons/gi). Les monstres non
// mappés retombent sur leur emoji (voir <MonsterIcon>). Miroir de items.ts/icons.ts.
export const MONSTER_ICONS: Record<string, IconType> = {
  slime: GiSlime, wolf: GiWolfHead, bat: GiBat, dryad: GiOakLeaf,
  boar: GiBoarTusks, bandit: GiRobberMask, water_elemental: GiWaveCrest,
  yeti: GiMammoth, wraith: GiGhost, golem: GiStoneTower,
  scorpion: GiScorpion, efreet: GiFlame, sun_priest: GiSunPriest,
  hydra: GiHydra, troll_shaman: GiTroll,
  voidling: GiVortex, shadow_stalker: GiShadowFollower, abyssal_horror: GiEyeball,
  crypt_wraith: GiGhostAlly, bone_golem: GiBoneKnife, crypt_lich: GiHoodedAssassin,
  crystal_horror: GiCrystalCluster, crypt_warden: GiTombstone,
};

export function hasMonsterIcon(id: string): boolean {
  return !!MONSTER_ICONS[id];
}
