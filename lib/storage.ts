import {
  LeaderboardEntry,
  UserGameState,
  RobberyToolId,
  ActiveRobbery,
  CoinTransaction,
  CarId,
  BikeId,
  WithdrawalRecord,
  ConversionRecord,
  CryptoCurrency,
  InventoryItem,
  InventoryCategory,
  PostedSong,
  AdminLog,
} from '@/types/game';

const SAVE_KEY_V2 = 'streetLife_save_v2';

export const DEFAULT_WITHDRAWALS: WithdrawalRecord[] = [
  {
    id: 'wdr_init_1',
    timestamp: 1773489000000 - 3600000 * 4,
    coinAmount: 5000,
    payoutAmount: 0.5,
    currency: 'TON',
    network: 'TON Network',
    destinationAddress: 'UQDx4B9aZ908yKp1M7xQ',
    status: 'completed',
    txHash: '0x3f7a9d2c18b4e7a02b6d8f51a4c9e7f8',
  },
  {
    id: 'wdr_init_2',
    timestamp: 1773489000000 - 3600000 * 26,
    coinAmount: 2500,
    payoutAmount: 2.5,
    currency: 'USDT',
    network: 'USDT (TRC-20)',
    destinationAddress: 'TPx79a1F6e39eM21k8L0',
    status: 'completed',
    txHash: '0x99b1e84d2f09a63c71a4d8c2e910fa31',
  },
];

export const DEFAULT_TRANSACTIONS: CoinTransaction[] = [
  {
    id: 'tx_seed_1',
    type: 'referral',
    description: '+10 for referral',
    amount: 10,
    timestamp: 1773489000000,
  },
  {
    id: 'tx_seed_2',
    type: 'boss_kill',
    description: '+10 for boss kill',
    amount: 10,
    timestamp: 1773487000000,
  },
  {
    id: 'tx_seed_3',
    type: 'welcome_bonus',
    description: '+10 for welcome bonus',
    amount: 10,
    timestamp: 1773484000000,
  },
  {
    id: 'tx_seed_4',
    type: 'daily_reward',
    description: '+10 for daily claim',
    amount: 10,
    timestamp: 1773480000000,
  },
];

export const DEFAULT_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'white_tee',
    name: 'White Tee',
    category: 'DRIP',
    rarity: 'Common',
    statLabel: '+5% Flex',
    statType: 'flex',
    statValue: 5,
    slot: 'torso',
    iconName: 'Shirt',
    description: 'Clean oversized heavy cotton tee. Pure street staple.',
  },
  {
    id: 'gold_chain',
    name: 'Gold Chain',
    category: 'DRIP',
    rarity: 'Epic',
    statLabel: '+5% Flex',
    statType: 'flex',
    statValue: 15,
    slot: 'neck',
    iconName: 'Sparkles',
    description: '24K iced-out Cuban link chain. Commands instant respect.',
  },
  {
    id: 'balenciaga_shoes',
    name: 'Balenciaga Shoes',
    category: 'DRIP',
    rarity: 'Epic',
    statLabel: '+15% Flex',
    statType: 'flex',
    statValue: 20,
    slot: 'feet',
    iconName: 'Footprints',
    description: 'Triple S Chunky sole kicks. Designer high-fashion drip.',
  },
  {
    id: 'glock',
    name: 'Glock',
    category: 'GUNS',
    rarity: 'Common',
    statLabel: '+10 Power',
    statType: 'power',
    statValue: 10,
    slot: 'waist',
    iconName: 'Crosshair',
    description: 'Tucked in the waistband. Always stay ready on the block.',
  },
  {
    id: 'ak',
    name: 'AK',
    category: 'GUNS',
    rarity: 'Legendary',
    statLabel: '+35 Power',
    statType: 'power',
    statValue: 35,
    slot: 'hands',
    iconName: 'Flame',
    description: 'Gold-plated Kalashnikov rifle. Ultimate firepower.',
  },
  {
    id: 'spray_can',
    name: 'Spray Can',
    category: 'GRAFFITI',
    rarity: 'Rare',
    statLabel: '+10% Flex',
    statType: 'flex',
    statValue: 10,
    slot: 'tool',
    iconName: 'Paintbrush',
    description: 'Montana Gold chrome can. Tag the turf and leave your mark.',
  },
  {
    id: 'low_rider_car',
    name: 'Low Rider Car',
    category: 'CARS',
    rarity: 'Rare',
    statLabel: '+15 Speed',
    statType: 'speed',
    statValue: 15,
    slot: 'ride',
    iconName: 'Car',
    description: 'Hydraulic bouncing 64 Impala cruising down the boulevard.',
  },
  {
    id: 'g_wagon_car',
    name: 'G-Wagon Car',
    category: 'CARS',
    rarity: 'Legendary',
    statLabel: '+40 Speed',
    statType: 'speed',
    statValue: 40,
    slot: 'ride',
    iconName: 'Zap',
    description: 'Matte black twin-turbo AMG beast. Untouchable syndicate boss.',
  },
];

export const DEFAULT_INVENTORY_ARRAY: string[] = [
  'white_tee',
  'gold_chain',
  'balenciaga_shoes',
  'glock',
  'ak',
  'spray_can',
  'low_rider_car',
  'g_wagon_car',
];

export const DEFAULT_EQUIPPED_ITEMS: string[] = [
  'white_tee',
  'gold_chain',
  'balenciaga_shoes',
  'glock',
  'ak',
  'spray_can',
  'low_rider_car',
  'g_wagon_car',
];

// Deterministic mock referral code generator
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SL';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate deviceId = UUID + userAgent hash
export function generateDeviceId(): string {
  if (typeof window === 'undefined') return 'SL-DEV-001';
  
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'dev-' + Math.random().toString(36).substring(2, 10);
  
  return `SL-DEVICE-${uuid.slice(0, 8)}`;
}

// Generate deterministic 100 users for leaderboard (identical on SSR and client)
export function generateMockLeaderboard(): LeaderboardEntry[] {
  const nicknames = [
    'Tony Montana', 'Vito Corleone', 'Cyber Hustler', 'Crypto King',
    'Street Kingpin', 'Night Stalker', 'Gold Rush', 'Shadow Boss',
    'Diamond Hands', 'Block Master', 'Tokyo Drifter', 'Apex Predator',
    'Viper Strike', 'Ghost Rider', 'Iron Wolf', 'Neon Phantom',
    'Velvet Syndicate', 'Midnight Baron', 'Bulletproof', 'Slick Rick'
  ];

  const avatars = [
    '👑', '⚡', '🔥', '💎', '🚀', '🥊', '🎯', '🏎️', '🐉', '🐯',
    '🐺', '🦁', '🦅', '💰', '🎲', '♠️', '🕶️', '⚔️', '🏆', '🎩'
  ];

  const list: LeaderboardEntry[] = [];
  let currentCoins = 1420000;

  for (let rank = 1; rank <= 100; rank++) {
    const baseName = nicknames[(rank - 1) % nicknames.length];
    const name = rank <= 10 ? baseName : `Player ${rank} (${baseName.split(' ')[0]})`;
    const avatar = avatars[(rank - 1) % avatars.length];
    
    // Deterministic coin drop formula
    if (rank === 1) currentCoins = 1420000;
    else if (rank === 2) currentCoins = 1180000;
    else if (rank === 3) currentCoins = 985000;
    else {
      const drop = 8500 + ((rank * 37) % 4500);
      currentCoins = Math.max(15000, currentCoins - drop);
    }

    list.push({
      rank,
      id: `usr_${rank}`,
      name,
      avatar,
      coins: currentCoins,
    });
  }

  return list;
}

const STATIC_MOCK_LEADERBOARD: LeaderboardEntry[] = generateMockLeaderboard();

export function getLeaderboard(): LeaderboardEntry[] {
  return STATIC_MOCK_LEADERBOARD;
}

// PROM 6: Task System Defaults
export const DEFAULT_TASK_PROGRESS: Record<string, number> = {
  stayTimeSeconds: 0,
  adsWatchedTotal: 5,
  wheelSpinsTotal: 0,
  statusPostsToday: 0,
  videoPromoSubmitted: 0,
  racesWon: 0,
  beefWon: 0,
  turfWarsWon: 0,
  cribTier: 0,
  walletConnected: 0,
  firstWithdrawBonusClaimed: 0,
  mysteryBoxOpenedToday: 0,
  dailyQuizAnswersToday: 0,
};

