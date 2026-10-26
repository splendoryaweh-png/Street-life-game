import { addGameCoins } from './storage';

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: 'CLOTHES' | 'HOUSES' | 'VEHICLES' | 'PHONES' | 'HOUSE_DESIGN' | 'STUDIO_LEVELS' | 'STUDIO_FILTERS' | 'FOOD_DRINKS';
  type?: 'rent' | 'buy' | 'free';
  rentPrice?: number;
  buyPrice?: number;
  soundQuality?: number;
  payoutPerSong?: number;
  energyBonus?: number;
  desc?: string;
  icon?: string;
  actionLabel?: string;
}

// 8 CATEGORIES CATALOG DEFINITIONS EXACTLY PER USER SPECIFICATION
export const CLOTHES_CATALOG: CatalogItem[] = [
  { id: 'basic_tshirt', name: 'Basic T-shirt', price: 1500, category: 'CLOTHES', icon: '👕', actionLabel: 'Wear', desc: 'Everyday clean cotton streetwear tee' },
  { id: 'designer_shirt', name: 'Designer Shirt', price: 8000, category: 'CLOTHES', icon: '👔', actionLabel: 'Wear', desc: 'Tailored luxury graphic button-up' },
  { id: 'hoodie_set', name: 'Hoodie Set', price: 15000, category: 'CLOTHES', icon: '🧥', actionLabel: 'Wear', desc: 'Heavyweight fleece hoodie + sweatpants set' },
  { id: 'luxury_jacket', name: 'Luxury Jacket', price: 35000, category: 'CLOTHES', icon: '🥼', actionLabel: 'Wear', desc: 'Italian leather bomber jacket' },
  { id: 'formal_suit', name: 'Formal Suit', price: 60000, category: 'CLOTHES', icon: '🤵', actionLabel: 'Wear', desc: 'Bespoke executive double-breasted suit' },
  { id: 'chain_watch_set', name: 'Premium Chain + Watch Set', price: 90000, category: 'CLOTHES', icon: '⌚', actionLabel: 'Wear', desc: 'Solid Cuban link chain & chronograph watch' },
  { id: 'diamond_set', name: 'Diamond Set', price: 150000, category: 'CLOTHES', icon: '💎', actionLabel: 'Wear', desc: 'Iced-out VVS diamond chain, bracelet & ring' },
];

export const HOUSES_CATALOG: CatalogItem[] = [
  // RENT (Monthly, Temporary - 30 days)
  { id: 'shared_room_rent', name: 'Shared Room Rent', price: 5000, type: 'rent', category: 'HOUSES', icon: '🚪', desc: '5,000 SC / month. Temporary room in city center.' },
  { id: 'studio_rent', name: 'Studio Rent', price: 20000, type: 'rent', category: 'HOUSES', icon: '🏢', desc: '20,000 SC / month. Private modern downtown studio.' },
  { id: '1bed_rent', name: '1-Bedroom Rent', price: 50000, type: 'rent', category: 'HOUSES', icon: '🏠', desc: '50,000 SC / month. Spacious 1-bed apartment with balcony.' },
  { id: 'luxury_rent', name: 'Luxury Rent', price: 120000, type: 'rent', category: 'HOUSES', icon: '🏙️', desc: '120,000 SC / month. High-floor luxury apartment with skyline view.' },
  // BUY (Permanent)
  { id: 'studio_buy', name: 'Studio Buy', price: 250000, type: 'buy', category: 'HOUSES', icon: '🔑', desc: 'Permanent ownership of modern city studio.' },
  { id: '1bed_buy', name: '1-Bedroom Buy', price: 600000, type: 'buy', category: 'HOUSES', icon: '🏡', desc: 'Permanent 1-bedroom apartment ownership.' },
  { id: '2bed_buy', name: '2-Bedroom Buy', price: 1200000, type: 'buy', category: 'HOUSES', icon: '🏘️', desc: 'Spacious 2-bedroom condominium in prime neighborhood.' },
  { id: 'penthouse_buy', name: 'Penthouse Buy', price: 3500000, type: 'buy', category: 'HOUSES', icon: '🌆', desc: 'Panoramic glass penthouse with private elevator & terrace.' },
  { id: 'mansion_buy', name: 'Mansion Buy', price: 10000000, type: 'buy', category: 'HOUSES', icon: '🏰', desc: 'Gated estate with infinity pool, security & 8-car garage.' },
];

