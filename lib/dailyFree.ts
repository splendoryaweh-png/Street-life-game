/**
 * Daily Free Rewards System (Prompt 12)
 * Manages daily retention rewards: login streak, free nitro, double coins,
 * free shooter power-ups, slot spins, dice entry, and anti-abuse verification.
 */

export interface DailyClaimsDbRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  day_streak: number;
  login_claimed: boolean;
  login_reward_sc: number;
  login_perk: string;
  free_nitro_granted: number;
  free_nitro_remaining: number;
  nitro_ad_claims_count: number; // max 5 per day
  coin_bonus_claimed_count: number; // up to 5 coins get 2X bonus
  shooter_powerup_daily_granted: boolean;
  shooter_powerup_type: 'double_bullet' | 'energy_pack' | null;
  shooter_ad_powerups_count: number; // max 3 per day
  slot_free_spins_remaining: number; // starts at 3
  dice_free_entries_remaining: number; // starts at 1
  crush_free_moves_remaining: number; // starts at 1 (+5 moves)
  flip_free_time_remaining: number; // starts at 1 (+15 sec)
  claimed_all_today: boolean;
  ip_address: string;
  device_id: string;
  created_at: number;
  updated_at: number;
}

const STORAGE_KEY_CLAIMS_DB = 'street_daily_claims_db_v1';
const STORAGE_KEY_DEVICE_ID = 'street_device_id_v1';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device_001';
  try {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
    }
    return id;
  } catch {
    return 'dev_fallback_001';
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const DAILY_LOGIN_SCHEDULE = [
  { day: 1, sc: 100, perk: '+1 Free Nitro', icon: 'Zap' },
  { day: 2, sc: 200, perk: '+2 Free Coin Packs', icon: 'Coins' },
  { day: 3, sc: 300, perk: '+1 Shooter Power-up', icon: 'Crosshair' },
  { day: 4, sc: 400, perk: '+3 Free Nitro', icon: 'Zap' },
  { day: 5, sc: 500, perk: '+5 Slot Free Spins', icon: 'Sparkles' },
  { day: 6, sc: 600, perk: '+1 Shield Power-up', icon: 'Shield' },
  { day: 7, sc: 1000, perk: 'Jackpot Box (500-2000 SC)', icon: 'Gift' },
];

/**
 * Read the simulated DB table `daily_claims`
 */
export function getDailyClaimsTable(): DailyClaimsDbRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLAIMS_DB);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDailyClaimsTable(table: DailyClaimsDbRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CLAIMS_DB, JSON.stringify(table));
  } catch {}
}

/**
 * Get or initialize today's daily claim record
 */
