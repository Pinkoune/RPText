import type { PlayerState } from './types';
import type { WindowKind } from '../store/uiStore';
import { useUi } from '../store/uiStore';
import { useGame } from '../store/gameStore';
import { pickMonster } from './monsters';
import { cooldownLeft } from './player';
import { item, ITEMS } from './items';
import { deriveStats, removeItem } from './player';
import { currentPhase } from './daynight';
import { addQuestMetric } from './quests';
import { GATHER_SKILLS, gatherCooldownLeft, type GatherSkillId } from './gathering';
import { talentMods } from './talents';
import { BIOMES } from './biomes';

// Ressource représentative de chaque biome (récompense « pauvre » anti-farm).
const BIOME_RESOURCE: Record<string, string> = {
  forest: 'dryad_leaf', plains: 'wildflower', mountains: 'iron_ore',
  desert: 'sun_shard', swamp: 'bog_root', volcano: 'lava_crystal', crypt: 'crypt_shard', frozen: 'crystal',
};

// Seuil : en dessous, le biome est « bas niveau » pour un boss end-game.
const HIGH_ZONE_MIN_LEVEL = 24; // volcan(24) / crypte(30) / abysses(38)

/**
 * Anti-farm : si le joueur invoque un boss end-game (miniboss/mercenaire/
 * sanctuaire) dans une zone bas niveau, ses récompenses fondent et son butin se
 * limite à la ressource du biome courant (au lieu du loot rare). Force à
 * affronter ces boss dans les zones adaptées.
 */
function applyZonePenalty(p: PlayerState, monster: any): void {
  const biomeMin = BIOMES[p.biome]?.minLevel ?? 1;
  if (biomeMin >= HIGH_ZONE_MIN_LEVEL) return; // zone adaptée : loot complet
  monster.xp = Math.round(monster.xp * 0.3);
  monster.gold = [Math.round(monster.gold[0] * 0.3), Math.round(monster.gold[1] * 0.3)];
  const res = BIOME_RESOURCE[p.biome] ?? 'herb';
  monster.loot = { [res]: 0.9 };
  monster.name += ' (affaibli — zone trop faible)';
}
import { getRaidWindow } from './raid';
import { joinOrCreateRaid } from '../firebase/dungeonService';

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
  reqLevel?: number;
  /** Commande secrète : absente du help, affichée « ??? » dans le tuto. */
  hidden?: boolean;
}