export const VEHICLES_CATALOG: CatalogItem[] = [
  { id: 'walking', name: 'Walking', price: 0, category: 'VEHICLES', icon: '👟', actionLabel: 'Drive', desc: 'Legs & sneakers on city pavement.' },
  { id: 'bicycle', name: 'Bicycle', price: 10000, category: 'VEHICLES', icon: '🚲', actionLabel: 'Drive', desc: 'High-speed urban commuter bike.' },
  { id: 'scooter', name: 'Scooter', price: 35000, category: 'VEHICLES', icon: '🛵', actionLabel: 'Drive', desc: '125cc electric street scooter.' },
  { id: 'motorcycle', name: 'Motorcycle', price: 80000, category: 'VEHICLES', icon: '🏍️', actionLabel: 'Drive', desc: 'Sport street bike with aggressive exhaust.' },
  { id: 'hatchback', name: 'Hatchback', price: 200000, category: 'VEHICLES', icon: '🚗', actionLabel: 'Drive', desc: 'Turbo hot-hatch for city commuting.' },
  { id: 'sedan', name: 'Sedan', price: 500000, category: 'VEHICLES', icon: '🚘', actionLabel: 'Drive', desc: 'Executive comfort sedan.' },
  { id: 'suv', name: 'SUV', price: 900000, category: 'VEHICLES', icon: '🚙', actionLabel: 'Drive', desc: 'V8 luxury all-wheel drive SUV.' },
  { id: 'sports_coupe', name: 'Sports Coupe', price: 2000000, category: 'VEHICLES', icon: '🏎️', actionLabel: 'Drive', desc: 'Twin-turbo aerodynamic rear-wheel sports car.' },
  { id: 'luxury_sedan', name: 'Luxury Sedan', price: 4500000, category: 'VEHICLES', icon: '👑', actionLabel: 'Drive', desc: 'Armored presidential flagship limousine.' },
  { id: 'supercar', name: 'Supercar', price: 10000000, category: 'VEHICLES', icon: '🔥', actionLabel: 'Drive', desc: 'V12 hypercar hitting 0-100 in 2.4 seconds.' },
  { id: 'private_helicopter', name: 'Private Helicopter', price: 25000000, category: 'VEHICLES', icon: '🚁', actionLabel: 'Drive', desc: 'Twin-engine rooftop executive transport.' },
];

export const PHONES_CATALOG: CatalogItem[] = [
  { id: 'basic_phone', name: 'Basic Phone', price: 0, category: 'PHONES', icon: '📞', actionLabel: 'Hold', desc: 'Standard keypad phone with calls & SMS.' },
  { id: 'mid_smartphone', name: 'Mid-Range Smartphone', price: 8000, category: 'PHONES', icon: '📱', actionLabel: 'Hold', desc: 'Fast 5G touchscreen smartphone.' },
  { id: 'flagship_phone', name: 'Flagship Phone', price: 30000, category: 'PHONES', icon: '📲', actionLabel: 'Hold', desc: 'Titanium frame with triple 4K cameras.' },
  { id: 'foldable_pro', name: 'Foldable Pro', price: 75000, category: 'PHONES', icon: '📳', actionLabel: 'Hold', desc: 'Dual OLED folding screen production powerhouse.' },
  { id: 'luxury_gold_phone', name: 'Luxury Gold Phone', price: 200000, category: 'PHONES', icon: '🪙', actionLabel: 'Hold', desc: '24K gold bespoke smartphone with sapphire crystal display.' },
];