export const DEFAULT_COMPLETED_TASKS: Record<string, boolean> = {};

// Canonical Server-Side Baseline Snapshot
export const SERVER_GAME_STATE_SNAPSHOT: UserGameState = {
  streetCoin: 12450,
  myReferralCode: 'SL7K9B2',
  deviceId: 'SL-DEV-001',
  hasPlayedToday: false,
  dailyStreak: 1,
  lastClaimDate: null,
  adsWatched: 0,
  telegramUser: null,
  // Bank Robbery Defaults
  unlockedBanks: [1],
  ownedTools: [],
  heatLevel: 0,
  lastHeatUpdate: 0,
  lastRobberyTime: null,
  cooldownUntil: null,
  cooldownReason: null,
  activeRobbery: null,
  // Referral Defaults
  referralsCount: 0,
  hasClaimedWelcomeBonus: false,
  appliedReferralCode: null,
  // Prom 2 Defaults
  shooterLevel: 1,
  ownedCars: ['basic'],
  selectedCar: 'basic',
  ownedBikes: ['scooter'],
  selectedBike: 'scooter',
  riderMission: 1,
  transactions: DEFAULT_TRANSACTIONS,
  withdrawals: DEFAULT_WITHDRAWALS,
  conversions: [],
  // PROM 5: Inventory
  inventoryArray: DEFAULT_INVENTORY_ARRAY,
  equippedItems: DEFAULT_EQUIPPED_ITEMS,
  // PROM 4: Watch Ads
  watchCountDaily: 5,
  lastWatchDate: null,
  boostUntil: null,
  // PROM 6: Task System
  completedTasks: DEFAULT_COMPLETED_TASKS,
  taskProgress: DEFAULT_TASK_PROGRESS,
  // Studio Rent & Security
  studioLevel: 0,
  rentExpiry: 0,
  userEmail: '',
  isBanned: false,
  postedSongs: [],
  studioAdsWatched: 0,
  studioAdDayMap: {},
  lastPostTimestamp: 0,
};

export const DEFAULT_RENT_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ADMIN_EMAIL = 'augustinejackson222@gmail.com';
export const ADMIN_TELEGRAM = 'https://t.me/Gammyadmin';
export const GROUP_TELEGRAM = 'https://t.me/Streetlifestars';

