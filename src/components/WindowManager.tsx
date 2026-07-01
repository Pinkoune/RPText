import { AnimatePresence } from 'framer-motion';
import { useUi, type WindowKind } from '../store/uiStore';
import Window from './Window';
import ProfileCard from './cards/ProfileCard';
import HuntCard from './cards/HuntCard';
import MapCard from './cards/MapCard';
import InventoryCard from './cards/InventoryCard';
import EquipmentCard from './cards/EquipmentCard';
import CooldownCard from './cards/CooldownCard';
import ExperienceCard from './cards/ExperienceCard';
import CasinoCard from './cards/CasinoCard';
import ShopCard from './cards/ShopCard';
import CraftCard from './cards/CraftCard';
import GatherCard from './cards/GatherCard';
import MarketCard from './cards/MarketCard';
import DungeonCard from './cards/DungeonCard';
import TalentCard from './cards/TalentCard';
import QuestsCard from './cards/QuestsCard';
import DuelCard from './cards/DuelCard';
import CardJitsuCard from './cards/CardJitsuCard';
import TeamCard from './cards/TeamCard';
import GuildCard from './cards/GuildCard';
import BossCard from './cards/BossCard';
import ChatCard from './cards/ChatCard';
import LeaderboardCard from './cards/LeaderboardCard';
import StatsCard from './cards/StatsCard';
import HelpCard from './cards/HelpCard';
import type { HuntEncounter } from '../game/combat';

const META: Record<WindowKind, { title: string; accent: string }> = {
  profile: { title: '👤 Profil', accent: '#9fd0ff' },
  hunt: { title: '⚔️ Chasse', accent: '#ff8a8a' },
  map: { title: '🗺️ Carte du monde', accent: '#7bd88f' },
  inventory: { title: '🎒 Inventaire', accent: '#e6d27a' },
  equipment: { title: '🛡️ Équipement', accent: '#9fd0ff' },
  cooldown: { title: '⏳ Récupérations', accent: '#ffce6a' },
  experience: { title: '📈 Expérience', accent: '#62d67a' },
  casino: { title: '🎰 Casino du Destin', accent: '#c46bff' },
  shop: { title: '🛒 Boutique', accent: '#f0b46a' },
  craft: { title: '🔨 Forge', accent: '#d8a26a' },
  gather: { title: '🌿 Récolte', accent: '#8fd88f' },
  market: { title: '🏪 Marché', accent: '#ffce6a' },
  dungeon: { title: '🏰 Donjons', accent: '#c46bff' },
  talents: { title: '🌟 Talents', accent: '#9fd0ff' },
  quests: { title: '📜 Quêtes', accent: '#9be37b' },
  duel: { title: '⚔️ Duels PvP', accent: '#ff7bd0' },
  cardjitsu: { title: '🥷 Card-Jitsu', accent: '#ff9a4a' },
  team: { title: '👥 Équipe', accent: '#8fd0ff' },
  guild: { title: '🏰 Guilde', accent: '#ffd45a' },
  boss: { title: '🐲 Boss mondial', accent: '#ff6b6b' },
  chat: { title: '💬 Chat mondial', accent: '#7bd8d0' },
  leaderboard: { title: '🏆 Classement', accent: '#ffd45a' },
  stats: { title: '📊 Statistiques', accent: '#9fd0ff' },
  help: { title: '❔ Commandes', accent: '#b8c0cf' },
};

export default function WindowManager() {
  const windows = useUi((s) => s.windows);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <AnimatePresence>
        {windows.map((w, i) => {
          const meta = META[w.kind];
          return (
            <Window key={w.id} win={w} index={i} title={meta.title} accent={meta.accent}>
              {w.kind === 'profile' && <ProfileCard />}
              {w.kind === 'hunt' && <HuntCard encounter={w.payload as HuntEncounter} />}
              {w.kind === 'map' && <MapCard />}
              {w.kind === 'inventory' && <InventoryCard />}
              {w.kind === 'equipment' && <EquipmentCard />}
              {w.kind === 'cooldown' && <CooldownCard />}
              {w.kind === 'experience' && <ExperienceCard />}
              {w.kind === 'casino' && <CasinoCard />}
              {w.kind === 'shop' && <ShopCard />}
              {w.kind === 'craft' && <CraftCard />}
              {w.kind === 'gather' && <GatherCard />}
              {w.kind === 'market' && <MarketCard />}
              {w.kind === 'dungeon' && <DungeonCard />}
              {w.kind === 'talents' && <TalentCard />}
              {w.kind === 'quests' && <QuestsCard />}
              {w.kind === 'duel' && <DuelCard />}
              {w.kind === 'cardjitsu' && <CardJitsuCard />}
              {w.kind === 'team' && <TeamCard />}
              {w.kind === 'guild' && <GuildCard />}
              {w.kind === 'boss' && <BossCard />}
              {w.kind === 'chat' && <ChatCard />}
              {w.kind === 'leaderboard' && <LeaderboardCard />}
              {w.kind === 'stats' && <StatsCard />}
              {w.kind === 'help' && <HelpCard />}
            </Window>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