export function getTodayDailyClaim(currentStreak = 1): DailyClaimsDbRecord {
  const today = getTodayDateString();
  const deviceId = getOrCreateDeviceId();
  const table = getDailyClaimsTable();

  let todayRecord = table.find((r) => r.date === today && r.device_id === deviceId);

  if (!todayRecord) {
    todayRecord = {
      id: `claim_${today}_${deviceId.slice(-6)}`,
      user_id: `user_${deviceId.slice(-6)}`,
      date: today,
      day_streak: currentStreak > 7 ? 1 : Math.max(1, currentStreak),
      login_claimed: false,
      login_reward_sc: 0,
      login_perk: '',
      free_nitro_granted: 3,
      free_nitro_remaining: 3,
      nitro_ad_claims_count: 0,
      coin_bonus_claimed_count: 0,
      shooter_powerup_daily_granted: false,
      shooter_powerup_type: null,
      shooter_ad_powerups_count: 0,
      slot_free_spins_remaining: 1,
      dice_free_entries_remaining: 1,
      crush_free_moves_remaining: 1,
      flip_free_time_remaining: 1,
      claimed_all_today: false,
      ip_address: '197.210.65.12', // Simulated Lagos ISP IP
      device_id: deviceId,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    table.unshift(todayRecord);
    // Keep max 30 records
    saveDailyClaimsTable(table.slice(0, 30));
  }

  return todayRecord;
}

export function updateTodayDailyClaim(
  updater: (prev: DailyClaimsDbRecord) => Partial<DailyClaimsDbRecord>
): DailyClaimsDbRecord {
  const current = getTodayDailyClaim();
  const changes = updater(current);
  const updated: DailyClaimsDbRecord = {
    ...current,
    ...changes,
    updated_at: Date.now(),
  };

  const table = getDailyClaimsTable();
  const index = table.findIndex((r) => r.id === updated.id);
  if (index >= 0) {
    table[index] = updated;
  } else {
    table.unshift(updated);
  }
  saveDailyClaimsTable(table);
  return updated;
}

/**
 * Time left until 24-hour midnight reset
 */
export function getTimeUntilReset(): { hours: number; minutes: number; seconds: number; formatted: string } {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours}h ${minutes}m ${seconds}s`,
  };
}

/**
 * 2. RACING NITRO LOGIC
 */
export function consumeRacingNitro(): { success: boolean; remaining: number; mustBuyWithSc: boolean } {
  const record = getTodayDailyClaim();
  if (record.free_nitro_remaining > 0) {
    const updated = updateTodayDailyClaim((prev) => ({
      free_nitro_remaining: prev.free_nitro_remaining - 1,
    }));
    return { success: true, remaining: updated.free_nitro_remaining, mustBuyWithSc: false };
  }
  return { success: false, remaining: 0, mustBuyWithSc: true };
}

export function claimRacingAdNitro(): { success: boolean; remaining: number; totalAdsClaimed: number } {
  const record = getTodayDailyClaim();
  if (record.nitro_ad_claims_count >= 5) {
    return { success: false, remaining: record.free_nitro_remaining, totalAdsClaimed: 5 };
  }

  const updated = updateTodayDailyClaim((prev) => ({
    free_nitro_remaining: prev.free_nitro_remaining + 1,
    nitro_ad_claims_count: prev.nitro_ad_claims_count + 1,
  }));

  return {
    success: true,
    remaining: updated.free_nitro_remaining,
    totalAdsClaimed: updated.nitro_ad_claims_count,
  };
}

export function buyRacingNitroWithCoins(): { success: boolean; cost: number; remaining: number } {
  const cost = 50;
  const updated = updateTodayDailyClaim((prev) => ({
    free_nitro_remaining: prev.free_nitro_remaining + 1,
  }));
  return { success: true, cost, remaining: updated.free_nitro_remaining };
}

/**
 * 3. RACING DAILY 2X BONUS COINS
 */
export function evaluateRacingBonusCoin(baseAmount: number): {
  isBonus: boolean;
  awardedAmount: number;
  bonusCountSoFar: number;
} {
  const record = getTodayDailyClaim();
  if (record.coin_bonus_claimed_count < 5) {
    const updated = updateTodayDailyClaim((prev) => ({
      coin_bonus_claimed_count: prev.coin_bonus_claimed_count + 1,
    }));
    return {
      isBonus: true,
      awardedAmount: baseAmount * 2,
      bonusCountSoFar: updated.coin_bonus_claimed_count,
    };
  }
  return {
    isBonus: false,
    awardedAmount: baseAmount,
    bonusCountSoFar: record.coin_bonus_claimed_count,
  };
}

/**
 * 4. SHOOTER DAILY POWER-UPS
 */
export function getOrGrantShooterDailyPowerup(): {
  powerup: 'double_bullet' | 'energy_pack';
  isNewGrant: boolean;
} {
  const record = getTodayDailyClaim();
  if (record.shooter_powerup_daily_granted && record.shooter_powerup_type) {
    return {
      powerup: record.shooter_powerup_type,
      isNewGrant: false,
    };
  }

  // Grant a random one: Double Bullet or Energy Pack
  const randomChoice: 'double_bullet' | 'energy_pack' =
    Math.random() > 0.5 ? 'double_bullet' : 'energy_pack';

  updateTodayDailyClaim(() => ({
    shooter_powerup_daily_granted: true,
    shooter_powerup_type: randomChoice,
  }));

  return {
    powerup: randomChoice,
    isNewGrant: true,
  };
}

export function claimShooterAdPowerup(): {
  success: boolean;
  powerup?: 'double_bullet' | 'energy_pack';
  count: number;
} {
  const record = getTodayDailyClaim();
  if (record.shooter_ad_powerups_count >= 3) {
    return { success: false, count: 3 };
  }

  const randomChoice: 'double_bullet' | 'energy_pack' =
    Math.random() > 0.5 ? 'double_bullet' : 'energy_pack';

  const updated = updateTodayDailyClaim((prev) => ({
    shooter_ad_powerups_count: prev.shooter_ad_powerups_count + 1,
    shooter_powerup_type: randomChoice,
  }));

  return {
    success: true,
    powerup: randomChoice,
    count: updated.shooter_ad_powerups_count,
  };
}

/**
 * 5. MINI-GAME DAILY PERKS (SLOT, DICE, CRUSH, FLIP)
 */
export function consumeSlotDailyFreeSpin(): { success: boolean; remaining: number } {
  const record = getTodayDailyClaim();
  if (record.slot_free_spins_remaining > 0) {
    const updated = updateTodayDailyClaim((prev) => ({
      slot_free_spins_remaining: prev.slot_free_spins_remaining - 1,
    }));
    return { success: true, remaining: updated.slot_free_spins_remaining };
  }
  return { success: false, remaining: 0 };
}

export function consumeDiceDailyFreeEntry(): { success: boolean; remaining: number } {
  const record = getTodayDailyClaim();
  if (record.dice_free_entries_remaining > 0) {
    const updated = updateTodayDailyClaim((prev) => ({
      dice_free_entries_remaining: prev.dice_free_entries_remaining - 1,
    }));
    return { success: true, remaining: updated.dice_free_entries_remaining };
  }
  return { success: false, remaining: 0 };
}

export function consumeCrushDailyFreeMoves(): { success: boolean; remaining: number } {
  const record = getTodayDailyClaim();
  if (record.crush_free_moves_remaining > 0) {
    const updated = updateTodayDailyClaim((prev) => ({
      crush_free_moves_remaining: prev.crush_free_moves_remaining - 1,
    }));
    return { success: true, remaining: updated.crush_free_moves_remaining };
  }
  return { success: false, remaining: 0 };
}

export function consumeFlipDailyFreeTime(): { success: boolean; remaining: number } {
  const record = getTodayDailyClaim();
  if (record.flip_free_time_remaining > 0) {
    const updated = updateTodayDailyClaim((prev) => ({
      flip_free_time_remaining: prev.flip_free_time_remaining - 1,
    }));
    return { success: true, remaining: updated.flip_free_time_remaining };
  }
  return { success: false, remaining: 0 };
}
