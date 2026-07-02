import type { PlayerState } from './types';
import type { WindowKind } from '../store/uiStore';
import { pickMonster } from './monsters';
import { cooldownLeft } from './player';
import { item } from './items';
import { deriveStats, removeItem } from './player';
import { currentPhase } from './daynight';
import { addQuestMetric } from './quests';
import { GATHER_SKILLS, type GatherSkillId } from './gathering';

export interface CommandCtx {
  getPlayer: () => PlayerState | null;
  mutate: (fn: (p: PlayerState) => void) => void;
  open: (kind: WindowKind, payload?: unknown, opts?: { ttl?: number; singleton?: boolean }) => string;
  toast: (text: string, tone?: 'info' | 'good' | 'bad' | 'gold') => void;
}

export interface CommandDef {
  name: string;
  aliases: string[];
  desc: string;
  category: 'Jeu' | 'Combat' | 'Récolte' | 'Casino' | 'Multijoueur' | 'Système';
}

export const COMMANDS: CommandDef[] = [
  { name: 'profile', aliases: ['profil', 'p', 'me'], desc: 'Affiche ta carte de profil.', category: 'Jeu' },
  { name: 'hunt', aliases: ['chasse', 'h'], desc: 'Pars chasser un monstre du biome actuel.', category: 'Combat' },
  { name: 'adventure', aliases: ['adv', 'aventure'], desc: 'Pars pour une grande aventure dangereuse (15 min de CD).', category: 'Combat' },
  { name: 'dungeon', aliases: ['donjon', 'dj'], desc: 'Donjons à étapes (combats enchaînés, gros butin).', category: 'Combat' },
  { name: 'talents', aliases: ['talent', 'skills', 'competences', 'compétences'], desc: 'Arbre de talents de ta classe (points par niveau).', category: 'Combat' },
  { name: 'map', aliases: ['carte', 'm'], desc: 'Ouvre la carte des biomes.', category: 'Jeu' },
  { name: 'inventory', aliases: ['inv', 'sac', 'i'], desc: 'Ouvre ton inventaire.', category: 'Jeu' },
  { name: 'equipment', aliases: ['equip', 'équip', 'stuff', 'gear'], desc: 'Gère ton équipement (arme, armure, bijou).', category: 'Jeu' },
  { name: 'cooldown', aliases: ['cd', 'cooldowns', 'recup'], desc: 'Affiche les récupérations en cours.', category: 'Jeu' },
  { name: 'experience', aliases: ['xp', 'exp', 'niveau', 'level'], desc: 'Expérience d\'aventure et de farm.', category: 'Jeu' },
  { name: 'craft', aliases: ['forge', 'fabriquer'], desc: 'Forge de l\'équipement avec tes matériaux.', category: 'Jeu' },
  { name: 'gather', aliases: ['farm', 'recolte', 'récolte'], desc: 'Récolte les ressources du biome (vue d\'ensemble).', category: 'Récolte' },
  { name: 'chop', aliases: ['bois', 'woodcut'], desc: 'Bûcheronnage : récolte du bois.', category: 'Récolte' },
  { name: 'mine', aliases: ['miner', 'minage'], desc: 'Minage : pierre, fer, mithril, cristal.', category: 'Récolte' },
  { name: 'fish', aliases: ['peche', 'pêche'], desc: 'Pêche : poissons.', category: 'Récolte' },
  { name: 'forage', aliases: ['cueillette', 'cueillir'], desc: 'Cueillette : herbes médicinales.', category: 'Récolte' },
  { name: 'casino', aliases: ['gamble', 'pari', 'g'], desc: 'Entre au casino (pile/face, blackjack, machine, roue).', category: 'Casino' },
  { name: 'shop', aliases: ['boutique', 'store'], desc: 'Achète potions et équipement.', category: 'Jeu' },
  { name: 'fateshop', aliases: ['fate', 'destin', 'boutiquefate'], desc: 'Boutique du Destin : dépense tes Fate Coins.', category: 'Casino' },
  { name: 'market', aliases: ['marche', 'marché', 'hv', 'vente'], desc: 'Marché entre joueurs : vendre et acheter.', category: 'Multijoueur' },
  { name: 'heal', aliases: ['soin', 'potion'], desc: 'Bois une potion pour récupérer des PV.', category: 'Combat' },
  { name: 'quests', aliases: ['quetes', 'quêtes', 'q', 'daily', 'quotidien'], desc: 'Quêtes journalières et hebdomadaires.', category: 'Jeu' },
  { name: 'duel', aliases: ['pvp', 'defi'], desc: 'Défie un autre joueur au pile/face (mise en or).', category: 'Multijoueur' },
  { name: 'cardjitsu', aliases: ['cj', 'cards', 'ninja', 'cartes'], desc: 'Duel de cartes Card-Jitsu (feu/eau/neige).', category: 'Multijoueur' },
  { name: 'team', aliases: ['equipe', 'équipe', 'party'], desc: 'Forme une équipe et partage des ressources.', category: 'Multijoueur' },
  { name: 'guild', aliases: ['guilde', 'clan'], desc: 'Rejoins ou fonde une guilde.', category: 'Multijoueur' },
  { name: 'familiar', aliases: ['familier', 'pet', 'compagnon'], desc: 'Adopte et équipe un familier (petit bonus de stats).', category: 'Jeu' },
  { name: 'boss', aliases: ['raid', 'worldboss'], desc: 'Attaque le boss mondial avec les autres joueurs.', category: 'Multijoueur' },
  { name: 'chat', aliases: ['tchat', 'say'], desc: 'Chat mondial avec les joueurs connectés.', category: 'Multijoueur' },
  { name: 'leaderboard', aliases: ['classement', 'top', 'lb'], desc: 'Affiche le classement et les joueurs en ligne.', category: 'Multijoueur' },
  { name: 'stats', aliases: ['statistiques', 'stat', 'st'], desc: 'Affiche toutes tes statistiques.', category: 'Jeu' },
  { name: 'events', aliases: ['event', 'evenement', 'événement', 'evenements', 'événements'], desc: 'Événements mondiaux et régionaux en cours.', category: 'Jeu' },
  { name: 'achievements', aliases: ['succes', 'succès', 'trophees', 'trophées', 'achi'], desc: 'Tes succès et leurs récompenses.', category: 'Jeu' },
  { name: 'news', aliases: ['changelog', 'nouveautes', 'nouveautés', 'patchnotes'], desc: 'Historique complet des mises à jour.', category: 'Système' },
  { name: 'help', aliases: ['aide', 'commands', '?'], desc: 'Liste toutes les commandes.', category: 'Système' },
  { name: 'close', aliases: ['clear', 'esc'], desc: 'Ferme toutes les fenêtres.', category: 'Système' },
  { name: 'reset', aliases: ['resetui'], desc: "Réinitialise la position et l'état de toutes les fenêtres.", category: 'Système' },
  { name: 'wiki', aliases: ['bestiaire', 'items', 'encyclopedie'], desc: "Consulte l'encyclopédie des objets et des monstres.", category: 'Système' },
];

