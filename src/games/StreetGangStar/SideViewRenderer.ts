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

/** Lighten existing city palette without changing its layout or camera framing. */
function lightenColor(color: string, amount = 0.38): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const lift = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return '#' + [lift(r), lift(g), lift(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Draws the existing street-level scene in a brighter daylight palette. Camera framing and movement remain unchanged. */
export function drawSideViewScene(ctx: CanvasRenderingContext2D, scene: SideViewScene) {
  const { city, player, screenWidth, screenHeight } = scene;
  const groundY = Math.round(screenHeight * 0.79);
  const cameraX = Math.max(0, Math.min(city.mapWidth - screenWidth, scene.cameraX));
  const laneOffset = (y: number) => ((y / city.mapHeight) - 0.5) * 34;
  ctx.clearRect(0, 0, screenWidth, screenHeight);

  // Keep the simple road background shown in the user's reference; only lift
  // the asphalt slightly so it is easier to see. Camera and player framing stay intact.
  ctx.fillStyle = '#2B3038';
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  ctx.strokeStyle = '#F4D35E';
  ctx.lineWidth = 4;
  ctx.setLineDash([48, 48]);
  ctx.beginPath();
  ctx.moveTo(screenWidth / 2, 0);
  ctx.lineTo(screenWidth / 2, screenHeight);
  ctx.stroke();
  ctx.setLineDash([]);

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
