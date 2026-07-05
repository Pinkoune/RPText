import type { BiomeId, Phase } from './types';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  emoji: string;
  /** Niveau minimum pour débloquer. */
  minLevel: number;
  desc: string;
  /** Dégradés CSS par phase pour le fond d'écran. */
  bg: Record<Phase, [string, string, string]>;
  /** Couleurs des silhouettes (premier plan, arrière plan). Si absent, utilise bg[0] et bg[1]. */
  fg?: Record<Phase, [string, string]>;
  /** Couleur d'accent de l'UI dans ce biome. */
  accent: string;
  /** Multiplicateur d'XP pour les combats de chasse dans ce biome. */
  xpMult: number;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Forêt de Sylvebois',
    emoji: '🌲',
    minLevel: 1,
    xpMult: 1.0,
    desc: 'Bois denses et clairières. Le fil de soie de ses araignées ne se trouve nulle part ailleurs.',
    accent: '#7bd88f',
    bg: {
      dawn: ['#3e5c76', '#7293a0', '#a8c79a'],
      day: ['#4287f5', '#9bc0f5', '#a2e0ae'],
      dusk: ['#1d3326', '#5a4a2e', '#caa15a'],
      night: ['#0a1710', '#10241a', '#1c3a28'],
    },
    fg: {
      dawn: ['#2e4a3a', '#3d6b4f'],
      day: ['#1f4d2e', '#2f7a45'],
      dusk: ['#1d3326', '#5a4a2e'],
      night: ['#0a1710', '#10241a'],
    },
  },
  plains: {
    id: 'plains',
    name: 'Plaines de Vent-d\'Or',
    emoji: '🌾',
    minLevel: 3,
    xpMult: 1.0,
    desc: 'Étendues herbeuses balayées par le vent. Ses fleurs sauvages ne poussent qu\'ici.',
    accent: '#e6d27a',
    bg: {
      dawn: ['#5a5a3a', '#9a8f55', '#e9dca0'],
      day: ['#6b8f3a', '#a9c45a', '#f0e6a0'],
      dusk: ['#4a3a2a', '#8a6a3a', '#e0b060'],
      night: ['#14160c', '#22251a', '#383b2a'],
    },
  },
  mountains: {
    id: 'mountains',
    name: 'Pics de Givre-Cime',
    emoji: '🏔️',
    minLevel: 8,
    xpMult: 1.3,
    desc: 'Sommets enneigés et air glacial. Seul son sous-sol recèle du mithril.',
    accent: '#9fd0ff',
    bg: {
      dawn: ['#5a6b8a', '#aab8d0', '#e8eef7'],
      day: ['#6e8fc0', '#bcd2ee', '#ffffff'],
      dusk: ['#4a5570', '#8a90b0', '#d8c0d0'],
      night: ['#0c1422', '#1a2740', '#33486e'],
    },
  },
  desert: {
    id: 'desert',
    name: 'Dunes de Braise',
    emoji: '🏜️',
    minLevel: 14,
    xpMult: 1.5,
    desc: 'Sable brûlant le jour, glacial la nuit. Ses éclats solaires n\'existent que là.',
    accent: '#f0b46a',
    bg: {
      dawn: ['#7a5a3a', '#c89055', '#f0d0a0'],
      day: ['#b07a30', '#e0b060', '#f7e0a8'],
      dusk: ['#6a3a2a', '#b05a3a', '#e89050'],
      night: ['#1a1208', '#2a1e10', '#3e2c18'],
    },
  },
  swamp: {
    id: 'swamp',
    name: 'Marais de Brume-Pâle',
    emoji: '🐸',
    minLevel: 20,
    xpMult: 1.8,
    desc: 'Eaux stagnantes et brouillards toxiques. Racines et poissons des vases uniques au monde.',
    accent: '#8fd0a0',
    bg: {
      dawn: ['#2a3a30', '#4a5a40', '#7a8a60'],
      day: ['#33523a', '#557a50', '#88a070'],
      dusk: ['#22302a', '#3a4a38', '#5a6a4a'],
      night: ['#08100c', '#101c14', '#1c3024'],
    },
  },
  volcano: {
    id: 'volcano',
    name: 'Caldeira de Braise',
    emoji: '🌋',
    minLevel: 24,
    xpMult: 2.0,
    desc: 'Un champ de lave à ciel ouvert où la roche fond et où rôdent démons et golems de magma.',
    accent: '#f97316',
    bg: {
      dawn: ['#2b0a06', '#5a1608', '#9a2b0e'],
      day: ['#2b0a06', '#5a1608', '#b3350f'],
      dusk: ['#25060a', '#5a1608', '#8a2408'],
      night: ['#180404', '#3a0d06', '#611806'],
    },
  },
  crypt: {
    id: 'crypt',
    name: 'Nécropole de Cristal',
    emoji: '🪦',
    minLevel: 30,
    xpMult: 2.2,
    desc: 'Ruines englouties où poussent des cristaux noirs. Les morts n\'y reposent pas vraiment.',
    accent: '#7dd3c8',
    bg: {
      dawn: ['#0e1a1c', '#1c3a38', '#2f5c54'],
      day: ['#0e1a1c', '#1f4340', '#3a6b60'],
      dusk: ['#0c1618', '#1a2f2e', '#2a4a44'],
      night: ['#050b0c', '#0e1c1c', '#173330'],
    },
    fg: {
      dawn: ['#0a1414', '#163028'],
      day: ['#0a1414', '#163028'],
      dusk: ['#0a1414', '#163028'],
      night: ['#050b0c', '#0e1c1c'],
    },
  },
  frozen: {
    id: 'frozen',
    name: 'Abysses du Vide',
    emoji: '🌌',
    minLevel: 38,
    xpMult: 2.6,
    desc: 'Le néant absolu où la lumière s\'éteint. Réservé aux vétérans cherchant à affronter les ombres.',
    accent: '#a855f7',
    bg: {
      dawn: ['#0f0524', '#170b3b', '#2e1065'],
      day: ['#0f0524', '#170b3b', '#2e1065'],
      dusk: ['#0f0524', '#170b3b', '#2e1065'],
      night: ['#0f0524', '#170b3b', '#2e1065'],
    },
  },
};

export const BIOME_LIST = Object.values(BIOMES).sort((a, b) => a.minLevel - b.minLevel);
