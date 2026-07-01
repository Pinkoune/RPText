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
  /** Couleur d'accent de l'UI dans ce biome. */
  accent: string;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Forêt de Sylvebois',
    emoji: '🌲',
    minLevel: 1,
    desc: 'Bois denses et clairières. Idéal pour débuter.',
    accent: '#7bd88f',
    bg: {
      dawn: ['#3e5c76', '#7293a0', '#a8c79a'],
      day: ['#4287f5', '#9bc0f5', '#a2e0ae'],
      dusk: ['#1d3326', '#5a4a2e', '#caa15a'],
      night: ['#0a1710', '#10241a', '#1c3a28'],
    },
  },
  plains: {
    id: 'plains',
    name: 'Plaines de Vent-d\'Or',
    emoji: '🌾',
    minLevel: 3,
    desc: 'Étendues herbeuses balayées par le vent.',
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
    desc: 'Sommets enneigés et air glacial. Fond blanc/bleu.',
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
    desc: 'Sable brûlant le jour, glacial la nuit.',
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
    desc: 'Eaux stagnantes et brouillards toxiques.',
    accent: '#8fd0a0',
    bg: {
      dawn: ['#2a3a30', '#4a5a40', '#7a8a60'],
      day: ['#33523a', '#557a50', '#88a070'],
      dusk: ['#22302a', '#3a4a38', '#5a6a4a'],
      night: ['#08100c', '#101c14', '#1c3024'],
    },
  },
  frozen: {
    id: 'frozen',
    name: 'Abysse Gelé',
    emoji: '❄️',
    minLevel: 28,
    desc: 'Le bout du monde connu. Réservé aux vétérans.',
    accent: '#c0e8ff',
    bg: {
      dawn: ['#3a4a6a', '#7a90c0', '#d0e4f7'],
      day: ['#5a7ab0', '#a8c8ee', '#eef6ff'],
      dusk: ['#2a3550', '#5a6a90', '#a0b0d0'],
      night: ['#060c18', '#0e1830', '#1e3050'],
    },
  },
};

export const BIOME_LIST = Object.values(BIOMES).sort((a, b) => a.minLevel - b.minLevel);
