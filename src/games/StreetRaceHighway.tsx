'use client';

// Highway Math and Pseudo-3D Perspective Engine for 7KM Street Race
export const HIGHWAY_LENGTH = 70000; // 70,000 units = 7km (10 units = 1 meter)
export const ROAD_WIDTH = 420; // 4 lanes total
export const SEGMENT_LENGTH = 100; // segment depth in units
export const DRAW_DISTANCE = 160; // how many segments ahead to render
export const CAMERA_HEIGHT = 120; // camera elevation above road
export const CAMERA_DEPTH = 0.84; // camera focal depth

export interface HighwayObstacle {
  id: string;
  y: number; // 0 to 70000
  laneOffset: number; // -1 to 1 (-1 = far left lane, 1 = far right lane)
  type: 'broken_car' | 'oil_slick' | 'cones' | 'concrete_barrier';
  width: number;
  height: number;
  color: string;
}

export interface HighwayMarker {
  y: number;
  label: string;
  subtitle: string;
}

// Curvature formula as specified:
// roadCenterX = canvasWidth/2 + Math.sin(y * 0.0005) * 300 + Math.sin(y * 0.0002) * 500
export function getRoadCenterX(y: number, screenWidth: number): number {
  return (
    screenWidth / 2 +
    Math.sin(y * 0.0005) * 300 +
    Math.sin(y * 0.0002) * 500
  );
}

// Generate roadside distance milestone markers along the 7km highway
export function generateHighwayMarkers(): HighwayMarker[] {
  return [
    { y: 10000, label: '1 KM COMPLETE', subtitle: '6 KM TO FINISH' },
    { y: 20000, label: '2 KM COMPLETE', subtitle: 'MID-VALLEY SECTION' },
    { y: 30000, label: '3 KM COMPLETE', subtitle: '4 KM TO FINISH - SPEED ZONE' },
    { y: 40000, label: '4 KM COMPLETE', subtitle: '3 KM TO FINISH - TUNNEL PASS' },
    { y: 50000, label: '5 KM COMPLETE', subtitle: '2 KM TO FINISH - HIGH TRAFFIC' },
    { y: 60000, label: '6 KM COMPLETE', subtitle: '1 KM REMAINING - FINAL SPRINT!' },
    { y: 70000, label: 'FINISH LINE - 7 KM', subtitle: 'CHAMPIONS ARCH' },
  ];
}

// Procedural generation of obstacles over 7km
export function generateHighwayObstacles(): HighwayObstacle[] {
  const obstacles: HighwayObstacle[] = [];
  const obstacleTypes: Array<HighwayObstacle['type']> = [
    'broken_car',
    'oil_slick',
    'cones',
    'concrete_barrier',
  ];

  // Spawn obstacles starting from 1500 units up to 69500 units
  let currentY = 1500;
  let idCounter = 0;

  while (currentY < HIGHWAY_LENGTH - 600) {
    // Gap varies between 320 and 650 units
    currentY += 320 + Math.floor(Math.sin(currentY * 0.003) * 120 + Math.random() * 200);

    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    // Lane offset: -0.75 (lane 1), -0.25 (lane 2), 0.25 (lane 3), 0.75 (lane 4)
    const laneChoices = [-0.75, -0.25, 0.25, 0.75];
    const laneOffset = laneChoices[Math.floor(Math.random() * laneChoices.length)];

    let color = '#EF4444';
    if (type === 'oil_slick') color = '#020617';
    else if (type === 'cones') color = '#F97316';
    else if (type === 'concrete_barrier') color = '#94A3B8';
    else if (type === 'broken_car') color = '#7C3AED';

    obstacles.push({
      id: `obs_${idCounter++}_${Math.floor(currentY)}`,
      y: currentY,
      laneOffset,
      type,
      width: type === 'concrete_barrier' ? 55 : 42,
      height: type === 'concrete_barrier' ? 24 : 32,
      color,
    });
  }

  return obstacles;
}

// Perspective Projection Helper
export function projectPoint(
  worldX: number,
  worldY: number,
  worldZ: number,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  screenWidth: number,
  screenHeight: number
) {
  const relZ = worldZ - cameraZ;
  if (relZ <= 0) {
    return { screenX: 0, screenY: 0, scale: 0, visible: false };
  }

  const scale = (CAMERA_DEPTH / relZ) * (screenHeight / 2);
  const relX = worldX - cameraX;
  const relY = worldY - cameraY;

  const screenX = Math.round(screenWidth / 2 + relX * scale);
  const screenY = Math.round(screenHeight / 2 - relY * scale);

  return {
    screenX,
    screenY,
    scale,
    visible: screenY >= 0 && screenY <= screenHeight && scale > 0.001,
  };
}