export const COMMANDS: CommandDef[] = [
  // Niveau 1
  { name: 'profile', aliases: ['profil', 'p', 'me'], desc: 'Affiche ta carte de profil.', category: 'Jeu', reqLevel: 1 },
  { name: 'hunt', aliases: ['chasse', 'h'], desc: 'Pars chasser un monstre du biome actuel.', category: 'Combat', reqLevel: 1 },
  { name: 'map', aliases: ['carte', 'm'], desc: 'Ouvre la carte des biomes.', category: 'Jeu', reqLevel: 1 },
  { name: 'inventory', aliases: ['inv', 'sac', 'i'], desc: 'Ouvre ton inventaire.', category: 'Jeu', reqLevel: 1 },
  { name: 'equipment', aliases: ['equip', 'équip', 'stuff', 'gear'], desc: 'Gère ton équipement (arme, armure, bijou).', category: 'Jeu', reqLevel: 1 },
  { name: 'cooldown', aliases: ['cd', 'cooldowns', 'recup'], desc: 'Affiche les récupérations en cours.', category: 'Jeu', reqLevel: 1 },
  { name: 'experience', aliases: ['xp', 'exp', 'niveau', 'level'], desc: 'Expérience d\'aventure et de farm.', category: 'Jeu', reqLevel: 1 },
  { name: 'heal', aliases: ['soin', 'potion'], desc: 'Bois une potion pour récupérer des PV.', category: 'Combat', reqLevel: 1 },
  { name: 'stats', aliases: ['statistiques', 'stat', 'st'], desc: 'Affiche toutes tes statistiques.', category: 'Jeu', reqLevel: 1 },
  { name: 'help', aliases: ['aide', 'commands', '?'], desc: 'Liste toutes les commandes.', category: 'Système', reqLevel: 1 },
  { name: 'wiki', aliases: ['bestiaire', 'items', 'encyclopedie'], desc: "Consulte l'encyclopédie des objets et des monstres.", category: 'Système', reqLevel: 1 },
  { name: 'settings', aliases: ['parametres', 'options', 'config'], desc: 'Paramètres du jeu et réinitialisation de personnage.', category: 'Système', reqLevel: 1 },
  { name: 'leaderboard', aliases: ['classement', 'top', 'lb'], desc: 'Affiche le classement et les joueurs en ligne.', category: 'Multijoueur', reqLevel: 1 },
  { name: 'chat', aliases: ['tchat', 'say'], desc: 'Chat mondial avec les joueurs connectés.', category: 'Multijoueur', reqLevel: 1 },
  { name: 'tutorial', aliases: ['tuto', 'tutoriel'], desc: 'Affiche le tutoriel des débutants.', category: 'Système', reqLevel: 1 },
  { name: 'close', aliases: ['clear', 'esc'], desc: 'Ferme toutes les fenêtres.', category: 'Système', reqLevel: 1 },
  { name: 'reset', aliases: ['resetui'], desc: "Réinitialise la position et l'état de toutes les fenêtres.", category: 'Système', reqLevel: 1 },
  { name: 'save', aliases: ['saveui', 'sauvegarder'], desc: 'Sauvegarde les fenêtres ouvertes et leurs positions.', category: 'Système', reqLevel: 1 },
  { name: 'reload', aliases: ['loadui', 'charger'], desc: 'Réouvre les fenêtres précédemment sauvegardées.', category: 'Système', reqLevel: 1 },

  // Niveau 2
  { name: 'quests', aliases: ['quetes', 'quêtes', 'q', 'daily', 'quotidien'], desc: 'Quêtes journalières et hebdomadaires.', category: 'Jeu', reqLevel: 2 },
  { name: 'gather', aliases: ['farm', 'recolte', 'récolte'], desc: 'Récolte les ressources du biome (vue d\'ensemble).', category: 'Récolte', reqLevel: 2 },
  { name: 'chop', aliases: ['bois', 'woodcut'], desc: 'Bûcheronnage : récolte du bois.', category: 'Récolte', reqLevel: 2 },
  { name: 'mine', aliases: ['miner', 'minage'], desc: 'Minage : pierre, fer, mithril, cristal.', category: 'Récolte', reqLevel: 2 },
  { name: 'fish', aliases: ['peche', 'pêche'], desc: 'Pêche : poissons.', category: 'Récolte', reqLevel: 2 },
  { name: 'forage', aliases: ['cueillette', 'cueillir'], desc: 'Cueillette : herbes médicinales.', category: 'Récolte', reqLevel: 2 },

  // Niveau 3
  { name: 'craft', aliases: ['forge', 'fabriquer'], desc: 'Forge de l\'équipement avec tes matériaux.', category: 'Jeu', reqLevel: 3 },
  { name: 'shop', aliases: ['boutique', 'store'], desc: 'Achète potions et équipement.', category: 'Jeu', reqLevel: 3 },
  { name: 'events', aliases: ['event', 'evenement', 'événement', 'evenements', 'événements'], desc: 'Événements mondiaux et régionaux en cours.', category: 'Jeu', reqLevel: 3 },

  // Niveau 4
  { name: 'endless', aliases: ['infini', 'abysse'], desc: 'Descend dans l\'abysse infini.', category: 'Combat', reqLevel: 4 },

  // Niveau 5
  { name: 'dungeon', aliases: ['donjon', 'dj'], desc: 'Donjons à étapes (combats enchaînés, gros butin).', category: 'Combat', reqLevel: 5 },
  { name: 'brew', aliases: ['concoction', 'potions', 'appats', 'laboratoire', 'alchimie'], desc: 'Laboratoire de concoction pour fabriquer des appâts.', category: 'Jeu', reqLevel: 5 },
  { name: 'talents', aliases: ['talent', 'skills', 'competences', 'compétences'], desc: 'Arbre de talents de ta classe (points par niveau).', category: 'Combat', reqLevel: 5 },
  { name: 'achievements', aliases: ['succes', 'succès', 'trophees', 'trophées', 'achi'], desc: 'Tes succès et leurs récompenses.', category: 'Jeu', reqLevel: 5 },

  // Niveau 6
  { name: 'enchant', aliases: ['enchantement', 'runes'], desc: 'Sertit des runes sur ton équipement.', category: 'Jeu', reqLevel: 6 },
  { name: 'blacksmith', aliases: ['forgeron', 'renold', 'smith'], desc: 'Forgeron Renold : réparation, renforcement garanti et purification. Uniquement le week-end.', category: 'Jeu', reqLevel: 10 },
  { name: 'boss', aliases: ['worldboss'], desc: 'Attaque le boss mondial avec les autres joueurs.', category: 'Multijoueur', reqLevel: 6 },

  // Niveau 7
  { name: 'market', aliases: ['marche', 'marché', 'hv', 'vente'], desc: 'Marché entre joueurs : vendre et acheter.', category: 'Multijoueur', reqLevel: 7 },

  // Niveau 8
  { name: 'duel', aliases: ['pvp', 'defi'], desc: 'Défie un autre joueur au pile/face (mise en or).', category: 'Multijoueur', reqLevel: 8 },
  { name: 'cardjitsu', aliases: ['cj', 'cards', 'ninja', 'cartes'], desc: 'Duel de cartes Card-Jitsu (feu/eau/neige).', category: 'Multijoueur', reqLevel: 8 },
  { name: 'season', aliases: ['saison', 'ladder', 'rang', 'rank'], desc: 'Saison PvP : ton rang, le ladder et la fin de saison.', category: 'Multijoueur', reqLevel: 8 },

  // Niveau 9
  { name: 'team', aliases: ['equipe', 'équipe', 'party'], desc: 'Forme une équipe et partage des ressources.', category: 'Multijoueur', reqLevel: 9 },
  { name: 'guild', aliases: ['guilde', 'clan'], desc: 'Rejoins ou fonde une guilde.', category: 'Multijoueur', reqLevel: 9 },

  // Niveau 10
  { name: 'familiar', aliases: ['familier', 'pet', 'compagnon'], desc: 'Adopte et équipe un familier (petit bonus de stats).', category: 'Jeu', reqLevel: 10 },
  { name: 'adventure', aliases: ['adv', 'aventure'], desc: 'Pars pour une grande aventure dangereuse (15 min de CD).', category: 'Combat', reqLevel: 10 },
  { name: 'casino', aliases: ['gamble', 'pari', 'g'], desc: 'Entre au casino (pile/face, blackjack, machine, roue).', category: 'Casino', reqLevel: 10 },
  { name: 'fateshop', aliases: ['fate', 'destin', 'boutiquefate'], desc: 'Boutique du Destin : dépense tes Fate Coins.', category: 'Casino', reqLevel: 10 },

  // Niveau 15
  { name: 'miniboss', aliases: ['mb', 'colosse'], desc: 'Affronte un mini-boss très puissant (1 fois / 12h). Grosses récompenses.', category: 'Combat', reqLevel: 15 },
  { name: 'mercenary', aliases: ['mercenaire', 'merc', 'contrat'], desc: 'Contrat mercenaire : boss quotidien costaud (1 fois / 6h). Butin volcanique.', category: 'Combat', reqLevel: 25 },
  { name: 'expedition', aliases: ['expe', 'exploration'], desc: 'Envoie ton familier en expédition 4h → ramène des ressources.', category: 'Jeu', reqLevel: 35 },
  { name: 'sanctuary', aliases: ['sanctuaire', 'sanctum'], desc: 'Sanctuaire des Anciens : boss solo ultime (1 fois / 24h). Butin unique.', category: 'Combat', reqLevel: 40 },
  { name: 'aura', aliases: ['auras'], desc: 'Choisis une aura de prestige (bonus passif + affichée au classement).', category: 'Jeu', reqLevel: 30 },
  { name: 'prestige', aliases: ['ascension', 'neant'], desc: '???', category: 'Combat', reqLevel: 50, hidden: true },

  // Niveau 22
  { name: 'raid', aliases: ['epreuves'], desc: 'Raid : 3 donjons enchaînés. Inscriptions à 10h et 20h uniquement.', category: 'Multijoueur', reqLevel: 22 },
];

