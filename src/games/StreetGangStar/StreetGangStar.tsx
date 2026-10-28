'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Shield, Zap, Volume2, VolumeX, Heart, Coins, ShoppingBag, X, ArrowLeft, Users } from 'lucide-react';
import { playShootSound, playReloadSound, playPickupSound, playCoinSound, playSuccessSound, playSirenSound, playClickSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { getRandomCityByCountry, CityData, isPointInsideBuilding } from './CityGenerator';
import { getGangStarText, GangStarTextKey } from './language';
import { StreetGangStarIntro } from './Intro';
import { StreetJoystick } from './StreetJoystick';
export type WeaponType = 'pistol' | 'shotgun_laser' | 'ak_laser' | 'sniper_laser';
export interface WeaponDef { id: WeaponType; nameKey: GangStarTextKey; damage: number; maxAmmo: number; fireRateMs: number; laserColor: string; price: number; bulletSpeed: number; spread: number; }
export const WEAPONS: Record<WeaponType, WeaponDef> = {
  pistol: { id: 'pistol', nameKey: 'weapon_pistol', damage: 30, maxAmmo: 30, fireRateMs: 240, laserColor: '#38BDF8', price: 0, bulletSpeed: 18, spread: 1 },
  shotgun_laser: { id: 'shotgun_laser', nameKey: 'weapon_shotgun', damage: 40, maxAmmo: 10, fireRateMs: 650, laserColor: '#FACC15', price: 50, bulletSpeed: 16, spread: 3 },
  ak_laser: { id: 'ak_laser', nameKey: 'weapon_ak', damage: 35, maxAmmo: 60, fireRateMs: 120, laserColor: '#EC4899', price: 100, bulletSpeed: 20, spread: 1 },
  sniper_laser: { id: 'sniper_laser', nameKey: 'weapon_sniper', damage: 65, maxAmmo: 5, fireRateMs: 900, laserColor: '#22C55E', price: 200, bulletSpeed: 58, spread: 5 },
};
export interface LaserBeam { id: string; x1: number; y1: number; x2: number; y2: number; color: string; life: number; maxLife: number; isPlayer: boolean; damage: number; }
export interface CityCar { id: string; x: number; y: number; vx: number; vy: number; speed: number; direction: 'horizontal' | 'vertical'; width: number; height: number; color: string; isOccupied: boolean; hasDriver: boolean; driverType: 'civilian' | 'player' | 'gangster' | null; health: number; maxHealth: number; }
export interface Civilian { id: string; x: number; y: number; vx: number; vy: number; speed: number; facingAngle: number; state: 'walking' | 'scared' | 'saved'; color: string; }
export interface Gangster { id: string; type: 'fighter_motor' | 'fighter_bus'; x: number; y: number; vx: number; vy: number; health: number; maxHealth: number; speed: number; facingAngle: number; gun: WeaponType; lastShootTime: number; vehicleType: 'motorcycle' | 'bus'; }
export interface SparkParticle { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface StreetGangStarProps { onBack: () => void; onToast: (msg: string) => void; language?: string; initialCountry?: string; }
export function StreetGangStar({ onBack, onToast, language = 'en', initialCountry = 'NG' }: StreetGangStarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = useCallback((key: GangStarTextKey) => getGangStarText(language, key), [language]);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(false);
  const [avatarColor, setAvatarColor] = useState<string>(() => { if (typeof window !== 'undefined') { return localStorage.getItem('gangstar_avatar_color') || '#FFD700'; } return '#FFD700'; });
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [playerTeam, setPlayerTeam] = useState<'blue' | 'red'>('blue');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cityData] = useState<CityData>(() => getRandomCityByCountry(initialCountry, 'single_player_seed'));
  const [hudHealth, setHudHealth] = useState<number>(100);
  const [hudAmmo, setHudAmmo] = useState<number>(30);
  const [hudMaxAmmo, setHudMaxAmmo] = useState<number>(30);
  const [hudCoins, setHudCoins] = useState<number>(0);
  const [hudGun, setHudGun] = useState<WeaponType>('pistol');
  const [hudInCover, setHudInCover] = useState<boolean>(false);
  const [hudInCar, setHudInCar] = useState<boolean>(false);
  const [hudIsNearCar, setHudIsNearCar] = useState<boolean>(false);
  const [civiliansSavedCount, setCiviliansSavedCount] = useState<number>(0);
  const [gangstersKilledCount, setGangstersKilledCount] = useState<number>(0);
  const gameStateRef = useRef({
    player: { x: 1900, y: 1800, vx: 0, vy: 0, speed: 4.5, health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, gun: 'pistol' as WeaponType, coins: 0, facingAngle: 0, isCover: false, inCarId: null as string | null, lastShootTime: 0, isReloading: false, jumpOffset: 0, jumpVy: 0, isJumping: false },
    unlockedGuns: { pistol: true, shotgun_laser: false, ak_laser: false, sniper_laser: false } as Record<WeaponType, boolean>,
    cars: [] as CityCar[], civilians: [] as Civilian[], gangsters: [] as Gangster[], lasers: [] as LaserBeam[], sparks: [] as SparkParticle[],
    keys: { w: false, a: false, s: false, d: false, shift: false, mouseLeft: false },
    joystickMovement: { dx: 0, dy: 0, isMoving: false }, isRunActive: false, isMouseActive: false, mousePos: { x: 0, y: 0 }, screenDim: { w: 800, h: 600 }, lastSpawnTime: Date.now(), isRunning: false,
  });
  const playSfx = useCallback((name: 'shoot' | 'reload' | 'pickup' | 'coin' | 'success' | 'siren' | 'click') => {
    if (!soundEnabled) return;
    if (name === 'shoot') playShootSound(); else if (name === 'reload') playReloadSound(); else if (name === 'pickup') playPickupSound(); else if (name === 'coin') playCoinSound(); else if (name === 'success') playSuccessSound(); else if (name === 'siren') playSirenSound(); else if (name === 'click') playClickSound();
  }, [soundEnabled]);
  const initTrafficAndCivilians = useCallback(() => {
    const s = gameStateRef.current; const cars: CityCar[] = []; const colors = ['#38BDF8', '#F97316', '#A855F7', '#EF4444', '#10B981', '#E2E8F0', '#FACC15'];
    cityData.roads.forEach((road, idx) => { if (idx < 10) { const isHoriz = road.direction === 'horizontal'; const carW = isHoriz ? 54 : 30; const carH = isHoriz ? 30 : 54; const startX = isHoriz ? (idx * 380) % cityData.mapWidth : road.x + 30; const startY = isHoriz ? road.y + 40 : (idx * 380) % cityData.mapHeight; const speed = 2.4 + (idx % 3) * 0.5; cars.push({ id: `car_${idx}`, x: startX, y: startY, vx: isHoriz ? speed : 0, vy: isHoriz ? 0 : speed, speed, direction: road.direction, width: carW, height: carH, color: colors[idx % colors.length], isOccupied: false, hasDriver: true, driverType: 'civilian', health: 10, maxHealth: 10 }); } });
    s.cars = cars; const civs: Civilian[] = []; const civColors = ['#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#64748B'];
    for (let i = 0; i < 15; i++) { civs.push({ id: `civ_${i}`, x: 1200 + ((i * 170) % 1800), y: 1100 + ((i * 190) % 1800), vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, speed: 1.2, facingAngle: Math.random() * Math.PI * 2, state: 'walking', color: civColors[i % civColors.length] }); } s.civilians = civs;
  }, [cityData]);
  const setupGame = useCallback(() => {
    const s = gameStateRef.current; s.player.x = 1900; s.player.y = 1800; s.player.health = 100; s.player.ammo = WEAPONS.pistol.maxAmmo; s.player.maxAmmo = WEAPONS.pistol.maxAmmo; s.player.gun = 'pistol'; s.player.isCover = false; s.player.inCarId = null; s.gangsters = []; s.lasers = []; s.sparks = []; s.lastSpawnTime = Date.now(); s.isRunning = true;
    setHudHealth(100); setHudAmmo(WEAPONS.pistol.maxAmmo); setHudMaxAmmo(WEAPONS.pistol.maxAmmo); setHudGun('pistol'); setHudInCover(false); setHudInCar(false); initTrafficAndCivilians();
  }, [initTrafficAndCivilians]);
  const handleStartFromIntro = () => { setShowIntro(false); setupGame(); };
  const handleReload = useCallback(() => { const s = gameStateRef.current; if (s.player.isReloading) return; const wDef = WEAPONS[s.player.gun]; if (s.player.ammo >= wDef.maxAmmo) return; s.player.isReloading = true; playSfx('reload'); onToast(t('reload_alert')); setTimeout(() => { s.player.ammo = wDef.maxAmmo; s.player.isReloading = false; setHudAmmo(wDef.maxAmmo); }, 900); }, [onToast, playSfx, t]);
  const handleToggleCar = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; if (p.inCarId) { const car = s.cars.find((c) => c.id === p.inCarId); if (car) { car.isOccupied = false; car.hasDriver = false; car.driverType = null; p.x = car.x + 30; p.y = car.y + 30; } p.inCarId = null; setHudInCar(false); playSfx('click'); onToast(t('car_exit')); return; }
    let nearestCar: CityCar | null = null; let minDist = 70; for (const c of s.cars) { const dist = Math.hypot(c.x - p.x, c.y - p.y); if (dist < minDist) { minDist = dist; nearestCar = c; } }
    if (nearestCar) { if (nearestCar.hasDriver && nearestCar.driverType === 'civilian') { nearestCar.hasDriver = false; nearestCar.driverType = 'player'; nearestCar.isOccupied = true; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('siren'); onToast(t('car_hijacked')); } else if (!nearestCar.isOccupied) { nearestCar.isOccupied = true; nearestCar.hasDriver = true; nearestCar.driverType = 'player'; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('click'); onToast(t('car_enter')); } }
  }, [onToast, playSfx, t]);
  const handleToggleCover = useCallback(() => {
    const s = gameStateRef.current; const p = s.player;
    p.isCover = !p.isCover; setHudInCover(p.isCover); playSfx('click'); onToast(p.isCover ? 'SHIELD ON 🛡️ - Bullet Protection!' : 'Shield OFF');
  }, [onToast, playSfx]);
  const handleJump = useCallback(() => { const s = gameStateRef.current; const p = s.player; if (p.isJumping || p.inCarId) return; p.isJumping = true; p.jumpVy = 8.5; playPickupSound(); onToast('LEAP JUMP! 🚀'); }, [onToast]);
  const shootPlayerLaser = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; if (p.isReloading) return; if (p.ammo <= 0) { handleReload(); return; } const wDef = WEAPONS[s.player.gun]; const now = Date.now(); if (now - p.lastShootTime < wDef.fireRateMs) return; p.lastShootTime = now; p.ammo -= 1; setHudAmmo(p.ammo); playSfx('shoot');
    const startX = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.x || p.x) : p.x + Math.cos(p.facingAngle) * 22; const startY = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.y || p.y) : p.y + Math.sin(p.facingAngle) * 22; const baseAngle = p.facingAngle; const spreadAngles = wDef.spread === 3 ? [baseAngle - 0.14, baseAngle, baseAngle + 0.14] : [baseAngle];
    spreadAngles.forEach((ang) => { const beamLength = 450; const endX = startX + Math.cos(ang) * beamLength; const endY = startY + Math.sin(ang) * beamLength; s.lasers.push({ id: `laser_${Date.now()}_${Math.random()}`, x1: startX, y1: startY, x2: endX, y2: endY, color: wDef.laserColor, life: 7, maxLife: 7, isPlayer: true, damage: wDef.damage }); });
  }, [handleReload, playSfx]);
  const handleBuyWeapon = (wKey: WeaponType) => { const s = gameStateRef.current; const wDef = WEAPONS[wKey]; if (s.player.coins < wDef.price) { onToast(t('insufficient_coins')); return; } s.player.coins -= wDef.price; s.unlockedGuns[wKey] = true; s.player.gun = wKey; s.player.ammo = wDef.maxAmmo; s.player.maxAmmo = wDef.maxAmmo; setHudCoins(s.player.coins); setHudGun(wKey); setHudAmmo(wDef.maxAmmo); setHudMaxAmmo(wDef.maxAmmo); playSfx('success'); onToast(`${t('purchased')} ${t(wDef.nameKey)}`); setShowShopModal(false); };
  useEffect(() => {
    if (showIntro) return; const onKeyDown = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = true; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = true; if (k === 's' || e.key === 'ArrowDown') s.keys.s = true; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = true; if (e.key === 'Shift') s.keys.shift = true; if (e.code === 'Space') handleJump(); if (k === 'r') handleReload(); if (k === 'e') handleToggleCar(); if (k === 'q') handleToggleCover(); if (k === 'b') { setShowShopModal((prev) => !prev); playSfx('click'); } if (k === 't') { setShowTeamModal((prev) => !prev); playSfx('click'); } };
    const onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = false; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = false; if (k === 's' || e.key === 'ArrowDown') s.keys.s = false; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = false; if (e.key === 'Shift') s.keys.shift = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [showIntro, handleReload, handleToggleCar, handleToggleCover, handleJump, playSfx]);
  useEffect(() => {
    if (showIntro) return; const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; let animId: number;
    const handleResize = () => { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; gameStateRef.current.screenDim = { w: canvas.width, h: canvas.height }; }; handleResize(); window.addEventListener('resize', handleResize);
    const onMouseMove = (e: MouseEvent) => { const rect = canvas.getBoundingClientRect(); gameStateRef.current.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }; gameStateRef.current.isMouseActive = true; };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = true; shootPlayerLaser(); } };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = false; } };
    canvas.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);
    const loop = () => {
      const s = gameStateRef.current; const p = s.player; const now = Date.now();
      if (s.keys.mouseLeft) { shootPlayerLaser(); }
      if (now - s.lastSpawnTime >= 5000) {
        s.lastSpawnTime = now; const edge = cityData.gangsterSpawnEdges[Math.floor(Math.random() * cityData.gangsterSpawnEdges.length)]; const isBus = Math.random() > 0.5;
        s.gangsters.push({ id: `gangster_${Date.now()}_${Math.random()}`, type: isBus ? 'fighter_bus' : 'fighter_motor', x: edge.x, y: edge.y, vx: 0, vy: 0, health: 3, maxHealth: 3, speed: isBus ? 1.8 : 3.2, facingAngle: 0, gun: isBus ? 'shotgun_laser' : 'ak_laser', lastShootTime: now, vehicleType: isBus ? 'bus' : 'motorcycle' });
      }
      if (p.isJumping) { p.jumpOffset += p.jumpVy; p.jumpVy -= 0.65; if (p.jumpOffset <= 0) { p.jumpOffset = 0; p.jumpVy = 0; p.isJumping = false; } }
      let nearCarFound = false; for (const car of s.cars) { if (Math.hypot(car.x - p.x, car.y - p.y) < 75) { nearCarFound = true; break; } } setHudIsNearCar((prev) => (prev !== nearCarFound ? nearCarFound : prev));
      const isSprinting = s.keys.shift || s.isRunActive;
      if (p.inCarId) {
        const car = s.cars.find((c) => c.id === p.inCarId); if (car) { const driveSpeed = isSprinting ? 7.5 : 5.0; if (s.joystickMovement.isMoving) { car.x += s.joystickMovement.dx * driveSpeed; car.y += s.joystickMovement.dy * driveSpeed; } else { if (s.keys.w) car.y -= driveSpeed; if (s.keys.s) car.y += driveSpeed; if (s.keys.a) car.x -= driveSpeed; if (s.keys.d) car.x += driveSpeed; } car.x = Math.max(80, Math.min(cityData.mapWidth - 80, car.x)); car.y = Math.max(80, Math.min(cityData.mapHeight - 80, car.y)); p.x = car.x; p.y = car.y; }
      } else {
        const moveSpeed = isSprinting ? p.speed * 1.65 : p.speed; let dx = 0; let dy = 0; if (s.joystickMovement.isMoving) { dx = s.joystickMovement.dx; dy = s.joystickMovement.dy; if (!s.isMouseActive) { p.facingAngle = Math.atan2(dy, dx); } } else { if (s.keys.w) dy -= 1; if (s.keys.s) dy += 1; if (s.keys.a) dx -= 1; if (s.keys.d) dx += 1; if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; } }
        const nextX = p.x + dx * moveSpeed; const nextY = p.y + dy * moveSpeed; const hit = isPointInsideBuilding(nextX, nextY, cityData.buildings, 12); if (!hit.inside || hit.nearDoor || p.jumpOffset > 15) { p.x = Math.max(40, Math.min(cityData.mapWidth - 40, nextX)); p.y = Math.max(40, Math.min(cityData.mapHeight - 40, nextY)); }
      }
      const cameraX = Math.max(0, Math.min(cityData.mapWidth - s.screenDim.w, p.x - s.screenDim.w / 2)); const cameraY = Math.max(0, Math.min(cityData.mapHeight - s.screenDim.h, p.y - s.screenDim.h / 2));
      if (s.isMouseActive) { const playerScreenX = p.x - cameraX; const playerScreenY = p.y - cameraY; p.facingAngle = Math.atan2(s.mousePos.y - playerScreenY, s.mousePos.x - playerScreenX); }
      s.cars.forEach((car) => { if (!car.isOccupied) { if (car.direction === 'horizontal') { car.x += car.vx; if (car.x > cityData.mapWidth + 80) car.x = -80; if (car.x < -80) car.x = cityData.mapWidth + 80; } else { car.y += car.vy; if (car.y > cityData.mapHeight + 80) car.y = -80; if (car.y < -80) car.y = cityData.mapHeight + 80; } } });
      s.civilians.forEach((civ) => {
        let threatNear = false; let threatX = 0; let threatY = 0; for (const g of s.gangsters) { const d = Math.hypot(g.x - civ.x, g.y - civ.y); if (d < 110) { threatNear = true; threatX = g.x; threatY = g.y; break; } }
        if (threatNear) { civ.state = 'scared'; const awayAngle = Math.atan2(civ.y - threatY, civ.x - threatX); civ.x += Math.cos(awayAngle) * 2.8; civ.y += Math.sin(awayAngle) * 2.8; civ.facingAngle = awayAngle; } else { if (civ.state === 'scared') { civ.state = 'saved'; setCiviliansSavedCount((c) => c + 1); p.coins += 2; setHudCoins(p.coins); } civ.x += Math.cos(civ.facingAngle) * civ.speed; civ.y += Math.sin(civ.facingAngle) * civ.speed; if (Math.random() < 0.02) { civ.facingAngle += (Math.random() - 0.5) * 1.5; } } civ.x = Math.max(80, Math.min(cityData.mapWidth - 80, civ.x)); civ.y = Math.max(80, Math.min(cityData.mapHeight - 80, civ.y));
      });
      for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
        const g = s.gangsters[gIdx]; let targetX = p.x; let targetY = p.y; let targetDist = Math.hypot(p.x - g.x, p.y - g.y); for (const c of s.civilians) { const cDist = Math.hypot(c.x - g.x, c.y - g.y); if (cDist < targetDist) { targetDist = cDist; targetX = c.x; targetY = c.y; } }
        const aimAngle = Math.atan2(targetY - g.y, targetX - g.x); g.facingAngle = aimAngle; g.x += Math.cos(aimAngle) * g.speed; g.y += Math.sin(aimAngle) * g.speed;
        if (targetDist < 260 && now - g.lastShootTime >= 650) { g.lastShootTime = now; const beamLen = 320; const laserEndX = g.x + Math.cos(aimAngle) * beamLen; const laserEndY = g.y + Math.sin(aimAngle) * beamLen; s.lasers.push({ id: `laser_g_${now}_${Math.random()}`, x1: g.x + Math.cos(aimAngle) * 16, y1: g.y + Math.sin(aimAngle) * 16, x2: laserEndX, y2: laserEndY, color: '#EF4444', life: 6, maxLife: 6, isPlayer: false, damage: 10 }); if (targetDist < 350) { playSfx('shoot'); } }
      }
      for (let lIdx = s.lasers.length - 1; lIdx >= 0; lIdx--) {
        const l = s.lasers[lIdx]; l.life -= 1;
        if (l.isPlayer) {
          let hitSomething = false;
          for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
            const g = s.gangsters[gIdx]; const dist = Math.hypot(g.x - l.x2, g.y - l.y2);
            if (dist < 75) { g.health -= 1; for (let sp = 0; sp < 6; sp++) { s.sparks.push({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, color: l.color, life: 16 }); } s.lasers.splice(lIdx, 1); hitSomething = true; if (g.health <= 0) { s.gangsters.splice(gIdx, 1); p.coins += 5; setHudCoins(p.coins); setGangstersKilledCount((k) => k + 1); addGameCoins(5, '+5 SC - Gangster Neutralized!', 'task_reward'); playSfx('coin'); } break; }
          }
          if(hitSomething) continue;
          for (let cIdx = s.cars.length - 1; cIdx >= 0; cIdx--) {
            const car = s.cars[cIdx]; const dist = Math.hypot(car.x - l.x2, car.y - l.y2);
            if (dist < 60) {
              car.health -= 1;
              for (let sp = 0; sp < 3; sp++) { s.sparks.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, color: '#f97316', life: 12 }); }
              s.lasers.splice(lIdx, 1);
              if (car.health <= 0) {
                for (let sp = 0; sp < 15; sp++) { s.sparks.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, color: sp % 2 === 0 ? '#ff0000' : '#ffaa00', life: 25 }); }
                s.cars.splice(cIdx, 1);
                p.coins += 20;
                setHudCoins(p.coins);
                addGameCoins(20, '+20 SC - Car Destroyed!', 'task_reward');
                playSfx('coin');
              }
              break;
            }
          }
        } else {
          const distToPlayer = Math.hypot(p.x - l.x2, p.y - l.y2);
          if (distToPlayer < 42) {
            const isDriver = !!p.inCarId; let appliedDamage = 10; if (p.isCover) appliedDamage = 1; else if (isDriver) appliedDamage = 3;
            p.health = Math.max(0, p.health - appliedDamage); setHudHealth(p.health); s.lasers.splice(lIdx, 1);
            for (let sp = 0; sp < 4; sp++) { s.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, color: '#38BDF8', life: 12 }); }
            if (p.health <= 0) { playSfx('siren'); onToast(t('player_down')); p.health = 100; p.x = 1900; p.y = 1800; setHudHealth(100); }
          }
        }
        if (l.life <= 0 && s.lasers[lIdx]) { s.lasers.splice(lIdx, 1); }
      }
      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) { const sp = s.sparks[spIdx]; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 1; if (sp.life <= 0) s.sparks.splice(spIdx, 1); }
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-cameraX, -cameraY);
      ctx.fillStyle = cityData.theme.groundGrassColor; ctx.fillRect(0, 0, cityData.mapWidth, cityData.mapHeight);
      cityData.roads.forEach((road) => { ctx.fillStyle = cityData.theme.asphaltColor; ctx.fillRect(road.x, road.y, road.width, road.height); ctx.strokeStyle = cityData.theme.curbColor; ctx.lineWidth = 4; ctx.strokeRect(road.x, road.y, road.width, road.height); ctx.strokeStyle = cityData.theme.roadMarkingColor; ctx.lineWidth = 2.5; ctx.setLineDash([25, 25]); if (road.direction === 'horizontal') { const midY = road.y + road.height / 2; ctx.beginPath(); ctx.moveTo(road.x, midY); ctx.lineTo(road.x + road.width, midY); ctx.stroke(); } else { const midX = road.x + road.width / 2; ctx.beginPath(); ctx.moveTo(midX, road.y); ctx.lineTo(midX, road.y + road.height); ctx.stroke(); } ctx.setLineDash([]); });
      cityData.compounds.forEach((comp) => { ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; ctx.fillRect(comp.x, comp.y, comp.width, comp.height); ctx.strokeStyle = comp.fenceColor; ctx.lineWidth = 6; ctx.strokeRect(comp.x, comp.y, comp.width, comp.height); comp.gates.forEach((gate) => { ctx.clearRect(gate.x, gate.y, gate.width, gate.height); ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 2; ctx.strokeRect(gate.x, gate.y, gate.width, gate.height); }); });
      cityData.buildings.forEach((bld) => { ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(bld.x + 8, bld.y + 12, bld.width, bld.height); ctx.fillStyle = bld.wallColor; ctx.fillRect(bld.x, bld.y, bld.width, bld.height); ctx.strokeStyle = bld.roofColor; ctx.lineWidth = 5; ctx.strokeRect(bld.x + 6, bld.y + 6, bld.width - 12, bld.height - 12); ctx.fillStyle = '#FFD700'; ctx.fillRect(bld.door.x, bld.door.y, bld.door.width, bld.door.height); ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(bld.name, bld.x + 14, bld.y + 24); });
      s.cars.forEach((car) => { ctx.save(); ctx.translate(car.x, car.y); ctx.fillStyle = car.color; ctx.beginPath(); ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6); ctx.fill(); ctx.fillStyle = '#0F172A'; ctx.fillRect(-car.width / 4, -car.height / 4, car.width / 2, car.height / 2); ctx.fillStyle = '#FEF08A'; if (car.direction === 'horizontal') { ctx.fillRect(car.width / 2 - 3, -car.height / 2 + 2, 4, 4); ctx.fillRect(car.width / 2 - 3, car.height / 2 - 6, 4, 4); } else { ctx.fillRect(-car.width / 2 + 2, car.height / 2 - 3, 4, 4); ctx.fillRect(car.width / 2 - 6, car.height / 2 - 3, 4, 4); } ctx.restore(); });
      function drawHuman(ctx: any, x: number, y: number, angle: number, shirtColor: string, type: string, hasGun: boolean, isShield: boolean) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = type === 'gangster' ? '#111827' : '#1E293B'; ctx.fillRect(-4, 7, 3.5, 11); ctx.fillRect(1.5, 7, 3.5, 11);
        ctx.fillStyle = '#000'; ctx.fillRect(-4.5, 17, 5, 2.5); ctx.fillRect(1, 17, 5, 2.5);
        ctx.fillStyle = shirtColor; ctx.beginPath(); ctx.roundRect(-8, -7, 16, 16, 3); ctx.fill();
        ctx.fillStyle = '#FDBA74'; ctx.fillRect(-9, -4, 3, 10);
        ctx.save(); ctx.translate(6, -1); ctx.rotate(0.15); ctx.fillStyle = '#FDBA74'; ctx.fillRect(0, -2, 8, 3); if (hasGun) { ctx.fillStyle = '#1F2937'; ctx.fillRect(7, -2, 18, 3); } ctx.restore();
        ctx.fillStyle = '#FDBA74'; ctx.beginPath(); ctx.arc(0, -12, 7, 0, Math.PI * 2); ctx.fill();
        if (type === 'gangster') { ctx.fillStyle = '#000'; ctx.fillRect(-7, -14, 14, 4); ctx.fillStyle = '#DC2626'; ctx.fillRect(-7, -12, 14, 2); } else { ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0, -17, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (isShield) { ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 3; ctx.shadowColor = '#38BDF8'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(56,189,248,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore(); }
      }
      s.civilians.forEach((civ) => {
        const isScared = civ.state === 'scared'; drawHuman(ctx, civ.x, civ.y, civ.facingAngle, isScared ? '#F87171' : civ.color, 'civilian', false, false);
        if (isScared) { ctx.fillStyle = '#EF4444'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('!', civ.x - 4, civ.y - 26); }
      });
      s.gangsters.forEach((g) => {
        if (g.vehicleType === 'bus') {
          ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle);
          ctx.fillStyle = '#7F1D1D'; ctx.beginPath(); ctx.roundRect(-34, -20, 68, 40, 8); ctx.fill();
          ctx.fillStyle = '#1F2937'; ctx.fillRect(-26, -14, 12, 8); ctx.fillRect(-8, -14, 12, 8); ctx.fillRect(10, -14, 12, 8);
          ctx.fillStyle = '#FEF08A'; ctx.fillRect(32, -8, 4, 4); ctx.fillRect(32, 6, 4, 4); ctx.restore();
          drawHuman(ctx, g.x - 10, g.y, g.facingAngle, '#991B1B', 'gangster', true, false);
          drawHuman(ctx, g.x + 14, g.y, g.facingAngle, '#DC2626', 'gangster', true, false);
        } else {
          ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle); ctx.fillStyle = '#18181B'; ctx.beginPath(); ctx.roundRect(-16, -5, 32, 10, 4); ctx.fill(); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI*2); ctx.arc(10, 0, 5, 0, Math.PI*2); ctx.fill(); ctx.restore();
          drawHuman(ctx, g.x, g.y - 4, g.facingAngle, '#DC2626', 'gangster', true, false);
        }
        ctx.fillStyle = '#000'; ctx.fillRect(g.x - 16, g.y - 34, 32, 5); ctx.fillStyle = g.vehicleType === 'bus' ? '#FACC15' : '#EF4444'; ctx.fillRect(g.x - 16, g.y - 34, 32 * (g.health / g.maxHealth), 5);
      });
      s.sparks.forEach((sp) => { ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.8, 0, Math.PI * 2); ctx.fill(); });
      s.lasers.forEach((l) => { ctx.save(); ctx.strokeStyle = l.color; ctx.shadowColor = l.color; ctx.shadowBlur = 14; ctx.lineWidth = l.isPlayer ? 3.8 : 2.8; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); ctx.restore(); });
      if (!p.inCarId) {
        ctx.save(); ctx.translate(p.x, p.y - (p.jumpOffset || 0)); ctx.fillStyle = 'rgba(0,0,0,0.4)'; const shadowScale = Math.max(0.4, 1 - (p.jumpOffset || 0) / 45); ctx.beginPath(); ctx.ellipse(0, 12, 14 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        drawHuman(ctx, p.x, p.y - (p.jumpOffset || 0), p.facingAngle, avatarColor, 'player', true, p.isCover);
      }
      ctx.restore();
      const mmSize = 62; const mmX = s.screenDim.w - mmSize - 12; const mmY = s.screenDim.h - mmSize - 190;
      ctx.save(); ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.beginPath(); ctx.roundRect(mmX, mmY, mmSize, mmSize, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.6)'; s.civilians.forEach((c) => { const cx = mmX + (c.x / cityData.mapWidth) * mmSize; const cy = mmY + (c.y / cityData.mapHeight) * mmSize; ctx.fillRect(cx - 1, cy - 1, 1.5, 1.5); });
      ctx.fillStyle = '#EF4444'; s.gangsters.forEach((g) => { const gx = mmX + (g.x / cityData.mapWidth) * mmSize; const gy = mmY + (g.y / cityData.mapHeight) * mmSize; ctx.beginPath(); ctx.arc(gx, gy, 1.8, 0, Math.PI * 2); ctx.fill(); });
      const px = mmX + (p.x / cityData.mapWidth) * mmSize; const py = mmY + (p.y / cityData.mapHeight) * mmSize; ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(px, py, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'right'; ctx.fillText('RADAR', mmX + mmSize - 4, mmY + mmSize - 4); ctx.restore();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize); canvas.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); };
  }, [showIntro, cityData, avatarColor, playerTeam, shootPlayerLaser, playSfx, onToast, t]);
  if (showIntro) { return (<StreetGangStarIntro language={language} cityName={cityData.cityName} streetName={cityData.streetName} onStartGame={handleStartFromIntro} onBack={onBack} />); }
  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-1 max-w-[185px] scale-[0.75] origin-top-left pointer-events-none">
        <div className="p-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { playSfx('click'); onBack(); }} type="button" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-white active:scale-95 transition-all"><ArrowLeft className="w-4 h-4 text-[#FFD700]" /></button>
            <div><div className="flex items-center gap-1.5"><span className="text-xs font-black uppercase text-white tracking-wider">{cityData.streetName}</span><span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${playerTeam === 'blue' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>{playerTeam === 'blue' ? 'BLUE' : 'RED'}</span></div><p className="text-[10px] text-gray-400">{cityData.cityName}</p></div>
          </div><button onClick={() => setSoundEnabled((prev) => !prev)} type="button" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-gray-300">{soundEnabled ? <Volume2 className="w-4 h-4 text-[#FFD700]" /> : <VolumeX className="w-4 h-4 text-red-400" />}</button>
        </div>
        <div className="p-2.5 rounded-2xl bg-black/85 border border-[#FFD700]/30 backdrop-blur-md shadow-xl space-y-2">
          <div><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1"><span className="flex items-center gap-1 text-red-400"><Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /><span>{t('health')}</span></span><span className="font-mono text-white">{hudHealth}%</span></div><div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-200" style={{ width: `${Math.max(0, Math.min(100, hudHealth))}%` }} /></div></div>
          <div><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1"><span className="flex items-center gap-1 text-[#FFD700]"><Zap className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" /><span>{t('ammo')}</span></span><span className="font-mono text-white">{hudAmmo} / {hudMaxAmmo}</span></div><div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-amber-500 to-[#FFD700] transition-all duration-200" style={{ width: `${Math.max(0, Math.min(100, (hudAmmo / hudMaxAmmo) * 100))}%` }} /></div></div>
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] font-mono"><div className="flex items-center gap-1 text-[#FFD700] font-black"><Coins className="w-3.5 h-3.5" /><span>{hudCoins} SC</span></div><span className="text-[10px] text-gray-400 font-bold">K:{gangstersKilledCount} S:{civiliansSavedCount}</span></div>
          <div className="flex items-center gap-1.5 pt-1">{hudInCover && (<span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/30 text-sky-300 border border-sky-400 animate-pulse">🛡️ SHIELD ACTIVE</span>)}{hudInCar && (<span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">DRIVING [E]</span>)}</div>
        </div>
      </div>
      <div className="absolute top-3 right-24 z-30 flex items-center gap-2 pointer-events-auto">
        <button onClick={() => { playSfx('click'); setShowShopModal(true); }} type="button" className="px-3 py-2 rounded-2xl bg-black/85 border border-[#FFD700]/70 text-[#FFD700] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,215,0,0.25)] active:scale-95 transition-all cursor-pointer backdrop-blur-md"><ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">SHOP [B]</span></button>
        <button onClick={() => { playSfx('click'); setShowAvatarModal(true); }} type="button" className="p-2 rounded-2xl bg-black/85 border border-white/20 text-white font-black text-xs uppercase active:scale-95 transition-all cursor-pointer hover:border-[#FFD700] backdrop-blur-md"><Users className="w-4 h-4" /></button>
      </div>
      <StreetJoystick onMove={(movement) => { gameStateRef.current.joystickMovement = movement; if (movement.isMoving) { gameStateRef.current.isMouseActive = false; } }} onJump={handleJump} onShoot={shootPlayerLaser} onRunToggle={(running) => { gameStateRef.current.isRunActive = running; }} onHijackOrEnterCar={handleToggleCar} isNearCar={hudIsNearCar} isInCar={hudInCar} isCover={hudInCover} onCoverToggle={handleToggleCover} onReload={handleReload} ammo={hudAmmo} maxAmmo={hudMaxAmmo} />
      {showShopModal && (<div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-[#FFD700] p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)] text-left relative animate-in zoom-in-95"><div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4"><div className="flex items-center gap-2 text-[#FFD700]"><ShoppingBag className="w-5 h-5" /><h3 className="text-base font-black uppercase tracking-wider">{t('gun_shop')}</h3></div><button onClick={() => setShowShopModal(false)} type="button" className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button></div><div className="space-y-2.5">{(Object.keys(WEAPONS) as WeaponType[]).map((wKey) => { const w = WEAPONS[wKey]; const isOwned = gameStateRef.current.unlockedGuns[wKey]; const isEquipped = hudGun === wKey; return (<div key={wKey} className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${isEquipped ? 'bg-[#FFD700]/15 border-[#FFD700]' : 'bg-black/60 border-white/10'}`}><div><h4 className="text-xs font-black text-white">{t(w.nameKey)}</h4><p className="text-[10px] text-gray-400">DMG: {w.damage} | Ammo: {w.maxAmmo}</p></div>{isEquipped ? (<span className="text-[10px] font-mono text-[#FFD700] font-black uppercase">EQUIPPED</span>) : isOwned ? (<button onClick={() => { gameStateRef.current.player.gun = wKey; gameStateRef.current.player.ammo = w.maxAmmo; gameStateRef.current.player.maxAmmo = w.maxAmmo; setHudGun(wKey); setHudAmmo(w.maxAmmo); setHudMaxAmmo(w.maxAmmo); playSfx('click'); setShowShopModal(false); }} type="button" className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase active:scale-95">EQUIP</button>) : (<button onClick={() => handleBuyWeapon(wKey)} type="button" className="px-3 py-1.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 hover:brightness-110 shadow-md">{w.price} SC</button>)}</div>); })}</div></div></div>)}
      {showAvatarModal && (<div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left relative animate-in zoom-in-95"><div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4"><h3 className="text-sm font-black uppercase tracking-wider text-white">{t('customize_avatar')}</h3><button onClick={() => setShowAvatarModal(false)} type="button" className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button></div><div className="mb-4"><span className="text-xs font-bold text-gray-300 block mb-2">{t('choose_color')}</span><div className="flex items-center gap-2">{['#FFD700', '#22C55E', '#3B82F6', '#EF4444', '#A855F7', '#E2E8F0'].map((col) => (<button key={col} onClick={() => { setAvatarColor(col); if (typeof window !== 'undefined') { localStorage.setItem('gangstar_avatar_color', col); } playSfx('click'); }} type="button" className={`w-9 h-9 rounded-2xl border-2 transition-all cursor-pointer ${avatarColor === col ? 'scale-110 border-white shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: col }} />))}</div></div><button onClick={() => setShowAvatarModal(false)} type="button" className="w-full py-3 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30">{t('close')}</button></div></div>)}
      {showTeamModal && (<div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left relative animate-in zoom-in-95"><div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4"><h3 className="text-sm font-black uppercase tracking-wider text-white">{t('team_join')}</h3><button onClick={() => setShowTeamModal(false)} type="button" className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button></div><div className="space-y-3"><button onClick={() => { setPlayerTeam('blue'); setShowTeamModal(false); playSfx('click'); onToast('Joined Blue Syndicate Defend Team!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left transition-all ${playerTeam === 'blue' ? 'bg-sky-950/60 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-sky-400">{t('team_blue')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_blue_desc')}</p></button><button onClick={() => { setPlayerTeam('red'); setShowTeamModal(false); playSfx('click'); onToast('Joined Red Corsairs Free-For-All!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left transition-all ${playerTeam === 'red' ? 'bg-red-950/60 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-red-400">{t('team_red')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_red_desc')}</p></button></div></div></div>)}
    </div>
  );
}
