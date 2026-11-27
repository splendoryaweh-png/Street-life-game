import type { CityData } from './CityGenerator';

type Actor = { x: number; y: number; facingAngle?: number; color?: string; health?: number; maxHealth?: number; vehicleType?: string; name?: string; jumpOffset?: number; };
type Vehicle = { x: number; y: number; width: number; height: number; color: string; angle?: number; direction?: string; };
type Beam = { x1: number; y1: number; x2: number; y2: number; color: string; life: number; isPlayer: boolean; };

export interface SideViewScene {
  city: CityData;
  player: Actor;
  cars: Vehicle[];
  civilians: Actor[];
  gangsters: Actor[];
  lasers: Beam[];
  remotePlayers?: Actor[];
  screenWidth: number;
  screenHeight: number;
  cameraX: number;
}

/** Draws a readable, horizontally scrolling street-level scene. Simulation coordinates remain untouched. */
export function drawSideViewScene(ctx: CanvasRenderingContext2D, scene: SideViewScene) {
  const { city, player, screenWidth, screenHeight } = scene;
  const groundY = Math.round(screenHeight * 0.79);
  const cameraX = Math.max(0, Math.min(city.mapWidth - screenWidth, scene.cameraX));
  const laneOffset = (y: number) => ((y / city.mapHeight) - 0.5) * 34;
  ctx.clearRect(0, 0, screenWidth, screenHeight);
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#7CC7F2'); sky.addColorStop(1, '#D9EAF4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, screenWidth, groundY);
  ctx.fillStyle = '#E8D9BD'; ctx.fillRect(0, groundY - 24, screenWidth, 24);
  ctx.fillStyle = '#30343B'; ctx.fillRect(0, groundY, screenWidth, screenHeight - groundY);
  ctx.fillStyle = '#F4D35E'; ctx.fillRect(0, groundY + 34, screenWidth, 4);

  // Parallax skyline and recognizable building fronts, not overhead roof blocks.
  const first = Math.max(0, Math.floor(cameraX / 260) - 2);
  const last = Math.min(Math.ceil(city.mapWidth / 260), Math.ceil((cameraX + screenWidth) / 260) + 2);
  for (let i = first; i < last; i++) {
    const x = i * 260 - cameraX;
    const h = 115 + ((i * 47) % 135);
    ctx.fillStyle = ['#9AA6B2', '#C7B7A3', '#8D9BA8', '#B7A18B'][i % 4];
    ctx.fillRect(x, groundY - h - 24, 225, h);
    ctx.fillStyle = 'rgba(25,35,45,.28)'; ctx.fillRect(x + 8, groundY - h - 16, 209, 9);
    for (let wy = groundY - h + 12; wy < groundY - 42; wy += 28) {
      for (let wx = x + 14; wx < x + 210; wx += 34) {
        ctx.fillStyle = (Math.floor(wx + wy + i) % 3 === 0) ? '#F8D98B' : '#426174';
        ctx.fillRect(wx, wy, 17, 15);
      }
    }
    ctx.fillStyle = '#3C4650'; ctx.fillRect(x + 12, groundY - 39, 58, 15);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(city.cityName.toUpperCase(), x + 17, groundY - 28);
  }

  city.buildings.forEach((b, i) => {
    const x = b.x - cameraX;
    if (x + b.width < -20 || x > screenWidth + 20) return;
    const h = Math.max(90, Math.min(230, b.height * 0.45));
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 7, groundY - h + 8, Math.max(35, b.width * .55), h);
    ctx.fillStyle = b.wallColor; ctx.fillRect(x, groundY - h, Math.max(35, b.width * .55), h);
    ctx.fillStyle = b.roofColor; ctx.fillRect(x - 4, groundY - h - 8, Math.max(43, b.width * .55) + 8, 10);
    for (let wx = x + 10; wx < x + b.width * .5 - 8; wx += 28) {
      ctx.fillStyle = '#29485B'; ctx.fillRect(wx, groundY - h + 18, 17, 22);
    }
    ctx.fillStyle = '#6B4428'; ctx.fillRect(x + 12, groundY - 38, 18, 38);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(b.name.slice(0, 22), x + 8, groundY - h - 14);
  });

  city.roads.filter(r => r.direction === 'horizontal').forEach(r => {
    const x = r.x - cameraX;
    if (x < screenWidth && x + r.width > 0) {
      ctx.fillStyle = '#26313A'; ctx.fillRect(Math.max(0, x), groundY + 6, Math.min(screenWidth, r.width), screenHeight - groundY - 6);
    }
  });
  // Prominent street sign stays readable as the player travels.
  ctx.fillStyle = '#14532D'; ctx.fillRect(16, 18, 210, 34);
  ctx.strokeStyle = '#D1FAE5'; ctx.lineWidth = 2; ctx.strokeRect(16, 18, 210, 34);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText(city.streetName.toUpperCase().slice(0, 28), 25, 40);

  const drawPerson = (a: Actor, shirt: string, scale = 1) => {
    const x = a.x - cameraX, y = groundY - 20 + laneOffset(a.y) - (a.jumpOffset || 0);
    if (x < -50 || x > screenWidth + 50) return;
    ctx.fillStyle = '#20252B'; ctx.fillRect(x - 7 * scale, y - 17 * scale, 5 * scale, 18 * scale); ctx.fillRect(x + 2 * scale, y - 17 * scale, 5 * scale, 18 * scale);
    ctx.fillStyle = shirt; ctx.fillRect(x - 10 * scale, y - 38 * scale, 20 * scale, 23 * scale);
    ctx.fillStyle = '#D99A72'; ctx.beginPath(); ctx.arc(x, y - 46 * scale, 8 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#18212B'; ctx.fillRect(x + 5 * scale, y - 38 * scale, 16 * scale, 4 * scale);
  };
  scene.cars.forEach(c => {
    const x = c.x - cameraX, y = groundY - 12 + laneOffset(c.y);
    if (x < -100 || x > screenWidth + 100) return;
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(x - 34, y - 30, 68, 30, 8); ctx.fill();
    ctx.fillStyle = '#263B4A'; ctx.fillRect(x - 20, y - 25, 36, 12);
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(x - 21, y, 8, 0, Math.PI * 2); ctx.arc(x + 21, y, 8, 0, Math.PI * 2); ctx.fill();
  });
  scene.civilians.forEach(a => drawPerson(a, a.color || '#94A3B8', .9));
  scene.gangsters.forEach(a => {
    const x = a.x - cameraX, y = groundY - 12 + laneOffset(a.y);
    if (a.vehicleType === 'tank') {
      ctx.fillStyle = '#55616D'; ctx.fillRect(x - 42, y - 34, 84, 30);
      ctx.fillStyle = '#202B35'; ctx.fillRect(x - 22, y - 48, 42, 16);
      ctx.fillStyle = '#94A3B8'; ctx.fillRect(x + 8, y - 44, 42, 6);
      ctx.fillStyle = '#111827'; for (let wx = x - 32; wx <= x + 32; wx += 16) { ctx.beginPath(); ctx.arc(wx, y - 3, 8, 0, Math.PI * 2); ctx.fill(); }
    } else if (a.vehicleType === 'bus') {
      ctx.fillStyle = '#7F1D1D'; ctx.fillRect(x - 42, y - 52, 84, 42); ctx.fillStyle = '#BFE3F5'; ctx.fillRect(x - 32, y - 44, 64, 17);
    } else drawPerson(a, '#B91C1C');
    if (a.health !== undefined && a.maxHealth) { ctx.fillStyle = '#111827'; ctx.fillRect(x - 18, y - 65, 36, 4); ctx.fillStyle = '#EF4444'; ctx.fillRect(x - 18, y - 65, 36 * Math.max(0, a.health / a.maxHealth), 4); }
  });
  scene.remotePlayers?.forEach(a => drawPerson(a, '#0EA5E9'));
  drawPerson(player, '#FACC15', 1.12);
  scene.lasers.forEach(l => {
    ctx.strokeStyle = l.color; ctx.lineWidth = l.isPlayer ? 4 : 3; ctx.shadowColor = l.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(l.x1 - cameraX, groundY - 48 + laneOffset(l.y1)); ctx.lineTo(l.x2 - cameraX, groundY - 48 + laneOffset(l.y2)); ctx.stroke(); ctx.shadowBlur = 0;
  });
}