export const HOUSE_DESIGN_CATALOG: CatalogItem[] = [
  { id: 'led_strip_lights', name: 'LED Strip Lights', price: 5000, category: 'HOUSE_DESIGN', icon: '💡', actionLabel: 'Install', desc: 'Smart RGB ambient glow strips.' },
  { id: 'plants_set', name: 'Plants Set', price: 6000, category: 'HOUSE_DESIGN', icon: '🌿', actionLabel: 'Install', desc: 'Monstera & indoor botanical plant collection.' },
  { id: 'rug', name: 'Rug', price: 7000, category: 'HOUSE_DESIGN', icon: '🧶', actionLabel: 'Install', desc: 'Plush modern geometric woven area rug.' },
  { id: 'sofa_set', name: 'Sofa Set', price: 15000, category: 'HOUSE_DESIGN', icon: '🛋️', actionLabel: 'Install', desc: 'Ergonomic sectional charcoal sofa.' },
  { id: 'big_tv', name: 'Big TV', price: 20000, category: 'HOUSE_DESIGN', icon: '📺', actionLabel: 'Install', desc: '75-inch 4K OLED HDR Smart TV.' },
  { id: 'gaming_setup', name: 'Gaming Setup', price: 35000, category: 'HOUSE_DESIGN', icon: '🎮', actionLabel: 'Install', desc: 'Triple monitor battle-station with mechanical deck.' },
  { id: 'luxury_interior_pack', name: 'Luxury Interior Pack', price: 80000, category: 'HOUSE_DESIGN', icon: '✨', actionLabel: 'Install', desc: 'Marble finishes, brass chandeliers & designer art.' },
];

export const STUDIO_LEVELS_CATALOG: CatalogItem[] = [
  { id: 'bedroom_studio', name: 'Bedroom Studio (Starter)', price: 0, category: 'STUDIO_LEVELS', soundQuality: 40, payoutPerSong: 100, icon: '🎙️', desc: 'Free Starter [Owned] - Sound 40% - Earn 100 SC/song' },
  { id: 'street_studio', name: 'Street Studio', price: 25000, category: 'STUDIO_LEVELS', soundQuality: 60, payoutPerSong: 500, icon: '🎧', desc: '25,000 SC - Sound 60% - Earn 500 SC/song -> Unlocks Studio Tab' },
  { id: 'pro_studio', name: 'Pro Studio', price: 100000, category: 'STUDIO_LEVELS', soundQuality: 85, payoutPerSong: 2000, icon: '🎛️', desc: '100,000 SC - Sound 85% - Earn 2,000 SC/song + 500 fans' },
  { id: 'hitmaker_studio', name: 'Hitmaker Studio (Level 3)', price: 200000, category: 'STUDIO_LEVELS', soundQuality: 90, payoutPerSong: 5000, icon: '👑', desc: 'Level 3 [200,000 SC] - Sound 90% - Earn 5,000 SC/song + 1,200 fans' },
  { id: 'celebrity_studio', name: 'Celebrity Studio', price: 500000, category: 'STUDIO_LEVELS', soundQuality: 100, payoutPerSong: 10000, icon: '⭐', desc: '500,000 SC - Sound 100% - Earn 10,000 SC/hit + 2,500 fans' },
];

export function getPlayerStudioLevel(playerState: HustlePlayerState): number {
  const owned = playerState.owned?.studioLevels || [];
  if (owned.includes('celebrity_studio')) return 4;
  if (owned.includes('hitmaker_studio')) return 3;
  if (owned.includes('pro_studio')) return 2;
  if (owned.includes('street_studio')) return 1;
  return 0;
}