const ALIAS_MAP: Record<string, string> = {};
for (const c of COMMANDS) {
  ALIAS_MAP[c.name] = c.name;
  for (const a of c.aliases) ALIAS_MAP[a] = c.name;
}

export function resolveCommand(input: string): string | null {
  const word = input.trim().toLowerCase().split(/\s+/)[0];
  return ALIAS_MAP[word] ?? null;
}

export const HUNT_COOLDOWN = 20_000; // 20s (Façon EPIC RPG)
export const DAILY_COOLDOWN = 20 * 60 * 60 * 1000; // 20h

export function runCommand(input: string, ctx: CommandCtx): void {
  const cmd = resolveCommand(input);
  const p = ctx.getPlayer();
  if (!cmd) {
    ctx.toast(`Commande inconnue : "${input}". Tape "help".`, 'bad');
    return;
  }
  if (!p && cmd !== 'help') return;

  switch (cmd) {
    case 'profile':
      ctx.open('profile', undefined, { singleton: true });
      break;

    case 'reset':
      import('../store/uiStore').then(({ useUi }) => {
        useUi.getState().resetPrefs();
        useUi.getState().closeAll();
        ctx.toast('Toutes les fenêtres ont été réinitialisées.', 'info');
      });
      break;

    case 'map':
      ctx.open('map', undefined, { singleton: true });
      break;

    case 'inventory':
      ctx.open('inventory', undefined, { singleton: true });
      break;

    case 'equipment':
      ctx.open('equipment', undefined, { singleton: true });
      break;

    case 'mathieukdo':
      if (ctx.p.claimedMathieuKdo) {
        ctx.toast('Tu as déjà réclamé ce cadeau !', 'bad');
      } else {
        ctx.mutate((d) => {
          d.claimedMathieuKdo = true;
          d.inventory['heartsteel'] = (d.inventory['heartsteel'] || 0) + 1;
        });
        ctx.toast('🎁 Tu as reçu le Coeuracier !', 'good');
      }
      break;

    case 'cooldown':
      ctx.open('cooldown', undefined, { singleton: true });
      break;

    case 'experience':
      ctx.open('experience', undefined, { singleton: true });
      break;

    case 'casino':
      ctx.open('casino', undefined, { singleton: true });
      break;

    case 'shop':
      ctx.open('shop', undefined, { singleton: true });
      break;

    case 'fateshop':
      ctx.open('fateshop', undefined, { singleton: true });
      break;

    case 'craft':
      ctx.open('craft', undefined, { singleton: true });
      break;

    case 'gather':
      ctx.open('gather', undefined, { singleton: true });
      break;

    case 'dungeon':
      ctx.open('dungeon', undefined, { singleton: true });
      break;

    case 'talents':
      ctx.open('talents', undefined, { singleton: true });
      break;

    case 'market':
      ctx.open('market', undefined, { singleton: true });
      break;

    case 'chop':
    case 'mine':
    case 'fish':
    case 'forage': {
      const skill = cmd as GatherSkillId;
      ctx.open('gather', skill, { singleton: true });
      break;
    }

    case 'quests':
      ctx.open('quests', undefined, { singleton: true });
      break;

    case 'duel':
      ctx.open('duel', undefined, { singleton: true });
      break;

    case 'cardjitsu':
      ctx.open('cardjitsu', undefined, { singleton: true });
      break;

    case 'team':
      ctx.open('team', undefined, { singleton: true });
      break;

    case 'guild':
      ctx.open('guild', undefined, { singleton: true });
      break;

    case 'familiar':
      ctx.open('familiar', undefined, { singleton: true });
      break;

    case 'events':
      ctx.open('events', undefined, { singleton: true });
      break;

    case 'achievements':
      ctx.open('achievements', undefined, { singleton: true });
      break;

    case 'news':
      ctx.open('news', undefined, { singleton: true });
      break;
    case 'wiki':
      ctx.open('wiki', undefined, { singleton: true });
      break;

    case 'boss':
      ctx.open('boss', undefined, { singleton: true });
      break;

    case 'chat':
      ctx.open('chat', undefined, { singleton: true });
      break;

    case 'leaderboard':
      ctx.open('leaderboard', undefined, { singleton: true });
      break;

    case 'help':
      ctx.open('help', undefined, { singleton: true });
      break;

    case 'stats':
      ctx.open('stats', undefined, { singleton: true });
      break;

    case 'close':
      ctx.open('close' as WindowKind); // intercepté dans le composant
      break;

    case 'heal': {
      const has = ['hi_potion', 'potion'].find((id) => (p!.inventory[id] ?? 0) > 0);
      if (!has) {
        ctx.toast('Aucune potion. Va à la boutique (shop).', 'bad');
        break;
      }
      ctx.mutate((d) => {
        const heal = item(has)!.hp ?? 0;
        const max = deriveStats(d).maxHp;
        removeItem(d, has);
        d.hp = Math.min(max, d.hp + heal);
      });
      ctx.toast(`Tu bois une ${item(has)!.name} (+${item(has)!.hp} PV).`, 'good');
      break;
    }

    case 'hunt': {
      const left = cooldownLeft(p!, 'hunt', HUNT_COOLDOWN);
      if (left > 0) {
        ctx.toast(`Tu es essoufflé. Attends ${(left / 1000).toFixed(0)}s.`, 'bad');
        break;
      }
      if (p!.hp <= 0) {
        ctx.toast('Tu es K.O. ! Soigne-toi (heal) avant de chasser.', 'bad');
        break;
      }
      const monster = pickMonster(p!.biome, currentPhase(), p!.level);
      ctx.mutate((d) => {
        d.cooldowns.hunt = Date.now();
        addQuestMetric(d, 'hunts', 1);
        if (!d.statistics.mobsEncountered) d.statistics.mobsEncountered = {};
        d.statistics.mobsEncountered[monster.id] = (d.statistics.mobsEncountered[monster.id] ?? 0) + 1;
      });
      // Ouvre une rencontre interactive (fenêtre unique).
      ctx.open('hunt', { monster, id: Date.now() }, { singleton: true });
      break;
    }

    case 'adventure': {
      const left = cooldownLeft(p!, 'adventure', 15 * 60 * 1000);
      if (left > 0) {
        ctx.toast(`L'aventure est dangereuse. Attends ${Math.ceil(left / 60000)} minutes.`, 'bad');
        break;
      }
      if (p!.hp <= 0) {
        ctx.toast('Tu es K.O. ! Soigne-toi avant de partir à l\'aventure.', 'bad');
        break;
      }
      const baseMonster = pickMonster(p!.biome, currentPhase(), p!.level);
      const monster = {
        ...baseMonster,
        name: `${baseMonster.name} Furieux`,
        hp: Math.round(baseMonster.hp * 3),
        atk: Math.round(baseMonster.atk * 2),
        def: Math.round(baseMonster.def * 1.5),
        xp: Math.round(baseMonster.xp * 5),
        gold: [baseMonster.gold[0] * 5, baseMonster.gold[1] * 5] as [number, number],
      };
      ctx.mutate((d) => {
        d.cooldowns.adventure = Date.now();
        addQuestMetric(d, 'hunts', 1);
        if (!d.statistics.mobsEncountered) d.statistics.mobsEncountered = {};
        d.statistics.mobsEncountered[baseMonster.id] = (d.statistics.mobsEncountered[baseMonster.id] ?? 0) + 1;
      });
      ctx.open('hunt', { monster, id: Date.now(), isAdventure: true }, { singleton: true });
      break;
    }
  }
}
