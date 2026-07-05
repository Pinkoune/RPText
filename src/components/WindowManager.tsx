import { AnimatePresence } from 'framer-motion';
import { useUi, type WindowKind } from '../store/uiStore';
import type { ChatChannel } from '../firebase/chatService';
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
import ConcoctionCard from './cards/ConcoctionCard';
import GatherCard from './cards/GatherCard';
import MarketCard from './cards/MarketCard';
import DungeonCard from './cards/DungeonCard';
import TalentCard from './cards/TalentCard';
import QuestsCard from './cards/QuestsCard';
import DuelCard from './cards/DuelCard';
import CardJitsuCard from './cards/CardJitsuCard';
import TeamCard from './cards/TeamCard';
import GuildCard from './cards/GuildCard';
import FamiliarCard from './cards/FamiliarCard';
import BossCard from './cards/BossCard';
import ChatCard from './cards/ChatCard';
import LeaderboardCard from './cards/LeaderboardCard';
import StatsCard from './cards/StatsCard';
import NewsCard from './cards/NewsCard';
import HelpCard from './cards/HelpCard';
import WikiCard from './cards/WikiCard';
import EventsCard from './cards/EventsCard';
import AchievementsCard from './cards/AchievementsCard';
import FateShopCard from './cards/FateShopCard';
import SeasonCard from './cards/SeasonCard';
import EnchantCard from './cards/EnchantCard';
import ForgeronCard from './cards/ForgeronCard';
import PrestigeCard from './cards/PrestigeCard';
import AscensionCard from './cards/AscensionCard';
import EndlessCard from './cards/EndlessCard';
import SettingsCard from './cards/SettingsCard';
import TutorialCard from './cards/TutorialCard';
import LevelUpModal from './cards/LevelUpModal';
import VeteranCard from './cards/VeteranCard';
import { AdminModal } from './AdminModal';
import type { HuntEncounter } from '../game/combat';

const META: Record<WindowKind, { title: string; accent: string }> = {
  admin: { title: '👑 Panel Administrateur', accent: '#4ade80' },
  profile: { title: '👤 Profil', accent: '#9fd0ff' },
  hunt: { title: '⚔️ Chasse', accent: '#ff8a8a' },
  map: { title: '🗺️ Carte du monde', accent: '#7bd88f' },
  inventory: { title: '🎒 Inventaire', accent: '#e6d27a' },
  equipment: { title: '🛡️ Équipement', accent: '#9fd0ff' },
  enchant: { title: '✨ Enchantement', accent: '#a78bfa' },
  forgeron: { title: '🧔‍♂️ Forgeron Renold', accent: '#f0b46a' },
  prestige: { title: '✨ Aura de Prestige', accent: '#ffd45a' },
  ascension: { title: '🕳️ Le Néant', accent: '#a855f7' },
  endless: { title: '🕳️ Abysses Infinis', accent: '#dc2626' },
  concoction: { title: '🧪 Concoction', accent: '#10b981' },
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
  familiar: { title: '🐾 Familiers', accent: '#ff9a4a' },
  boss: { title: '🐲 Boss mondial', accent: '#ff6b6b' },
  chat: { title: '💬 Chat', accent: '#7bd8d0' },
  leaderboard: { title: '🏆 Classement', accent: '#ffd45a' },
  stats: { title: '📊 Statistiques', accent: '#9fd0ff' },
  news: { title: '📰 Nouveautés', accent: '#7bd8d0' },
  help: { title: '❔ Commandes', accent: '#b8c0cf' },
  wiki: { title: '📚 Wiki', accent: '#a26ad8' },
  events: { title: '🌍 Événements', accent: '#c084fc' },
  achievements: { title: '🏆 Succès', accent: '#ffd45a' },
  fateshop: { title: '🎲 Boutique du Destin', accent: '#e879f9' },
  season: { title: '🏅 Saison PvP', accent: '#7ad0ff' },
  settings: { title: '⚙️ Paramètres', accent: '#94a3b8' },
  tuto: { title: '🎓 Tutoriel', accent: '#4ade80' },
  levelup: { title: '🌟 Niveau Supérieur', accent: '#fbbf24' },
  veteran: { title: '👑 Vétéran', accent: '#f59e0b' },
};

const WIDE: Partial<Record<WindowKind, boolean>> = { news: true, craft: true, talents: true, admin: true };
const MEDIUM: Partial<Record<WindowKind, boolean>> = { leaderboard: true, inventory: true };
const SHORT: Partial<Record<WindowKind, boolean>> = { inventory: true };

export default function WindowManager() {
  const windows = useUi((s) => s.windows);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <AnimatePresence>
        {windows.map((w, i) => {
          const meta = META[w.kind];
          return (
            <Window key={w.id} win={w} index={i} title={w.title ?? meta.title} accent={w.accent ?? meta.accent} wide={WIDE[w.kind]} medium={MEDIUM[w.kind]} short={SHORT[w.kind]}>
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
              {w.kind === 'concoction' && <ConcoctionCard />}
              {w.kind === 'gather' && <GatherCard initialPayload={w.payload as { skill: string; nonce: number } | undefined} />}
              {w.kind === 'market' && <MarketCard />}
              {w.kind === 'dungeon' && <DungeonCard />}
              {w.kind === 'talents' && <TalentCard />}
              {w.kind === 'quests' && <QuestsCard />}
              {w.kind === 'duel' && <DuelCard />}
              {w.kind === 'cardjitsu' && <CardJitsuCard />}
              {w.kind === 'team' && <TeamCard />}
              {w.kind === 'guild' && <GuildCard />}
              {w.kind === 'familiar' && <FamiliarCard />}
              {w.kind === 'boss' && <BossCard />}
              {w.kind === 'chat' && <ChatCard initialPayload={w.payload as { tab?: ChatChannel; dmPeer?: string } | undefined} />}
              {w.kind === 'leaderboard' && <LeaderboardCard />}
              {w.kind === 'stats' && <StatsCard />}
              {w.kind === 'news' && <NewsCard />}
              {w.kind === 'help' && <HelpCard />}
              {w.kind === 'wiki' && <WikiCard />}
              {w.kind === 'events' && <EventsCard />}
              {w.kind === 'achievements' && <AchievementsCard />}
              {w.kind === 'fateshop' && <FateShopCard />}
              {w.kind === 'season' && <SeasonCard />}
              {w.kind === 'enchant' && <EnchantCard />}
              {w.kind === 'forgeron' && <ForgeronCard />}
              {w.kind === 'prestige' && <PrestigeCard />}
              {w.kind === 'ascension' && <AscensionCard />}
              {w.kind === 'endless' && <EndlessCard />}
              {w.kind === 'settings' && <SettingsCard />}
              {w.kind === 'tuto' && <TutorialCard win={w} />}
              {w.kind === 'levelup' && <LevelUpModal win={w} />}
              {w.kind === 'veteran' && <VeteranCard />}
              {w.kind === 'admin' && <AdminModal />}
            </Window>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