export const STUDIO_FILTERS_CATALOG: CatalogItem[] = [
  { id: 'echo_filter', name: 'Echo Filter', price: 3000, category: 'STUDIO_FILTERS', icon: '🔊', actionLabel: 'Equip', desc: 'Spatial stereo echo delay' },
  { id: 'bass_boost', name: 'Bass Boost', price: 4000, category: 'STUDIO_FILTERS', icon: '🔉', actionLabel: 'Equip', desc: '808 sub-bass low-end boost' },
  { id: 'reverb_delay', name: 'Reverb + Delay', price: 8000, category: 'STUDIO_FILTERS', icon: '🎚️', actionLabel: 'Equip', desc: 'Stadium reverb acoustic chamber' },
  { id: 'autotune_pro', name: 'Auto-Tune Pro', price: 10000, category: 'STUDIO_FILTERS', icon: '🎤', actionLabel: 'Equip', desc: 'Pitch-perfect real-time vocal tuner' },
  { id: 'beat_pack', name: 'Beat Pack', price: 12000, category: 'STUDIO_FILTERS', icon: '🥁', actionLabel: 'Equip', desc: 'Exclusive producer beat loops & percussion' },
  { id: 'voice_changer', name: 'Voice Changer', price: 15000, category: 'STUDIO_FILTERS', icon: '🤖', actionLabel: 'Equip', desc: 'Multi-formant robotic & harmonic vocal FX' },
  { id: 'mastering_tool', name: 'Mastering Tool', price: 25000, category: 'STUDIO_FILTERS', icon: '💎', actionLabel: 'Equip', desc: 'Broadcast-ready loudness & clarity limiter' },
];

export const FOOD_CATALOG: CatalogItem[] = [
  { id: 'street_burger', name: 'Street Burger', price: 500, energyBonus: 10, category: 'FOOD_DRINKS', icon: '🍔', actionLabel: 'Eat', desc: 'Energy +10' },
  { id: 'chicken_shawarma', name: 'Chicken Shawarma', price: 800, energyBonus: 15, category: 'FOOD_DRINKS', icon: '🌯', actionLabel: 'Eat', desc: 'Energy +15' },
  { id: 'pizza_slice', name: 'Pizza Slice', price: 1200, energyBonus: 20, category: 'FOOD_DRINKS', icon: '🍕', actionLabel: 'Eat', desc: 'Energy +20' },
  { id: 'fried_rice_chicken', name: 'Fried Rice + Chicken', price: 2000, energyBonus: 30, category: 'FOOD_DRINKS', icon: '🍗', actionLabel: 'Eat', desc: 'Energy +30' },
  { id: 'fast_food_combo', name: 'Fast Food Combo', price: 3500, energyBonus: 45, category: 'FOOD_DRINKS', icon: '🍟', actionLabel: 'Eat', desc: 'Energy +45' },
  { id: 'restaurant_meal', name: 'Restaurant Meal', price: 6000, energyBonus: 60, category: 'FOOD_DRINKS', icon: '🍲', actionLabel: 'Eat', desc: 'Energy +60' },
  { id: 'luxury_steak_dinner', name: 'Luxury Steak Dinner', price: 15000, energyBonus: 80, category: 'FOOD_DRINKS', icon: '🥩', actionLabel: 'Eat', desc: 'Energy +80' },
  { id: 'champagne_caviar', name: 'Champagne + Caviar', price: 35000, energyBonus: 100, category: 'FOOD_DRINKS', icon: '🍾', actionLabel: 'Eat', desc: 'Energy +100' },
  { id: 'energy_drink', name: 'Energy Drink', price: 1000, energyBonus: 25, category: 'FOOD_DRINKS', icon: '⚡', actionLabel: 'Drink', desc: 'Energy +25' },
  { id: 'premium_juice_pack', name: 'Premium Juice Pack', price: 2500, energyBonus: 35, category: 'FOOD_DRINKS', icon: '🧃', actionLabel: 'Drink', desc: 'Energy +35' },
];