// Draw realistic roadside scenery, highway guardrails, barriers, and road striping
export function renderHighwayScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  carY: number,
  carXOffset: number
) {
  // 1. Sky & Horizon Gradient (Sunset to Dusk Street Vibe)
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  skyGradient.addColorStop(0, '#020617'); // Dark Space
  skyGradient.addColorStop(0.35, '#1e1b4b'); // Deep indigo
  skyGradient.addColorStop(0.7, '#831843'); // Pink dusk
  skyGradient.addColorStop(1, '#f97316'); // Golden horizon
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height * 0.55);

  // 2. Distant Parallax City Skyline
  const horizonY = height * 0.5;
  const cityOffset = (carXOffset * 0.15 + Math.sin(carY * 0.0001) * 60) % 300;

  ctx.fillStyle = '#09090b';
  for (let b = -300; b < width + 300; b += 45) {
    const bHeight = 40 + Math.abs(Math.sin(b * 12.3)) * 65;
    ctx.fillRect(b - cityOffset, horizonY - bHeight, 42, bHeight);
    // Neon window lights
    if (Math.abs(Math.sin(b * 5)) > 0.4) {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(b - cityOffset + 10, horizonY - bHeight + 15, 6, 6);
      ctx.fillRect(b - cityOffset + 24, horizonY - bHeight + 25, 6, 6);
      ctx.fillStyle = '#09090b';
    }
  }

  // 3. Ground / Grass Terrain below horizon
  const groundGradient = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGradient.addColorStop(0, '#064e3b'); // Dark emerald
  groundGradient.addColorStop(0.5, '#065f46');
  groundGradient.addColorStop(1, '#022c22');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, horizonY, width, height - horizonY);
}

// Draw 3D projected road segments
export function renderRoadSegments(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  playerY: number,
  playerXOffset: number
) {
  const horizonY = height * 0.48;
  const bottomY = height;
  const roadCenterBase = width / 2;

  // We trace from player camera forward
  const currentSeg = Math.floor(playerY / SEGMENT_LENGTH);
  const segmentsToDraw = DRAW_DISTANCE;

  for (let n = segmentsToDraw; n >= 1; n--) {
    const segIndex = currentSeg + n;
    const segY = segIndex * SEGMENT_LENGTH;
    const dist = n * SEGMENT_LENGTH;

    // Perspective depth projection factor
    const p1 = 1 / (n * 0.08 + 1);
    const p2 = 1 / ((n - 1) * 0.08 + 1);

    const y1 = bottomY - (bottomY - horizonY) * (1 - p1);
    const y2 = bottomY - (bottomY - horizonY) * (1 - p2);

    // Highway curve offset relative to player
    const curve1 = getRoadCenterX(segY, width) - roadCenterBase - playerXOffset * p1;
    const curve2 = getRoadCenterX(segY - SEGMENT_LENGTH, width) - roadCenterBase - playerXOffset * p2;

    const x1 = roadCenterBase + curve1;
    const x2 = roadCenterBase + curve2;

    const w1 = ROAD_WIDTH * p1 * 1.5;
    const w2 = ROAD_WIDTH * p2 * 1.5;

    // Alternating asphalt / rumble stripe colors
    const isEven = (segIndex % 4) < 2;
    const roadColor = isEven ? '#18181B' : '#27272A';
    const shoulderColor = isEven ? '#DC2626' : '#FAFAFA';

    // 1. Shoulders / Rumble strips
    const shoulderW1 = w1 * 1.15;
    const shoulderW2 = w2 * 1.15;

    ctx.fillStyle = shoulderColor;
    ctx.beginPath();
    ctx.moveTo(x1 - shoulderW1, y1);
    ctx.lineTo(x1 + shoulderW1, y1);
    ctx.lineTo(x2 + shoulderW2, y2);
    ctx.lineTo(x2 - shoulderW2, y2);
    ctx.closePath();
    ctx.fill();

    // 2. Main Asphalt Road Surface
    ctx.fillStyle = roadColor;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x2 - w2, y2);
    ctx.closePath();
    ctx.fill();

    // 3. Center Barrier / Double Solid Yellow Line
    ctx.fillStyle = '#EAB308';
    const dividerW1 = Math.max(2, 3 * p1);
    const dividerW2 = Math.max(2, 3 * p2);
    ctx.beginPath();
    ctx.moveTo(x1 - dividerW1, y1);
    ctx.lineTo(x1 + dividerW1, y1);
    ctx.lineTo(x2 + dividerW2, y2);
    ctx.lineTo(x2 - dividerW2, y2);
    ctx.closePath();
    ctx.fill();

    // 4. Broken Lane Markings (Left lane divider & Right lane divider)
    if (isEven) {
      ctx.fillStyle = '#FFFFFF';
      const lane1X1 = x1 - w1 * 0.5;
      const lane1X2 = x2 - w2 * 0.5;
      const lane2X1 = x1 + w1 * 0.5;
      const lane2X2 = x2 + w2 * 0.5;

      const markW1 = Math.max(1.5, 2 * p1);
      const markW2 = Math.max(1.5, 2 * p2);

      // Lane 1 divider
      ctx.beginPath();
      ctx.moveTo(lane1X1 - markW1, y1);
      ctx.lineTo(lane1X1 + markW1, y1);
      ctx.lineTo(lane1X2 + markW2, y2);
      ctx.lineTo(lane1X2 - markW2, y2);
      ctx.closePath();
      ctx.fill();

      // Lane 2 divider
      ctx.beginPath();
      ctx.moveTo(lane2X1 - markW1, y1);
      ctx.lineTo(lane2X1 + markW1, y1);
      ctx.lineTo(lane2X2 + markW2, y2);
      ctx.lineTo(lane2X2 - markW2, y2);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Check if Milestone / Finish Arch on this segment
    if (segY >= HIGHWAY_LENGTH && segY - SEGMENT_LENGTH < HIGHWAY_LENGTH) {
      renderFinishArch(ctx, x1, y1, w1);
    }
  }
}