export function calculateChecksum(coins: number, rentExpiry: number): string {
  const salt = 'STREET_LIFE_STARS_2026_SECURITY_SALT';
  let hash = 0;
  const str = `${coins}:${rentExpiry}:${salt}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Cached snapshot reference to prevent infinite loops in useSyncExternalStore
let currentSnapshot: UserGameState = SERVER_GAME_STATE_SNAPSHOT;
let isInitialized = false;

// Store listeners
let listeners: (() => void)[] = [];

function notifyListeners() {
  for (const l of listeners) {
    l();
  }
}

// Persist helper for localStorage streetLife_save_v2
function persistState(state: UserGameState) {
  if (typeof window === 'undefined') return;
  try {
    const validRentExpiry = state.rentExpiry && state.rentExpiry > 0 ? state.rentExpiry : Date.now() + DEFAULT_RENT_DURATION;
    const dataToSave = {
      streetCoin: state.streetCoin,
      myReferralCode: state.myReferralCode,
      deviceId: state.deviceId,
      hasPlayedToday: state.hasPlayedToday,
      dailyStreak: state.dailyStreak,
      lastClaimDate: state.lastClaimDate,
      adsWatched: state.adsWatched,
      unlockedBanks: state.unlockedBanks,
      ownedTools: state.ownedTools,
      heatLevel: state.heatLevel,
      lastHeatUpdate: state.lastHeatUpdate,
      lastRobberyTime: state.lastRobberyTime,
      cooldownUntil: state.cooldownUntil,
      cooldownReason: state.cooldownReason,
      activeRobbery: state.activeRobbery,
      referralsCount: state.referralsCount,
      hasClaimedWelcomeBonus: state.hasClaimedWelcomeBonus,
      appliedReferralCode: state.appliedReferralCode,
      shooterLevel: state.shooterLevel,
      ownedCars: state.ownedCars,
      selectedCar: state.selectedCar,
      ownedBikes: state.ownedBikes,
      selectedBike: state.selectedBike,
      riderMission: state.riderMission,
      transactions: state.transactions,
      withdrawals: state.withdrawals,
      conversions: state.conversions,
      inventoryArray: state.inventoryArray,
      equippedItems: state.equippedItems,
      watchCountDaily: state.watchCountDaily,
      lastWatchDate: state.lastWatchDate,
      boostUntil: state.boostUntil,
      // PROM 6: Task System
      completedTasks: state.completedTasks,
      taskProgress: state.taskProgress,
      // Studio Rent & Admin
      studioLevel: state.studioLevel || 0,
      rentExpiry: validRentExpiry,
      userEmail: state.userEmail || '',
      isBanned: !!state.isBanned,
      postedSongs: state.postedSongs || [],
      studioAdsWatched: state.studioAdsWatched || 0,
      studioAdDayMap: state.studioAdDayMap || {},
      lastPostTimestamp: state.lastPostTimestamp || 0,
    };
    localStorage.setItem(SAVE_KEY_V2, JSON.stringify(dataToSave));
    localStorage.setItem('streetCoin', state.streetCoin.toString());
    localStorage.setItem('shooterLevel', state.shooterLevel.toString());
    localStorage.setItem('rentExpiry', validRentExpiry.toString());
    localStorage.setItem('streetLife_checksum', calculateChecksum(state.streetCoin, validRentExpiry));

    // Direct localStorage keys required by Prom 4, Prom 5, and Prom 6
    if (state.inventoryArray) {
      localStorage.setItem('inventoryArray', JSON.stringify(state.inventoryArray));
    }
    if (state.equippedItems) {
      localStorage.setItem('equippedItems', JSON.stringify(state.equippedItems));
    }
    if (typeof state.watchCountDaily === 'number') {
      localStorage.setItem('watchCountDaily', state.watchCountDaily.toString());
    }
    if (state.lastWatchDate) {
      localStorage.setItem('lastWatchDate', state.lastWatchDate);
    }
    // PROM 6: Task System Direct Keys
    if (state.completedTasks) {
      localStorage.setItem('completedTasks', JSON.stringify(state.completedTasks));
      localStorage.setItem('streetLife_completedTasks', JSON.stringify(state.completedTasks));
    }
    if (state.taskProgress) {
      localStorage.setItem('taskProgress', JSON.stringify(state.taskProgress));
      localStorage.setItem('streetLife_taskProgress', JSON.stringify(state.taskProgress));
    }
  } catch (err) {
    console.error('Failed to save to localStorage streetLife_save_v2:', err);
  }
}

// Decay heat by -1% every 2 minutes (120,000 ms)
function calculateHeatDecay(heat: number, lastUpdate: number, now: number): { newHeat: number; newLastUpdate: number } {
  if (heat <= 0) return { newHeat: 0, newLastUpdate: now };
  if (!lastUpdate || lastUpdate <= 0) return { newHeat: heat, newLastUpdate: now };

  const elapsedMs = now - lastUpdate;
  const decaySteps = Math.floor(elapsedMs / 120000); // 120,000 ms = 2 min
  if (decaySteps <= 0) return { newHeat: heat, newLastUpdate: lastUpdate };

  const newHeat = Math.max(0, heat - decaySteps);
  const newLastUpdate = lastUpdate + (decaySteps * 120000);
  return { newHeat, newLastUpdate };
}

export function subscribeGameState(listener: () => void) {
  listeners.push(listener);

  // When client mounts and subscribes, hydrate from localStorage streetLife_save_v2
  if (typeof window !== 'undefined' && !isInitialized) {
    isInitialized = true;
    try {
      const now = Date.now();
      let loadedData: Partial<UserGameState> = {};

      const rawV2 = localStorage.getItem(SAVE_KEY_V2);
      if (rawV2) {
        try {
          loadedData = JSON.parse(rawV2);
        } catch {
          // ignore corrupted json
        }
      } else {
        // Fallback / migration from legacy v1 individual keys
        const storedCoin = localStorage.getItem('streetCoin');
        const storedReferral = localStorage.getItem('myReferralCode');
        const storedDevice = localStorage.getItem('deviceId');
        const storedPlayed = localStorage.getItem('hasPlayedToday');
        const storedStreak = localStorage.getItem('dailyStreak');
        const storedLastClaim = localStorage.getItem('lastClaimDate');

        if (storedCoin) loadedData.streetCoin = parseInt(storedCoin, 10);
        if (storedReferral) loadedData.myReferralCode = storedReferral;
        if (storedDevice) loadedData.deviceId = storedDevice;
        if (storedPlayed) loadedData.hasPlayedToday = storedPlayed === 'true';
        if (storedStreak) loadedData.dailyStreak = parseInt(storedStreak, 10);
        if (storedLastClaim) loadedData.lastClaimDate = storedLastClaim;
      }

      // Generate deviceId & myReferralCode if missing
      const deviceId = loadedData.deviceId || generateDeviceId();
      const myReferralCode = loadedData.myReferralCode || generateReferralCode();
      const streetCoin = typeof loadedData.streetCoin === 'number' && !isNaN(loadedData.streetCoin) ? loadedData.streetCoin : 12450;
      const hasPlayedToday = !!loadedData.hasPlayedToday;
      const dailyStreak = loadedData.dailyStreak || 1;
      const lastClaimDate = loadedData.lastClaimDate || null;
      const adsWatched = loadedData.adsWatched || 0;

      // Bank robbery data
      const unlockedBanks = Array.isArray(loadedData.unlockedBanks) && loadedData.unlockedBanks.length > 0
        ? loadedData.unlockedBanks
        : [1];
      const ownedTools = Array.isArray(loadedData.ownedTools) ? loadedData.ownedTools : [];
      let rawHeat = typeof loadedData.heatLevel === 'number' ? loadedData.heatLevel : 0;
      let lastHeatUpdate = loadedData.lastHeatUpdate || now;

      // Apply initial decay
      const decayResult = calculateHeatDecay(rawHeat, lastHeatUpdate, now);
      rawHeat = decayResult.newHeat;
      lastHeatUpdate = decayResult.newLastUpdate;

      let cooldownUntil = loadedData.cooldownUntil || null;
      let cooldownReason = loadedData.cooldownReason || null;
      if (cooldownUntil && now >= cooldownUntil) {
        cooldownUntil = null;
        cooldownReason = null;
      }

      // Prom 2 & Transactions hydration
      let shooterLevel = typeof loadedData.shooterLevel === 'number' ? loadedData.shooterLevel : 1;
      const storedShooterLevel = localStorage.getItem('shooterLevel');
      if (storedShooterLevel) {
        const parsed = parseInt(storedShooterLevel, 10);
        if (!isNaN(parsed) && parsed >= 1) shooterLevel = parsed;
      }
      const ownedCars = Array.isArray(loadedData.ownedCars) && loadedData.ownedCars.length > 0
        ? (loadedData.ownedCars as CarId[])
        : (['basic'] as CarId[]);
      const selectedCar = loadedData.selectedCar && ownedCars.includes(loadedData.selectedCar)
        ? loadedData.selectedCar
        : ownedCars[0];
      const ownedBikes = Array.isArray(loadedData.ownedBikes) && loadedData.ownedBikes.length > 0
        ? (loadedData.ownedBikes as BikeId[])
        : (['scooter'] as BikeId[]);
      const selectedBike = loadedData.selectedBike && ownedBikes.includes(loadedData.selectedBike)
        ? loadedData.selectedBike
        : ownedBikes[0];
      const riderMission = typeof loadedData.riderMission === 'number' ? loadedData.riderMission : 1;
      const transactions = Array.isArray(loadedData.transactions) && loadedData.transactions.length > 0
        ? loadedData.transactions
        : DEFAULT_TRANSACTIONS;
      const withdrawals = Array.isArray(loadedData.withdrawals) && loadedData.withdrawals.length > 0
        ? loadedData.withdrawals
        : DEFAULT_WITHDRAWALS;
      const conversions = Array.isArray(loadedData.conversions)
        ? loadedData.conversions
        : [];

      // PROM 5: Inventory Hydration
      let inventoryArray = DEFAULT_INVENTORY_ARRAY;
      try {
        const rawInv = localStorage.getItem('inventoryArray');
        if (rawInv) {
          const parsed = JSON.parse(rawInv);
          if (Array.isArray(parsed) && parsed.length > 0) inventoryArray = parsed;
        } else if (Array.isArray(loadedData.inventoryArray) && loadedData.inventoryArray.length > 0) {
          inventoryArray = loadedData.inventoryArray;
        }
      } catch {
        // use default
      }

      let equippedItems = DEFAULT_EQUIPPED_ITEMS;
      try {
        const rawEquipped = localStorage.getItem('equippedItems');
        if (rawEquipped) {
          const parsed = JSON.parse(rawEquipped);
          if (Array.isArray(parsed)) equippedItems = parsed;
        } else if (Array.isArray(loadedData.equippedItems)) {
          equippedItems = loadedData.equippedItems;
        }
      } catch {
        // use default
      }

      // PROM 4: Watch Ads Hydration
      const todayStr = new Date().toISOString().split('T')[0];
      let lastWatchDate = localStorage.getItem('lastWatchDate') || loadedData.lastWatchDate || todayStr;
      let watchCountDaily = 5;
      const rawWatchCount = localStorage.getItem('watchCountDaily');
      if (rawWatchCount !== null) {
        watchCountDaily = parseInt(rawWatchCount, 10) || 0;
      } else if (typeof loadedData.watchCountDaily === 'number') {
        watchCountDaily = loadedData.watchCountDaily;
      }

      // Reset daily watch limit if date rolled over
      if (lastWatchDate !== todayStr) {
        watchCountDaily = 0;
        lastWatchDate = todayStr;
        localStorage.setItem('watchCountDaily', '0');
        localStorage.setItem('lastWatchDate', todayStr);
      }

      const boostUntil = typeof loadedData.boostUntil === 'number' ? loadedData.boostUntil : null;

      // PROM 6: Task System Hydration
      let completedTasks: Record<string, boolean> = { ...DEFAULT_COMPLETED_TASKS };
      try {
        const rawCompleted = localStorage.getItem('completedTasks') || localStorage.getItem('streetLife_completedTasks');
        if (rawCompleted) {
          const parsed = JSON.parse(rawCompleted);
          if (parsed && typeof parsed === 'object') {
            const mapped: Record<string, boolean> = {};
            for (const [k, v] of Object.entries(parsed)) {
              mapped[k] = Boolean(v);
            }
            completedTasks = mapped;
          }
        } else if (loadedData.completedTasks && typeof loadedData.completedTasks === 'object') {
          const mapped: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(loadedData.completedTasks)) {
            mapped[k] = Boolean(v);
          }
          completedTasks = mapped;
        }
      } catch {
        completedTasks = { ...DEFAULT_COMPLETED_TASKS };
      }

      let taskProgress: Record<string, number> = { ...DEFAULT_TASK_PROGRESS };
      try {
        const rawProgress = localStorage.getItem('taskProgress') || localStorage.getItem('streetLife_taskProgress');
        if (rawProgress) {
          const parsed = JSON.parse(rawProgress);
          if (parsed && typeof parsed === 'object') {
            taskProgress = { ...DEFAULT_TASK_PROGRESS, ...parsed };
          }
        } else if (loadedData.taskProgress && typeof loadedData.taskProgress === 'object') {
          taskProgress = { ...DEFAULT_TASK_PROGRESS, ...loadedData.taskProgress };
        }
      } catch {
        taskProgress = { ...DEFAULT_TASK_PROGRESS };
      }

      // Check daily reset for status post task, mystery box, and daily quiz if date changed
      const todayDayNum = Math.floor(Date.now() / 86400000);
      if (taskProgress.lastDayNum && taskProgress.lastDayNum !== todayDayNum) {
        taskProgress.statusPostsToday = 0;
        taskProgress.mysteryBoxOpenedToday = 0;
        taskProgress.dailyQuizAnswersToday = 0;
        taskProgress.lastDayNum = todayDayNum;
      }

      currentSnapshot = {
        streetCoin,
        myReferralCode,
        deviceId,
        hasPlayedToday,
        dailyStreak,
        lastClaimDate,
        adsWatched,
        telegramUser: null,
        unlockedBanks,
        ownedTools,
        heatLevel: rawHeat,
        lastHeatUpdate,
        lastRobberyTime: loadedData.lastRobberyTime || null,
        cooldownUntil,
        cooldownReason,
        activeRobbery: loadedData.activeRobbery || null,
        referralsCount: loadedData.referralsCount || 0,
        hasClaimedWelcomeBonus: !!loadedData.hasClaimedWelcomeBonus,
        appliedReferralCode: loadedData.appliedReferralCode || null,
        shooterLevel,
        ownedCars,
        selectedCar,
        ownedBikes,
        selectedBike,
        riderMission,
        transactions,
        withdrawals,
        conversions,
        inventoryArray,
        equippedItems,
        watchCountDaily,
        boostUntil,
        completedTasks,
        taskProgress,
        // Studio Rent & Security
        studioLevel: loadedData.studioLevel || 0,
        rentExpiry: (() => {
          const storedRent = typeof window !== 'undefined' ? localStorage.getItem('rentExpiry') : null;
          if (storedRent) {
            const p = parseInt(storedRent, 10);
            if (!isNaN(p) && p > 0) return p;
          }
          return loadedData.rentExpiry && loadedData.rentExpiry > 0 ? loadedData.rentExpiry : now + DEFAULT_RENT_DURATION;
        })(),
        userEmail: loadedData.userEmail || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : ''),
        isBanned: !!loadedData.isBanned,
        postedSongs: loadedData.postedSongs || (typeof window !== 'undefined' ? (() => {
          try {
            const r = localStorage.getItem('streetLife_postedSongs');
            return r ? JSON.parse(r) : [];
          } catch {
            return [];
          }
        })() : []),
        studioAdsWatched: loadedData.studioAdsWatched || 0,
        studioAdDayMap: loadedData.studioAdDayMap || {},
        lastPostTimestamp: loadedData.lastPostTimestamp || 0,
      };


      persistState(currentSnapshot);
      // Defer notification to prevent synchronous re-entrant calls in React useSyncExternalStore
      setTimeout(() => {
        notifyListeners();
      }, 0);
    } catch (e) {
      console.error('Error during initial state hydration:', e);
    }
  }

  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Stable snapshot getter
export function getGameStateSnapshot(): UserGameState {
  return currentSnapshot;
}

// Ticker helper: periodic decay and timer check
export function tickGameState(): void {
  const now = Date.now();
  let hasChanges = false;
  let updated = { ...currentSnapshot };

  // 1. Heat decay (-1% every 2 minutes)
  if (updated.heatLevel > 0) {
    const decay = calculateHeatDecay(updated.heatLevel, updated.lastHeatUpdate, now);
    if (decay.newHeat !== updated.heatLevel) {
      updated.heatLevel = decay.newHeat;
      updated.lastHeatUpdate = decay.newLastUpdate;
      hasChanges = true;
    }
  }

  // 2. Cooldown check
  if (updated.cooldownUntil && now >= updated.cooldownUntil) {
    updated.cooldownUntil = null;
    updated.cooldownReason = null;
    hasChanges = true;
  }

  if (hasChanges) {
    currentSnapshot = updated;
    persistState(currentSnapshot);
    notifyListeners();
  }
}

// Update Coin
export function saveCoins(amount: number): void {
  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: amount,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// Update hasPlayedToday
export function saveHasPlayedToday(played: boolean): void {
  currentSnapshot = {
    ...currentSnapshot,
    hasPlayedToday: played,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// Update Daily Streak & Last Claim Date
export function saveDailyClaim(newCoins: number, newStreak: number): void {
  const todayStr = new Date().toISOString().split('T')[0];
  const earned = Math.max(0, newCoins - currentSnapshot.streetCoin);
  const now = Date.now();
  const newTx: CoinTransaction = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'daily_reward',
    description: `+${earned || 50} for daily claim`,
    amount: earned || 50,
    timestamp: now,
  };
  const updatedTransactions = [newTx, ...(currentSnapshot.transactions || [])].slice(0, 25);
  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: newCoins,
    dailyStreak: newStreak,
    lastClaimDate: todayStr,
    transactions: updatedTransactions,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// Reset Daily State for Testing
export function resetDailyTestState(): void {
  currentSnapshot = {
    ...currentSnapshot,
    hasPlayedToday: false,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// ==================== BANK ROBBERY ACTIONS ====================

// Buy a Tool from Tools Shop
export function buyRobberyTool(toolId: RobberyToolId, price: number): { success: boolean; message: string } {
  if (currentSnapshot.streetCoin < price) {
    return { success: false, message: `Insufficient coins! Need ${price.toLocaleString()} coins.` };
  }

  const updatedTools = [...currentSnapshot.ownedTools, toolId];
  const newCount = updatedTools.filter((t) => t === toolId).length;

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin - price,
    ownedTools: updatedTools,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: `Acquired! You now possess ${newCount}x ${toolId.replace('_', ' ')}.` };
}

// Start a Bank Robbery
export function startBankRobbery(
  bankId: number,
  durationSeconds: number,
  reward: number,
  heatIncrease: number,
  successChance: number
): { success: boolean; message: string } {
  const now = Date.now();

  // Check if active robbery already in progress
  if (currentSnapshot.activeRobbery) {
    return { success: false, message: 'A robbery is already in progress!' };
  }

  // Check cooldown / busted
  if (currentSnapshot.cooldownUntil && now < currentSnapshot.cooldownUntil) {
    const remainingSec = Math.ceil((currentSnapshot.cooldownUntil - now) / 1000);
    return {
      success: false,
      message: `You are currently in hiding/cooldown! Wait ${remainingSec}s or watch an ad to skip.`,
    };
  }

  // Check if heat is 100%
  if (currentSnapshot.heatLevel >= 100) {
    return {
      success: false,
      message: 'Police Heat is 100% (BUSTED)! Pay a 300 coin bribe or wait out the heat.',
    };
  }

  const activeRobbery: ActiveRobbery = {
    bankId,
    startTime: now,
    durationSeconds,
    reward,
    heatIncrease,
    successChance,
  };

  currentSnapshot = {
    ...currentSnapshot,
    activeRobbery,
    hasPlayedToday: true, // Counts as playing a game for daily claim unlock!
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: 'Robbery initiated! Stay frosty...' };
}

// Finish Robbery (Called when timer expires or test fast-forward)
export function completeBankRobbery(): { isSuccess: boolean; reward: number; heatAdded: number } {
  const active = currentSnapshot.activeRobbery;
  if (!active) {
    return { isSuccess: false, reward: 0, heatAdded: 0 };
  }

  const roll = Math.random() * 100;
  const isSuccess = roll <= active.successChance;
  const now = Date.now();

  if (isSuccess) {
    // Reward player + Increase Heat
    const newCoins = currentSnapshot.streetCoin + active.reward;
    const newHeat = Math.min(100, currentSnapshot.heatLevel + active.heatIncrease);
    
    // Unlock next bank if target is current highest
    const nextBankId = active.bankId + 1;
    let unlockedBanks = [...currentSnapshot.unlockedBanks];
    if (nextBankId <= 5 && !unlockedBanks.includes(nextBankId)) {
      unlockedBanks.push(nextBankId);
    }

    // Check if heat hit 100% -> Busted for 10 mins
    let cooldownUntil = currentSnapshot.cooldownUntil;
    let cooldownReason = currentSnapshot.cooldownReason;
    if (newHeat >= 100) {
      cooldownUntil = now + (10 * 60 * 1000); // 10 min
      cooldownReason = 'BUSTED_100';
    }

    const newTx: CoinTransaction = {
      id: `tx_${now}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'bank_heist',
      description: `+${active.reward} for bank heist`,
      amount: active.reward,
      timestamp: now,
    };
    const updatedTransactions = [newTx, ...(currentSnapshot.transactions || [])].slice(0, 25);

    currentSnapshot = {
      ...currentSnapshot,
      streetCoin: newCoins,
      heatLevel: newHeat,
      lastHeatUpdate: now,
      lastRobberyTime: now,
      unlockedBanks,
      cooldownUntil,
      cooldownReason,
      activeRobbery: null,
      transactions: updatedTransactions,
    };
    persistState(currentSnapshot);
    notifyListeners();
    return { isSuccess: true, reward: active.reward, heatAdded: active.heatIncrease };
  } else {
    // Caught / Failed -> Heat +50%, 5 min cooldown
    const newHeat = Math.min(100, currentSnapshot.heatLevel + 50);
    // 5 min cooldown for caught, or 10 min if heat hit 100
    const cooldownMs = newHeat >= 100 ? (10 * 60 * 1000) : (5 * 60 * 1000);
    const cooldownReason = newHeat >= 100 ? 'BUSTED_100' : 'CAUGHT_FAIL';

    currentSnapshot = {
      ...currentSnapshot,
      heatLevel: newHeat,
      lastHeatUpdate: now,
      lastRobberyTime: now,
      cooldownUntil: now + cooldownMs,
      cooldownReason,
      activeRobbery: null,
    };
    persistState(currentSnapshot);
    notifyListeners();
    return { isSuccess: false, reward: 0, heatAdded: 50 };
  }
}