export interface HustlePlayerState {
  energy: number;
  lastDecayDate: string;
  equipped: {
    clothes: string;
    house: string;
    houseType: 'rent' | 'buy' | 'homeless';
    rentExpiresTimestamp: number | null;
    vehicle: string;
    phone: string;
    studio: string;
    food: string | null;
    studioFilters: string[];
    installedHouseDesign: string[];
  };
  owned: {
    clothes: string[];
    houses: Record<string, { type: 'rent' | 'buy'; rentExpires?: number }>;
    vehicles: string[];
    phones: string[];
    houseDesign: string[];
    studioLevels: string[];
    studioFilters: string[];
    foodStock: Record<string, number>;
  };
  fansCount: number;
}

const HUSTLE_PLAYER_KEY = 'street_life_hustle_player_v3';

export function getHustlePlayerState(userId = 'anon'): HustlePlayerState {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultState: HustlePlayerState = {
    energy: 100,
    lastDecayDate: todayStr,
    equipped: {
      clothes: 'basic_tshirt',
      house: 'homeless',
      houseType: 'homeless',
      rentExpiresTimestamp: null,
      vehicle: 'walking',
      phone: 'basic_phone',
      studio: 'bedroom_studio',
      food: null,
      studioFilters: [],
      installedHouseDesign: [],
    },
    owned: {
      clothes: ['basic_tshirt'],
      houses: {},
      vehicles: ['walking'],
      phones: ['basic_phone'],
      houseDesign: [],
      studioLevels: ['bedroom_studio'],
      studioFilters: [],
      foodStock: {},
    },
    fansCount: 150,
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(`${HUSTLE_PLAYER_KEY}_${userId}`);
    if (!raw) return defaultState;
    const parsed: HustlePlayerState = JSON.parse(raw);

    // Daily Energy Decay Rule: -20 per day
    if (parsed.lastDecayDate !== todayStr) {
      const daysPassed = 1;
      parsed.energy = Math.max(0, parsed.energy - 20 * daysPassed);
      parsed.lastDecayDate = todayStr;
      localStorage.setItem(`${HUSTLE_PLAYER_KEY}_${userId}`, JSON.stringify(parsed));
    }

    // Check Rent Expiration Rule: 30 days -> homeless & clean up owned record
    const nowTs = Date.now();
    const updatedHouses = { ...(parsed.owned?.houses || {}) };
    let hasHouseChange = false;

    Object.entries(updatedHouses).forEach(([houseId, houseData]) => {
      if (houseData.type === 'rent' && houseData.rentExpires && nowTs >= houseData.rentExpires) {
        delete updatedHouses[houseId];
        hasHouseChange = true;
      }
    });

    let updatedEquipped = { ...(parsed.equipped || {}) };
    if (updatedEquipped.houseType === 'rent' && updatedEquipped.rentExpiresTimestamp && nowTs >= updatedEquipped.rentExpiresTimestamp) {
      updatedEquipped.house = 'homeless';
      updatedEquipped.houseType = 'homeless';
      updatedEquipped.rentExpiresTimestamp = null;
      hasHouseChange = true;
    }

    if (hasHouseChange) {
      parsed.owned = { ...(parsed.owned || {}), houses: updatedHouses };
      parsed.equipped = updatedEquipped;
      localStorage.setItem(`${HUSTLE_PLAYER_KEY}_${userId}`, JSON.stringify(parsed));
    }

    return {
      ...defaultState,
      ...parsed,
      energy: Math.max(0, Math.min(100, typeof parsed.energy === 'number' ? parsed.energy : defaultState.energy)),
      equipped: {
        ...defaultState.equipped,
        ...(parsed.equipped || {}),
        studioFilters: Array.isArray(parsed.equipped?.studioFilters) ? parsed.equipped.studioFilters : [],
        installedHouseDesign: Array.isArray(parsed.equipped?.installedHouseDesign) ? parsed.equipped.installedHouseDesign : [],
      },
      owned: {
        ...defaultState.owned,
        ...(parsed.owned || {}),
        clothes: Array.isArray(parsed.owned?.clothes) ? parsed.owned.clothes : defaultState.owned.clothes,
        houses: typeof parsed.owned?.houses === 'object' && parsed.owned?.houses ? parsed.owned.houses : {},
        vehicles: Array.isArray(parsed.owned?.vehicles) ? parsed.owned.vehicles : defaultState.owned.vehicles,
        phones: Array.isArray(parsed.owned?.phones) ? parsed.owned.phones : defaultState.owned.phones,
        houseDesign: Array.isArray(parsed.owned?.houseDesign) ? parsed.owned.houseDesign : [],
        studioLevels: Array.isArray(parsed.owned?.studioLevels) ? parsed.owned.studioLevels : defaultState.owned.studioLevels,
        studioFilters: Array.isArray(parsed.owned?.studioFilters) ? parsed.owned.studioFilters : [],
        foodStock: typeof parsed.owned?.foodStock === 'object' && parsed.owned?.foodStock ? parsed.owned.foodStock : {},
      },
    };
  } catch {
    return defaultState;
  }
}

