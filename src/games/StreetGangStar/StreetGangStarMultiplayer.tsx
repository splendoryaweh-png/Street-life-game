'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Shield, Zap, Crosshair, RotateCcw, Volume2, VolumeX, Heart, Coins, Car, ShoppingBag, MapPin, X, ArrowLeft, Users, Copy, Check, Trophy, Flame, Radio, Send, Sparkles } from 'lucide-react';
import { playShootSound, playReloadSound, playPickupSound, playCoinSound, playSuccessSound, playSirenSound, playClickSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { getRandomCityByCountry, CityData, isPointInsideBuilding } from './CityGenerator';
import { getGangStarText, GangStarTextKey } from './language';
import { WEAPONS, WeaponType, CityCar, Civilian, Gangster, LaserBeam, SparkParticle } from './StreetGangStar';
import { GangChat } from './GangChat';
import { StreetJoystick } from './StreetJoystick';

export interface RemotePlayer { id: string; name: string; x: number; y: number; targetX: number; targetY: number; facingAngle: number; health: number; maxHealth: number; team: 'blue' | 'red'; gun: WeaponType; avatarColor: string; isCover: boolean; inCarId: string | null; jumpOffset?: number; lastReaction?: { emoji: string; until: number }; lastSeen: number; hitCount?: number; }
export interface MultiplayerMessage { type: 'player_sync' | 'laser_fire' | 'reaction' | 'host_sync' | 'kill_alert'; senderId: string; payload: any; }
interface StreetGangStarMultiplayerProps { onBack: () => void; onToast: (msg: string) => void; language?: string; initialCountry?: string; }

export function StreetGangStarMultiplayer({ onBack, onToast, language = 'en', initialCountry = 'NG' }: StreetGangStarMultiplayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = useCallback((key: GangStarTextKey) => getGangStarText(language, key), [language]);
  const [inLobby, setInLobby] = useState<boolean>(true);
  const [roomCode, setRoomCode] = useState<string>('');
  const [customRoomInput, setCustomRoomInput] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myPlayerId] = useState<string>(() => `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const [myPlayerName] = useState<string>(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem('streetlife_username'); if (saved) return saved; } return `Hustler_${Math.floor(100 + Math.random() * 900)}`; });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [myTeam, setMyTeam] = useState<'blue' | 'red'>('blue');
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cityData, setCityData] = useState<CityData>(() => getRandomCityByCountry(initialCountry, roomCode || 'STREET_DEFAULT'));
  const [hudHealth, setHudHealth] = useState<number>(100);
  const [hudAmmo, setHudAmmo] = useState<number>(30);
  const [hudMaxAmmo, setHudMaxAmmo] = useState<number>(30);
  const [hudCoins, setHudCoins] = useState<number>(0);
  const [hudGun, setHudGun] = useState<WeaponType>('pistol');
  const [hudInCover, setHudInCover] = useState<boolean>(false);
  const [hudInCar, setHudInCar] = useState<boolean>(false);
  const [hudIsNearCar, setHudIsNearCar] = useState<boolean>(false);
  const [activePlayerCount, setActivePlayerCount] = useState<number>(1);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const gameStateRef = useRef({
    player: { id: myPlayerId, name: myPlayerName, team: 'blue' as 'blue' | 'red', x: 1900, y: 1800, vx: 0, vy: 0, speed: 4.5, health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, gun: 'pistol' as WeaponType, coins: 0, facingAngle: 0, isCover: false, inCarId: null as string | null, lastShootTime: 0, isReloading: false, kills: 0, civiliansSaved: 0, jumpOffset: 0, jumpVy: 0, isJumping: false, hitCount: 0 },
    remotePlayers: new Map<string, RemotePlayer>(),
    unlockedGuns: { pistol: true, shotgun_laser: false, ak_laser: false, sniper_laser: false } as Record<WeaponType, boolean>,
    cars: [] as (CityCar & { health: number; maxHealth: number })[], civilians: [] as Civilian[], gangsters: [] as Gangster[], lasers: [] as LaserBeam[], sparks: [] as SparkParticle[],
    keys: { w: false, a: false, s: false, d: false, shift: false, mouseLeft: false },
    joystickMovement: { dx: 0, dy: 0, isMoving: false }, isRunActive: false, isMouseActive: false, mousePos: { x: 0, y: 0 }, screenDim: { w: 800, h: 600 }, lastSpawnTime: Date.now(), lastBroadcastTime: 0, myReaction: null as { emoji: string; until: number } | null, isRunning: false,
  });

  const playSfx = useCallback((name: 'shoot' | 'reload' | 'pickup' | 'coin' | 'success' | 'siren' | 'click') => {
    if (!soundEnabled) return;
    if (name === 'shoot') playShootSound(); else if (name === 'reload') playReloadSound(); else if (name === 'pickup') playPickupSound(); else if (name === 'coin') playCoinSound(); else if (name === 'success') playSuccessSound(); else if (name === 'siren') playSirenSound(); else if (name === 'click') playClickSound();
  }, [soundEnabled]);

  const createRoom = () => {
    playClickSound(); const code = `STREET${Math.floor(100 + Math.random() * 900)}`; setRoomCode(code); setIsHost(true);
    try { const saved = JSON.parse(localStorage.getItem('gangstar_rooms') || '[]'); saved.push({ code, status: 'playing', createdAt: Date.now() }); localStorage.setItem('gangstar_rooms', JSON.stringify(saved.slice(-10))); } catch {}
    connectToRoom(code, true);
  };
  const joinRandomCity = () => {
    playClickSound(); let targetCode = ''; try { const saved = JSON.parse(localStorage.getItem('gangstar_rooms') || '[]'); const active = saved.filter((r: any) => Date.now() - r.createdAt < 30 * 60 * 1000); if (active.length > 0) { targetCode = active[Math.floor(Math.random() * active.length)].code; } } catch {}
    if (!targetCode) { targetCode = `STREET${Math.floor(100 + Math.random() * 900)}`; setIsHost(true); } else { setIsHost(false); }
    setRoomCode(targetCode); connectToRoom(targetCode, isHost);
  };
  const joinWithCode = (e: React.FormEvent) => {
    e.preventDefault(); const cleaned = customRoomInput.toUpperCase().trim(); if (!cleaned) { onToast('Please enter a valid room code!'); return; }
    playClickSound(); setRoomCode(cleaned); setIsHost(false); connectToRoom(cleaned, false);
  };

  const connectToRoom = (code: string, hostStatus: boolean) => {
    if (channelRef.current) { channelRef.current.close(); }
    const channelName = `gangstar_${code}`; const channel = new BroadcastChannel(channelName); channelRef.current = channel;
    const newCity = getRandomCityByCountry(initialCountry, code); setCityData(newCity);
    if (hostStatus) {
      const s = gameStateRef.current; const cars: any[] = []; const colors = ['#38BDF8', '#F97316', '#A855F7', '#EF4444', '#10B981', '#E2E8F0', '#FACC15'];
      newCity.roads.forEach((road, idx) => { if (idx < 10) { const isHoriz = road.direction === 'horizontal'; cars.push({ id: `car_${idx}`, x: isHoriz ? (idx * 380) % newCity.mapWidth : road.x + 30, y: isHoriz ? road.y + 40 : (idx * 380) % newCity.mapHeight, vx: isHoriz ? 2.8 : 0, vy: isHoriz ? 0 : 2.8, speed: 2.8, direction: road.direction, width: isHoriz ? 54 : 30, height: isHoriz ? 30 : 54, color: colors[idx % colors.length], isOccupied: false, hasDriver: true, driverType: 'civilian', health: 10, maxHealth: 10 }); } }); s.cars = cars;
      const civs: Civilian[] = []; const civColors = ['#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#64748B'];
      for (let i = 0; i < 15; i++) { civs.push({ id: `civ_${i}`, x: 1200 + ((i * 170) % 1800), y: 1100 + ((i * 190) % 1800), vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, speed: 1.2, facingAngle: Math.random() * Math.PI * 2, state: 'walking', color: civColors[i % civColors.length] }); } s.civilians = civs;
    }
    channel.onmessage = (event: MessageEvent<MultiplayerMessage>) => {
      const msg = event.data; if (!msg || msg.senderId === myPlayerId) return; const s = gameStateRef.current;
      if (msg.type === 'player_sync') {
        const payload = msg.payload; const existing = s.remotePlayers.get(msg.senderId);
        if (existing) { existing.name = payload.name; existing.targetX = payload.x; existing.targetY = payload.y; existing.facingAngle = payload.facingAngle; existing.health = payload.health; existing.team = payload.team; existing.gun = payload.gun; existing.avatarColor = payload.avatarColor; existing.isCover = payload.isCover; existing.inCarId = payload.inCarId; existing.jumpOffset = payload.jumpOffset || 0; existing.lastSeen = Date.now(); }
        else { s.remotePlayers.set(msg.senderId, { id: msg.senderId, name: payload.name, x: payload.x, y: payload.y, targetX: payload.x, targetY: payload.y, facingAngle: payload.facingAngle, health: payload.health ?? 100, maxHealth: 3, team: payload.team, gun: payload.gun, avatarColor: payload.avatarColor, isCover: payload.isCover, inCarId: payload.inCarId, jumpOffset: payload.jumpOffset || 0, lastSeen: Date.now(), hitCount: 0 }); }
        setActivePlayerCount(s.remotePlayers.size + 1);
      } else if (msg.type === 'laser_fire') {
        const p = msg.payload; s.lasers.push({ id: `laser_${Date.now()}_${Math.random()}`, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, color: p.color, life: 7, maxLife: 7, isPlayer: false, damage: p.damage });
      } else if (msg.type === 'reaction') {
        const rem = s.remotePlayers.get(msg.senderId); if (rem) { rem.lastReaction = { emoji: msg.payload.emoji, until: Date.now() + 2000 }; }
      } else if (msg.type === 'host_sync' && !isHost) { s.cars = msg.payload.cars || s.cars; s.civilians = msg.payload.civilians || s.civilians; s.gangsters = msg.payload.gangsters || s.gangsters; }
    };
    setInLobby(false); gameStateRef.current.isRunning = true; playSuccessSound(); onToast(`Connected to District Lobby: ${code}!`);
  };

  const handleSendReaction = (emoji: string) => {
    playClickSound(); const s = gameStateRef.current; s.myReaction = { emoji, until: Date.now() + 2000 };
    if (channelRef.current) { channelRef.current.postMessage({ type: 'reaction', senderId: myPlayerId, payload: { emoji } }); }
  };
  const handleReload = useCallback(() => {
    const s = gameStateRef.current; if (s.player.isReloading) return; const wDef = WEAPONS[s.player.gun]; if (s.player.ammo >= wDef.maxAmmo) return;
    s.player.isReloading = true; playSfx('reload'); onToast(t('reload_alert'));
    setTimeout(() => { s.player.ammo = wDef.maxAmmo; s.player.isReloading = false; setHudAmmo(wDef.maxAmmo); }, 900);
  }, [onToast, playSfx, t]);
  const handleToggleCar = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; if (p.inCarId) { const car = s.cars.find((c) => c.id === p.inCarId); if (car) { car.isOccupied = false; car.hasDriver = false; car.driverType = null; p.x = car.x + 30; p.y = car.y + 30; } p.inCarId = null; setHudInCar(false); playSfx('click'); onToast(t('car_exit')); return; }
    let nearestCar: any = null; let minDist = 70; for (const c of s.cars) { const dist = Math.hypot(c.x - p.x, c.y - p.y); if (dist < minDist) { minDist = dist; nearestCar = c; } }
    if (nearestCar) { if (nearestCar.hasDriver && nearestCar.driverType === 'civilian') { nearestCar.hasDriver = false; nearestCar.driverType = 'player'; nearestCar.isOccupied = true; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('siren'); onToast(t('car_hijacked')); } else if (!nearestCar.isOccupied) { nearestCar.isOccupied = true; nearestCar.hasDriver = true; nearestCar.driverType = 'player'; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('click'); onToast(t('car_enter')); } }
  }, [onToast, playSfx, t]);
  const handleToggleCover = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; let nearObstacle = false;
    for (const bld of cityData.buildings) { if (p.x >= bld.x - 40 && p.x <= bld.x + bld.width + 40 && p.y >= bld.y - 40 && p.y <= bld.y + bld.height + 40) { nearObstacle = true; break; } }
    if (!nearObstacle) { for (const car of s.cars) { if (Math.hypot(car.x - p.x, car.y - p.y) < 65) { nearObstacle = true; break; } } }
    if (nearObstacle) { p.isCover = !p.isCover; setHudInCover(p.isCover); playSfx('click'); onToast(p.isCover ? t('cover_active') : t('cover_inactive')); } else { onToast(t('cover_inactive')); }
  }, [cityData.buildings, onToast, playSfx, t]);
  const handleJump = useCallback(() => { const s = gameStateRef.current; const p = s.player; if (p.isJumping || p.inCarId) return; p.isJumping = true; p.jumpVy = 8.5; playPickupSound(); onToast('LEAP JUMP! 🚀'); }, [onToast]);
  const shootPlayerLaser = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; if (p.isReloading) return; if (p.ammo <= 0) { handleReload(); return; }
    const wDef = WEAPONS[p.gun]; const now = Date.now(); if (now - p.lastShootTime < wDef.fireRateMs) return;
    p.lastShootTime = now; p.ammo -= 1; setHudAmmo(p.ammo); playSfx('shoot');
    const startX = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.x || p.x) : p.x + Math.cos(p.facingAngle) * 22;
    const startY = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.y || p.y) : p.y + Math.sin(p.facingAngle) * 22;
    const baseAngle = p.facingAngle; const spreadAngles = wDef.spread === 3 ? [baseAngle - 0.14, baseAngle, baseAngle + 0.14] : [baseAngle];
    spreadAngles.forEach((ang) => {
      const beamLength = 480; const endX = startX + Math.cos(ang) * beamLength; const endY = startY + Math.sin(ang) * beamLength;
      s.lasers.push({ id: `laser_${now}_${Math.random()}`, x1: startX, y1: startY, x2: endX, y2: endY, color: wDef.laserColor, life: 7, maxLife: 7, isPlayer: true, damage: wDef.damage });
      if (channelRef.current) { channelRef.current.postMessage({ type: 'laser_fire', senderId: myPlayerId, payload: { x1: startX, y1: startY, x2: endX, y2: endY, color: wDef.laserColor, damage: wDef.damage, team: myTeam } }); }
    });
  }, [handleReload, myPlayerId, myTeam, playSfx]);

  useEffect(() => {
    if (inLobby) return;
    const onKeyDown = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = true; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = true; if (k === 's' || e.key === 'ArrowDown') s.keys.s = true; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = true; if (e.key === 'Shift') s.keys.shift = true; if (e.code === 'Space') handleJump(); if (k === 'r') handleReload(); if (k === 'e') handleToggleCar(); if (k === 'q') handleToggleCover(); if (k === 'b') { setShowShopModal((prev) => !prev); playSfx('click'); } if (k === 't') { setShowTeamModal((prev) => !prev); playSfx('click'); } };
    const onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = false; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = false; if (k === 's' || e.key === 'ArrowDown') s.keys.s = false; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = false; if (e.key === 'Shift') s.keys.shift = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [inLobby, handleReload, handleToggleCar, handleToggleCover, handleJump, playSfx]);

  useEffect(() => {
    if (inLobby) return; const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; let animId: number;
    const handleResize = () => { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; gameStateRef.current.screenDim = { w: canvas.width, h: canvas.height }; }; handleResize(); window.addEventListener('resize', handleResize);
    const onMouseMove = (e: MouseEvent) => { const rect = canvas.getBoundingClientRect(); gameStateRef.current.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }; gameStateRef.current.isMouseActive = true; };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = true; shootPlayerLaser(); } };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = false; } };
    canvas.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);

    const loop = () => {
      const s = gameStateRef.current; const p = s.player; const now = Date.now();
      if (s.keys.mouseLeft) { shootPlayerLaser(); }
      if (now - s.lastBroadcastTime >= 100 && channelRef.current) {
        s.lastBroadcastTime = now;
        channelRef.current.postMessage({ type: 'player_sync', senderId: myPlayerId, payload: { name: myPlayerName, x: p.x, y: p.y, facingAngle: p.facingAngle, health: p.health, team: myTeam, gun: p.gun, avatarColor: '#FFD700', isCover: p.isCover, inCarId: p.inCarId, jumpOffset: p.jumpOffset } });
        if (isHost) { channelRef.current.postMessage({ type: 'host_sync', senderId: myPlayerId, payload: { cars: s.cars, civilians: s.civilians, gangsters: s.gangsters } }); }
      }
      s.remotePlayers.forEach((rem, remId) => { rem.x += (rem.targetX - rem.x) * 0.25; rem.y += (rem.targetY - rem.y) * 0.25; if (now - rem.lastSeen > 8000) { s.remotePlayers.delete(remId); setActivePlayerCount(s.remotePlayers.size + 1); } });
      if (isHost && now - s.lastSpawnTime >= 5000) {
        s.lastSpawnTime = now; const edge = cityData.gangsterSpawnEdges[Math.floor(Math.random() * cityData.gangsterSpawnEdges.length)]; const isBus = Math.random() > 0.65;
        s.gangsters.push({ id: `gangster_${now}_${Math.random()}`, type: isBus ? 'fighter_bus' : 'fighter_motor', x: edge.x, y: edge.y, vx: 0, vy: 0, health: 3, maxHealth: 3, speed: isBus ? 1.8 : 3.2, facingAngle: 0, gun: isBus ? 'shotgun_laser' : 'ak_laser', lastShootTime: now, vehicleType: isBus ? 'bus' : 'motorcycle' });
      }
      if (p.isJumping) { p.jumpOffset += p.jumpVy; p.jumpVy -= 0.65; if (p.jumpOffset <= 0) { p.jumpOffset = 0; p.jumpVy = 0; p.isJumping = false; } }
      let nearCarFound = false; for (const car of s.cars) { if (Math.hypot(car.x - p.x, car.y - p.y) < 75) { nearCarFound = true; break; } } setHudIsNearCar((prev) => (prev !== nearCarFound ? nearCarFound : prev));
      const isSprinting = s.keys.shift || s.isRunActive;
      if (p.inCarId) {
        const car = s.cars.find((c) => c.id === p.inCarId); if (car) { const driveSpeed = isSprinting ? 7.5 : 5.0; if (s.joystickMovement.isMoving) { car.x += s.joystickMovement.dx * driveSpeed; car.y += s.joystickMovement.dy * driveSpeed; } else { if (s.keys.w) car.y -= driveSpeed; if (s.keys.s) car.y += driveSpeed; if (s.keys.a) car.x -= driveSpeed; if (s.keys.d) car.x += driveSpeed; } car.x = Math.max(80, Math.min(cityData.mapWidth - 80, car.x)); car.y = Math.max(80, Math.min(cityData.mapHeight - 80, car.y)); p.x = car.x; p.y = car.y; }
      } else {
        const moveSpeed = isSprinting ? p.speed * 1.65 : p.speed; let dx = 0; let dy = 0;
        if (s.joystickMovement.isMoving) { dx = s.joystickMovement.dx; dy = s.joystickMovement.dy; if (!s.isMouseActive) { p.facingAngle = Math.atan2(dy, dx); } } else { if (s.keys.w) dy -= 1; if (s.keys.s) dy += 1; if (s.keys.a) dx -= 1; if (s.keys.d) dx += 1; if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; } }
        const nextX = p.x + dx * moveSpeed; const nextY = p.y + dy * moveSpeed; const hit = isPointInsideBuilding(nextX, nextY, cityData.buildings, 12); if (!hit.inside || hit.nearDoor || p.jumpOffset > 15) { p.x = Math.max(40, Math.min(cityData.mapWidth - 40, nextX)); p.y = Math.max(40, Math.min(cityData.mapHeight - 40, nextY)); }
      }
      const cameraX = Math.max(0, Math.min(cityData.mapWidth - s.screenDim.w, p.x - s.screenDim.w / 2)); const cameraY = Math.max(0, Math.min(cityData.mapHeight - s.screenDim.h, p.y - s.screenDim.h / 2));
      if (s.isMouseActive) { const playerScreenX = p.x - cameraX; const playerScreenY = p.y - cameraY; p.facingAngle = Math.atan2(s.mousePos.y - playerScreenY, s.mousePos.x - playerScreenX); }

      // ===== NEW HIT LOGIC - 3 SHOTS PLAYER/ENEMY, 10 SHOTS CAR =====
      function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1); if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
      }
      for (let lIdx = s.lasers.length - 1; lIdx >= 0; lIdx--) {
        const l = s.lasers[lIdx]; l.life -= 1;
        if (l.isPlayer) {
          let hit = false;
          for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
            const g = s.gangsters[gIdx];
            if (distToSegment(g.x, g.y, l.x1, l.y1, l.x2, l.y2) < 38) {
              g.health -= 1; // 3 shots
              for (let sp = 0; sp < 6; sp++) { s.sparks.push({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, color: l.color, life: 16 }); }
              s.lasers.splice(lIdx, 1); hit = true;
              if (g.health <= 0) {
                for (let sp = 0; sp < 14; sp++) { s.sparks.push({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, color: sp % 2 ? '#ff0000' : '#ffaa00', life: 22 }); }
                s.gangsters.splice(gIdx, 1); p.coins += 5; p.kills += 1; setHudCoins(p.coins); addGameCoins(5, '+5 SC', 'task_reward'); playSfx('coin');
              }
              break;
            }
          }
          if (hit) continue;
          s.remotePlayers.forEach((rem) => {
            if (distToSegment(rem.x, rem.y, l.x1, l.y1, l.x2, l.y2) < 32) {
              rem.hitCount = (rem.hitCount || 0) + 1;
              s.sparks.push({ x: rem.x, y: rem.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color: l.color, life: 14 });
              if (rem.hitCount >= 3) {
                s.remotePlayers.delete(rem.id); p.coins += 10; setHudCoins(p.coins); addGameCoins(10, '+10 SC - Player Kill (3 shots)', 'task_reward'); playSfx('coin'); onToast(`ELIMINATED ${rem.name} - 3 SHOTS! 🔥`);
              }
              s.lasers.splice(lIdx, 1); hit = true;
            }
          });
          if (hit) continue;
          for (let cIdx = s.cars.length - 1; cIdx >= 0; cIdx--) {
            const car = s.cars[cIdx];
            if (distToSegment(car.x, car.y, l.x1, l.y1, l.x2, l.y2) < 48) {
              car.health -= 1; // 10 shots
              s.lasers.splice(lIdx, 1); hit = true;
              if (car.health <= 0) {
                for (let sp = 0; sp < 20; sp++) { s.sparks.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, color: sp % 2 ? '#ff0000' : '#ffaa00', life: 26 }); }
                s.cars.splice(cIdx, 1);
              }
              break;
            }
          }
          if (hit) continue;
        } else {
          // ENEMY HITS YOU - 3 SHOTS DIE
          if (distToSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < 32) {
            if (!p.isCover) { p.hitCount = (p.hitCount || 0) + 1; p.health = Math.max(0, 100 - p.hitCount * 33); setHudHealth(p.health); } else { p.health = Math.max(0, p.health - 1); setHudHealth(p.health); }
            s.lasers.splice(lIdx, 1);
            for (let sp = 0; sp < 5; sp++) { s.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color: '#38BDF8', life: 14 }); }
            if (p.health <= 0 || p.hitCount >= 3) { playSfx('siren'); onToast(t('player_down') + ' - 3 HITS!'); p.health = 100; p.hitCount = 0; p.x = 1900; p.y = 1800; setHudHealth(100); }
          }
        }
        if (l.life <= 0 && s.lasers[lIdx]) { s.lasers.splice(lIdx, 1); }
      }

      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) { const sp = s.sparks[spIdx]; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 1; if (sp.life <= 0) s.sparks.splice(spIdx, 1); }

      // ===== RENDER =====
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-cameraX, -cameraY);
      ctx.fillStyle = cityData.theme.groundGrassColor; ctx.fillRect(0, 0, cityData.mapWidth, cityData.mapHeight);
      cityData.roads.forEach((road) => { ctx.fillStyle = cityData.theme.asphaltColor; ctx.fillRect(road.x, road.y, road.width, road.height); ctx.strokeStyle = cityData.theme.roadMarkingColor; ctx.lineWidth = 2.5; ctx.setLineDash([25, 25]); if (road.direction === 'horizontal') { const midY = road.y + road.height / 2; ctx.beginPath(); ctx.moveTo(road.x, midY); ctx.lineTo(road.x + road.width, midY); ctx.stroke(); } else { const midX = road.x + road.width / 2; ctx.beginPath(); ctx.moveTo(midX, road.y); ctx.lineTo(midX, road.y + road.height); ctx.stroke(); } ctx.setLineDash([]); });
      cityData.buildings.forEach((bld) => { ctx.fillStyle = bld.wallColor; ctx.fillRect(bld.x, bld.y, bld.width, bld.height); ctx.strokeStyle = bld.roofColor; ctx.lineWidth = 5; ctx.strokeRect(bld.x + 6, bld.y + 6, bld.width - 12, bld.height - 12); });
      s.cars.forEach((car) => { ctx.save(); ctx.translate(car.x, car.y); ctx.fillStyle = car.color; ctx.beginPath(); ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6); ctx.fill(); ctx.fillStyle = '#0F172A'; ctx.fillRect(-car.width / 4, -car.height / 4, car.width / 2, car.height / 2); ctx.fillStyle = '#FEF08A'; if (car.direction === 'horizontal') { ctx.fillRect(car.width / 2 - 3, -car.height / 2 + 2, 4, 4); ctx.fillRect(car.width / 2 - 3, car.height / 2 - 6, 4, 4); } else { ctx.fillRect(-car.width / 2 + 2, car.height / 2 - 3, 4, 4); ctx.fillRect(car.width / 2 - 6, car.height / 2 - 3, 4, 4); } ctx.restore(); });
      s.gangsters.forEach((g) => {
        if (g.vehicleType === 'bus') { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle); ctx.fillStyle = '#7F1D1D'; ctx.beginPath(); ctx.roundRect(-34, -20, 68, 40, 8); ctx.fill(); ctx.fillStyle = '#1F2937'; ctx.fillRect(-26, -14, 12, 8); ctx.fillRect(-8, -14, 12, 8); ctx.fillRect(10, -14, 12, 8); ctx.fillStyle = '#FEF08A'; ctx.fillRect(32, -8, 4, 4); ctx.fillRect(32, 6, 4, 4); ctx.restore(); }
        else { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle); ctx.fillStyle = '#18181B'; ctx.beginPath(); ctx.roundRect(-16, -5, 32, 10, 4); ctx.fill(); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI * 2); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#000'; ctx.fillRect(g.x - 16, g.y - 34, 32, 5); ctx.fillStyle = g.vehicleType === 'bus' ? '#FACC15' : '#EF4444'; ctx.fillRect(g.x - 16, g.y - 34, 32 * (g.health / 3), 5);
      });
      s.sparks.forEach((sp) => { ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.8, 0, Math.PI * 2); ctx.fill(); });
      s.lasers.forEach((l) => { ctx.save(); ctx.strokeStyle = l.color; ctx.shadowColor = l.color; ctx.shadowBlur = 12; ctx.lineWidth = l.isPlayer ? 3.8 : 2.8; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); ctx.restore(); });

      function drawHuman(ctx: any, x: number, y: number, angle: number, shirtColor: string, isYou: boolean, team: string, jumpOffset: number, isShield: boolean) {
        ctx.save(); ctx.translate(x, y - jumpOffset); ctx.rotate(angle);
        ctx.fillStyle = isYou ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'; const shScale = Math.max(0.4, 1 - jumpOffset / 45); ctx.beginPath(); ctx.ellipse(0, 12, 12 * shScale, 6 * shScale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111827'; ctx.fillRect(-3.5, 6, 3, 10); ctx.fillRect(1.5, 6, 3, 10); ctx.fillStyle = '#000'; ctx.fillRect(-4, 15, 4.5, 2); ctx.fillRect(1, 15, 4.5, 2);
        ctx.fillStyle = shirtColor; ctx.beginPath(); ctx.roundRect(-7, -6, 14, 14, 3); ctx.fill();
        ctx.fillStyle = '#FDBA74'; ctx.fillRect(-8, -3, 2.5, 8); ctx.save(); ctx.translate(5, -1); ctx.rotate(0.15); ctx.fillStyle = '#FDBA74'; ctx.fillRect(0, -1.5, 7, 2.5); ctx.fillStyle = '#1F2937'; ctx.fillRect(6, -1.5, 14, 2.5); ctx.restore();
        ctx.fillStyle = '#FDBA74'; ctx.beginPath(); ctx.arc(0, -10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0, -14, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = team === 'blue' ? '#38BDF8' : '#EF4444'; ctx.fillRect(-4.5, -12, 9, 1.5);
        ctx.restore();
        if (isShield) { ctx.save(); ctx.translate(x, y - jumpOffset); ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2.5; ctx.shadowColor = '#38BDF8'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore(); }
      }

      s.remotePlayers.forEach((rem) => {
        const shirt = rem.team === 'blue' ? '#0EA5E9' : '#DC2626';
        drawHuman(ctx, rem.x, rem.y, rem.facingAngle, shirt, false, rem.team, rem.jumpOffset || 0, rem.isCover);
        ctx.save(); ctx.translate(rem.x, rem.y - (rem.jumpOffset || 0)); ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(rem.name, 0, -20); if (rem.lastReaction && now < rem.lastReaction.until) { ctx.font = '16px sans-serif'; ctx.fillText(rem.lastReaction.emoji, 0, -32); } ctx.fillStyle = '#000'; ctx.fillRect(-14, -28, 28, 4); ctx.fillStyle = '#22C55E'; ctx.fillRect(-14, -28, 28 * (rem.health / 100) * (3 - (rem.hitCount || 0)) / 3, 4); ctx.restore();
      });

      if (!p.inCarId) {
        const shirt = myTeam === 'blue' ? '#0284C7' : '#991B1B';
        drawHuman(ctx, p.x, p.y, p.facingAngle, shirt, true, myTeam, p.jumpOffset, p.isCover);
        ctx.save(); ctx.translate(p.x, p.y - (p.jumpOffset || 0)); ctx.fillStyle = '#FFD700'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${myPlayerName} (YOU)`, 0, -20); if (s.myReaction && now < s.myReaction.until) { ctx.font = '16px sans-serif'; ctx.fillText(s.myReaction.emoji, 0, -32); } ctx.restore();
      }
      ctx.restore();

      // SMALL RADAR - 62px BOTTOM RIGHT (LIKE SECOND PICTURE)
      const mmSize = 62; const mmX = s.screenDim.w - mmSize - 12; const mmY = s.screenDim.h - mmSize - 190;
      ctx.save(); ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.beginPath(); ctx.roundRect(mmX, mmY, mmSize, mmSize, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.6)'; s.civilians.forEach((c) => { const cx = mmX + (c.x / cityData.mapWidth) * mmSize; const cy = mmY + (c.y / cityData.mapHeight) * mmSize; ctx.fillRect(cx - 1, cy - 1, 1.5, 1.5); });
      ctx.fillStyle = '#EF4444'; s.gangsters.forEach((g) => { const gx = mmX + (g.x / cityData.mapWidth) * mmSize; const gy = mmY + (g.y / cityData.mapHeight) * mmSize; ctx.beginPath(); ctx.arc(gx, gy, 1.8, 0, Math.PI * 2); ctx.fill(); });
      s.remotePlayers.forEach((rp) => { const rx = mmX + (rp.x / cityData.mapWidth) * mmSize; const ry = mmY + (rp.y / cityData.mapHeight) * mmSize; ctx.fillStyle = rp.team === 'blue' ? '#38BDF8' : '#F87171'; ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill(); });
      const px = mmX + (p.x / cityData.mapWidth) * mmSize; const py = mmY + (p.y / cityData.mapHeight) * mmSize; ctx.fillStyle = myTeam === 'blue' ? '#38BDF8' : '#EF4444'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(px, py, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'right'; ctx.fillText('RADAR', mmX + mmSize - 4, mmY + mmSize - 4); ctx.restore();

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize); canvas.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); };
  }, [inLobby, cityData, myPlayerId, myPlayerName, myTeam, isHost, shootPlayerLaser, playSfx, onToast, t]);

  if (inLobby) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0B10] text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto font-sans">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={onBack} type="button" className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#FFD700]"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2"><span>{t('multiplayer_title')}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500 text-red-400">LIVE 20 PLAYERS</span></h1><p className="text-xs text-gray-400">Persistent Wide 4KM City • Betrayal Allowed</p></div></div></div>
        <div className="w-full max-w-md mx-auto my-auto space-y-4 py-6">
          <div className="p-5 rounded-3xl bg-gradient-to-b from-[#181A24] to-[#10121A] border-2 border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.2)]"><div className="flex items-center gap-2 text-[#FFD700] mb-2"><Sparkles className="w-5 h-5" /><h2 className="text-sm font-black uppercase">TYPE A: INVITE CODE ROOM</h2></div><p className="text-xs text-gray-300 mb-4">Create a custom district lobby with a room code to invite friends.</p><button onClick={createRoom} type="button" className="w-full py-3.5 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95"> {t('create_room')} </button></div>
          <div className="p-5 rounded-3xl bg-gradient-to-b from-[#181A24] to-[#10121A] border-2 border-sky-500/50 shadow-[0_0_30px_rgba(56,189,248,0.2)]"><div className="flex items-center gap-2 text-sky-400 mb-2"><Radio className="w-5 h-5 animate-pulse" /><h2 className="text-sm font-black uppercase">TYPE B: RANDOM CITY MATCH</h2></div><p className="text-xs text-gray-300 mb-4">Instantly find and drop into any active public city warfare zone.</p><button onClick={joinRandomCity} type="button" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs uppercase active:scale-95"> {t('random_city')} </button></div>
          <form onSubmit={joinWithCode} className="p-4 rounded-3xl bg-black/60 border border-white/10 flex items-center gap-2"><input type="text" value={customRoomInput} onChange={(e) => setCustomRoomInput(e.target.value)} placeholder={t('invite_code')} className="flex-1 bg-transparent px-3 py-2 text-xs font-mono font-bold text-white placeholder-gray-500 focus:outline-none uppercase" /><button type="submit" className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase">JOIN</button></form>
        </div>
        <div className="text-center text-[11px] text-gray-500 font-medium"> Supports up to 20 players per city • Auto-synchronized </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />
      {/* SMALL LIFE PANEL - LIKE SECOND PICTURE - 0.75 SCALE */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-1 max-w-[185px] scale-[0.75] origin-top-left pointer-events-none">
        <div className="p-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { playSfx('click'); onBack(); }} type="button" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-white"><ArrowLeft className="w-4 h-4 text-[#FFD700]" /></button>
            <div><div className="flex items-center gap-1.5"><span className="text-[11px] font-black uppercase text-white tracking-wider">{roomCode}</span><span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">{activePlayerCount} ONLINE</span></div><p className="text-[9px] text-gray-400">{cityData.streetName}</p></div>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(roomCode); setCopiedCode(true); onToast(`Copied: ${roomCode}`); setTimeout(() => setCopiedCode(false), 2000); }} type="button" className="p-1.5 rounded-xl bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] pointer-events-auto">{copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
        </div>
        <div className="p-2.5 rounded-2xl bg-black/85 border border-[#FFD700]/30 backdrop-blur-md shadow-xl space-y-2">
          <div><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1"><span className="flex items-center gap-1 text-red-400"><Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /><span>{t('health')}</span></span><span className="font-mono text-white">{hudHealth}%</span></div><div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, hudHealth))}%` }} /></div></div>
          <div><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1"><span className="flex items-center gap-1 text-[#FFD700]"><Zap className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" /><span>{t('ammo')}</span></span><span className="font-mono text-white">{hudAmmo} / {hudMaxAmmo}</span></div><div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-amber-500 to-[#FFD700] transition-all" style={{ width: `${Math.max(0, Math.min(100, (hudAmmo / hudMaxAmmo) * 100))}%` }} /></div></div>
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] font-mono"><span className="text-[#FFD700] font-black">{hudCoins} SC</span><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${myTeam === 'blue' ? 'bg-sky-500/20 text-sky-400' : 'bg-red-500/20 text-red-400'}`}>{myTeam === 'blue' ? 'TEAM BLUE' : 'TEAM RED'}</span></div>
          <div className="flex items-center gap-1.5 pt-1">{hudInCover && (<span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/30 text-sky-300 border border-sky-400 animate-pulse">🛡️ SHIELD</span>)}{hudInCar && (<span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">DRIVING</span>)}</div>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md">
          {['🔥','💀','💰','👑','🔫','🛡️'].map((emoji) => (<button key={emoji} onClick={() => handleSendReaction(emoji)} type="button" className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-base active:scale-90 cursor-pointer">{emoji}</button>))}
        </div>
      </div>

      <div className="absolute top-3 right-24 z-30 flex items-center gap-2 pointer-events-auto">
        <button onClick={() => { playSfx('click'); setShowShopModal(true); }} type="button" className="px-3 py-2 rounded-2xl bg-black/85 border border-[#FFD700]/70 text-[#FFD700] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,215,0,0.25)] active:scale-95 cursor-pointer backdrop-blur-md"><ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">SHOP [B]</span></button>
        <button onClick={() => { playSfx('click'); setShowTeamModal(true); }} type="button" className="p-2 rounded-2xl bg-black/85 border border-white/20 text-white font-black text-xs uppercase active:scale-95 cursor-pointer hover:border-[#FFD700] backdrop-blur-md"><Users className="w-4 h-4" /></button>
      </div>

      <GangChat roomCode={roomCode} playerId={myPlayerId} playerName={myPlayerName} playerTeam={myTeam} onToast={onToast} />
      <StreetJoystick onMove={(movement) => { gameStateRef.current.joystickMovement = movement; if (movement.isMoving) { gameStateRef.current.isMouseActive = false; } }} onJump={handleJump} onShoot={shootPlayerLaser} onRunToggle={(running) => { gameStateRef.current.isRunActive = running; }} onHijackOrEnterCar={handleToggleCar} isNearCar={hudIsNearCar} isInCar={hudInCar} isCover={hudInCover} onCoverToggle={handleToggleCover} onReload={handleReload} ammo={hudAmmo} maxAmmo={hudMaxAmmo} />
      {showTeamModal && (<div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left animate-in zoom-in-95"><div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4"><h3 className="text-sm font-black uppercase text-white">{t('team_join')}</h3><button onClick={() => setShowTeamModal(false)} type="button" className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button></div><div className="space-y-3"><button onClick={() => { setMyTeam('blue'); gameStateRef.current.player.team = 'blue'; setShowTeamModal(false); playSfx('click'); onToast('Blue Team!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left ${myTeam === 'blue' ? 'bg-sky-950/60 border-sky-400' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-sky-400">{t('team_blue')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_blue_desc')}</p></button><button onClick={() => { setMyTeam('red'); gameStateRef.current.player.team = 'red'; setShowTeamModal(false); playSfx('click'); onToast('Red Team!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left ${myTeam === 'red' ? 'bg-red-950/60 border-red-500' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-red-400">{t('team_red')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_red_desc')}</p></button></div></div></div>)}
    </div>
  );
}