// Cancel or Fast-forward Robbery (for testing)
export function fastForwardActiveRobbery(): { isSuccess: boolean; reward: number; heatAdded: number } | null {
  if (currentSnapshot.activeRobbery) {
    return completeBankRobbery();
  }
  return null;
}

// Pay 300 coins bribe to reduce heat to 50%
export function payPoliceBribe(): { success: boolean; message: string } {
  const BRIBE_COST = 300;
  if (currentSnapshot.streetCoin < BRIBE_COST) {
    return { success: false, message: `Need ${BRIBE_COST} coins to pay off dirty cops!` };
  }

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin - BRIBE_COST,
    heatLevel: 50,
    lastHeatUpdate: Date.now(),
    cooldownUntil: null,
    cooldownReason: null,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: 'Bribe paid! Heat slashed to 50% & charges dropped.' };
}

// Watch Ad to skip cooldown (Adsgram placeholder)
export function watchAdToSkipCooldown(): { success: boolean; message: string } {
  currentSnapshot = {
    ...currentSnapshot,
    cooldownUntil: null,
    cooldownReason: null,
    adsWatched: currentSnapshot.adsWatched + 1,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: 'Ad watched! Arrest cooldown cleared immediately.' };
}

// ==================== REFERRAL SYSTEM ACTIONS ====================