const ALIAS_MAP: Record<string, string> = {};
for (const c of COMMANDS) {
  ALIAS_MAP[c.name] = c.name;
  for (const a of c.aliases) ALIAS_MAP[a] = c.name;
}

export function resolveCommand(input: string): string | null {
  const word = input.trim().toLowerCase().split(/\s+/)[0];
  if (word === 'admin') return 'admin';
  if (word === 'admin_curve' || word === 'curve') return 'admin_curve';
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
  if (!p && cmd !== 'help' && cmd !== 'tuto') return;

  if (p) {
    const def = COMMANDS.find((c) => c.name === cmd);
    if (def && def.reqLevel && p.level < def.reqLevel) {
      if (p.ignoreRestrictions) {
        ctx.toast(`[Admin] Bypassed level ${def.reqLevel} req for ${def.name}`, 'info');
      } else {
        ctx.toast(`Cette commande se débloque au niveau ${def.reqLevel}.`, 'bad');
        return;
      }
    }
  }

  switch (cmd) {
    case 'profile':
      ctx.open('profile', undefined, { singleton: true });
      break;

    case 'admin': {
      if (p && p.isAdmin) {
        ctx.open('admin', undefined, { singleton: true });
      } else {
        ctx.toast('Commande introuvable.', 'bad');
      }
      break;
    }

    case 'admin_curve': {
      if (!p || !p.isAdmin) {
        ctx.toast('Commande introuvable.', 'bad');
        break;
      }
      
      const levels = [1, 5, 10, 15, 20, 30];
      
      console.log("=== SIMULATION DE COURBE DE STATS ===");
      const getBestStat = (slot: string, lvl: number, stat: 'atk' | 'def' | 'hp'): number => {
        const valid = Object.values(ITEMS)
          .filter((i: any) => i.slot === slot && (i.reqLevel || 1) <= lvl);
        return valid.reduce((max: number, i: any) => Math.max(max, i[stat] || 0), 0);
      };
        for (const lvl of levels) {
          const wp = getBestStat('weapon', lvl, 'atk');
          const am = getBestStat('armor', lvl, 'def');
          const ah = getBestStat('armor', lvl, 'hp');
          const tkA = getBestStat('trinket', lvl, 'atk');
          const tkD = getBestStat('trinket', lvl, 'def');
          const tkH = getBestStat('trinket', lvl, 'hp');
          
          const maxHpBase = 100 + (lvl - 1) * 20;
          const atkBase = 5 + (lvl - 1) * 2;
          const defBase = 5 + (lvl - 1) * 1;
          
          const hpStars = (ah + tkH) * 1.5; // +50% étoiles
          const atkStars = (wp + tkA) * 1.5;
          const defStars = (am + tkD) * 1.5;
          
          console.log(`Lvl ${lvl} | Base: HP=${maxHpBase} ATK=${atkBase} DEF=${defBase} | Gear (Max+Etoiles): HP=${Math.round(hpStars)} ATK=${Math.round(atkStars)} DEF=${Math.round(defStars)}`);
        }
        ctx.toast("Simulation générée ! Ouvre la console du navigateur (F12) pour voir les résultats.", "good");
      break;
    }

    case 'reset':
      import('../store/uiStore').then(({ useUi }) => {
        useUi.getState().resetPrefs();
        useUi.getState().closeAll();
        ctx.toast('Toutes les fenêtres ont été réinitialisées.', 'info');
      });
      break;

    case 'save':
      import('../store/uiStore').then(({ useUi }) => {
        useUi.getState().saveLayout();
        ctx.toast('Disposition des fenêtres sauvegardée !', 'good');
      });
      break;

    case 'reload':
      import('../store/uiStore').then(({ useUi }) => {
        useUi.getState().closeAll();
        // Filtre par niveau ACTUEL : une disposition sauvegardée avant un reset
        // global ne doit pas rouvrir des fenêtres au-delà du niveau du perso
        // (recréé à Nv.1) — voir uiStore.loadLayout.
        const lvl = p!.level;
        useUi.getState().loadLayout((kind) => {
          const reqLevel = COMMANDS.find((c) => c.name === kind)?.reqLevel ?? 1;
          return lvl >= reqLevel;
        });
        ctx.toast('Disposition chargée.', 'good');
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

    case 'settings':
      ctx.open('settings', undefined, { singleton: true });
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

    case 'brew':
      ctx.open('concoction', undefined, { singleton: true });
      break;

    case 'gather':
      ctx.open('gather', undefined, { singleton: true });
      break;

    case 'dungeon':
      ctx.open('dungeon', undefined, { singleton: true });
      break;

    case 'tutorial':
      ctx.open('tuto', undefined, { singleton: true });
      break;

    case 'enchant':
      ctx.open('enchant', undefined, { singleton: true });
      break;

    case 'blacksmith':
      ctx.open('forgeron', undefined, { singleton: true });
      break;

    case 'endless':
      ctx.open('endless', undefined, { singleton: true });
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
      const skillId = cmd as GatherSkillId;
      const skillDef = GATHER_SKILLS[skillId];
      if (!skillDef.byBiome[p!.biome]) {
        ctx.toast(`${skillDef.name} indisponible dans ce biome.`, 'bad');
        break;
      }
      const left = gatherCooldownLeft(p!);
      if (left > 0) {
        ctx.toast(`Récolte en récupération (${Math.ceil(left / 1000)}s).`, 'bad');
        break;
      }
      // nonce : force GatherCard à relancer la récolte même si la fenêtre est déjà
      // ouverte sur le même skill (sinon retaper la commande ne faisait rien de
      // visible — payload identique => l'effet de démarrage ne se redéclenchait pas).
      ctx.open('gather', { skill: skillId, nonce: Date.now() }, { singleton: true });
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

    case 'season':
      ctx.open('season', undefined, { singleton: true });
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
      const args = input.trim().split(/\s+/);
      const targetId = args[1];

      const inCombat = useGame.getState().inCombat;
      if (inCombat) {
        ctx.toast("Impossible de se soigner hors tour pendant un combat ! (Utilise le bouton Soin du combat)", "bad");
        break;
      }

      let has = '';
      if (targetId) {
        const match = Object.keys(p!.inventory).find(id => 
          (p!.inventory[id] ?? 0) > 0 && 
          item(id)?.hp && 
          (id.toLowerCase() === targetId.toLowerCase() || item(id)?.name.toLowerCase().includes(targetId.toLowerCase()))
        );
        if (match) {
          has = match;
        } else {
          ctx.toast(`Potion "${targetId}" introuvable dans ton sac.`, 'bad');
          break;
        }
      } else {
        has = ['hi_potion', 'potion'].find((id) => (p!.inventory[id] ?? 0) > 0) || '';
      }

      if (!has) {
        ctx.toast('Aucune potion. Va à la boutique (shop) ou précise le nom (ex: heal hi_potion).', 'bad');
        break;
      }
      ctx.mutate((d) => {
        const healAmt = item(has)!.hp ?? 0;
        const max = deriveStats(d).maxHp;
        removeItem(d, has);
        d.hp = Math.min(max, d.hp + healAmt);
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
      const now = Date.now();
      const activeBait = p!.activeBuffs?.find(b => b.id.startsWith('bait_') && b.expiresAt > now)?.id;
      const monster = pickMonster(p!.biome, currentPhase(), p!.level, activeBait);
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
      const now2 = Date.now();
      const activeBait2 = p!.activeBuffs?.find(b => b.id.startsWith('bait_') && b.expiresAt > now2)?.id;
      const baseMonster = pickMonster(p!.biome, currentPhase(), p!.level, activeBait2);
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

    case 'miniboss': {
      const left = cooldownLeft(p!, 'miniboss', 12 * 60 * 60 * 1000);
      if (left > 0) {
        const h = Math.floor(left / 3_600_000);
        const m = Math.ceil((left % 3_600_000) / 60_000);
        ctx.toast(`Le mini-boss se repose. Reviens dans ${h > 0 ? `${h}h` : ''}${m}min.`, 'bad');
        break;
      }
      if (p!.hp <= 0) {
        ctx.toast('Tu es K.O. ! Soigne-toi avant d\'affronter le mini-boss.', 'bad');
        break;
      }
      const lvl = p!.level;
      const base = pickMonster(p!.biome, currentPhase(), lvl);
      // Boss très costaud, récompenses proportionnelles au niveau.
      const monster = {
        ...base,
        id: 'miniboss',
        name: 'Colosse des Abysses',
        emoji: '👹',
        hp: Math.round(base.hp * 5 + lvl * 180),
        atk: Math.round(base.atk * 1.6 + lvl * 1.5),
        def: Math.round(base.def * 1.2 + lvl * 0.5),
        xp: Math.round(base.xp * 8 + lvl * 120),
        gold: [base.gold[0] * 8 + lvl * 20, base.gold[1] * 8 + lvl * 40] as [number, number],
        element: 'dark' as const,
        dmgType: 'physical' as const,
        loot: { upgrade_matrix: 0.2, hi_potion: 0.6, void_dust: 0.5, mithril_ore: 0.4, boss_soul: 0.06 },
      };
      applyZonePenalty(p!, monster);
      ctx.mutate((d) => {
        d.cooldowns.miniboss = Date.now();
        if (!d.statistics.mobsEncountered) d.statistics.mobsEncountered = {};
        d.statistics.mobsEncountered['miniboss'] = (d.statistics.mobsEncountered['miniboss'] ?? 0) + 1;
      });
      ctx.open('hunt', { monster, id: Date.now(), isMiniboss: true }, { singleton: true });
      break;
    }

    case 'mercenary': {
      const left = cooldownLeft(p!, 'mercenaire', 6 * 60 * 60 * 1000);
      if (left > 0) { ctx.toast(`Prochain contrat dans ${Math.ceil(left / 3_600_000)}h.`, 'bad'); break; }
      if (p!.hp <= 0) { ctx.toast('Tu es K.O. Soigne-toi avant le contrat.', 'bad'); break; }
      const lvl = p!.level;
      const base = pickMonster(p!.biome, currentPhase(), lvl);
      const monster = {
        ...base, id: 'mercenaire', name: 'Cible du Contrat', emoji: '🎯',
        // Doit être clairement au-dessus de miniboss (×5/×1.6/×8/×8) : les anciens
        // multiplicateurs étaient plus BAS malgré un déblocage 10 niveaux plus tard.
        hp: Math.round(base.hp * 6 + lvl * 220), atk: Math.round(base.atk * 1.7 + lvl * 1.8), def: Math.round(base.def * 1.3 + lvl * 0.5),
        xp: Math.round(base.xp * 9 + lvl * 160), gold: [base.gold[0] * 9 + lvl * 30, base.gold[1] * 9 + lvl * 55] as [number, number],
        element: 'fire' as const, dmgType: 'physical' as const,
        loot: { lava_crystal: 0.7, ember_stone: 0.6, infernal_shard: 0.35, upgrade_matrix: 0.15, boss_soul: 0.05 },
      };
      applyZonePenalty(p!, monster);
      ctx.mutate((d) => { d.cooldowns.mercenaire = Date.now(); });
      ctx.open('hunt', { monster, id: Date.now(), isMiniboss: true }, { singleton: true });
      break;
    }

    case 'sanctuary': {
      const left = cooldownLeft(p!, 'sanctuaire', 24 * 60 * 60 * 1000);
      if (left > 0) { ctx.toast(`Le Sanctuaire se rouvre dans ${Math.ceil(left / 3_600_000)}h.`, 'bad'); break; }
      if (p!.hp <= 0) { ctx.toast('Tu es K.O. Soigne-toi avant d\'entrer.', 'bad'); break; }
      const lvl = p!.level;
      const base = pickMonster(p!.biome, currentPhase(), lvl);
      const monster = {
        ...base, id: 'sanctuaire', name: 'Gardien des Anciens', emoji: '🗿',
        hp: Math.round(base.hp * 7 + lvl * 280), atk: Math.round(base.atk * 1.8 + lvl * 2), def: Math.round(base.def * 1.4 + lvl * 0.6),
        xp: Math.round(base.xp * 12 + lvl * 200), gold: [base.gold[0] * 12 + lvl * 40, base.gold[1] * 12 + lvl * 80] as [number, number],
        element: 'light' as const, dmgType: 'magical' as const,
        loot: { infernal_shard: 0.8, void_dust: 0.7, boss_soul: 0.25, primordial_crown: 0.04, upgrade_matrix: 0.3 },
      };
      applyZonePenalty(p!, monster);
      ctx.mutate((d) => { d.cooldowns.sanctuaire = Date.now(); });
      ctx.open('hunt', { monster, id: Date.now(), isMiniboss: true }, { singleton: true });
      break;
    }

    case 'expedition': {
      const now = Date.now();
      const end = p!.expeditionEndsAt ?? 0;
      if (end > now) {
        ctx.toast(`Ton familier revient dans ${Math.ceil((end - now) / 60_000)} min.`, 'info');
        break;
      }
      if (end > 0 && end <= now) {
        // Collecte : ressource représentative du biome ciblé + or.
        const biomeRes: Record<string, string> = { forest: 'dryad_leaf', plains: 'wildflower', mountains: 'mithril_ore', desert: 'sun_shard', swamp: 'bog_root', volcano: 'lava_crystal', crypt: 'crypt_shard', frozen: 'crystal' };
        const res = biomeRes[p!.expeditionBiome ?? p!.biome] ?? 'herb';
        const famLvl = 1 + Math.floor(Object.keys(p!.familiars ?? {}).length);
        const qty = 3 + famLvl;
        const gold = p!.level * 60;
        ctx.mutate((d) => {
          d.expeditionEndsAt = 0;
          d.expeditionBiome = undefined;
          d.inventory[res] = (d.inventory[res] ?? 0) + qty;
          d.gold += gold;
        });
        ctx.toast(`🎒 Expédition terminée : +${qty} ${item(res)?.name ?? res}, +${gold} 🪙 !`, 'good');
        break;
      }
      if (!p!.activeFamiliarId) { ctx.toast('Équipe un familier pour l\'envoyer en expédition.', 'bad'); break; }
      ctx.mutate((d) => { d.expeditionEndsAt = now + 4 * 60 * 60 * 1000; d.expeditionBiome = d.biome; });
      ctx.toast('🐾 Ton familier part en expédition (4h). Reviens avec « expedition » pour collecter.', 'good');
      break;
    }

    case 'aura':
      ctx.open('prestige', undefined, { singleton: true });
      break;

    case 'prestige': {
      // Rituel secret : uniquement depuis les Abysses (biome 'frozen').
      if (p!.biome !== 'frozen') {
        ctx.toast('Une force obscure te retient... il faut être au cœur des Abysses.', 'bad');
        break;
      }
      const cd = (p!.ascensionCooldownUntil ?? 0) - Date.now();
      if (cd > 0) {
        ctx.toast(`Le Néant se recompose. Reviens dans ${Math.ceil(cd / 3_600_000)}h.`, 'bad');
        break;
      }
      ctx.open('ascension', undefined, { singleton: true });
      break;
    }

    case 'raid': {
      const w = getRaidWindow();
      if (!w.open) {
        ctx.toast('Le raid n\'est ouvert qu\'aux inscriptions : 10h00→10h10 et 20h00→20h10.', 'bad');
        break;
      }
      if (p!.hp <= 0) {
        ctx.toast('Tu es K.O. ! Soigne-toi avant de rejoindre le raid.', 'bad');
        break;
      }
      const sessionId = `raid-${w.key}`;
      const stats = deriveStats(p!);
      const mods = talentMods(p!);
      joinOrCreateRaid(sessionId, 'raid_trials', w.startsAt, p!.uid, p!.name, p!.classId, stats, mods, p!.level, p!.prestigeAura, p!.auraColorOn)
        .catch(() => ctx.toast('Impossible de rejoindre le raid (hors ligne ?).', 'bad'));
      ctx.mutate((d) => { d.dungeonSessionId = sessionId; });
      ctx.open('dungeon', undefined, { singleton: true });
      ctx.toast('🔱 Inscrit au raid ! Rejoins le lobby et prépare-toi.', 'good');
      break;
    }
  }
}