export function saveHustlePlayerState(userId = 'anon', update: Partial<HustlePlayerState>): HustlePlayerState {
  const current = getHustlePlayerState(userId);
  const updated: HustlePlayerState = {
    ...current,
    ...update,
    energy: typeof update.energy === 'number' ? Math.max(0, Math.min(100, update.energy)) : current.energy,
    equipped: { ...current.equipped, ...(update.equipped || {}) },
    owned: { ...current.owned, ...(update.owned || {}) },
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${HUSTLE_PLAYER_KEY}_${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save hustle player state:', e);
    }
  }
  return updated;
}

// Format Profile String Rule:
// "👕 Designer Shirt | 🏠 Studio (Bought) | 🚗 Motorcycle | 📱 Flagship | 🎤 Pro Studio (85%) | ⚡ 85/100 | 🍔 Steak"
export function formatEquippedProfileSummary(state: HustlePlayerState): string {
  const clothesItem = CLOTHES_CATALOG.find((c) => c.id === state.equipped.clothes)?.name || 'Basic T-shirt';
  
  let houseStr = 'Homeless';
  if (state.equipped.houseType === 'rent') {
    const houseItem = HOUSES_CATALOG.find((h) => h.id === state.equipped.house);
    houseStr = `${houseItem?.name || 'Apartment'} (Rented)`;
  } else if (state.equipped.houseType === 'buy') {
    const houseItem = HOUSES_CATALOG.find((h) => h.id === state.equipped.house);
    houseStr = `${houseItem?.name || 'Studio'} (Bought)`;
  }

  const vehicleItem = VEHICLES_CATALOG.find((v) => v.id === state.equipped.vehicle)?.name || 'Walking';
  const phoneItem = PHONES_CATALOG.find((p) => p.id === state.equipped.phone)?.name || 'Basic Phone';
  
  const studioDef = STUDIO_LEVELS_CATALOG.find((s) => s.id === state.equipped.studio);
  const studioStr = studioDef ? `${studioDef.name} (${studioDef.soundQuality}%)` : 'Bedroom Studio (40%)';

  const foodItem = FOOD_CATALOG.find((f) => f.id === state.equipped.food)?.name || 'None';

  return `👕 ${clothesItem} | 🏠 ${houseStr} | 🚗 ${vehicleItem} | 📱 ${phoneItem} | 🎤 ${studioStr} | ⚡ ${state.energy}/100 | 🍔 ${foodItem}`;
}

export const HUSTLE_VIEW_IMAGES = {
  outside: '/images/street_outside_guy_scene_1792339428754.jpg',
  inside: '/images/street_inside_house_scene_1792339447906.jpg',
  studio: '/images/street_music_studio_scene_1792339448415.jpg',
  vehicle: '/images/street_vehicle_drive_scene_1792339449071.jpg',
};
