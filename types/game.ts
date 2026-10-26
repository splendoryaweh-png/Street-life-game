export type NavTab =
  | 'STUDIO'
  | 'GAMES'
  | 'SHOP'
  | 'WAR'
  | 'PROFILE'
  | 'ADMIN'
  | 'HOME'
  | 'CRIB'
  | 'BANK'
  | 'TASKS'
  | 'WATCH'
  | 'INVENTORY';

export interface TelegramUser {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  coins: number;
  isCurrentUser?: boolean;
}

export interface DailyRewardDay {
  day: number;
  coins: number;
  isClaimed: boolean;
  isCurrent: boolean;
}

export type RobberyToolId = 'crowbar' | 'mask' | 'gun' | 'driver' | 'full_crew';

export interface RobberyTool {
  id: RobberyToolId;
  name: string;
  price: number;
  description: string;
  iconName: string;
}

export interface BankTarget {
  id: number;
  level: number;
  name: string;
  reward: number;
  durationSeconds: number;
  durationLabel: string;
  heatIncrease: number;
  requiredToolIds: RobberyToolId[];
  description: string;
  bgGradient: string;
  iconName: string;
}

export interface ActiveRobbery {
  bankId: number;
  startTime: number; // timestamp in ms
  durationSeconds: number;
  reward: number;
  heatIncrease: number;
  successChance: number;
}

export type CarId = 'basic' | 'sport' | 'super';
export type BikeId = 'scooter' | 'cruiser' | 'cyber';

export type CryptoCurrency = 'TON' | 'USDT' | 'STARS' | 'USD';

export interface WithdrawalRecord {
  id: string;
  timestamp: number;
  coinAmount: number;
  payoutAmount: number;
  currency: CryptoCurrency;
  network: string;
  destinationAddress: string;
  memo?: string;
  status: 'completed' | 'processing';
  txHash: string;
}

export interface ConversionRecord {
  id: string;
  timestamp: number;
  fromCoins: number;
  toAmount: number;
  toCurrency: CryptoCurrency;
  rate: number;
}

export interface CoinTransaction {
  id: string;
  type: 'referral' | 'boss_kill' | 'wave_complete' | 'daily_reward' | 'bank_heist' | 'race_reward' | 'rider_delivery' | 'ad_reward' | 'welcome_bonus' | 'withdrawal' | 'conversion' | 'task_reward';
  description: string;
  amount: number;
  timestamp: number;
}

export type InventoryCategory = 'ALL' | 'DRIP' | 'CARS' | 'GUNS' | 'GRAFFITI';
export type ItemRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type EquipSlot = 'head' | 'neck' | 'torso' | 'waist' | 'feet' | 'hands' | 'ride' | 'tool';

export interface InventoryItem {
  id: string;
  name: string;
  category: 'DRIP' | 'CARS' | 'GUNS' | 'GRAFFITI';
  rarity: ItemRarity;
  statLabel: string;
  statType: 'flex' | 'power' | 'speed';
  statValue: number;
  slot: EquipSlot;
  iconName: string;
  description: string;
}

// ---------------------------------------------------------------------------
// PROM 6: Task System Metrics & Types
// ---------------------------------------------------------------------------
export type TaskCategory =
  | 'Social'
  | 'Boost'
  | 'Promotion'
  | 'Referral'
  | 'Watch'
  | 'Stay'
  | 'Play'
  | 'Earn'
  | 'Daily'
  | 'Other';

export interface CompletedTaskRecord {
  completedAt: number;
  reward: number;
  proofData?: string;
  claimed?: boolean;
}

export interface TaskProgressMetrics {
  stayTimeSeconds: number; // Cumulative seconds in app for Stay tasks
  adsWatchedTotal: number;
  wheelSpinsTotal: number;
  statusPostsToday: number; // Max 2 per day (50 SC, 100 SC)
  lastStatusPostDate: string | null;
  videoPromoSubmitted: boolean;
  videoPromoLink: string | null;
  racesWon: number;
  beefWon: number;
  turfWarsWon: number;
  cribTier: number; // 0: Shack, 1: Ghetto House, 2: Duplex, 3: Penthouse
  walletConnected: boolean;
  firstWithdrawBonusClaimed: boolean;
  mysteryBoxOpenedToday: boolean;
  lastMysteryBoxDate: string | null;
  dailyQuizAnswersToday: number;
  lastQuizDate: string | null;
}

export interface UserGameState {
  streetCoin: number;
  myReferralCode: string;
  deviceId: string;
  hasPlayedToday: boolean;
  dailyStreak: number;
  lastClaimDate: string | null;
  adsWatched: number;
  telegramUser: TelegramUser | null;
  // Bank Robbery System (legacy backward compat)
  unlockedBanks: number[];
  ownedTools: RobberyToolId[];
  heatLevel: number; // 0 - 100
  lastHeatUpdate: number;
  lastRobberyTime: number | null;
  cooldownUntil: number | null;
  cooldownReason: 'BUSTED_100' | 'CAUGHT_FAIL' | null;
  activeRobbery: ActiveRobbery | null;
  // Referral System
  referralsCount: number;
  hasClaimedWelcomeBonus: boolean;
  appliedReferralCode: string | null;
  // Prom 2: Games State
  shooterLevel: number; // Level 1..100
  ownedCars: CarId[];
  selectedCar: CarId;
  ownedBikes: BikeId[];
  selectedBike: BikeId;
  riderMission: number;
  // Transactions History (last 10-20 coin earning events)
  transactions: CoinTransaction[];
  // Bank Financial System: Withdrawals & Conversions
  withdrawals?: WithdrawalRecord[];
  conversions?: ConversionRecord[];
  // PROM 5: Inventory System
  inventoryArray?: string[];
  equippedItems?: string[];
  // PROM 4: Watch Ads System
  watchCountDaily?: number;
  lastWatchDate?: string | null;
  boostUntil?: number | null;
  // PROM 6: Task System (completedTasks object and taskProgress metrics)
  completedTasks: Record<string, boolean>;
  taskProgress: Record<string, number>;
  // Hustle Hub: Studio, Food, Energy, Housing
  studioLevel?: number; // 0: Ghetto, 1: Street, 2: Hood, 3: City, 4: Star
  hunger?: number; // 0 - 100
  energy?: number; // 0 - 100
  housingTier?: number; // 0: Street, 1: Ghetto Flat, 2: Duplex, 3: Penthouse, 4: Mansion
  // Studio Rent & Security
  rentExpiry?: number;
  userEmail?: string;
  isBanned?: boolean;
  postedSongs?: PostedSong[];
  studioAdsWatched?: number;
  studioAdDayMap?: Record<number, { count: number; date: string }>;
  lastPostTimestamp?: number;
}

export interface PostedSong {
  id: string;
  beatId: string;
  beatName: string;
  producer: string;
  userName: string;
  userId: string;
  timestamp: number;
  durationSeconds: number;
  audioBlobUrl?: string;
}

export interface AdminLog {
  id: string;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface TaskSubmission {
  id: string;
  type: 'status_post' | 'video_promo' | 'boost';
  username: string;
  telegramId: string;
  date: string;
  time: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  reward: number;
  screenshotUrl?: string;
  videoLink?: string;
  platform?: 'TikTok' | 'YouTube' | 'Facebook' | 'Instagram' | 'Other';
  channel?: 'Main' | 'Proof';
  views?: number;
  likes?: number;
  rejectReason?: string;
  dailyCount?: number;
  isBoostVerified?: boolean;
}

