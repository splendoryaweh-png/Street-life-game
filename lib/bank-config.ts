import { BankTarget, RobberyTool, RobberyToolId } from '@/types/game';

export const ROBBERY_TOOLS: Record<RobberyToolId, RobberyTool> = {
  crowbar: {
    id: 'crowbar',
    name: 'Heavy Crowbar',
    price: 50,
    description: 'Pries open security grates & cash registers.',
    iconName: 'Wrench',
  },
  mask: {
    id: 'mask',
    name: 'Tactical Balaclava',
    price: 100,
    description: 'Conceals identity from high-res CCTV cameras.',
    iconName: 'Shield',
  },
  gun: {
    id: 'gun',
    name: 'Suppressed Handgun',
    price: 250,
    description: 'Subdues armed security and guards quietly.',
    iconName: 'Crosshair',
  },
  driver: {
    id: 'driver',
    name: 'Getaway Driver',
    price: 250,
    description: 'Expert wheelman with modified tuned V8 getaway.',
    iconName: 'Car',
  },
  full_crew: {
    id: 'full_crew',
    name: 'Syndicate Full Crew',
    price: 2000,
    description: 'Master safecracker, cyber hacker & elite muscle.',
    iconName: 'Users',
  },
};

export const BANK_TARGETS: BankTarget[] = [
  {
    id: 1,
    level: 1,
    name: 'Local Kiosk',
    reward: 200,
    durationSeconds: 30,
    durationLabel: '30 sec',
    heatIncrease: 10,
    requiredToolIds: [],
    description: 'Corner street kiosk with quick till cash. Light risk, fast score.',
    bgGradient: 'from-emerald-950/40 via-[#151515] to-[#121212]',
    iconName: 'Store',
  },
  {
    id: 2,
    level: 2,
    name: 'Mini Mart',
    reward: 500,
    durationSeconds: 60,
    durationLabel: '1 min',
    heatIncrease: 20,
    requiredToolIds: ['crowbar'],
    description: 'Late-night bodega with reinforced safe box. Needs crowbar leverage.',
    bgGradient: 'from-amber-950/40 via-[#151515] to-[#121212]',
    iconName: 'ShoppingBag',
  },
  {
    id: 3,
    level: 3,
    name: 'Gas Station',
    reward: 1200,
    durationSeconds: 120,
    durationLabel: '2 min',
    heatIncrease: 35,
    requiredToolIds: ['mask'],
    description: 'Highway fuel station depot with high security cameras. Mask required.',
    bgGradient: 'from-orange-950/40 via-[#151515] to-[#121212]',
    iconName: 'Fuel',
  },
  {
    id: 4,
    level: 4,
    name: 'City Bank',
    reward: 3000,
    durationSeconds: 300,
    durationLabel: '5 min',
    heatIncrease: 60,
    requiredToolIds: ['gun', 'driver'],
    description: 'Metro commercial branch with armed guards. Gun & Driver essential.',
    bgGradient: 'from-red-950/40 via-[#151515] to-[#121212]',
    iconName: 'Landmark',
  },
  {
    id: 5,
    level: 5,
    name: 'Federal Vault',
    reward: 10000,
    durationSeconds: 600,
    durationLabel: '10 min',
    heatIncrease: 100,
    requiredToolIds: ['full_crew'],
    description: 'Maximum security state reserve depository. Requires Full Crew.',
    bgGradient: 'from-[#FFD700]/15 via-[#1a1a1a] to-[#121212]',
    iconName: 'Vault',
  },
];

/**
 * Calculates current robbery success percentage based on:
 * - 30% base success
 * - +10% for each tool owned
 * - -20% penalty if Police Heat > 80%
 */
export function calculateRobberySuccessChance(
  ownedTools: RobberyToolId[],
  heatLevel: number
): {
  totalChance: number;
  baseChance: number;
  toolBonus: number;
  heatPenalty: number;
} {
  const baseChance = 30;
  const toolBonus = ownedTools.length * 10;
  const heatPenalty = heatLevel > 80 ? 20 : 0;
  const rawChance = baseChance + toolBonus - heatPenalty;
  const totalChance = Math.max(10, Math.min(95, rawChance));

  return {
    totalChance,
    baseChance,
    toolBonus,
    heatPenalty,
  };
}