// Apply invite code: 500 + 20 welcome bonus for invitee
export function applyInviteCode(code: string): { success: boolean; message: string } {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Please enter a referral code.' };
  }
  if (cleanCode === currentSnapshot.myReferralCode) {
    return { success: false, message: 'You cannot use your own referral code!' };
  }
  if (currentSnapshot.hasClaimedWelcomeBonus) {
    return { success: false, message: 'You have already claimed your welcome bonus!' };
  }

  const WELCOME_BONUS = 10;
  const now = Date.now();
  const newTx: CoinTransaction = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'welcome_bonus',
    description: `+${WELCOME_BONUS} for welcome bonus`,
    amount: WELCOME_BONUS,
    timestamp: now,
  };
  const updatedTransactions = [newTx, ...(currentSnapshot.transactions || [])].slice(0, 25);

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin + WELCOME_BONUS,
    hasClaimedWelcomeBonus: true,
    appliedReferralCode: cleanCode,
    transactions: updatedTransactions,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: `🎉 Welcome bonus applied! +${WELCOME_BONUS} Street Coins added to your stash.` };
}

// Add simulated referral (+10 coins)
export function simulateReferralInvited(): void {
  const now = Date.now();
  const newTx: CoinTransaction = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'referral',
    description: '+10 for referral',
    amount: 10,
    timestamp: now,
  };
  const updatedTransactions = [newTx, ...(currentSnapshot.transactions || [])].slice(0, 25);

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin + 10,
    referralsCount: currentSnapshot.referralsCount + 1,
    transactions: updatedTransactions,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// ==================== TRANSACTION ACTIONS ====================

export function recordCoinTransaction(
  amount: number,
  description: string,
  type: CoinTransaction['type']
): void {
  const now = Date.now();
  const newTx: CoinTransaction = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    description,
    amount,
    timestamp: now,
  };

  const newCoins = Math.max(0, currentSnapshot.streetCoin + amount);
  const updatedTransactions = [newTx, ...(currentSnapshot.transactions || [])].slice(0, 25);

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: newCoins,
    hasPlayedToday: true,
    transactions: updatedTransactions,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// ==================== PROM 2 GAME ACTIONS ====================

export function addGameCoins(
  amount: number,
  description: string,
  type: CoinTransaction['type']
): void {
  if (amount === 0) return;
  recordCoinTransaction(amount, description, type);
}