// Render the 7KM Finish Arch with neon celebration
function renderFinishArch(ctx: CanvasRenderingContext2D, centerX: number, screenY: number, roadWidth: number) {
  const archHeight = roadWidth * 0.8;
  const pillarW = Math.max(10, roadWidth * 0.12);

  ctx.save();
  // Left pillar
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(centerX - roadWidth - pillarW, screenY - archHeight, pillarW, archHeight);

  // Right pillar
  ctx.fillRect(centerX + roadWidth, screenY - archHeight, pillarW, archHeight);

  // Top truss
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(
    centerX - roadWidth - pillarW,
    screenY - archHeight,
    roadWidth * 2 + pillarW * 2,
    archHeight * 0.28
  );

  // Checkered Banner
  const bannerW = roadWidth * 2;
  const bannerH = archHeight * 0.22;
  const bannerX = centerX - roadWidth;
  const bannerY = screenY - archHeight + 4;

  const sq = 12;
  for (let bx = 0; bx < bannerW; bx += sq) {
    for (let by = 0; by < bannerH; by += sq) {
      ctx.fillStyle = (Math.floor(bx / sq) + Math.floor(by / sq)) % 2 === 0 ? '#FFFFFF' : '#000000';
      ctx.fillRect(bannerX + bx, bannerY + by, sq, sq);
    }
  }

  // Glowing Finish Text
  ctx.font = `bold ${Math.max(14, Math.round(roadWidth * 0.12))}px sans-serif`;
  ctx.fillStyle = '#FDE047';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#F59E0B';
  ctx.shadowBlur = 15;
  ctx.fillText('★ 7KM FINISH LINE ★', centerX, screenY - archHeight + archHeight * 0.2);

  ctx.restore();
}

