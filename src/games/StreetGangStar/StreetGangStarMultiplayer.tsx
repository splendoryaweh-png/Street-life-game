'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Shield, Zap, Crosshair, RotateCcw, Volume2, VolumeX, Heart, Coins, Car, ShoppingBag, MapPin, X, ArrowLeft, Users, Copy, Check, Trophy, Flame, Radio, Send, Sparkles, Tv } from 'lucide-react';
import { playShootSound, playReloadSound, playPickupSound, playCoinSound, playSuccessSound, playSirenSound, playClickSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { showAdsgramRewardedAd } from '@/lib/adsgram';
import { getRandomCityByCountry, CityData, isPointInsideBuilding } from './CityGenerator';
import { getGangStarText, GangStarTextKey } from './language';
import { WEAPONS, WeaponType, CityCar, Civilian, Gangster, LaserBeam, SparkParticle } from './StreetGangStar';
import { GangChat } from './GangChat';
import { StreetJoystick } from './StreetJoystick';
import { playerHealthAfterHits, tankDamagePerHit, isPlayerDown as hasReachedPlayerHitLimit } from './CombatRules';
import { getTelegramInitData } from '@/lib/telegram';

export interface RemotePlayer { id: string; name: string; x: number; y: number; targetX: number; targetY: number; facingAngle: number; health: number; maxHealth: number; team: 'blue' | 'red'; gun: WeaponType; avatarColor: string; isCover: boolean; inCarId: string | null; jumpOffset?: number; lastReaction?: { emoji: string; until: number }; lastSeen: number; hitCount?: number; lastShotAt?: number; }
export interface MultiplayerMessage { type: 'player_sync' | 'laser_fire' | 'reaction' | 'host_sync' | 'kill_alert' | 'driver_eject'; senderId: string; payload: any; }
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
  const [missileBusy, setMissileBusy] = useState(false);
  const [hijackInProgress, setHijackInProgress] = useState(false);
  const hijackTargetRef = useRef<string | null>(null);
  const hijackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [missileTankCount, setMissileTankCount] = useState(0);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
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
  const [isPlayerDown, setIsPlayerDown] = useState<boolean>(false);
  const [isReviving, setIsReviving] = useState<boolean>(false);
  const reviveRequestRef = useRef<boolean>(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const serverSyncBusyRef = useRef(false);
  const serverRoomReadyRef = useRef(false);

  const gameStateRef = useRef({
    player: { id: myPlayerId, name: myPlayerName, team: 'blue' as 'blue' | 'red', x: cityData.spawnPoints[0].x, y: cityData.spawnPoints[0].y, vx: 0, vy: 0, speed: 4.5, health: 100, maxHealth: 100, hitCount: 0, recentShots: [] as { id: number; beams: { x1: number; y1: number; x2: number; y2: number; color: string; damage: number }[] }[], ammo: 30, maxAmmo: 30, gun: 'pistol' as WeaponType, coins: 0, facingAngle: 0, isCover: false, inCarId: null as string | null, lastShootTime: 0, isReloading: false, kills: 0, civiliansSaved: 0, jumpOffset: 0, jumpVy: 0, isJumping: false },
    remotePlayers: new Map<string, RemotePlayer>(), ejectedDrivers: [] as { id: string; x: number; y: number; facingAngle: number; state: 'falling' | 'standing'; stateAt: number }[],
    unlockedGuns: { pistol: true, shotgun_laser: false, ak_laser: false, sniper_laser: false } as Record<WeaponType, boolean>,
    cars: [] as (CityCar & { health: number; maxHealth: number })[], civilians: [] as Civilian[], gangsters: [] as (Gangster & { isPlayerOwned?: boolean; driverId?: string | null; })[], lasers: [] as LaserBeam[], missiles: [] as { id: string; x: number; y: number; targetId: string | null; ownerId: string; life: number; damage: number }[], sparks: [] as SparkParticle[],
    keys: { w: false, a: false, s: false, d: false, shift: false, mouseLeft: false },
    joystickMovement: { dx: 0, dy: 0, isMoving: false }, isRunActive: false, isMouseActive: false, mousePos: { x: 0, y: 0 }, screenDim: { w: 800, h: 600 }, lastSpawnTime: Date.now(), lastBroadcastTime: 0, myReaction: null as { emoji: string; until: number } | null, isRunning: false,
  });

  const playSfx = useCallback((name: 'shoot' | 'reload' | 'pickup' | 'coin' | 'success' | 'siren' | 'click') => {
    if (!soundEnabled) return;
    if (name === 'shoot') playShootSound(); else if (name === 'reload') playReloadSound(); else if (name === 'pickup') playPickupSound(); else if (name === 'coin') playCoinSound(); else if (name === 'success') playSuccessSound(); else if (name === 'siren') playSirenSound(); else if (name === 'click') playClickSound();
  }, [soundEnabled]);

  const createRoom = async () => {
    playClickSound();
    try {
      const response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', initData: getTelegramInitData(), countryCode: initialCountry, playerName: myPlayerName, maxPlayers: 20 }) });
      const result = await response.json();
      if (!response.ok || !result?.room?.room_code) throw new Error(result?.error || 'Unable to create multiplayer room.');
      const code = String(result.room.room_code);
      setRoomCode(code); setIsHost(true); serverRoomReadyRef.current = true;
      connectToRoom(code, true);
    } catch (error) { onToast(error instanceof Error ? error.message : 'Room creation failed. Open Street Life inside Telegram and try again.'); }
  };
  const joinRandomCity = async () => {
    playClickSound();
    try {
      let response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'random_join', initData: getTelegramInitData(), playerName: myPlayerName, team: myTeam }) });
      let result = await response.json();
      if (!response.ok && response.status === 404) {
        response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', initData: getTelegramInitData(), countryCode: initialCountry, playerName: myPlayerName, maxPlayers: 20 }) });
        result = await response.json();
      }
      if (!response.ok || !result?.room?.room_code) throw new Error(result?.error || 'No city room is available.');
      const code = String(result.room.room_code);
      const host = String(result.room.host_telegram_id) === String(result.playerId);
      setRoomCode(code); setIsHost(host); serverRoomReadyRef.current = true;
      connectToRoom(code, host);
    } catch (error) { onToast(error instanceof Error ? error.message : 'Random matchmaking failed. Open Street Life inside Telegram and try again.'); }
  };
  const joinWithCode = async (e: React.FormEvent) => {
    e.preventDefault(); const cleaned = customRoomInput.toUpperCase().trim(); if (!cleaned) { onToast('Please enter a valid room code!'); return; }
    playClickSound();
    try {
      const response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', initData: getTelegramInitData(), roomCode: cleaned, playerName: myPlayerName, team: myTeam }) });
      const result = await response.json();
      if (!response.ok || !result?.room?.room_code) throw new Error(result?.error || 'Unable to join this room.');
      setRoomCode(cleaned); setIsHost(String(result.room.host_telegram_id) === String(result.playerId)); serverRoomReadyRef.current = true;
      connectToRoom(cleaned, String(result.room.host_telegram_id) === String(result.playerId));
    } catch (error) { onToast(error instanceof Error ? error.message : 'Room join failed. Open Street Life inside Telegram and try again.'); }
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
        if (existing) { existing.name = payload.name; existing.targetX = payload.x; existing.targetY = payload.y; existing.facingAngle = payload.facingAngle; existing.health = payload.health ?? existing.health; existing.hitCount = payload.hitCount ?? existing.hitCount ?? 0; existing.team = payload.team; existing.gun = payload.gun; existing.avatarColor = payload.avatarColor; existing.isCover = payload.isCover; existing.inCarId = payload.inCarId; existing.jumpOffset = payload.jumpOffset || 0; existing.lastSeen = Date.now(); }
        else { s.remotePlayers.set(msg.senderId, { id: msg.senderId, name: payload.name, x: payload.x, y: payload.y, targetX: payload.x, targetY: payload.y, facingAngle: payload.facingAngle, health: payload.health ?? 100, maxHealth: 100, team: payload.team, gun: payload.gun, avatarColor: payload.avatarColor, isCover: payload.isCover, inCarId: payload.inCarId, jumpOffset: payload.jumpOffset || 0, lastSeen: Date.now(), hitCount: payload.hitCount ?? 0 }); }
        setActivePlayerCount(s.remotePlayers.size + 1);
      } else if (msg.type === 'laser_fire') {
        const p = msg.payload; s.lasers.push({ id: `laser_${Date.now()}_${Math.random()}`, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, color: p.color, life: 7, maxLife: 7, isPlayer: false, damage: p.damage });
      } else if (msg.type === 'reaction') {
        const rem = s.remotePlayers.get(msg.senderId); if (rem) { rem.lastReaction = { emoji: msg.payload.emoji, until: Date.now() + 2000 }; }
      } else if (msg.type === 'driver_eject') { if (!s.ejectedDrivers.some((driver) => driver.id === msg.payload.id)) s.ejectedDrivers.push(msg.payload); } else if (msg.type === 'host_sync' && !isHost) { s.cars = msg.payload.cars || s.cars; s.civilians = msg.payload.civilians || s.civilians; s.gangsters = msg.payload.gangsters || s.gangsters; s.ejectedDrivers = msg.payload.ejectedDrivers || s.ejectedDrivers; s.missiles = msg.payload.missiles || s.missiles; }
    };
    const player = gameStateRef.current.player;
    player.health = 100; player.hitCount = 0; player.x = newCity.spawnPoints[0].x; player.y = newCity.spawnPoints[0].y; player.inCarId = null; player.isCover = false;
    setHudHealth(100); setHudInCar(false); setHudInCover(false); setIsPlayerDown(false);
    setInLobby(false); gameStateRef.current.isRunning = true; playSuccessSound(); onToast(`Connected to District Lobby: ${code}!`);
  };

  const leaveRoom = () => {
    if (!serverRoomReadyRef.current || !roomCode) return;
    const initData = getTelegramInitData();
    void fetch('/api/streetgangstar/rooms', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', initData, roomCode })
    }).catch((error) => console.warn('Unable to leave Street Gang Star room cleanly:', error));
    serverRoomReadyRef.current = false;
    if (channelRef.current) { channelRef.current.close(); channelRef.current = null; }
  };

  const handleWatchAdContinue = async () => {
    if (reviveRequestRef.current || !isPlayerDown) return;
    reviveRequestRef.current = true;
    setIsReviving(true);
    try {
      // One Adsgram rewarded session uses the existing approved 3-in-1 ad block.
      // Revive only after Adsgram confirms that this session completed.
      await showAdsgramRewardedAd();
      const s = gameStateRef.current;
      const p = s.player;
      p.health = 60;
      p.hitCount = 4;
      p.x = cityData.spawnPoints[0].x;
      p.y = cityData.spawnPoints[0].y;
      p.inCarId = null;
      p.isCover = false;
      p.isJumping = false;
      p.jumpOffset = 0;
      s.keys = { w: false, a: false, s: false, d: false, shift: false, mouseLeft: false };
      s.joystickMovement = { dx: 0, dy: 0, isMoving: false };
      s.isRunning = true;
      setHudHealth(60);
      setHudInCar(false);
      setHudInCover(false);
      setIsPlayerDown(false);
      onToast('Revived! You are back in the match.');
    } catch (error) {
      console.error('Multiplayer revive ad was not completed:', error);
      onToast('Ad not completed or unavailable. You are still down.');
    } finally {
      reviveRequestRef.current = false;
      setIsReviving(false);
    }
  };

  const handleBackToLobbyAfterDeath = () => {
    playSfx('click');
    gameStateRef.current.isRunning = false;
    leaveRoom();
    setIsPlayerDown(false);
    setIsReviving(false);
    setInLobby(true);
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
  const cancelTankHijack = useCallback((reason = 'Hijack interrupted.') => {
    const tankKey = hijackTargetRef.current;
    if (!tankKey) return;
    if (hijackTimerRef.current) clearTimeout(hijackTimerRef.current);
    hijackTimerRef.current = null; hijackTargetRef.current = null; setHijackInProgress(false);
    void fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_tank_hijack', initData: getTelegramInitData(), roomCode, tankKey }) });
    onToast(reason);
  }, [roomCode, onToast]);

  const handleToggleCar = useCallback(() => {
    const s = gameStateRef.current; const p = s.player;
    if (hijackTargetRef.current) { cancelTankHijack(); return; }
    if (p.inCarId) { const tank = s.gangsters.find((g) => g.id === p.inCarId && g.vehicleType === 'tank'); if (tank) { tank.driverId = null; tank.isPlayerOwned = true; p.x = tank.x + 54; p.y = tank.y + 18; } else { const car = s.cars.find((c) => c.id === p.inCarId); if (car) { car.isOccupied = false; car.hasDriver = false; car.driverType = null; p.x = car.x + 30; p.y = car.y + 30; } } p.inCarId = null; setHudInCar(false); playSfx('click'); onToast(t('car_exit')); return; }
    let nearestTank: any = null; let tankDistance = 92;
    for (const g of s.gangsters) { if (g.vehicleType !== 'tank') continue; const dist = Math.hypot(g.x - p.x, g.y - p.y); if (dist < tankDistance && g.driverId !== myPlayerId) { tankDistance = dist; nearestTank = g; } }
    if (nearestTank && nearestTank.driverId) {
      const tankKey = nearestTank.id; hijackTargetRef.current = tankKey; setHijackInProgress(true);
      const begin = async () => {
        if (nearestTank.isMissileTank) {
          const response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_tank_hijack', initData: getTelegramInitData(), roomCode, tankKey }) });
          const result = await response.json(); if (!response.ok || !result?.ok) throw new Error(result?.error || 'Could not start hijacking.');
          if (hijackTargetRef.current !== tankKey) { void fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_tank_hijack', initData: getTelegramInitData(), roomCode, tankKey }) }); return; }
        }
        onToast('HIJACKING… STAY STILL FOR 5 SECONDS. Do not shoot.');
        hijackTimerRef.current = setTimeout(async () => {
          try {
            const current = gameStateRef.current; const currentTank = current.gangsters.find((g) => g.id === tankKey);
            if (!currentTank || Math.hypot(current.player.x - currentTank.x, current.player.y - currentTank.y) > 105) throw new Error('You moved too far away.');
            if (currentTank.isMissileTank) {
              const response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete_tank_hijack', initData: getTelegramInitData(), roomCode, tankKey }) });
              const result = await response.json(); if (!response.ok || !result?.ok) throw new Error(result?.error || 'Hijack failed.');
            }
            currentTank.driverId = myPlayerId; currentTank.isPlayerOwned = true; current.player.inCarId = tankKey; current.player.x = currentTank.x; current.player.y = currentTank.y;
            setHudInCar(true); playSfx('siren'); onToast('TANK HIJACKED! You are now the driver.');
          } catch (error) {
            void fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_tank_hijack', initData: getTelegramInitData(), roomCode, tankKey }) });
            onToast(error instanceof Error ? error.message : 'Hijack failed.');
          } finally { hijackTargetRef.current = null; hijackTimerRef.current = null; setHijackInProgress(false); }
        }, 5100);
      };
      void begin().catch((error) => { hijackTargetRef.current = null; setHijackInProgress(false); onToast(error instanceof Error ? error.message : 'Hijack failed.'); });
      return;
    }
    if (nearestTank && !nearestTank.driverId) { nearestTank.isPlayerOwned = true; nearestTank.driverId = myPlayerId; p.inCarId = nearestTank.id; p.x = nearestTank.x; p.y = nearestTank.y; setHudInCar(true); playSfx('siren'); onToast('TANK ENTERED. You are now the driver.'); return; }
    let nearestCar: any = null; let minDist = 70; for (const c of s.cars) { const dist = Math.hypot(c.x - p.x, c.y - p.y); if (dist < minDist) { minDist = dist; nearestCar = c; } }
    if (nearestCar) { if (nearestCar.hasDriver && nearestCar.driverType === 'civilian') { const ejected = { id: `ejected_${nearestCar.id}_${Date.now()}_${myPlayerId}`, x: nearestCar.x - 24, y: nearestCar.y + 18, facingAngle: Math.atan2(p.y - nearestCar.y, p.x - nearestCar.x), state: 'falling' as const, stateAt: Date.now() }; s.ejectedDrivers.push(ejected); channelRef.current?.postMessage({ type: 'driver_eject', senderId: myPlayerId, payload: ejected }); nearestCar.hasDriver = false; nearestCar.driverType = 'player'; nearestCar.isOccupied = true; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('siren'); onToast(t('car_hijacked')); } else if (!nearestCar.isOccupied) { nearestCar.isOccupied = true; nearestCar.hasDriver = true; nearestCar.driverType = 'player'; p.inCarId = nearestCar.id; setHudInCar(true); playSfx('click'); onToast(t('car_enter')); } }
  }, [cancelTankHijack, myPlayerId, onToast, playSfx, roomCode, t]);
  const handleToggleCover = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; let nearObstacle = false;
    for (const bld of cityData.buildings) { if (p.x >= bld.x - 40 && p.x <= bld.x + bld.width + 40 && p.y >= bld.y - 40 && p.y <= bld.y + bld.height + 40) { nearObstacle = true; break; } }
    if (!nearObstacle) { for (const car of s.cars) { if (Math.hypot(car.x - p.x, car.y - p.y) < 65) { nearObstacle = true; break; } } }
    if (nearObstacle) { p.isCover = !p.isCover; setHudInCover(p.isCover); playSfx('click'); onToast(p.isCover ? t('cover_active') : t('cover_inactive')); } else { onToast(t('cover_inactive')); }
  }, [cityData.buildings, onToast, playSfx, t]);
  const handleJump = useCallback(() => { const s = gameStateRef.current; const p = s.player; if (p.isJumping || p.inCarId) return; p.isJumping = true; p.jumpVy = 8.5; playPickupSound(); onToast('LEAP JUMP! 🚀'); }, [onToast]);
  const purchaseMissileTank = useCallback(async () => {
    if (missileBusy) return;
    const s = gameStateRef.current;
    const tankKey = `mt_${myPlayerId}_${Date.now()}`;
    setMissileBusy(true);
    try {
      const response = await fetch('/api/streetgangstar/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purchase_missile_tank', initData: getTelegramInitData(), roomCode, tankKey }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Missile tank purchase failed.');
      const tank = { id: tankKey, type: 'fighter_motor' as const, x: s.player.x + 95, y: s.player.y + 20, vx: 0, vy: 0, health: 20, maxHealth: 20, speed: 1.5, facingAngle: s.player.facingAngle, gun: 'ak_laser' as WeaponType, lastShootTime: 0, vehicleType: 'tank' as const, isPlayerOwned: true, driverId: myPlayerId, isMissileTank: true };
      s.gangsters.push(tank);
      s.player.inCarId = tankKey; setHudInCar(true); setMissileTankCount(Number(result.room_tank_count) || missileTankCount + 1); setAccountBalance(Number(result.balance_after));
      onToast('MISSILE TANK PURCHASED! Use FIRE MISSILE to launch guided rockets.');
    } catch (error) { onToast(error instanceof Error ? error.message : 'Could not buy missile tank.'); }
    finally { setMissileBusy(false); }
  }, [missileBusy, roomCode, myPlayerId, missileTankCount, onToast]);

  useEffect(() => {
    if (!showShopModal) return;
    let cancelled = false;
    fetch('/api/streetgangstar/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_balance', initData: getTelegramInitData() }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Balance unavailable.');
      if (!cancelled) setAccountBalance(Number(result.balance) || 0);
    }).catch(() => { if (!cancelled) setAccountBalance(null); });
    return () => { cancelled = true; };
  }, [showShopModal]);

  const fireGuidedMissile = useCallback(() => {
    const s = gameStateRef.current; const p = s.player;
    const tank = s.gangsters.find((g) => g.id === p.inCarId && g.vehicleType === 'tank' && g.isMissileTank);
    if (!tank || tank.driverId !== myPlayerId) { onToast('You must be driving a missile tank to fire.'); return; }
    if (s.missiles.some((m) => m.ownerId === myPlayerId && m.life > 0)) { onToast('Wait for your guided missile to finish.'); return; }
    const targets = [...Array.from(s.remotePlayers.values()).map((r) => ({ id: r.id, x: r.x, y: r.y })), ...s.gangsters.filter((g) => g.id !== tank.id && g.driverId !== myPlayerId).map((g) => ({ id: g.id, x: g.x, y: g.y }))];
    const target = targets.sort((a,b) => Math.hypot(a.x-tank.x,a.y-tank.y)-Math.hypot(b.x-tank.x,b.y-tank.y))[0];
    if (!target) { onToast('No hostile target is in range.'); return; }
    s.missiles.push({ id: `guided_${Date.now()}_${Math.random()}`, x: tank.x, y: tank.y, targetId: target.id, ownerId: myPlayerId, life: 180, damage: 20 });
    playSfx('shoot');
  }, [myPlayerId, onToast, playSfx]);

  const shootPlayerLaser = useCallback(() => {
    const s = gameStateRef.current; const p = s.player; if (hijackTargetRef.current) { cancelTankHijack('Hijack failed because you tried to shoot.'); return; } if (p.isReloading) return; if (p.ammo <= 0) { handleReload(); return; }
    const wDef = WEAPONS[p.gun]; const now = Date.now(); if (now - p.lastShootTime < wDef.fireRateMs) return;
    p.lastShootTime = now; p.ammo -= 1; setHudAmmo(p.ammo); playSfx('shoot');
    const startX = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.x || p.x) : p.x + Math.cos(p.facingAngle) * 22;
    const startY = p.inCarId ? (s.cars.find((c) => c.id === p.inCarId)?.y || p.y) : p.y + Math.sin(p.facingAngle) * 22;
    const baseAngle = p.facingAngle; const spreadAngles = wDef.spread === 3 ? [baseAngle - 0.14, baseAngle, baseAngle + 0.14] : [baseAngle];
    const beams: { x1: number; y1: number; x2: number; y2: number; color: string; damage: number }[] = [];
    spreadAngles.forEach((ang) => {
      const beamLength = 480; const endX = startX + Math.cos(ang) * beamLength; const endY = startY + Math.sin(ang) * beamLength;
      const beam = { x1: startX, y1: startY, x2: endX, y2: endY, color: wDef.laserColor, damage: wDef.damage };
      beams.push(beam);
      s.lasers.push({ id: `laser_${now}_${Math.random()}`, ...beam, life: 7, maxLife: 7, isPlayer: true });
      if (channelRef.current) { channelRef.current.postMessage({ type: 'laser_fire', senderId: myPlayerId, payload: { ...beam, team: myTeam } }); }
    });
    p.recentShots.push({ id: now, beams });
    if (p.recentShots.length > 8) p.recentShots.splice(0, p.recentShots.length - 8);
  }, [cancelTankHijack, handleReload, myPlayerId, myTeam, playSfx]);

  useEffect(() => {
    if (inLobby) return;
    const onKeyDown = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = true; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = true; if (k === 's' || e.key === 'ArrowDown') s.keys.s = true; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = true; if (e.key === 'Shift') s.keys.shift = true; if (e.code === 'Space') handleJump(); if (k === 'r') handleReload(); if (k === 'e') handleToggleCar(); if (k === 'q') handleToggleCover(); if (k === 'b') { setShowShopModal((prev) => !prev); playSfx('click'); } if (k === 't') { setShowTeamModal((prev) => !prev); playSfx('click'); } };
    const onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); const s = gameStateRef.current; if (k === 'w' || e.key === 'ArrowUp') s.keys.w = false; if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = false; if (k === 's' || e.key === 'ArrowDown') s.keys.s = false; if (k === 'd' || e.key === 'ArrowRight') s.keys.d = false; if (e.key === 'Shift') s.keys.shift = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [inLobby, handleReload, handleToggleCar, handleToggleCover, handleJump, playSfx]);

  useEffect(() => {
    if (inLobby || !serverRoomReadyRef.current || !roomCode) return;
    let stopped = false;
    const syncRoom = async () => {
      if (serverSyncBusyRef.current || stopped) return;
      serverSyncBusyRef.current = true;
      try {
        const s = gameStateRef.current;
        const p = s.player;
        const response = await fetch('/api/streetgangstar/rooms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat', initData: getTelegramInitData(), roomCode,
            playerState: { name: myPlayerName, x: p.x, y: p.y, facingAngle: p.facingAngle, health: p.health, hitCount: p.hitCount || 0, team: myTeam, gun: p.gun, isCover: p.isCover, inCarId: p.inCarId, jumpOffset: p.jumpOffset, recentShots: p.recentShots },
            roomState: isHost ? { cars: s.cars, civilians: s.civilians, gangsters: s.gangsters, ejectedDrivers: s.ejectedDrivers, missiles: s.missiles } : undefined
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Multiplayer connection lost.');
        const pollResponse = await fetch('/api/streetgangstar/rooms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', initData: getTelegramInitData(), roomCode })
        });
        const snapshot = await pollResponse.json();
        if (!pollResponse.ok) throw new Error(snapshot?.error || 'Unable to sync room.');
        const state = snapshot.room?.room_state || {};
        if (!isHost) {
          if (Array.isArray(state.cars)) s.cars = state.cars;
          if (Array.isArray(state.civilians)) s.civilians = state.civilians;
          if (Array.isArray(state.gangsters)) s.gangsters = state.gangsters;
          if (Array.isArray(state.ejectedDrivers)) s.ejectedDrivers = state.ejectedDrivers;
          if (Array.isArray(state.missiles)) s.missiles = state.missiles;
        }
        const active = (snapshot.players || []).filter((member: any) => String(member.telegram_id) !== String(snapshot.playerId));
        const seen = new Set<string>();
        for (const member of active) {
          const id = String(member.telegram_id);
          const value = member.player_state || {};
          if (typeof value.x !== 'number' || typeof value.y !== 'number') continue;
          seen.add(id);
          const existing = s.remotePlayers.get(id);
          const remote = {
            id, name: String(member.player_name || value.name || 'Street Player'),
            x: existing?.x ?? value.x, y: existing?.y ?? value.y,
            targetX: value.x, targetY: value.y, facingAngle: Number(value.facingAngle) || 0,
            health: Number(value.health) || 100, maxHealth: 100,
            team: member.team === 'red' ? 'red' as const : 'blue' as const,
            gun: (value.gun || 'pistol') as WeaponType, avatarColor: '#FFD700',
            isCover: Boolean(value.isCover), inCarId: typeof value.inCarId === 'string' ? value.inCarId : null,
            jumpOffset: Number(value.jumpOffset) || 0, lastSeen: Date.now(), hitCount: Number(value.hitCount) || 0,
            lastShotAt: existing?.lastShotAt || 0
          };
          const recentShots = Array.isArray(value.recentShots) ? value.recentShots : [];
          for (const shot of recentShots) {
            const shotId = Number(shot?.id);
            if (!Number.isFinite(shotId) || shotId <= (remote.lastShotAt || 0) || !Array.isArray(shot?.beams)) continue;
            for (const beam of shot.beams) {
              if (![beam?.x1, beam?.y1, beam?.x2, beam?.y2].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
              s.lasers.push({ id: `server_shot_${id}_${shotId}_${Math.random()}`, x1: beam.x1, y1: beam.y1, x2: beam.x2, y2: beam.y2, color: typeof beam.color === 'string' ? beam.color : '#38BDF8', life: 7, maxLife: 7, isPlayer: false, damage: Math.max(1, Math.min(100, Number(beam.damage) || 1)) });
            }
            remote.lastShotAt = Math.max(remote.lastShotAt || 0, shotId);
          }
          s.remotePlayers.set(id, { ...(existing || remote), ...remote });
        }
        for (const id of Array.from(s.remotePlayers.keys())) if (!seen.has(id)) s.remotePlayers.delete(id);
        setActivePlayerCount((snapshot.players || []).length);
      } catch (error) {
        console.warn('Street Gang Star room sync:', error);
      } finally { serverSyncBusyRef.current = false; }
    };
    void syncRoom();
    const timer = window.setInterval(() => { void syncRoom(); }, 900);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [inLobby, roomCode, isHost, myPlayerName, myTeam]);

  useEffect(() => {
    if (inLobby) return; const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; let animId: number;
    const handleResize = () => { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; gameStateRef.current.screenDim = { w: canvas.width, h: canvas.height }; }; handleResize(); window.addEventListener('resize', handleResize);
    const onMouseMove = (e: MouseEvent) => { const rect = canvas.getBoundingClientRect(); gameStateRef.current.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }; gameStateRef.current.isMouseActive = true; };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = true; shootPlayerLaser(); } };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) { gameStateRef.current.keys.mouseLeft = false; } };
    canvas.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);

    const loop = () => {
      const s = gameStateRef.current; const p = s.player; const now = Date.now();
      if (!s.isRunning) { animId = requestAnimationFrame(loop); return; }
      if (s.keys.mouseLeft) { shootPlayerLaser(); }
      s.ejectedDrivers.forEach((driver) => { if (driver.state === 'falling' && now - driver.stateAt >= 520) { driver.state = 'standing'; driver.stateAt = now; } });
      if (now - s.lastBroadcastTime >= 100 && channelRef.current) {
        s.lastBroadcastTime = now;
        channelRef.current.postMessage({ type: 'player_sync', senderId: myPlayerId, payload: { name: myPlayerName, x: p.x, y: p.y, facingAngle: p.facingAngle, health: p.health, hitCount: p.hitCount || 0, team: myTeam, gun: p.gun, avatarColor: '#FFD700', isCover: p.isCover, inCarId: p.inCarId, jumpOffset: p.jumpOffset } });
        if (isHost) { channelRef.current.postMessage({ type: 'host_sync', senderId: myPlayerId, payload: { cars: s.cars, civilians: s.civilians, gangsters: s.gangsters, ejectedDrivers: s.ejectedDrivers } }); }
      }
      s.remotePlayers.forEach((rem, remId) => { rem.x += (rem.targetX - rem.x) * 0.25; rem.y += (rem.targetY - rem.y) * 0.25; if (now - rem.lastSeen > 8000) { s.remotePlayers.delete(remId); setActivePlayerCount(s.remotePlayers.size + 1); } });
      if (isHost) {
        // Host owns civilian traffic and publishes its turns to every player.
        s.cars.forEach((car) => {
          if (car.isOccupied) return;
          if (car.direction === 'horizontal') {
            car.x += car.vx;
            if (car.x > cityData.mapWidth + 80) car.x = -80;
            if (car.x < -80) car.x = cityData.mapWidth + 80;
            const junction = cityData.roads.some((road) => road.direction === 'vertical' && Math.abs(car.x - (road.x + road.width / 2)) < 3 && cityData.roads.some((cross) => cross.direction === 'horizontal' && Math.abs(car.y - (cross.y + cross.height / 2)) < cross.height / 2));
            if (junction && now - (car.lastTurnAt || 0) > 1200 && Math.random() < 0.35) {
              const turnSpeed = car.speed * (Math.random() < 0.5 ? -1 : 1);
              car.direction = 'vertical'; car.vx = 0; car.vy = turnSpeed;
              [car.width, car.height] = [car.height, car.width]; car.lastTurnAt = now;
            }
          } else {
            car.y += car.vy;
            if (car.y > cityData.mapHeight + 80) car.y = -80;
            if (car.y < -80) car.y = cityData.mapHeight + 80;
            const junction = cityData.roads.some((road) => road.direction === 'horizontal' && Math.abs(car.y - (road.y + road.height / 2)) < 3 && cityData.roads.some((cross) => cross.direction === 'vertical' && Math.abs(car.x - (cross.x + cross.width / 2)) < cross.width / 2));
            if (junction && now - (car.lastTurnAt || 0) > 1200 && Math.random() < 0.35) {
              const turnSpeed = car.speed * (Math.random() < 0.5 ? -1 : 1);
              car.direction = 'horizontal'; car.vy = 0; car.vx = turnSpeed;
              [car.width, car.height] = [car.height, car.width]; car.lastTurnAt = now;
            }
          }
        });
        s.civilians.forEach((civ) => {
          if (civ.state === 'scared') return;
          civ.x += Math.cos(civ.facingAngle) * civ.speed;
          civ.y += Math.sin(civ.facingAngle) * civ.speed;
          if (Math.random() < 0.012) civ.facingAngle += (Math.random() - 0.5) * 1.2;
          civ.x = Math.max(80, Math.min(cityData.mapWidth - 80, civ.x));
          civ.y = Math.max(80, Math.min(cityData.mapHeight - 80, civ.y));
        });
      }
      if (isHost && now - s.lastSpawnTime >= 5000) {
        s.lastSpawnTime = now; const edge = cityData.gangsterSpawnEdges[Math.floor(Math.random() * cityData.gangsterSpawnEdges.length)]; const roll = Math.random(); const isBus = roll > 0.78; const isTank = roll > 0.48 && !isBus;
        s.gangsters.push({ id: `gangster_${now}_${Math.random()}`, type: isBus ? 'fighter_bus' : 'fighter_motor', x: edge.x, y: edge.y, vx: 0, vy: 0, health: isTank ? 20 : 6, maxHealth: isTank ? 20 : 6, speed: isTank ? 1.5 : isBus ? 1.8 : 3.2, facingAngle: 0, gun: isBus ? 'shotgun_laser' : 'ak_laser', lastShootTime: now, vehicleType: isTank ? 'tank' : isBus ? 'bus' : 'motorcycle' });
      }
      if (p.isJumping) { p.jumpOffset += p.jumpVy; p.jumpVy -= 0.65; if (p.jumpOffset <= 0) { p.jumpOffset = 0; p.jumpVy = 0; p.isJumping = false; } }
      let nearCarFound = false; for (const car of s.cars) { if (Math.hypot(car.x - p.x, car.y - p.y) < 75) { nearCarFound = true; break; } } setHudIsNearCar((prev) => (prev !== nearCarFound ? nearCarFound : prev));
      const isSprinting = s.keys.shift || s.isRunActive;
      if (p.inCarId) {
        const tank = s.gangsters.find((g) => g.id === p.inCarId && g.vehicleType === 'tank');
        const car = s.cars.find((c) => c.id === p.inCarId);
        const vehicle: any = tank || car;
        if (vehicle) { const driveSpeed = tank ? (isSprinting ? 6.2 : 4.2) : (isSprinting ? 7.5 : 5.0); let dx = 0; let dy = 0; if (s.joystickMovement.isMoving) { dx = s.joystickMovement.dx; dy = s.joystickMovement.dy; } else { if (s.keys.w) dy -= 1; if (s.keys.s) dy += 1; if (s.keys.a) dx -= 1; if (s.keys.d) dx += 1; } if (dx && dy) { dx *= 0.7071; dy *= 0.7071; } vehicle.x = Math.max(80, Math.min(cityData.mapWidth - 80, vehicle.x + dx * driveSpeed)); vehicle.y = Math.max(80, Math.min(cityData.mapHeight - 80, vehicle.y + dy * driveSpeed)); if (tank && (dx || dy)) tank.facingAngle = Math.atan2(dy, dx); p.x = vehicle.x; p.y = vehicle.y; }
      } else {
        const moveSpeed = isSprinting ? p.speed * 1.65 : p.speed; let dx = 0; let dy = 0;
        if (s.joystickMovement.isMoving) { dx = s.joystickMovement.dx; dy = s.joystickMovement.dy; if (!s.isMouseActive) { p.facingAngle = Math.atan2(dy, dx); } } else { if (s.keys.w) dy -= 1; if (s.keys.s) dy += 1; if (s.keys.a) dx -= 1; if (s.keys.d) dx += 1; if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; } }
        const nextX = p.x + dx * moveSpeed; const nextY = p.y + dy * moveSpeed; const hit = isPointInsideBuilding(nextX, nextY, cityData.buildings, 12); if (!hit.inside || hit.nearDoor || p.jumpOffset > 15) { p.x = Math.max(40, Math.min(cityData.mapWidth - 40, nextX)); p.y = Math.max(40, Math.min(cityData.mapHeight - 40, nextY)); }
      }
      const cameraX = Math.max(0, Math.min(cityData.mapWidth - s.screenDim.w, p.x - s.screenDim.w / 2)); const cameraY = Math.max(0, Math.min(cityData.mapHeight - s.screenDim.h, p.y - s.screenDim.h / 2));
      if (s.isMouseActive) { const playerScreenX = p.x - cameraX; const playerScreenY = p.y - cameraY; p.facingAngle = Math.atan2(s.mousePos.y - playerScreenY, s.mousePos.x - playerScreenX); }

      // ===== MULTIPLAYER HIT LOGIC - 15 ENEMY HITS DOWN A PLAYER =====
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
            if (g.driverId) continue;
            if (distToSegment(g.x, g.y, l.x1, l.y1, l.x2, l.y2) < 38) {
              const playerIsDrivingTank = s.gangsters.some((vehicle) => vehicle.id === p.inCarId && vehicle.vehicleType === 'tank');
              g.health -= tankDamagePerHit(playerIsDrivingTank, g.vehicleType === 'tank'); // 10 tank hits vs 20 ordinary hits
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
          for (let civIdx = s.civilians.length - 1; civIdx >= 0; civIdx--) {
            const civ = s.civilians[civIdx];
            if (distToSegment(civ.x, civ.y, l.x1, l.y1, l.x2, l.y2) < 30) {
              civ.hitCount = (civ.hitCount || 0) + 1; s.lasers.splice(lIdx, 1); hit = true;
              for (let sp = 0; sp < 7; sp++) s.sparks.push({ x: civ.x, y: civ.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, color: l.color, life: 18 });
              if (civ.hitCount >= 3) { for (let sp = 0; sp < 14; sp++) s.sparks.push({ x: civ.x, y: civ.y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9, color: sp % 2 ? '#991B1B' : '#DC2626', life: 24 }); s.civilians.splice(civIdx, 1); }
              break;
            }
          }
          if (hit) continue;
          s.remotePlayers.forEach((rem) => {
            if (distToSegment(rem.x, rem.y, l.x1, l.y1, l.x2, l.y2) < 32) {
              rem.hitCount = (rem.hitCount || 0) + 1;
              s.sparks.push({ x: rem.x, y: rem.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color: l.color, life: 14 });
              if (rem.hitCount >= 15) {
                s.remotePlayers.delete(rem.id); p.coins += 10; setHudCoins(p.coins); addGameCoins(10, '+10 SC - Player Kill (15 hits)', 'task_reward'); playSfx('coin'); onToast(`ELIMINATED ${rem.name} - 15 HITS! 🔥`);
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
          // Enemy gangster lasers can hit civilians; three hits remove a civilian.
          let civilianHit = false;
          for (let civIdx = s.civilians.length - 1; civIdx >= 0; civIdx--) {
            const civ = s.civilians[civIdx];
            if (distToSegment(civ.x, civ.y, l.x1, l.y1, l.x2, l.y2) < 30) {
              civ.hitCount = (civ.hitCount || 0) + 1;
              s.lasers.splice(lIdx, 1);
              civilianHit = true;
              for (let sp = 0; sp < 7; sp++) s.sparks.push({ x: civ.x, y: civ.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, color: l.color, life: 18 });
              if (civ.hitCount >= 3) {
                for (let sp = 0; sp < 14; sp++) s.sparks.push({ x: civ.x, y: civ.y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9, color: sp % 2 ? '#991B1B' : '#DC2626', life: 24 });
                s.civilians.splice(civIdx, 1);
              }
              break;
            }
          }
          if (civilianHit) continue;
          // ENEMY HITS YOU - ARMOUR FIRST, THEN 15 PLAYER HITS
          const occupiedTank = p.inCarId ? s.gangsters.find((g) => g.id === p.inCarId && g.vehicleType === 'tank') : undefined;
          if (occupiedTank && distToSegment(occupiedTank.x, occupiedTank.y, l.x1, l.y1, l.x2, l.y2) < 54) {
            occupiedTank.health -= 1; s.lasers.splice(lIdx, 1);
            for (let sp = 0; sp < 7; sp++) s.sparks.push({ x: occupiedTank.x, y: occupiedTank.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, color: '#FACC15', life: 18 });
            if (occupiedTank.health <= 0) { const tx = occupiedTank.x; const ty = occupiedTank.y; for (let sp = 0; sp < 22; sp++) s.sparks.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * 13, vy: (Math.random() - 0.5) * 13, color: sp % 2 ? '#F97316' : '#FACC15', life: 28 }); s.gangsters = s.gangsters.filter((g) => g.id !== occupiedTank.id); p.inCarId = null; p.x = tx + 58; p.y = ty + 20; setHudInCar(false); onToast('YOUR TANK WAS DESTROYED! You are exposed again.'); }
            continue;
          }
          if (!occupiedTank && distToSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < 32) {
            if (hijackTargetRef.current) cancelTankHijack('Hijack interrupted because you were hit.');
            p.hitCount = (p.hitCount || 0) + 1; p.health = playerHealthAfterHits(p.hitCount); setHudHealth(p.health);
            s.lasers.splice(lIdx, 1);
            for (let sp = 0; sp < 5; sp++) { s.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color: '#38BDF8', life: 14 }); }
            if (p.health <= 0 || hasReachedPlayerHitLimit(p.hitCount)) {
              playSfx('siren');
              p.health = 0;
              p.hitCount = 15;
              p.inCarId = null;
              p.isCover = false;
              s.isRunning = false;
              setHudHealth(0);
              setHudInCar(false);
              setHudInCover(false);
              setIsPlayerDown(true);
              onToast(t('player_down'));
            }
          }
        }
        if (l.life <= 0 && s.lasers[lIdx]) { s.lasers.splice(lIdx, 1); }
      }

      for (let mIdx = s.missiles.length - 1; mIdx >= 0; mIdx--) {
        const missile = s.missiles[mIdx];
        const target = s.remotePlayers.get(missile.targetId || '') || s.gangsters.find((g) => g.id === missile.targetId);
        if (!target || missile.life-- <= 0) { s.missiles.splice(mIdx, 1); continue; }
        const dx = target.x - missile.x, dy = target.y - missile.y, distance = Math.hypot(dx, dy);
        if (distance < 34) {
          if ('hitCount' in target) { (target as any).hitCount = ((target as any).hitCount || 0) + 10; if ((target as any).hitCount >= 15) s.remotePlayers.delete(missile.targetId || ''); }
          else { target.health -= missile.damage; if (target.health <= 0) s.gangsters = s.gangsters.filter((g) => g.id !== target.id); }
          for (let sp = 0; sp < 22; sp++) s.sparks.push({ x: missile.x, y: missile.y, vx: (Math.random() - 0.5) * 13, vy: (Math.random() - 0.5) * 13, color: sp % 2 ? '#F97316' : '#FACC15', life: 26 });
          s.missiles.splice(mIdx, 1); continue;
        }
        const speed = 8; missile.x += dx / Math.max(1, distance) * speed; missile.y += dy / Math.max(1, distance) * speed;
      }

      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) { const sp = s.sparks[spIdx]; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 1; if (sp.life <= 0) s.sparks.splice(spIdx, 1); }

      // ===== RENDER =====
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-cameraX, -cameraY);
      ctx.fillStyle = cityData.theme.groundGrassColor; ctx.fillRect(0, 0, cityData.mapWidth, cityData.mapHeight);
      cityData.roads.forEach((road) => { ctx.fillStyle = cityData.theme.asphaltColor; ctx.fillRect(road.x, road.y, road.width, road.height); ctx.strokeStyle = cityData.theme.roadMarkingColor; ctx.lineWidth = 2.5; ctx.setLineDash([25, 25]); if (road.direction === 'horizontal') { const midY = road.y + road.height / 2; ctx.beginPath(); ctx.moveTo(road.x, midY); ctx.lineTo(road.x + road.width, midY); ctx.stroke(); } else { const midX = road.x + road.width / 2; ctx.beginPath(); ctx.moveTo(midX, road.y); ctx.lineTo(midX, road.y + road.height); ctx.stroke(); } ctx.setLineDash([]); });
      cityData.buildings.forEach((bld) => { ctx.fillStyle = bld.wallColor; ctx.fillRect(bld.x, bld.y, bld.width, bld.height); ctx.strokeStyle = bld.roofColor; ctx.lineWidth = 5; ctx.strokeRect(bld.x + 6, bld.y + 6, bld.width - 12, bld.height - 12); });
      s.cars.forEach((car) => { ctx.save(); ctx.translate(car.x, car.y); ctx.fillStyle = car.color; ctx.beginPath(); ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6); ctx.fill(); ctx.fillStyle = '#0F172A'; ctx.fillRect(-car.width / 4, -car.height / 4, car.width / 2, car.height / 2); ctx.fillStyle = '#FEF08A'; if (car.direction === 'horizontal') { ctx.fillRect(car.width / 2 - 3, -car.height / 2 + 2, 4, 4); ctx.fillRect(car.width / 2 - 3, car.height / 2 - 6, 4, 4); } else { ctx.fillRect(-car.width / 2 + 2, car.height / 2 - 3, 4, 4); ctx.fillRect(car.width / 2 - 6, car.height / 2 - 3, 4, 4); } ctx.restore(); });
      s.gangsters.forEach((g) => {
        if (g.vehicleType === 'tank') {
          ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle);
          ctx.fillStyle = g.isPlayerOwned ? '#166534' : '#475569'; ctx.beginPath(); ctx.roundRect(-38, -23, 76, 46, 9); ctx.fill();
          ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 3; ctx.strokeRect(-32, -18, 64, 36);
          ctx.fillStyle = '#1E293B'; for (let wheel = -27; wheel <= 27; wheel += 18) { ctx.beginPath(); ctx.arc(wheel, -21, 6, 0, Math.PI * 2); ctx.arc(wheel, 21, 6, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#64748B'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#94A3B8'; ctx.fillRect(5, -4, 37, 8); ctx.restore();
        } else if (g.vehicleType === 'bus') { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle); ctx.fillStyle = '#7F1D1D'; ctx.beginPath(); ctx.roundRect(-34, -20, 68, 40, 8); ctx.fill(); ctx.fillStyle = '#1F2937'; ctx.fillRect(-26, -14, 12, 8); ctx.fillRect(-8, -14, 12, 8); ctx.fillRect(10, -14, 12, 8); ctx.fillStyle = '#FEF08A'; ctx.fillRect(32, -8, 4, 4); ctx.fillRect(32, 6, 4, 4); ctx.restore(); }
        else { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.facingAngle); ctx.fillStyle = '#18181B'; ctx.beginPath(); ctx.roundRect(-16, -5, 32, 10, 4); ctx.fill(); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI * 2); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#000'; ctx.fillRect(g.x - 22, g.y - 40, 44, 5); ctx.fillStyle = g.vehicleType === 'tank' ? '#FACC15' : g.vehicleType === 'bus' ? '#FACC15' : '#EF4444'; ctx.fillRect(g.x - 22, g.y - 40, 44 * (g.health / g.maxHealth), 5);
      });
      s.sparks.forEach((sp) => { ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.8, 0, Math.PI * 2); ctx.fill(); });
      s.missiles.forEach((m) => { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2((s.remotePlayers.get(m.targetId || '')?.y || s.gangsters.find(g => g.id === m.targetId)?.y || m.y) - m.y, (s.remotePlayers.get(m.targetId || '')?.x || s.gangsters.find(g => g.id === m.targetId)?.x || m.x) - m.x)); ctx.fillStyle = '#F97316'; ctx.shadowColor = '#F97316'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -6); ctx.lineTo(-6, 0); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill(); ctx.restore(); });
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

      s.ejectedDrivers.forEach((driver) => { const fall = driver.state === 'falling' ? Math.min(1, (now - driver.stateAt) / 520) : 1; ctx.save(); ctx.globalAlpha = 1 - fall * 0.12; drawHuman(ctx, driver.x, driver.y, driver.facingAngle, '#94A3B8', false, 'red', 0, false); ctx.restore(); });
      s.remotePlayers.forEach((rem) => {
        const shirt = rem.team === 'blue' ? '#0EA5E9' : '#DC2626';
        drawHuman(ctx, rem.x, rem.y, rem.facingAngle, shirt, false, rem.team, rem.jumpOffset || 0, rem.isCover);
        ctx.save(); ctx.translate(rem.x, rem.y - (rem.jumpOffset || 0)); ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(rem.name, 0, -20); if (rem.lastReaction && now < rem.lastReaction.until) { ctx.font = '16px sans-serif'; ctx.fillText(rem.lastReaction.emoji, 0, -32); } ctx.fillStyle = '#000'; ctx.fillRect(-14, -28, 28, 4); ctx.fillStyle = '#22C55E'; ctx.fillRect(-14, -28, 28 * Math.max(0, Math.min(1, rem.health / 100)), 4); ctx.restore();
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
  }, [inLobby, cityData, myPlayerId, myPlayerName, myTeam, isHost, shootPlayerLaser, playSfx, onToast, t, cancelTankHijack]);

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
            <button onClick={() => { playSfx('click'); leaveRoom(); onBack(); }} type="button" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-white"><ArrowLeft className="w-4 h-4 text-[#FFD700]" /></button>
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

      <div className="absolute bottom-5 right-4 z-40 flex flex-col gap-2 pointer-events-auto"><button type="button" onClick={fireGuidedMissile} className="rounded-xl border border-red-400/70 bg-red-950/90 px-3 py-2 text-[10px] font-black uppercase text-red-200 shadow-lg">FIRE GUIDED MISSILE</button><span className="text-center text-[9px] font-bold text-white/70">{missileTankCount}/4 ROOM TANKS</span></div>
      {showShopModal && (<div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"><div className="w-full max-w-sm rounded-3xl border-2 border-[#FFD700] bg-[#12131C] p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)]"><div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3"><div className="flex items-center gap-2 text-[#FFD700]"><ShoppingBag className="h-5 w-5" /><h3 className="text-sm font-black uppercase tracking-wider">Weapon & Vehicle Shop</h3></div><button type="button" onClick={() => setShowShopModal(false)} className="rounded-xl bg-white/10 p-1.5 text-white"><X className="h-5 w-5" /></button></div><div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200">Street Life account balance: <b>{accountBalance === null ? 'Open in Telegram to check' : accountBalance.toLocaleString() + ' SC'}</b></div><div className="rounded-2xl border border-amber-300/40 bg-amber-950/25 p-3"><div className="flex items-center justify-between gap-3"><div><h4 className="text-xs font-black uppercase text-amber-200">Guided Missile Tank</h4><p className="mt-1 text-[10px] text-gray-300">Armoured driver seat · guided missiles · driver only · maximum 4 tanks per room</p></div><span className="text-xs font-black text-amber-300">1,000 SC</span></div><button type="button" disabled={missileBusy || missileTankCount >= 4} onClick={purchaseMissileTank} className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-black uppercase text-black disabled:opacity-50">{missileBusy ? 'PURCHASING…' : missileTankCount >= 4 ? 'ROOM TANK LIMIT REACHED' : 'BUY MISSILE TANK · 1,000 SC'}</button><p className="mt-2 text-[9px] text-gray-400">The purchase is charged to your Street Life account balance only after the server confirms it. Room tanks: {missileTankCount}/4.</p></div></div></div>)}
      {hijackInProgress && (<div className="absolute inset-x-5 top-24 z-[85] mx-auto max-w-xs rounded-2xl border border-amber-300/70 bg-black/90 px-4 py-3 text-center text-amber-200 shadow-xl"><div className="text-xs font-black uppercase tracking-wider">Hijacking tank…</div><div className="mt-1 text-[10px] text-white">Stay close and still for 5 seconds. Moving, shooting, or taking a hit cancels the attempt.</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-full origin-left animate-[pulse_5s_ease-in-out]" style={{ background: '#FACC15' }} /></div></div>)}
      <GangChat roomCode={roomCode} playerId={myPlayerId} playerName={myPlayerName} playerTeam={myTeam} onToast={onToast} />
      <StreetJoystick onMove={(movement) => { gameStateRef.current.joystickMovement = movement; if (movement.isMoving) { gameStateRef.current.isMouseActive = false; if (hijackTargetRef.current) cancelTankHijack('Hijack failed because you moved.'); } }} onJump={handleJump} onShoot={shootPlayerLaser} onRunToggle={(running) => { gameStateRef.current.isRunActive = running; }} onHijackOrEnterCar={handleToggleCar} isNearCar={hudIsNearCar} isInCar={hudInCar} isCover={hudInCover} onCoverToggle={handleToggleCover} onReload={handleReload} ammo={hudAmmo} maxAmmo={hudMaxAmmo} />
      {isPlayerDown && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/85 p-5 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border-2 border-red-500/60 bg-gradient-to-b from-[#1B1118] to-[#0B0B10] p-6 text-center shadow-[0_0_35px_rgba(239,68,68,0.25)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/40 bg-red-500/15 text-red-400"><Heart className="h-8 w-8 fill-current" /></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">MULTIPLAYER · PLAYER DOWN</p>
            <h2 className="mt-2 text-2xl font-black uppercase text-white">You Were Eliminated</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">Watch one rewarded video session to continue the match with 60% health, or return to the lobby.</p>
            <button type="button" onClick={handleWatchAdContinue} disabled={isReviving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 px-4 py-4 text-sm font-black uppercase tracking-wide text-black shadow-[0_0_18px_rgba(255,215,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60">
              <Tv className="h-5 w-5" />{isReviving ? 'PLAYING REWARDED AD...' : 'WATCH AD TO CONTINUE'}
            </button>
            <button type="button" onClick={handleBackToLobbyAfterDeath} disabled={isReviving} className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-white hover:bg-white/10 disabled:opacity-50">BACK TO LOBBY</button>
            <p className="mt-3 text-[10px] text-gray-500">Revival happens only after Adsgram confirms the rewarded ad is complete.</p>
          </div>
        </div>
      )}
      {showTeamModal && (<div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left animate-in zoom-in-95"><div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4"><h3 className="text-sm font-black uppercase text-white">{t('team_join')}</h3><button onClick={() => setShowTeamModal(false)} type="button" className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button></div><div className="space-y-3"><button onClick={() => { setMyTeam('blue'); gameStateRef.current.player.team = 'blue'; setShowTeamModal(false); playSfx('click'); onToast('Blue Team!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left ${myTeam === 'blue' ? 'bg-sky-950/60 border-sky-400' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-sky-400">{t('team_blue')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_blue_desc')}</p></button><button onClick={() => { setMyTeam('red'); gameStateRef.current.player.team = 'red'; setShowTeamModal(false); playSfx('click'); onToast('Red Team!'); }} type="button" className={`w-full p-4 rounded-2xl border text-left ${myTeam === 'red' ? 'bg-red-950/60 border-red-500' : 'bg-black/50 border-white/10'}`}><h4 className="text-xs font-black uppercase text-red-400">{t('team_red')}</h4><p className="text-[11px] text-gray-300 mt-1">{t('team_red_desc')}</p></button></div></div></div>)}
    </div>
  );
}