export function saveShooterLevel(level: number): void {
  const validated = Math.max(1, Math.min(100, level));
  currentSnapshot = {
    ...currentSnapshot,
    shooterLevel: validated,
    hasPlayedToday: true,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

export function buyCar(carId: CarId, price: number): { success: boolean; message: string } {
  if (currentSnapshot.streetCoin < price) {
    return { success: false, message: `Need ${price.toLocaleString()} coins for this ride!` };
  }
  const owned = currentSnapshot.ownedCars.includes(carId)
    ? currentSnapshot.ownedCars
    : [...currentSnapshot.ownedCars, carId];

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin - price,
    ownedCars: owned,
    selectedCar: carId,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: `Car purchased and parked in garage!` };
}

export function selectCar(carId: CarId): void {
  if (!currentSnapshot.ownedCars.includes(carId)) return;
  currentSnapshot = {
    ...currentSnapshot,
    selectedCar: carId,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

export function buyBike(bikeId: BikeId, price: number): { success: boolean; message: string } {
  if (currentSnapshot.streetCoin < price) {
    return { success: false, message: `Need ${price.toLocaleString()} coins for this bike!` };
  }
  const owned = currentSnapshot.ownedBikes.includes(bikeId)
    ? currentSnapshot.ownedBikes
    : [...currentSnapshot.ownedBikes, bikeId];

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin - price,
    ownedBikes: owned,
    selectedBike: bikeId,
  };
  persistState(currentSnapshot);
  notifyListeners();
  return { success: true, message: `Bike acquired and tuned for delivery!` };
}

export function selectBike(bikeId: BikeId): void {
  if (!currentSnapshot.ownedBikes.includes(bikeId)) return;
  currentSnapshot = {
    ...currentSnapshot,
    selectedBike: bikeId,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

export function completeRiderMission(missionNum: number): void {
  addGameCoins(10, '+10 for package delivery', 'rider_delivery');
  currentSnapshot = {
    ...currentSnapshot,
    riderMission: missionNum + 1,
    hasPlayedToday: true,
  };
  persistState(currentSnapshot);
  notifyListeners();
}

// ---------------------------------------------------------------------------
// Bank Financial Services: Withdrawal & Currency Conversion
// ---------------------------------------------------------------------------

export function requestWithdrawal(
  amount: number,
  currency: CryptoCurrency,
  network: string,
  destinationAddress: string,
  memo?: string
): { success: boolean; message: string; record?: WithdrawalRecord } {
  if (amount <= 0) {
    return { success: false, message: 'Invalid withdrawal amount' };
  }
  if (currentSnapshot.streetCoin < amount) {
    return { success: false, message: 'Insufficient Street Coin balance' };
  }
  if (!destinationAddress || destinationAddress.trim().length < 4) {
    return { success: false, message: 'Please enter a valid recipient address' };
  }

  let payout = 0;
  if (currency === 'TON') payout = Number((amount / 10000).toFixed(4));
  else if (currency === 'USDT') payout = Number((amount / 1000).toFixed(2));
  else if (currency === 'STARS') payout = Math.floor((amount / 100) * 5);
  else payout = Number((amount / 1000).toFixed(2));

  const randomHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const record: WithdrawalRecord = {
    id: 'wdr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    timestamp: Date.now(),
    coinAmount: amount,
    payoutAmount: payout,
    currency,
    network,
    destinationAddress: destinationAddress.trim(),
    memo: memo?.trim() || undefined,
    status: 'completed',
    txHash: randomHash,
  };

  const newCoin = currentSnapshot.streetCoin - amount;
  const existingWithdrawals = currentSnapshot.withdrawals || DEFAULT_WITHDRAWALS;
  const updatedWithdrawals = [record, ...existingWithdrawals];

  const tx: CoinTransaction = {
    id: 'tx_wdr_' + Date.now(),
    type: 'withdrawal',
    description: `Withdrew ${amount.toLocaleString()} coins (${payout} ${currency})`,
    amount: -amount,
    timestamp: Date.now(),
  };

  const updatedTransactions = [tx, ...(currentSnapshot.transactions || [])].slice(0, 30);

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: newCoin,
    withdrawals: updatedWithdrawals,
    transactions: updatedTransactions,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return {
    success: true,
    message: `Withdrawal of ${amount.toLocaleString()} coins sent!`,
    record,
  };
}

export function convertStreetCoins(
  amount: number,
  targetCurrency: CryptoCurrency
): { success: boolean; message: string; record?: ConversionRecord } {
  if (amount <= 0) {
    return { success: false, message: 'Invalid conversion amount' };
  }
  if (currentSnapshot.streetCoin < amount) {
    return { success: false, message: 'Insufficient Street Coin balance' };
  }

  let rate = 0.0001;
  let toAmount = 0;
  if (targetCurrency === 'TON') {
    rate = 0.0001;
    toAmount = Number((amount * rate).toFixed(4));
  } else if (targetCurrency === 'USDT') {
    rate = 0.001;
    toAmount = Number((amount * rate).toFixed(2));
  } else if (targetCurrency === 'STARS') {
    rate = 0.05;
    toAmount = Math.floor(amount * rate);
  } else {
    rate = 0.001;
    toAmount = Number((amount * rate).toFixed(2));
  }

  const record: ConversionRecord = {
    id: 'conv_' + Date.now(),
    timestamp: Date.now(),
    fromCoins: amount,
    toAmount,
    toCurrency: targetCurrency,
    rate,
  };

  const existingConversions = currentSnapshot.conversions || [];
  const updatedConversions = [record, ...existingConversions].slice(0, 30);

  const tx: CoinTransaction = {
    id: 'tx_conv_' + Date.now(),
    type: 'conversion',
    description: `Converted ${amount.toLocaleString()} coins to ${toAmount} ${targetCurrency}`,
    amount: -amount,
    timestamp: Date.now(),
  };

  const updatedTransactions = [tx, ...(currentSnapshot.transactions || [])].slice(0, 30);

  currentSnapshot = {
    ...currentSnapshot,
    conversions: updatedConversions,
    transactions: updatedTransactions,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return {
    success: true,
    message: `Converted ${amount.toLocaleString()} coins to ${toAmount} ${targetCurrency}!`,
    record,
  };
}

// ---------------------------------------------------------------------------
// PROM 5: Inventory System (Drip & Tools, Equip, Stats Calculation)
// ---------------------------------------------------------------------------

export function calculateTotalStats(equippedIds?: string[]): {
  flex: number;
  power: number;
  speed: number;
  maxFlex: number;
  maxPower: number;
  maxSpeed: number;
} {
  const ids = equippedIds || currentSnapshot.equippedItems || DEFAULT_EQUIPPED_ITEMS;
  let flex = 100; // Base Flex
  let power = 35; // Base Power
  let speed = 5;  // Base Speed

  for (const item of DEFAULT_INVENTORY_ITEMS) {
    if (ids.includes(item.id)) {
      if (item.statType === 'flex') flex += item.statValue;
      if (item.statType === 'power') power += item.statValue;
      if (item.statType === 'speed') speed += item.statValue;
    }
  }

  return {
    flex,
    power,
    speed,
    maxFlex: 200,
    maxPower: 100,
    maxSpeed: 100,
  };
}

export function isItemEquipped(itemId: string): boolean {
  const equipped = currentSnapshot.equippedItems || DEFAULT_EQUIPPED_ITEMS;
  return equipped.includes(itemId);
}

export function toggleEquipItem(itemId: string): { isEquipped: boolean; equippedItems: string[] } {
  const currentEquipped = currentSnapshot.equippedItems || [...DEFAULT_EQUIPPED_ITEMS];
  const currentInventory = currentSnapshot.inventoryArray || [...DEFAULT_INVENTORY_ARRAY];

  let nextEquipped: string[];
  let isNowEquipped: boolean;

  if (currentEquipped.includes(itemId)) {
    nextEquipped = currentEquipped.filter((id) => id !== itemId);
    isNowEquipped = false;
  } else {
    nextEquipped = [...currentEquipped, itemId];
    isNowEquipped = true;
  }

  // Ensure item is in inventoryArray
  const nextInventory = currentInventory.includes(itemId)
    ? currentInventory
    : [...currentInventory, itemId];

  currentSnapshot = {
    ...currentSnapshot,
    inventoryArray: nextInventory,
    equippedItems: nextEquipped,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return { isEquipped: isNowEquipped, equippedItems: nextEquipped };
}

// ---------------------------------------------------------------------------
// PROM 4: Watch Ads System (Watch & Earn, Rewarded Simulation, Multipliers, Boost)
// ---------------------------------------------------------------------------

/**
 * Ad network placeholder as requested in Prom 4.
 * Later replace with Adsgram / OnClickA
 */
export function showRewardedAd(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 3000));
}

export function claimWatchAdReward(baseAmount: number = 10): {
  success: boolean;
  reward: number;
  multiplier: number;
  dailyCount: number;
  limitReached: boolean;
  boostActivated: boolean;
} {
  const currentCount = typeof currentSnapshot.watchCountDaily === 'number'
    ? currentSnapshot.watchCountDaily
    : 0;

  if (currentCount >= 33) {
    return {
      success: false,
      reward: 0,
      multiplier: 1,
      dailyCount: currentCount,
      limitReached: true,
      boostActivated: false,
    };
  }

  const nextCount = currentCount + 1;
  const reward = 10; // Coins 10 only as specified
  const multiplier = 1;
  const todayStr = new Date().toISOString().split('T')[0];
  let boostUntil = currentSnapshot.boostUntil || null;
  let boostActivated = false;

  // Boost x2 for 1 hour after 5 ads
  if (nextCount >= 5 && (!boostUntil || Date.now() > boostUntil)) {
    boostUntil = Date.now() + 3600000; // 1 hour
    boostActivated = true;
  }

  const tx: CoinTransaction = {
    id: 'tx_ad_' + Date.now(),
    type: 'ad_reward',
    description: `+${reward} S for watching ad (${multiplier}x multiplier)`,
    amount: reward,
    timestamp: Date.now(),
  };

  const updatedTransactions = [tx, ...(currentSnapshot.transactions || [])].slice(0, 30);

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: currentSnapshot.streetCoin + reward,
    adsWatched: (currentSnapshot.adsWatched || 0) + 1,
    watchCountDaily: nextCount,
    lastWatchDate: todayStr,
    boostUntil,
    transactions: updatedTransactions,
    hasPlayedToday: true,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return {
    success: true,
    reward,
    multiplier,
    dailyCount: nextCount,
    limitReached: nextCount >= 10,
    boostActivated,
  };
}

// ---------------------------------------------------------------------------
// PROM 6: Task System Operations & State Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a task is marked as completed
 */
export function isTaskCompleted(taskId: string): boolean {
  const tasks = currentSnapshot.completedTasks || {};
  return !!tasks[taskId];
}

/**
 * Completes a task, awards StreetCoins, records transaction, and persists to localStorage
 */
export function completeTask(
  taskId: string,
  reward: number,
  taskTitle?: string,
  proofData?: string
): { success: boolean; message: string; newBalance: number } {
  const completedTasks = { ...(currentSnapshot.completedTasks || {}) };

  if (completedTasks[taskId]) {
    return {
      success: false,
      message: 'Task already completed and claimed!',
      newBalance: currentSnapshot.streetCoin,
    };
  }

  // Mark task as completed
  completedTasks[taskId] = true;

  const title = taskTitle || taskId.replace(/_/g, ' ');
  const tx: CoinTransaction = {
    id: `tx_task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'task_reward',
    description: `+${reward} SC Task: ${title}`,
    amount: reward,
    timestamp: Date.now(),
  };

  const updatedTransactions = [tx, ...(currentSnapshot.transactions || [])].slice(0, 30);
  const newStreetCoin = currentSnapshot.streetCoin + reward;

  currentSnapshot = {
    ...currentSnapshot,
    streetCoin: newStreetCoin,
    completedTasks,
    transactions: updatedTransactions,
    hasPlayedToday: true,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return {
    success: true,
    message: `+${reward} SC claimed for completing "${title}"!`,
    newBalance: newStreetCoin,
  };
}

/**
 * Updates task progress metrics and persists to localStorage
 */
export function updateTaskProgressMetrics(
  updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)
): Record<string, number> {
  const currentMetrics = currentSnapshot.taskProgress || { ...DEFAULT_TASK_PROGRESS };
  const partial = typeof updater === 'function' ? updater(currentMetrics) : updater;
  const updatedProgress: Record<string, number> = {
    ...currentMetrics,
    ...partial,
  };

  currentSnapshot = {
    ...currentSnapshot,
    taskProgress: updatedProgress,
  };

  persistState(currentSnapshot);
  notifyListeners();

  return updatedProgress;
}

/**
 * Accumulate in-game stay time
 */
export function addInGameStayTime(secondsToAdd: number): number {
  const currentMetrics = currentSnapshot.taskProgress || { ...DEFAULT_TASK_PROGRESS };
  const updatedSeconds = (currentMetrics.stayTimeSeconds || 0) + secondsToAdd;
  updateTaskProgressMetrics({ stayTimeSeconds: updatedSeconds });
  return updatedSeconds;
}

/**
 * Submit Status Post proof (Max 2 posts per day: 1st=50 SC, 2nd=100 SC)
 */
export function claimStatusPostTask(screenshotProof?: string): {
  success: boolean;
  reward: number;
  postNumber: number;
  message: string;
} {
  const todayStr = new Date().toISOString().split('T')[0];
  const metrics = currentSnapshot.taskProgress || { ...DEFAULT_TASK_PROGRESS };
  const postsToday = metrics.statusPostsToday || 0;

  if (postsToday >= 2) {
    return {
      success: false,
      reward: 0,
      postNumber: postsToday,
      message: 'Daily status post limit reached (max 2 per day)!',
    };
  }

  const nextPostNumber = postsToday + 1;
  const reward = 10;
  const taskId = `status_post_${todayStr}_${nextPostNumber}`;

  updateTaskProgressMetrics({
    statusPostsToday: nextPostNumber,
  });

  completeTask(taskId, reward, `Status Post #${nextPostNumber}`, screenshotProof);

  return {
    success: true,
    reward,
    postNumber: nextPostNumber,
    message: `+${reward} SC verified for Status Post #${nextPostNumber}!`,
  };
}

/**
 * Submit Video Promo link (TikTok, FB, YouTube - fixed 200 SC upon verification)
 */
export function submitVideoPromoTask(videoUrl: string): {
  success: boolean;
  reward: number;
  message: string;
} {
  if (!videoUrl || videoUrl.length < 5) {
    return { success: false, reward: 0, message: 'Please enter a valid video URL.' };
  }

  const taskId = 'video_promo_task';
  const completed = isTaskCompleted(taskId);
  if (completed) {
    return { success: false, reward: 0, message: 'Video promo task already claimed!' };
  }

  updateTaskProgressMetrics({
    videoPromoSubmitted: 1,
  });

  const res = completeTask(taskId, 200, 'Video Promo (200 SC)', videoUrl);

  return {
    success: true,
    reward: 200,
    message: res.message,
  };
}

/**
 * Open Mystery Box (Daily random SC reward: 150 - 1,000 SC)
 */
export function openMysteryBox(): {
  success: boolean;
  reward: number;
  message: string;
} {
  const todayStr = new Date().toISOString().split('T')[0];
  const metrics = currentSnapshot.taskProgress || { ...DEFAULT_TASK_PROGRESS };

  if (metrics.mysteryBoxOpenedToday) {
    return {
      success: false,
      reward: 0,
      message: 'Mystery Box already opened today! Come back tomorrow.',
    };
  }

  // Daily Mystery Box reward: 10 SC
  const reward = 10;
  const taskId = `mystery_box_${todayStr}`;

  updateTaskProgressMetrics({
    mysteryBoxOpenedToday: 1,
  });

  completeTask(taskId, reward, 'Daily Mystery Box');

  return {
    success: true,
    reward,
    message: `Mystery Box unlocked! Received +${reward} SC!`,
  };
}

// ---------------------------------------------------------------------------
// HUSTLE HUB STATE HELPERS (Food, Housing, Energy, Studio, Freestyle)
// ---------------------------------------------------------------------------

export interface HustleHubState {
  hunger: number;
  energy: number;
  housingTier: number;
  studioLevel: number;
  todayRecordingsCount: number;
  todayRecordingsDate: string;
}

const HUSTLE_HUB_KEY = 'street_life_hustle_hub_v1';

export function getHustleHubState(userId = 'anon'): HustleHubState {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultState: HustleHubState = {
    hunger: 85,
    energy: 80,
    housingTier: 0,
    studioLevel: 0,
    todayRecordingsCount: 0,
    todayRecordingsDate: todayStr,
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(`${HUSTLE_HUB_KEY}_${userId}`);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    // Reset daily recording count if new date
    if (parsed.todayRecordingsDate !== todayStr) {
      parsed.todayRecordingsCount = 0;
      parsed.todayRecordingsDate = todayStr;
      localStorage.setItem(`${HUSTLE_HUB_KEY}_${userId}`, JSON.stringify(parsed));
    }
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

export function saveHustleHubState(userId = 'anon', update: Partial<HustleHubState>): HustleHubState {
  const current = getHustleHubState(userId);
  const updated: HustleHubState = { ...current, ...update };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${HUSTLE_HUB_KEY}_${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Hustle hub save error:', e);
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// STUDIO RENT & SECURITY SYSTEM
// ---------------------------------------------------------------------------

export function getRentExpiry(): number {
  if (typeof window === 'undefined') return Date.now() + DEFAULT_RENT_DURATION;
  const stored = localStorage.getItem('rentExpiry');
  if (stored) {
    const val = parseInt(stored, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return currentSnapshot.rentExpiry && currentSnapshot.rentExpiry > 0
    ? currentSnapshot.rentExpiry
    : Date.now() + DEFAULT_RENT_DURATION;
}

export function isStudioRentExpired(): boolean {
  return Date.now() > getRentExpiry();
}

export function getDaysRemainingOnRent(): number {
  const expiry = getRentExpiry();
  const diff = expiry - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function renewStudioRent(isLevel1Upgrade = false): { success: boolean; message: string; rentExpiry: number } {
  const now = Date.now();
  const baseExpiry = currentSnapshot.rentExpiry && currentSnapshot.rentExpiry > now ? currentSnapshot.rentExpiry : now;
  const newExpiry = baseExpiry + DEFAULT_RENT_DURATION;

  if (isLevel1Upgrade) {
    if (currentSnapshot.streetCoin < 100000) {
      return {
        success: false,
        message: 'Need 100,000 Street Coins for Level 1 Studio (7 Beats + 30 Days Rent)!',
        rentExpiry: currentSnapshot.rentExpiry || now,
      };
    }
    const newCoins = currentSnapshot.streetCoin - 100000;
    currentSnapshot = {
      ...currentSnapshot,
      streetCoin: newCoins,
      studioLevel: 1,
      rentExpiry: newExpiry,
    };
  } else {
    // Level 0 renewal or normal 30 days renewal
    currentSnapshot = {
      ...currentSnapshot,
      rentExpiry: newExpiry,
    };
  }

  persistState(currentSnapshot);
  notifyListeners();
  return {
    success: true,
    message: isLevel1Upgrade ? 'Level 1 Studio Unlocked! 7 Beats available for 30 days!' : 'Studio Rent Extended for 30 Days!',
    rentExpiry: newExpiry,
  };
}

// ---------------------------------------------------------------------------
// ALL GAMES 10 COINS ONLY + 30 SECONDS COOLDOWN
// ---------------------------------------------------------------------------
let lastGameRewardTimestamp = 0;

export function awardGameCompletionReward(gameName: string): {
  success: boolean;
  coinsAwarded: number;
  cooldownRemaining: number;
  message: string;
} {
  const now = Date.now();
  const elapsed = (now - lastGameRewardTimestamp) / 1000;
  if (lastGameRewardTimestamp > 0 && elapsed < 30) {
    const remaining = Math.ceil(30 - elapsed);
    return {
      success: false,
      coinsAwarded: 0,
      cooldownRemaining: remaining,
      message: `Cooldown active: Wait ${remaining}s before next game reward.`,
    };
  }

  lastGameRewardTimestamp = now;
  addGameCoins(10, `+10 for ${gameName} completion`, 'task_reward');
  return {
    success: true,
    coinsAwarded: 10,
    cooldownRemaining: 0,
    message: `+10 Coins earned for ${gameName}!`,
  };
}

// ---------------------------------------------------------------------------
// WATCH AD UNDER STUDIO (10 COINS ONLY, 33 ADS TOTAL, 5/DAY PER AD)
// ---------------------------------------------------------------------------
export function watchStudioAd(adIndex: number): {
  success: boolean;
  message: string;
  coinsAwarded: number;
  nextAdIndex: number;
} {
  if (adIndex < 1 || adIndex > 33) adIndex = 1;
  const todayStr = new Date().toISOString().split('T')[0];
  const dayMap = currentSnapshot.studioAdDayMap || {};
  const currentAdData = dayMap[adIndex] || { count: 0, date: todayStr };

  const dailyCount = currentAdData.date === todayStr ? currentAdData.count : 0;
  if (dailyCount >= 5) {
    const nextAd = (adIndex % 33) + 1;
    return {
      success: false,
      message: `Daily limit reached for Ad ${adIndex} (5/5 today). Switched to Ad ${nextAd}!`,
      coinsAwarded: 0,
      nextAdIndex: nextAd,
    };
  }

  const updatedMap = {
    ...dayMap,
    [adIndex]: { count: dailyCount + 1, date: todayStr },
  };

  const nextAd = (adIndex % 33) + 1;
  const newAdsTotal = (currentSnapshot.studioAdsWatched || 0) + 1;

  addGameCoins(10, `+10 for watching Studio Ad ${adIndex}/33`, 'ad_reward');

  currentSnapshot = {
    ...currentSnapshot,
    studioAdsWatched: newAdsTotal,
    studioAdDayMap: updatedMap,
  };
  persistState(currentSnapshot);
  notifyListeners();

  return {
    success: true,
    message: `Ad ${adIndex}/33 watched! +10 Coins credited!`,
    coinsAwarded: 10,
    nextAdIndex: nextAd,
  };
}

// ---------------------------------------------------------------------------
// SONG POSTING & ANTI-SPAM (2 MIN COOLDOWN)
// ---------------------------------------------------------------------------
export const POST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export function canPostSong(): { allowed: boolean; remainingSeconds: number } {
  const lastPost = currentSnapshot.lastPostTimestamp || 0;
  const now = Date.now();
  const diff = now - lastPost;
  if (diff < POST_COOLDOWN_MS) {
    const rem = Math.ceil((POST_COOLDOWN_MS - diff) / 1000);
    return { allowed: false, remainingSeconds: rem };
  }
  return { allowed: true, remainingSeconds: 0 };
}

export function savePostedSong(song: Omit<PostedSong, 'id' | 'timestamp'>): { success: boolean; message: string } {
  const check = canPostSong();
  if (!check.allowed) {
    return { success: false, message: `Anti-spam: Wait ${check.remainingSeconds}s before posting again.` };
  }

  const now = Date.now();
  const newSong: PostedSong = {
    ...song,
    id: `song_${now}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
  };

  const existingSongs = currentSnapshot.postedSongs || getStoredPostedSongs();
  const updatedSongs = [newSong, ...existingSongs];

  currentSnapshot = {
    ...currentSnapshot,
    postedSongs: updatedSongs,
    lastPostTimestamp: now,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem('streetLife_postedSongs', JSON.stringify(updatedSongs));
  }
  persistState(currentSnapshot);
  notifyListeners();

  return { success: true, message: 'Song posted! Opening Telegram group...' };
}

export function getStoredPostedSongs(): PostedSong[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('streetLife_postedSongs');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// ADMIN PANEL FUNCTIONS (Augustine Jackson)
// ---------------------------------------------------------------------------

export function setUserEmail(email: string): void {
  currentSnapshot = {
    ...currentSnapshot,
    userEmail: email.trim().toLowerCase(),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem('userEmail', email.trim().toLowerCase());
  }
  persistState(currentSnapshot);
  notifyListeners();
}

export function logAdminAction(adminEmail: string, action: string, details: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem('streetLife_adminLogs');
    const existing: AdminLog[] = existingRaw ? JSON.parse(existingRaw) : [];
    const newLog: AdminLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminEmail,
      action,
      details,
      timestamp: Date.now(),
    };
    localStorage.setItem('streetLife_adminLogs', JSON.stringify([newLog, ...existing].slice(0, 50)));
  } catch (err) {
    console.warn('Admin log error:', err);
  }
}

export function getAdminLogs(): AdminLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('streetLife_adminLogs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function adminAddCoins(amount: number, targetUserId?: string): void {
  addGameCoins(amount, `Admin adjustment (+${amount} SC)`, 'task_reward');
  logAdminAction(ADMIN_EMAIL, 'ADD_COINS', `Added ${amount} SC to user ${targetUserId || 'current'}`);
}

export function adminExtendRent(days = 30): void {
  const currentExpiry = currentSnapshot.rentExpiry && currentSnapshot.rentExpiry > Date.now()
    ? currentSnapshot.rentExpiry
    : Date.now();
  const newExpiry = currentExpiry + (days * 24 * 60 * 60 * 1000);
  currentSnapshot = {
    ...currentSnapshot,
    rentExpiry: newExpiry,
  };
  persistState(currentSnapshot);
  notifyListeners();
  logAdminAction(ADMIN_EMAIL, 'EXTEND_RENT', `Extended rent by ${days} days (Expires ${new Date(newExpiry).toLocaleDateString()})`);
}

export function adminDeleteSong(songId: string): void {
  const existing = currentSnapshot.postedSongs || getStoredPostedSongs();
  const updated = existing.filter((s) => s.id !== songId);
  currentSnapshot = {
    ...currentSnapshot,
    postedSongs: updated,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem('streetLife_postedSongs', JSON.stringify(updated));
  }
  persistState(currentSnapshot);
  notifyListeners();
  logAdminAction(ADMIN_EMAIL, 'DELETE_SONG', `Deleted song id: ${songId}`);
}

export function adminToggleBan(targetUserId?: string): boolean {
  const newBanState = !currentSnapshot.isBanned;
  currentSnapshot = {
    ...currentSnapshot,
    isBanned: newBanState,
  };
  persistState(currentSnapshot);
  notifyListeners();
  logAdminAction(ADMIN_EMAIL, newBanState ? 'BAN_USER' : 'UNBAN_USER', `${newBanState ? 'Banned' : 'Unbanned'} user ${targetUserId || currentSnapshot.deviceId}`);
  return newBanState;
}

export function adminResetAll(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SAVE_KEY_V2);
    localStorage.removeItem('streetCoin');
    localStorage.removeItem('rentExpiry');
    localStorage.removeItem('streetLife_checksum');
    localStorage.removeItem('streetLife_postedSongs');
  }
  currentSnapshot = {
    ...SERVER_GAME_STATE_SNAPSHOT,
    rentExpiry: Date.now() + DEFAULT_RENT_DURATION,
  };
  persistState(currentSnapshot);
  notifyListeners();
  logAdminAction(ADMIN_EMAIL, 'RESET_ALL', 'Full system and client storage reset performed');
}

// ---------------------------------------------------------------------------
// WITHDRAWAL REQUEST RECORDING (DATE LOCK NOV 30, 2026)
// ---------------------------------------------------------------------------
export interface WithdrawalClickRecord {
  userId: string;
  username: string;
  coins: number;
  clickTime: string;
  status: string;
}

export function recordWithdrawalClick(data: {
  userId: string;
  username: string;
  coins: number;
  status?: string;
}): WithdrawalClickRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('withdrawalRequests');
    const existing: WithdrawalClickRecord[] = raw ? JSON.parse(raw) : [];
    const newRecord: WithdrawalClickRecord = {
      userId: data.userId || 'anonymous',
      username: data.username || 'Hustler',
      coins: data.coins || 0,
      clickTime: new Date().toString(),
      status: data.status || 'Clicked - Waiting for Nov 30',
    };
    const updated = [newRecord, ...existing];
    localStorage.setItem('withdrawalRequests', JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Error recording withdrawal click:', err);
    return [];
  }
}

export function getWithdrawalClickRecords(): WithdrawalClickRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('withdrawalRequests');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}



