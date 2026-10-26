/**
 * Street Gang Star - City & Map Generator
 * Generates an expansive 4000x4000 px realistic district layout:
 * - Multi-lane arterial roads, avenues, cross-streets
 * - Walkable compound courtyards, alleys, entering zones
 * - Detailed building architectures and collision bounding boxes
 * - Country-specific thematic palettes and street names
 */

export interface CityTheme {
  id: string;
  name: string;
  asphaltColor: string;
  roadMarkingColor: string;
  sidewalkColor: string;
  curbColor: string;
  groundGrassColor: string;
  buildingWallColors: string[];
  buildingRoofColors: string[];
  accentNeonColor: string;
  compoundWallColor: string;
  ambientGlow: string;
}

export interface Building {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  wallColor: string;
  roofColor: string;
  door: { x: number; y: number; width: number; height: number; side: 'top' | 'bottom' | 'left' | 'right' };
  interiorItems: { x: number; y: number; type: 'crate' | 'table' | 'safe' }[];
  canEnter: boolean;
}

export interface Compound {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fenceColor: string;
  gates: { x: number; y: number; width: number; height: number }[];
}

export interface Road {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'horizontal' | 'vertical';
  lanes: number;
}

export interface CityData {
  cityName: string;
  streetName: string;
  countryCode: string;
  theme: CityTheme;
  mapWidth: number;
  mapHeight: number;
  roads: Road[];
  buildings: Building[];
  compounds: Compound[];
  spawnPoints: { x: number; y: number }[];
  gangsterSpawnEdges: { x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right' }[];
}

const NIGERIAN_CITIES = [
  'Lagos - Ikeja Street',
  'Port Harcourt - Diobu',
  'Uyo - Ikot Ekpene Road',
  'Abuja - Wuse Zone',
  'Kano - Sabon Gari',
  'Onitsha Main Market',
];

const US_CITIES = [
  'Los Angeles - Compton Street',
  'New York - Brooklyn Ave',
  'California - Oakland Blvd',
];

const GHANA_CITIES = [
  'Accra - Makola Street',
  'Kumasi - Kejetia',
];

const THEMES: Record<string, CityTheme> = {
  NG: {
    id: 'NG',
    name: 'West African Syndicate',
    asphaltColor: '#1F242B',
    roadMarkingColor: '#FACC15',
    sidewalkColor: '#333A42',
    curbColor: '#F59E0B',
    groundGrassColor: '#18241A',
    buildingWallColors: ['#3A3025', '#2E353B', '#4A3B32', '#2A2E33', '#45382B'],
    buildingRoofColors: ['#231D18', '#1C2226', '#2D221D', '#1B1E22'],
    accentNeonColor: '#F59E0B',
    compoundWallColor: '#524336',
    ambientGlow: 'rgba(245, 158, 11, 0.08)',
  },
  US: {
    id: 'US',
    name: 'Neo Urban Metropolis',
    asphaltColor: '#171A21',
    roadMarkingColor: '#E2E8F0',
    sidewalkColor: '#2D333F',
    curbColor: '#0EA5E9',
    groundGrassColor: '#121D17',
    buildingWallColors: ['#1E293B', '#334155', '#1F2937', '#27272A', '#18181B'],
    buildingRoofColors: ['#0F172A', '#1E293B', '#111827', '#09090B'],
    accentNeonColor: '#38BDF8',
    compoundWallColor: '#475569',
    ambientGlow: 'rgba(56, 189, 248, 0.08)',
  },
  GH: {
    id: 'GH',
    name: 'Coastal Commercial Hub',
    asphaltColor: '#212429',
    roadMarkingColor: '#FACC15',
    sidewalkColor: '#383D45',
    curbColor: '#10B981',
    groundGrassColor: '#1A291F',
    buildingWallColors: ['#362D24', '#2F363F', '#40332B', '#2C3038'],
    buildingRoofColors: ['#241C16', '#1E242B', '#291E18'],
    accentNeonColor: '#10B981',
    compoundWallColor: '#4B3F33',
    ambientGlow: 'rgba(16, 185, 129, 0.08)',
  },
  WORLD: {
    id: 'WORLD',
    name: 'Global Street District',
    asphaltColor: '#181A20',
    roadMarkingColor: '#FBBF24',
    sidewalkColor: '#2B2F38',
    curbColor: '#A855F7',
    groundGrassColor: '#141E18',
    buildingWallColors: ['#282A36', '#1F2430', '#2B2038', '#1E262B'],
    buildingRoofColors: ['#181920', '#14171E', '#1B1424'],
    accentNeonColor: '#A855F7',
    compoundWallColor: '#3B364C',
    ambientGlow: 'rgba(168, 85, 247, 0.08)',
  },
};

/**
 * Deterministic pseudo-random number generator for shared multiplayer seed
 */
function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an expansive 4000x4000 px street city
 */
export function getRandomCityByCountry(countryCode?: string, seedStr?: string): CityData {
  let selectedCountry = (countryCode || '').toUpperCase().trim();
  let cityList: string[];

  if (selectedCountry === 'NG') {
    cityList = NIGERIAN_CITIES;
  } else if (selectedCountry === 'US') {
    cityList = US_CITIES;
  } else if (selectedCountry === 'GH') {
    cityList = GHANA_CITIES;
  } else {
    // Random from all
    const all = [...NIGERIAN_CITIES, ...US_CITIES, ...GHANA_CITIES];
    cityList = all;
    selectedCountry = 'WORLD';
  }

  // Derive numeric seed from seedStr or time
  let seedVal = 1337;
  if (seedStr) {
    for (let i = 0; i < seedStr.length; i++) {
      seedVal = (seedVal * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
    }
  } else {
    seedVal = Date.now() & 0xffffffff;
  }
  const rng = createSeededRandom(Math.abs(seedVal));

  const chosenEntry = cityList[Math.floor(rng() * cityList.length)];
  const parts = chosenEntry.split(' - ');
  const cityName = parts[0] || 'Lagos';
  const streetName = parts[1] || 'Ikeja Street';

  const themeKey = THEMES[selectedCountry] ? selectedCountry : 'WORLD';
  const theme = THEMES[themeKey];

  const mapWidth = 4000;
  const mapHeight = 4000;

  // 1. Generate Arterial Road Grid (Horizontal & Vertical Highways + Cross streets)
  const roads: Road[] = [];
  const roadWidthMajor = 220; // 4-lane avenue
  const roadWidthMinor = 140; // 2-lane street

  // Major horizontal avenues
  const horizPositions = [600, 1400, 2200, 3000];
  horizPositions.forEach((yPos, idx) => {
    roads.push({
      id: `road_h_${idx}`,
      name: `${streetName} Expressway ${idx + 1}`,
      x: 0,
      y: yPos - roadWidthMajor / 2,
      width: mapWidth,
      height: roadWidthMajor,
      direction: 'horizontal',
      lanes: 4,
    });
  });

  // Major vertical avenues
  const vertPositions = [700, 1500, 2300, 3100];
  vertPositions.forEach((xPos, idx) => {
    roads.push({
      id: `road_v_${idx}`,
      name: `${cityName} Boulevard ${idx + 1}`,
      x: xPos - roadWidthMajor / 2,
      y: 0,
      width: roadWidthMajor,
      height: mapHeight,
      direction: 'vertical',
      lanes: 4,
    });
  });

  // 2. Generate Buildings in City Blocks (Between Road Intersections)
  const buildings: Building[] = [];
  const compounds: Compound[] = [];
  let buildingCounter = 1;
  let compoundCounter = 1;

  // Define block zones based on road grid
  const blockXStarts = [120, 850, 1650, 2450, 3250];
  const blockYStarts = [100, 750, 1550, 2350, 3150];

  blockXStarts.forEach((bx) => {
    blockYStarts.forEach((by) => {
      const blockW = 460;
      const blockH = 460;

      // In some blocks create a walled compound
      if (rng() > 0.6) {
        compounds.push({
          id: `compound_${compoundCounter}`,
          name: `Syndicate Yard #${compoundCounter}`,
          x: bx,
          y: by,
          width: blockW,
          height: blockH,
          fenceColor: theme.compoundWallColor,
          gates: [
            { x: bx + blockW / 2 - 40, y: by + blockH - 8, width: 80, height: 16 },
            { x: bx + 8, y: by + blockH / 2 - 30, width: 16, height: 60 },
          ],
        });
        compoundCounter++;

        // Inside compound, place 1-2 small secure buildings
        const bW = 160;
        const bH = 140;
        buildings.push({
          id: `bld_${buildingCounter++}`,
          name: `Safehouse Depot ${buildingCounter}`,
          x: bx + 50,
          y: by + 50,
          width: bW,
          height: bH,
          wallColor: theme.buildingWallColors[Math.floor(rng() * theme.buildingWallColors.length)],
          roofColor: theme.buildingRoofColors[Math.floor(rng() * theme.buildingRoofColors.length)],
          door: { x: bx + 50 + bW / 2 - 20, y: by + 50 + bH - 4, width: 40, height: 8, side: 'bottom' },
          interiorItems: [
            { x: bx + 80, y: by + 80, type: 'crate' },
            { x: bx + 160, y: by + 120, type: 'safe' },
          ],
          canEnter: true,
        });
      } else {
        // Standard City Block with 2 to 4 street buildings
        const subW = 190;
        const subH = 180;
        const layoutConfigs = [
          { xOff: 20, yOff: 20 },
          { xOff: 240, yOff: 20 },
          { xOff: 20, yOff: 240 },
          { xOff: 240, yOff: 240 },
        ];

        layoutConfigs.forEach((cfg) => {
          if (rng() > 0.15) {
            const bX = bx + cfg.xOff;
            const bY = by + cfg.yOff;
            const wall = theme.buildingWallColors[Math.floor(rng() * theme.buildingWallColors.length)];
            const roof = theme.buildingRoofColors[Math.floor(rng() * theme.buildingRoofColors.length)];

            buildings.push({
              id: `bld_${buildingCounter++}`,
              name: `Block Commerce ${buildingCounter}`,
              x: bX,
              y: bY,
              width: subW,
              height: subH,
              wallColor: wall,
              roofColor: roof,
              door: {
                x: bX + subW / 2 - 18,
                y: bY + subH - 6,
                width: 36,
                height: 8,
                side: 'bottom',
              },
              interiorItems: [
                { x: bX + 40, y: bY + 40, type: 'table' },
                { x: bX + 120, y: bY + 110, type: 'crate' },
              ],
              canEnter: true,
            });
          }
        });
      }
    });
  });

  // 3. Safe Player Spawn Points (Central Open Hub)
  const spawnPoints = [
    { x: 1500, y: 1400 },
    { x: 2300, y: 1400 },
    { x: 1500, y: 2200 },
    { x: 2300, y: 2200 },
    { x: 1900, y: 1800 },
  ];

  // 4. Gangster Spawn Edge Coordinates
  const gangsterSpawnEdges: { x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right' }[] = [
    { x: 700, y: 40, edge: 'top' },
    { x: 1500, y: 40, edge: 'top' },
    { x: 2300, y: 40, edge: 'top' },
    { x: 3100, y: 40, edge: 'top' },
    { x: 700, y: 3960, edge: 'bottom' },
    { x: 1500, y: 3960, edge: 'bottom' },
    { x: 2300, y: 3960, edge: 'bottom' },
    { x: 3100, y: 3960, edge: 'bottom' },
    { x: 40, y: 600, edge: 'left' },
    { x: 40, y: 1400, edge: 'left' },
    { x: 40, y: 2200, edge: 'left' },
    { x: 40, y: 3000, edge: 'left' },
    { x: 3960, y: 600, edge: 'right' },
    { x: 3960, y: 1400, edge: 'right' },
    { x: 3960, y: 2200, edge: 'right' },
    { x: 3960, y: 3000, edge: 'right' },
  ];

  return {
    cityName,
    streetName,
    countryCode: selectedCountry,
    theme,
    mapWidth,
    mapHeight,
    roads,
    buildings,
    compounds,
    spawnPoints,
    gangsterSpawnEdges,
  };
}

/**
 * Check if a coordinate is inside a building collision box (solid wall)
 */
export function isPointInsideBuilding(
  x: number,
  y: number,
  buildings: Building[],
  padding = 10
): { inside: boolean; building?: Building; nearDoor: boolean } {
  for (const bld of buildings) {
    if (
      x >= bld.x - padding &&
      x <= bld.x + bld.width + padding &&
      y >= bld.y - padding &&
      y <= bld.y + bld.height + padding
    ) {
      // Check if near doorway
      const d = bld.door;
      const nearDoor =
        x >= d.x - 20 && x <= d.x + d.width + 20 && y >= d.y - 20 && y <= d.y + d.height + 20;

      return { inside: true, building: bld, nearDoor };
    }
  }
  return { inside: false, nearDoor: false };
}