// Render Obstacles in 3D Perspective
export function renderObstaclesOnRoad(
  ctx: CanvasRenderingContext2D,
  obstacles: HighwayObstacle[],
  playerY: number,
  playerXOffset: number,
  width: number,
  height: number
) {
  const horizonY = height * 0.48;
  const bottomY = height;
  const roadCenterBase = width / 2;

  // Filter obstacles in front of camera within draw distance
  const visibleObstacles = obstacles.filter(
    (obs) => obs.y >= playerY - 50 && obs.y <= playerY + SEGMENT_LENGTH * DRAW_DISTANCE
  );

  // Sort by Y distance descending (render farthest first)
  visibleObstacles.sort((a, b) => b.y - a.y);

  visibleObstacles.forEach((obs) => {
    const distY = obs.y - playerY;
    if (distY <= 1) return;

    const n = distY / SEGMENT_LENGTH;
    const p = 1 / (n * 0.08 + 1);

    const screenY = bottomY - (bottomY - horizonY) * (1 - p);
    const curve = getRoadCenterX(obs.y, width) - roadCenterBase - playerXOffset * p;
    const roadMidX = roadCenterBase + curve;
    const roadW = ROAD_WIDTH * p * 1.5;

    // Obstacle X on road based on its laneOffset (-1 to 1)
    const screenX = roadMidX + (obs.laneOffset * roadW * 0.7);

    const obsW = Math.max(6, obs.width * p * 2);
    const obsH = Math.max(5, obs.height * p * 2);

    ctx.save();
    ctx.translate(screenX, screenY);

    if (obs.type === 'broken_car') {
      // Broken vehicle smoke & hazard lights
      ctx.fillStyle = obs.color;
      ctx.fillRect(-obsW / 2, -obsH, obsW, obsH);

      // Windows
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-obsW * 0.4, -obsH * 0.85, obsW * 0.8, obsH * 0.4);

      // Flashing hazard lights
      if (Math.floor(Date.now() / 250) % 2 === 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(-obsW * 0.4, -obsH * 0.2, Math.max(2, obsW * 0.12), 0, Math.PI * 2);
        ctx.arc(obsW * 0.4, -obsH * 0.2, Math.max(2, obsW * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (obs.type === 'oil_slick') {
      // Dark slippery puddle on asphalt
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -obsH / 2, obsW * 0.7, obsH * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (obs.type === 'cones') {
      // Orange traffic cone
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(-obsW / 2, 0);
      ctx.lineTo(obsW / 2, 0);
      ctx.lineTo(0, -obsH);
      ctx.closePath();
      ctx.fill();
      // White reflective stripe
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-obsW * 0.25, -obsH * 0.5, obsW * 0.5, obsH * 0.2);
    } else {
      // Concrete barrier
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-obsW / 2, -obsH, obsW, obsH);
      ctx.fillStyle = '#475569';
      ctx.strokeRect(-obsW / 2, -obsH, obsW, obsH);
      // Caution stripes
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(-obsW * 0.3, -obsH * 0.6, obsW * 0.2, obsH * 0.4);
      ctx.fillRect(obsW * 0.1, -obsH * 0.6, obsW * 0.2, obsH * 0.4);
    }

    ctx.restore();
  });
}

// Draw Player Car from Behind (3rd Person Camera View)
export function renderPlayerCarBehind(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  steering: number, // -1 to 1
  isBraking: boolean,
  isNitro: boolean,
  isCrashed: boolean,
  carColor = '#DC2626'
) {
  ctx.save();
  ctx.translate(screenX, screenY);

  if (isCrashed) {
    // Flashing red opacity when crashed
    ctx.globalAlpha = Math.floor(Date.now() / 150) % 2 === 0 ? 0.4 : 1;
  }

  // Slight tilt based on steering
  const tiltAngle = steering * 0.12;
  ctx.rotate(tiltAngle);

  const carW = 90;
  const carH = 50;

  // Nitro exhaust flames
  if (isNitro) {
    ctx.fillStyle = '#06B6D4';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 20;
    // Left exhaust flame
    ctx.beginPath();
    ctx.moveTo(-carW * 0.35, carH * 0.5);
    ctx.lineTo(-carW * 0.25, carH * 0.5);
    ctx.lineTo(-carW * 0.3, carH * 0.5 + 30 + Math.random() * 20);
    ctx.closePath();
    ctx.fill();
    // Right exhaust flame
    ctx.beginPath();
    ctx.moveTo(carW * 0.25, carH * 0.5);
    ctx.lineTo(carW * 0.35, carH * 0.5);
    ctx.lineTo(carW * 0.3, carH * 0.5 + 30 + Math.random() * 20);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Car Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, carH * 0.4, carW * 0.6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels / Tires (Rear View)
  ctx.fillStyle = '#09090B';
  // Left Tire
  ctx.fillRect(-carW * 0.52, carH * 0.1, 16, 26);
  // Right Tire
  ctx.fillRect(carW * 0.52 - 16, carH * 0.1, 16, 26);

  // Lower Bumper & Diffuser
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.roundRect(-carW * 0.48, carH * 0.15, carW * 0.96, carH * 0.32, 6);
  ctx.fill();

  // Dual Exhaust Pipes
  ctx.fillStyle = '#71717A';
  ctx.beginPath();
  ctx.arc(-carW * 0.3, carH * 0.42, 5, 0, Math.PI * 2);
  ctx.arc(carW * 0.3, carH * 0.42, 5, 0, Math.PI * 2);
  ctx.fill();

  // Main Car Body (Rear Trunk & Quarter Panels)
  ctx.fillStyle = carColor;
  ctx.beginPath();
  ctx.roundRect(-carW * 0.45, -carH * 0.2, carW * 0.9, carH * 0.45, [10, 10, 4, 4]);
  ctx.fill();

  // Rear Spoiler / Wing
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-carW * 0.48, -carH * 0.35, carW * 0.96, 7);
  // Spoiler struts
  ctx.fillRect(-carW * 0.3, -carH * 0.35, 5, 12);
  ctx.fillRect(carW * 0.3 - 5, -carH * 0.35, 5, 12);

  // Cabin & Rear Windshield
  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.moveTo(-carW * 0.36, -carH * 0.2);
  ctx.lineTo(-carW * 0.28, -carH * 0.65);
  ctx.lineTo(carW * 0.28, -carH * 0.65);
  ctx.lineTo(carW * 0.36, -carH * 0.2);
  ctx.closePath();
  ctx.fill();

  // Glass reflection
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(-carW * 0.32, -carH * 0.22);
  ctx.lineTo(-carW * 0.25, -carH * 0.6);
  ctx.lineTo(carW * 0.25, -carH * 0.6);
  ctx.lineTo(carW * 0.32, -carH * 0.22);
  ctx.closePath();
  ctx.fill();

  // Rear LED Tail Lights
  const lightColor = isBraking ? '#FF0000' : '#DC2626';
  ctx.fillStyle = lightColor;
  ctx.shadowColor = lightColor;
  ctx.shadowBlur = isBraking ? 18 : 8;

  // Left Tail Light Strip
  ctx.fillRect(-carW * 0.42, -carH * 0.08, carW * 0.28, 7);
  // Right Tail Light Strip
  ctx.fillRect(carW * 0.14, -carH * 0.08, carW * 0.28, 7);
  ctx.shadowBlur = 0;

  // License Plate
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(-16, carH * 0.15, 32, 12);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STREET', 0, carH * 0.24);

  ctx.restore();
}

// Render Other Opponents' Cars in Perspective
export function renderOpponentCar(
  ctx: CanvasRenderingContext2D,
  playerY: number,
  playerXOffset: number,
  oppY: number,
  oppLaneOffset: number,
  oppName: string,
  oppColor: string,
  width: number,
  height: number
) {
  const distY = oppY - playerY;
  // If opponent is too far behind or ahead beyond draw distance, don't render
  if (distY < -300 || distY > SEGMENT_LENGTH * DRAW_DISTANCE) return;

  const horizonY = height * 0.48;
  const bottomY = height;
  const roadCenterBase = width / 2;

  const n = Math.max(1, distY / SEGMENT_LENGTH);
  const p = 1 / (n * 0.08 + 1);

  const screenY = bottomY - (bottomY - horizonY) * (1 - p);
  const curve = getRoadCenterX(oppY, width) - roadCenterBase - playerXOffset * p;
  const roadMidX = roadCenterBase + curve;
  const roadW = ROAD_WIDTH * p * 1.5;

  const screenX = roadMidX + (oppLaneOffset * roadW * 0.7);

  const scale = p * 1.1;
  const oppW = Math.max(18, 90 * scale);
  const oppH = Math.max(10, 50 * scale);

  ctx.save();
  ctx.translate(screenX, screenY);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, oppH * 0.4, oppW * 0.5, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-oppW * 0.5, oppH * 0.1, oppW * 0.18, oppH * 0.5);
  ctx.fillRect(oppW * 0.32, oppH * 0.1, oppW * 0.18, oppH * 0.5);

  // Body
  ctx.fillStyle = oppColor;
  ctx.beginPath();
  ctx.roundRect(-oppW * 0.45, -oppH * 0.2, oppW * 0.9, oppH * 0.45, 4 * scale);
  ctx.fill();

  // Cabin
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(-oppW * 0.35, -oppH * 0.2);
  ctx.lineTo(-oppW * 0.25, -oppH * 0.6);
  ctx.lineTo(oppW * 0.25, -oppH * 0.6);
  ctx.lineTo(oppW * 0.35, -oppH * 0.2);
  ctx.closePath();
  ctx.fill();

  // Tail lights
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-oppW * 0.4, -oppH * 0.08, oppW * 0.25, 4 * scale);
  ctx.fillRect(oppW * 0.15, -oppH * 0.08, oppW * 0.25, 4 * scale);

  // Opponent Name Tag floating above car
  ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(oppName, 0, -oppH * 0.85);

  ctx.restore();
}
