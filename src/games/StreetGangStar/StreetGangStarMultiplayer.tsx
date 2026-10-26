'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Zap,
  Crosshair,
  RotateCcw,
  Volume2,
  VolumeX,
  Heart,
  Coins,
  Car,
  ShoppingBag,
  MapPin,
  X,
  ArrowLeft,
  Users,
  Copy,
  Check,
  Trophy,
  Flame,
  Radio,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  playShootSound,
  playReloadSound,
  playPickupSound,
  playCoinSound,
  playSuccessSound,
  playSirenSound,
  playClickSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import {
  getRandomCityByCountry,
  CityData,
  isPointInsideBuilding,
} from './CityGenerator';
import { getGangStarText, GangStarTextKey } from './language';
import {
  WEAPONS,
  WeaponType,
  CityCar,
  Civilian,
  Gangster,
  LaserBeam,
  SparkParticle,
} from './StreetGangStar';
import { GangChat } from './GangChat';
import { StreetJoystick } from './StreetJoystick';

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facingAngle: number;
  health: number;
  team: 'blue' | 'red';
  gun: WeaponType;
  avatarColor: string;
  isCover: boolean;
  inCarId: string | null;
  jumpOffset?: number;
  lastReaction?: { emoji: string; until: number };
  lastSeen: number;
}

export interface MultiplayerMessage {
  type: 'player_sync' | 'laser_fire' | 'reaction' | 'host_sync' | 'kill_alert';
  senderId: string;
  payload: any;
}

interface StreetGangStarMultiplayerProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  language?: string;
  initialCountry?: string;
}

export function StreetGangStarMultiplayer({
  onBack,
  onToast,
  language = 'en',
  initialCountry = 'NG',
}: StreetGangStarPropsMultiplayer = {} as any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Translation helper
  const t = useCallback(
    (key: GangStarTextKey) => getGangStarText(language, key),
    [language]
  );

  // Connection & Room State
  const [inLobby, setInLobby] = useState<boolean>(true);
  const [roomCode, setRoomCode] = useState<string>('');
  const [customRoomInput, setCustomRoomInput] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myPlayerId] = useState<string>(
    () => `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );
  const [myPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('streetlife_username');
      if (saved) return saved;
    }
    return `Hustler_${Math.floor(100 + Math.random() * 900)}`;
  });

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Team Selection
  const [myTeam, setMyTeam] = useState<'blue' | 'red'>('blue');
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);

  // Gun Shop Modal
  const [showShopModal, setShowShopModal] = useState<boolean>(false);

  // Leaderboard Modal
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // City Map Definition (Shared by Room Code Seed)
  const [cityData, setCityData] = useState<CityData>(() =>
    getRandomCityByCountry(initialCountry, roomCode || 'STREET_DEFAULT')
  );

  // HUD State
  const [hudHealth, setHudHealth] = useState<number>(100);
  const [hudAmmo, setHudAmmo] = useState<number>(30);
  const [hudMaxAmmo, setHudMaxAmmo] = useState<number>(30);
  const [hudCoins, setHudCoins] = useState<number>(0);
  const [hudGun, setHudGun] = useState<WeaponType>('pistol');
  const [hudInCover, setHudInCover] = useState<boolean>(false);
  const [hudInCar, setHudInCar] = useState<boolean>(false);
  const [hudIsNearCar, setHudIsNearCar] = useState<boolean>(false);
  const [activePlayerCount, setActivePlayerCount] = useState<number>(1);

  // BroadcastChannel Reference
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Mutable Game Loop State
  const gameStateRef = useRef({
    player: {
      id: myPlayerId,
      name: myPlayerName,
      team: 'blue' as 'blue' | 'red',
      x: 1900,
      y: 1800,
      vx: 0,
      vy: 0,
      speed: 4.5,
      health: 100,
      maxHealth: 100,
      ammo: 30,
      maxAmmo: 30,
      gun: 'pistol' as WeaponType,
      coins: 0,
      facingAngle: 0,
      isCover: false,
      inCarId: null as string | null,
      lastShootTime: 0,
      isReloading: false,
      kills: 0,
      civiliansSaved: 0,
      jumpOffset: 0,
      jumpVy: 0,
      isJumping: false,
    },
    remotePlayers: new Map<string, RemotePlayer>(),
    unlockedGuns: {
      pistol: true,
      shotgun_laser: false,
      ak_laser: false,
      sniper_laser: false,
    } as Record<WeaponType, boolean>,
    cars: [] as CityCar[],
    civilians: [] as Civilian[],
    gangsters: [] as Gangster[],
    lasers: [] as LaserBeam[],
    sparks: [] as SparkParticle[],
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      mouseLeft: false,
    },
    joystickMovement: { dx: 0, dy: 0, isMoving: false },
    isRunActive: false,
    isMouseActive: false,
    mousePos: { x: 0, y: 0 },
    screenDim: { w: 800, h: 600 },
    lastSpawnTime: Date.now(),
    lastBroadcastTime: 0,
    myReaction: null as { emoji: string; until: number } | null,
    isRunning: false,
  });

  // Sound Player Safe Wrapper
  const playSfx = useCallback(
    (name: 'shoot' | 'reload' | 'pickup' | 'coin' | 'success' | 'siren' | 'click') => {
      if (!soundEnabled) return;
      if (name === 'shoot') playShootSound();
      else if (name === 'reload') playReloadSound();
      else if (name === 'pickup') playPickupSound();
      else if (name === 'coin') playCoinSound();
      else if (name === 'success') playSuccessSound();
      else if (name === 'siren') playSirenSound();
      else if (name === 'click') playClickSound();
    },
    [soundEnabled]
  );

  // 1. JOIN TYPE A: Create Invite Code Room
  const createRoom = () => {
    playClickSound();
    const code = `STREET${Math.floor(100 + Math.random() * 900)}`;
    setRoomCode(code);
    setIsHost(true);

    // Save to active rooms list in localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('gangstar_rooms') || '[]');
      saved.push({ code, status: 'playing', createdAt: Date.now() });
      localStorage.setItem('gangstar_rooms', JSON.stringify(saved.slice(-10)));
    } catch {}

    connectToRoom(code, true);
  };

  // 2. JOIN TYPE B: Quick Join Random City Room
  const joinRandomCity = () => {
    playClickSound();
    let targetCode = '';
    try {
      const saved = JSON.parse(localStorage.getItem('gangstar_rooms') || '[]');
      const active = saved.filter(
        (r: any) => Date.now() - r.createdAt < 30 * 60 * 1000
      );
      if (active.length > 0) {
        targetCode = active[Math.floor(Math.random() * active.length)].code;
      }
    } catch {}

    if (!targetCode) {
      // If none, create a new random city room
      targetCode = `STREET${Math.floor(100 + Math.random() * 900)}`;
      setIsHost(true);
    } else {
      setIsHost(false);
    }

    setRoomCode(targetCode);
    connectToRoom(targetCode, isHost);
  };

  // Join via manual input code
  const joinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customRoomInput.toUpperCase().trim();
    if (!cleaned) {
      onToast('Please enter a valid room code!');
      return;
    }
    playClickSound();
    setRoomCode(cleaned);
    setIsHost(false);
    connectToRoom(cleaned, false);
  };

  // Connect BroadcastChannel & Initialize City Map
  const connectToRoom = (code: string, hostStatus: boolean) => {
    if (channelRef.current) {
      channelRef.current.close();
    }

    const channelName = `gangstar_${code}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Generate shared map with roomCode seed
    const newCity = getRandomCityByCountry(initialCountry, code);
    setCityData(newCity);

    // Initialize Host Traffic & Civilians
    if (hostStatus) {
      const s = gameStateRef.current;
      const cars: CityCar[] = [];
      const colors = ['#38BDF8', '#F97316', '#A855F7', '#EF4444', '#10B981', '#E2E8F0', '#FACC15'];

      newCity.roads.forEach((road, idx) => {
        if (idx < 10) {
          const isHoriz = road.direction === 'horizontal';
          cars.push({
            id: `car_${idx}`,
            x: isHoriz ? (idx * 380) % newCity.mapWidth : road.x + 30,
            y: isHoriz ? road.y + 40 : (idx * 380) % newCity.mapHeight,
            vx: isHoriz ? 2.8 : 0,
            vy: isHoriz ? 0 : 2.8,
            speed: 2.8,
            direction: road.direction,
            width: isHoriz ? 54 : 30,
            height: isHoriz ? 30 : 54,
            color: colors[idx % colors.length],
            isOccupied: false,
            hasDriver: true,
            driverType: 'civilian',
          });
        }
      });
      s.cars = cars;

      const civs: Civilian[] = [];
      const civColors = ['#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#64748B'];
      for (let i = 0; i < 15; i++) {
        civs.push({
          id: `civ_${i}`,
          x: 1200 + ((i * 170) % 1800),
          y: 1100 + ((i * 190) % 1800),
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          speed: 1.2,
          facingAngle: Math.random() * Math.PI * 2,
          state: 'walking',
          color: civColors[i % civColors.length],
        });
      }
      s.civilians = civs;
    }

    // BroadcastChannel Message Listener
    channel.onmessage = (event: MessageEvent<MultiplayerMessage>) => {
      const msg = event.data;
      if (!msg || msg.senderId === myPlayerId) return;

      const s = gameStateRef.current;

      // 1. Remote Player Sync
      if (msg.type === 'player_sync') {
        const payload = msg.payload;
        const existing = s.remotePlayers.get(msg.senderId);

        if (existing) {
          existing.name = payload.name;
          existing.targetX = payload.x;
          existing.targetY = payload.y;
          existing.facingAngle = payload.facingAngle;
          existing.health = payload.health;
          existing.team = payload.team;
          existing.gun = payload.gun;
          existing.avatarColor = payload.avatarColor;
          existing.isCover = payload.isCover;
          existing.inCarId = payload.inCarId;
          existing.jumpOffset = payload.jumpOffset || 0;
          existing.lastSeen = Date.now();
        } else {
          s.remotePlayers.set(msg.senderId, {
            id: msg.senderId,
            name: payload.name,
            x: payload.x,
            y: payload.y,
            targetX: payload.x,
            targetY: payload.y,
            facingAngle: payload.facingAngle,
            health: payload.health,
            team: payload.team,
            gun: payload.gun,
            avatarColor: payload.avatarColor,
            isCover: payload.isCover,
            inCarId: payload.inCarId,
            jumpOffset: payload.jumpOffset || 0,
            lastSeen: Date.now(),
          });
        }
        setActivePlayerCount(s.remotePlayers.size + 1);
      }

      // 2. Laser Fire Event (From other players)
      else if (msg.type === 'laser_fire') {
        const p = msg.payload;
        s.lasers.push({
          id: `laser_${Date.now()}_${Math.random()}`,
          x1: p.x1,
          y1: p.y1,
          x2: p.x2,
          y2: p.y2,
          color: p.color,
          life: 7,
          maxLife: 7,
          isPlayer: false,
          damage: p.damage,
        });

        // Check if the laser hit local player
        const dist = Math.hypot(s.player.x - p.x2, s.player.y - p.y2);
        if (dist < 35) {
          const shooterTeam = p.team;
          // BETRAYAL CHECK: Even if both Blue, damage still applies!
          if (shooterTeam === s.player.team && s.player.team === 'blue') {
            onToast(t('betray_warning'));
            playSirenSound();
          }

          const appliedDamage = s.player.isCover ? Math.ceil(p.damage * 0.2) : p.damage;
          s.player.health = Math.max(0, s.player.health - appliedDamage);
          setHudHealth(s.player.health);

          if (s.player.health <= 0) {
            playSirenSound();
            onToast(t('player_down'));
            s.player.health = 100;
            s.player.x = 1900;
            s.player.y = 1800;
            setHudHealth(100);
          }
        }
      }

      // 3. Emoji Reactions floating above player
      else if (msg.type === 'reaction') {
        const rem = s.remotePlayers.get(msg.senderId);
        if (rem) {
          rem.lastReaction = {
            emoji: msg.payload.emoji,
            until: Date.now() + 2000,
          };
        }
      }

      // 4. Host Authority Sync (Cars, Civilians, Gangsters)
      else if (msg.type === 'host_sync' && !isHost) {
        s.cars = msg.payload.cars || s.cars;
        s.civilians = msg.payload.civilians || s.civilians;
        s.gangsters = msg.payload.gangsters || s.gangsters;
      }
    };

    setInLobby(false);
    gameStateRef.current.isRunning = true;
    playSuccessSound();
    onToast(`Connected to District Lobby: ${code}!`);
  };

  // Send Floating Emoji Reaction
  const handleSendReaction = (emoji: string) => {
    playClickSound();
    const s = gameStateRef.current;
    s.myReaction = { emoji, until: Date.now() + 2000 };

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'reaction',
        senderId: myPlayerId,
        payload: { emoji },
      });
    }
  };

  // Reload Weapon
  const handleReload = useCallback(() => {
    const s = gameStateRef.current;
    if (s.player.isReloading) return;
    const wDef = WEAPONS[s.player.gun];
    if (s.player.ammo >= wDef.maxAmmo) return;

    s.player.isReloading = true;
    playSfx('reload');
    onToast(t('reload_alert'));

    setTimeout(() => {
      s.player.ammo = wDef.maxAmmo;
      s.player.isReloading = false;
      setHudAmmo(wDef.maxAmmo);
    }, 900);
  }, [onToast, playSfx, t]);

  // Enter / Exit Vehicle (Press E)
  const handleToggleCar = useCallback(() => {
    const s = gameStateRef.current;
    const p = s.player;

    if (p.inCarId) {
      const car = s.cars.find((c) => c.id === p.inCarId);
      if (car) {
        car.isOccupied = false;
        car.hasDriver = false;
        car.driverType = null;
        p.x = car.x + 30;
        p.y = car.y + 30;
      }
      p.inCarId = null;
      setHudInCar(false);
      playSfx('click');
      onToast(t('car_exit'));
      return;
    }

    let nearestCar: CityCar | null = null;
    let minDist = 70;

    for (const c of s.cars) {
      const dist = Math.hypot(c.x - p.x, c.y - p.y);
      if (dist < minDist) {
        minDist = dist;
        nearestCar = c;
      }
    }

    if (nearestCar) {
      if (nearestCar.hasDriver && nearestCar.driverType === 'civilian') {
        nearestCar.hasDriver = false;
        nearestCar.driverType = 'player';
        nearestCar.isOccupied = true;
        p.inCarId = nearestCar.id;
        setHudInCar(true);
        playSfx('siren');
        onToast(t('car_hijacked'));
      } else if (!nearestCar.isOccupied) {
        nearestCar.isOccupied = true;
        nearestCar.hasDriver = true;
        nearestCar.driverType = 'player';
        p.inCarId = nearestCar.id;
        setHudInCar(true);
        playSfx('click');
        onToast(t('car_enter'));
      }
    }
  }, [onToast, playSfx, t]);

  // Toggle Cover (Press Q)
  const handleToggleCover = useCallback(() => {
    const s = gameStateRef.current;
    const p = s.player;

    let nearObstacle = false;
    for (const bld of cityData.buildings) {
      if (
        p.x >= bld.x - 40 &&
        p.x <= bld.x + bld.width + 40 &&
        p.y >= bld.y - 40 &&
        p.y <= bld.y + bld.height + 40
      ) {
        nearObstacle = true;
        break;
      }
    }

    if (!nearObstacle) {
      for (const car of s.cars) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 65) {
          nearObstacle = true;
          break;
        }
      }
    }

    if (nearObstacle) {
      p.isCover = !p.isCover;
      setHudInCover(p.isCover);
      playSfx('click');
      onToast(p.isCover ? t('cover_active') : t('cover_inactive'));
    } else {
      onToast(t('cover_inactive'));
    }
  }, [cityData.buildings, onToast, playSfx, t]);

  // Jump (Space or Joystick Jump Button)
  const handleJump = useCallback(() => {
    const s = gameStateRef.current;
    const p = s.player;
    if (p.isJumping || p.inCarId) return;
    p.isJumping = true;
    p.jumpVy = 8.5;
    playPickupSound();
    onToast('LEAP JUMP! 🚀');
  }, [onToast]);

  // Shoot Laser (With Betrayal System!)
  const shootPlayerLaser = useCallback(() => {
    const s = gameStateRef.current;
    const p = s.player;
    if (p.isReloading) return;
    if (p.ammo <= 0) {
      handleReload();
      return;
    }

    const wDef = WEAPONS[p.gun];
    const now = Date.now();
    if (now - p.lastShootTime < wDef.fireRateMs) return;

    p.lastShootTime = now;
    p.ammo -= 1;
    setHudAmmo(p.ammo);
    playSfx('shoot');

    const startX = p.inCarId
      ? (s.cars.find((c) => c.id === p.inCarId)?.x || p.x)
      : p.x + Math.cos(p.facingAngle) * 22;
    const startY = p.inCarId
      ? (s.cars.find((c) => c.id === p.inCarId)?.y || p.y)
      : p.y + Math.sin(p.facingAngle) * 22;

    const baseAngle = p.facingAngle;
    const spreadAngles =
      wDef.spread === 3
        ? [baseAngle - 0.14, baseAngle, baseAngle + 0.14]
        : [baseAngle];

    spreadAngles.forEach((ang) => {
      const beamLength = 480;
      const endX = startX + Math.cos(ang) * beamLength;
      const endY = startY + Math.sin(ang) * beamLength;

      s.lasers.push({
        id: `laser_${now}_${Math.random()}`,
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        color: wDef.laserColor,
        life: 7,
        maxLife: 7,
        isPlayer: true,
        damage: wDef.damage,
      });

      // Broadcast laser fire to other room participants
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'laser_fire',
          senderId: myPlayerId,
          payload: {
            x1: startX,
            y1: startY,
            x2: endX,
            y2: endY,
            color: wDef.laserColor,
            damage: wDef.damage,
            team: myTeam,
          },
        });
      }
    });
  }, [handleReload, myPlayerId, myTeam, playSfx]);

  // Keyboard Event Listeners
  useEffect(() => {
    if (inLobby) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const s = gameStateRef.current;

      if (k === 'w' || e.key === 'ArrowUp') s.keys.w = true;
      if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = true;
      if (k === 's' || e.key === 'ArrowDown') s.keys.s = true;
      if (k === 'd' || e.key === 'ArrowRight') s.keys.d = true;
      if (e.key === 'Shift') s.keys.shift = true;
      if (e.code === 'Space') handleJump();
      if (k === 'r') handleReload();
      if (k === 'e') handleToggleCar();
      if (k === 'q') handleToggleCover();
      if (k === 'b') {
        setShowShopModal((prev) => !prev);
        playSfx('click');
      }
      if (k === 't') {
        setShowTeamModal((prev) => !prev);
        playSfx('click');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const s = gameStateRef.current;

      if (k === 'w' || e.key === 'ArrowUp') s.keys.w = false;
      if (k === 'a' || e.key === 'ArrowLeft') s.keys.a = false;
      if (k === 's' || e.key === 'ArrowDown') s.keys.s = false;
      if (k === 'd' || e.key === 'ArrowRight') s.keys.d = false;
      if (e.key === 'Shift') s.keys.shift = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [inLobby, handleReload, handleToggleCar, handleToggleCover, handleJump, playSfx]);

  // Main 60FPS Multiplayer Loop
  useEffect(() => {
    if (inLobby) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameStateRef.current.screenDim = { w: canvas.width, h: canvas.height };
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      gameStateRef.current.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      gameStateRef.current.isMouseActive = true;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        gameStateRef.current.keys.mouseLeft = true;
        shootPlayerLaser();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        gameStateRef.current.keys.mouseLeft = false;
      }
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    const loop = () => {
      const s = gameStateRef.current;
      const p = s.player;
      const now = Date.now();

      if (s.keys.mouseLeft) {
        shootPlayerLaser();
      }

      // 1. BROADCAST POSITION SYNC EVERY 100ms
      if (now - s.lastBroadcastTime >= 100 && channelRef.current) {
        s.lastBroadcastTime = now;
        channelRef.current.postMessage({
          type: 'player_sync',
          senderId: myPlayerId,
          payload: {
            name: myPlayerName,
            x: p.x,
            y: p.y,
            facingAngle: p.facingAngle,
            health: p.health,
            team: myTeam,
            gun: p.gun,
            avatarColor: '#FFD700',
            isCover: p.isCover,
            inCarId: p.inCarId,
            jumpOffset: p.jumpOffset,
          },
        });

        // Host Syncs Gangsters, Cars, and Civilians
        if (isHost) {
          channelRef.current.postMessage({
            type: 'host_sync',
            senderId: myPlayerId,
            payload: {
              cars: s.cars,
              civilians: s.civilians,
              gangsters: s.gangsters,
            },
          });
        }
      }

      // 2. LERP REMOTE PLAYERS SMOOTHLY
      s.remotePlayers.forEach((rem, remId) => {
        rem.x += (rem.targetX - rem.x) * 0.25;
        rem.y += (rem.targetY - rem.y) * 0.25;

        // Disconnect timeout if no message in 8 seconds
        if (now - rem.lastSeen > 8000) {
          s.remotePlayers.delete(remId);
          setActivePlayerCount(s.remotePlayers.size + 1);
        }
      });

      // 3. HOST AUTHORITY: SPAWN GANGSTERS EVERY 5 SECONDS
      if (isHost && now - s.lastSpawnTime >= 5000) {
        s.lastSpawnTime = now;
        const edge = cityData.gangsterSpawnEdges[Math.floor(Math.random() * cityData.gangsterSpawnEdges.length)];
        const isBus = Math.random() > 0.65;

        s.gangsters.push({
          id: `gangster_${now}_${Math.random()}`,
          type: isBus ? 'fighter_bus' : 'fighter_motor',
          x: edge.x,
          y: edge.y,
          vx: 0,
          vy: 0,
          health: isBus ? 80 : 50,
          maxHealth: isBus ? 80 : 50,
          speed: isBus ? 1.8 : 3.2,
          facingAngle: 0,
          gun: isBus ? 'shotgun_laser' : 'ak_laser',
          lastShootTime: now,
          vehicleType: isBus ? 'bus' : 'motorcycle',
        });
      }

      // 4. JUMP PHYSICS & CAR PROXIMITY CHECK
      if (p.isJumping) {
        p.jumpOffset += p.jumpVy;
        p.jumpVy -= 0.65;
        if (p.jumpOffset <= 0) {
          p.jumpOffset = 0;
          p.jumpVy = 0;
          p.isJumping = false;
        }
      }

      // Check proximity to cars
      let nearCarFound = false;
      for (const car of s.cars) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 75) {
          nearCarFound = true;
          break;
        }
      }
      setHudIsNearCar((prev) => (prev !== nearCarFound ? nearCarFound : prev));

      // 5. LOCAL PLAYER MOVEMENT (Keyboard + Joystick + Run)
      const isSprinting = s.keys.shift || s.isRunActive;
      if (p.inCarId) {
        const car = s.cars.find((c) => c.id === p.inCarId);
        if (car) {
          const driveSpeed = isSprinting ? 7.5 : 5.0;
          if (s.joystickMovement.isMoving) {
            car.x += s.joystickMovement.dx * driveSpeed;
            car.y += s.joystickMovement.dy * driveSpeed;
          } else {
            if (s.keys.w) car.y -= driveSpeed;
            if (s.keys.s) car.y += driveSpeed;
            if (s.keys.a) car.x -= driveSpeed;
            if (s.keys.d) car.x += driveSpeed;
          }

          car.x = Math.max(80, Math.min(cityData.mapWidth - 80, car.x));
          car.y = Math.max(80, Math.min(cityData.mapHeight - 80, car.y));

          p.x = car.x;
          p.y = car.y;
        }
      } else {
        const moveSpeed = isSprinting ? p.speed * 1.65 : p.speed;
        let dx = 0;
        let dy = 0;

        if (s.joystickMovement.isMoving) {
          dx = s.joystickMovement.dx;
          dy = s.joystickMovement.dy;
          if (!s.isMouseActive) {
            p.facingAngle = Math.atan2(dy, dx);
          }
        } else {
          if (s.keys.w) dy -= 1;
          if (s.keys.s) dy += 1;
          if (s.keys.a) dx -= 1;
          if (s.keys.d) dx += 1;

          if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
          }
        }

        const nextX = p.x + dx * moveSpeed;
        const nextY = p.y + dy * moveSpeed;

        const hit = isPointInsideBuilding(nextX, nextY, cityData.buildings, 12);
        if (!hit.inside || hit.nearDoor || p.jumpOffset > 15) {
          p.x = Math.max(40, Math.min(cityData.mapWidth - 40, nextX));
          p.y = Math.max(40, Math.min(cityData.mapHeight - 40, nextY));
        }
      }

      // Camera Offset
      const cameraX = Math.max(
        0,
        Math.min(cityData.mapWidth - s.screenDim.w, p.x - s.screenDim.w / 2)
      );
      const cameraY = Math.max(
        0,
        Math.min(cityData.mapHeight - s.screenDim.h, p.y - s.screenDim.h / 2)
      );

      // Facing Angle towards Mouse (if mouse is active)
      if (s.isMouseActive) {
        const playerScreenX = p.x - cameraX;
        const playerScreenY = p.y - cameraY;
        p.facingAngle = Math.atan2(
          s.mousePos.y - playerScreenX,
          s.mousePos.x - playerScreenX
        );
      }

      // 5. UPDATE GANGSTERS & LASER HITS (Kill Gangster = +5 Coins, Kill Player = +10 Coins)
      for (let lIdx = s.lasers.length - 1; lIdx >= 0; lIdx--) {
        const l = s.lasers[lIdx];
        l.life -= 1;

        if (l.isPlayer) {
          // Check collision on Gangsters
          for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
            const g = s.gangsters[gIdx];
            if (Math.hypot(g.x - l.x2, g.y - l.y2) < 45) {
              g.health -= l.damage;
              if (g.health <= 0) {
                s.gangsters.splice(gIdx, 1);
                p.coins += 5; // +5 coins
                p.kills += 1;
                setHudCoins(p.coins);
                addGameCoins(5, '+5 SC - Multiplayer Gangster Kill', 'task_reward');
                playSfx('coin');
              }
              break;
            }
          }

          // Check collision on Remote Players (Betrayal Allowed!)
          s.remotePlayers.forEach((rem) => {
            if (Math.hypot(rem.x - l.x2, rem.y - l.y2) < 30) {
              // Teammate Betrayal Warning Alert!
              if (rem.team === myTeam && myTeam === 'blue') {
                onToast(t('betray_warning'));
              }
              p.coins += 10; // +10 coins for player kill
              setHudCoins(p.coins);
              addGameCoins(10, '+10 SC - Player Combat Hit', 'task_reward');
              playSfx('coin');
            }
          });
        }

        if (l.life <= 0) s.lasers.splice(lIdx, 1);
      }

      // ==========================================
      // RENDER CANVAS (MULTIPLAYER DISTIRCT)
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Ground
      ctx.fillStyle = cityData.theme.groundGrassColor;
      ctx.fillRect(0, 0, cityData.mapWidth, cityData.mapHeight);

      // Roads
      cityData.roads.forEach((road) => {
        ctx.fillStyle = cityData.theme.asphaltColor;
        ctx.fillRect(road.x, road.y, road.width, road.height);

        ctx.strokeStyle = cityData.theme.roadMarkingColor;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([25, 25]);
        if (road.direction === 'horizontal') {
          const midY = road.y + road.height / 2;
          ctx.beginPath();
          ctx.moveTo(road.x, midY);
          ctx.lineTo(road.x + road.width, midY);
          ctx.stroke();
        } else {
          const midX = road.x + road.width / 2;
          ctx.beginPath();
          ctx.moveTo(midX, road.y);
          ctx.lineTo(midX, road.y + road.height);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      });

      // Buildings
      cityData.buildings.forEach((bld) => {
        ctx.fillStyle = bld.wallColor;
        ctx.fillRect(bld.x, bld.y, bld.width, bld.height);

        ctx.strokeStyle = bld.roofColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(bld.x + 6, bld.y + 6, bld.width - 12, bld.height - 12);
      });

      // Traffic Cars
      s.cars.forEach((car) => {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6);
        ctx.fill();
        ctx.restore();
      });

      // Gangsters
      s.gangsters.forEach((g) => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.facingAngle);
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Lasers
      s.lasers.forEach((l) => {
        ctx.save();
        ctx.strokeStyle = l.color;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.restore();
      });

      // Remote Players
      s.remotePlayers.forEach((rem) => {
        // Shadow beneath remote player
        ctx.save();
        ctx.translate(rem.x, rem.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        const rShadowScale = Math.max(0.4, 1 - (rem.jumpOffset || 0) / 45);
        ctx.beginPath();
        ctx.ellipse(0, 6, 14 * rShadowScale, 8 * rShadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(rem.x, rem.y - (rem.jumpOffset || 0));
        ctx.rotate(rem.facingAngle);

        ctx.fillStyle = rem.team === 'blue' ? '#38BDF8' : '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.rotate(-rem.facingAngle);

        // Name Tag
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rem.name, 0, -22);

        // Emoji Reaction
        if (rem.lastReaction && now < rem.lastReaction.until) {
          ctx.font = '18px sans-serif';
          ctx.fillText(rem.lastReaction.emoji, 0, -36);
        }

        ctx.restore();
      });

      // Local Player
      if (!p.inCarId) {
        // Ground shadow beneath local player
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        const shadowScale = Math.max(0.4, 1 - (p.jumpOffset || 0) / 45);
        ctx.beginPath();
        ctx.ellipse(0, 6, 14 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Elevated player body
        ctx.save();
        ctx.translate(p.x, p.y - (p.jumpOffset || 0));
        ctx.rotate(p.facingAngle);

        ctx.fillStyle = myTeam === 'blue' ? '#0284C7' : '#DC2626';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Barrel
        ctx.fillStyle = '#334155';
        ctx.fillRect(8, 2, 16, 4);

        ctx.rotate(-p.facingAngle);

        // Name tag & Emoji
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${myPlayerName} (YOU)`, 0, -22);

        if (s.myReaction && now < s.myReaction.until) {
          ctx.font = '18px sans-serif';
          ctx.fillText(s.myReaction.emoji, 0, -36);
        }

        ctx.restore();
      }

      ctx.restore();

      // --- SCREEN OVERLAY: HIGH-TECH RADAR (TOP RIGHT) ---
      const mmSize = 120;
      const mmX = s.screenDim.w - mmSize - 16;
      const mmY = 56; // Below emoji bar

      ctx.save();
      // Radar Background box
      ctx.fillStyle = 'rgba(8, 10, 18, 0.88)';
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, mmSize, mmSize, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Concentric rings
      const mmCenterX = mmX + mmSize / 2;
      const mmCenterY = mmY + mmSize / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mmCenterX, mmCenterY, mmSize * 0.42, 0, Math.PI * 2);
      ctx.arc(mmCenterX, mmCenterY, mmSize * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      // Gangsters (Red blips)
      ctx.fillStyle = '#EF4444';
      s.gangsters.forEach((g) => {
        const gx = mmX + (g.x / cityData.mapWidth) * mmSize;
        const gy = mmY + (g.y / cityData.mapHeight) * mmSize;
        ctx.beginPath();
        ctx.arc(gx, gy, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Remote Players (Blue or Red dots)
      s.remotePlayers.forEach((rp) => {
        const rx = mmX + (rp.x / cityData.mapWidth) * mmSize;
        const ry = mmY + (rp.y / cityData.mapHeight) * mmSize;
        ctx.fillStyle = rp.team === 'blue' ? '#38BDF8' : '#F87171';
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Local Player (Gold / Cyan blip)
      const px = mmX + (p.x / cityData.mapWidth) * mmSize;
      const py = mmY + (p.y / cityData.mapHeight) * mmSize;
      ctx.fillStyle = myTeam === 'blue' ? '#38BDF8' : '#EF4444';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Radar Label
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('LIVE MAP', mmX + mmSize - 6, mmY + mmSize - 6);

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [inLobby, cityData, myPlayerId, myPlayerName, myTeam, isHost, shootPlayerLaser, playSfx, onToast, t]);

  // ==========================================
  // LOBBY SCREEN (TYPE A & TYPE B JOIN)
  // ==========================================
  if (inLobby) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0B10] text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              type="button"
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-[#FFD700]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2">
                <span>{t('multiplayer_title')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500 text-red-400">
                  LIVE 20 PLAYERS
                </span>
              </h1>
              <p className="text-xs text-gray-400">Persistent Wide 4KM City • Betrayal Allowed</p>
            </div>
          </div>
        </div>

        {/* Join Cards Center */}
        <div className="w-full max-w-md mx-auto my-auto space-y-4 py-6">
          {/* TYPE A: CREATE INVITE CODE ROOM */}
          <div className="p-5 rounded-3xl bg-gradient-to-b from-[#181A24] to-[#10121A] border-2 border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
            <div className="flex items-center gap-2 text-[#FFD700] mb-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-sm font-black uppercase tracking-wider">TYPE A: INVITE CODE ROOM</h2>
            </div>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              Create a custom district lobby with a room code (e.g. STREET101) to invite friends.
            </p>
            <button
              onClick={createRoom}
              type="button"
              className="w-full py-3.5 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase tracking-wider active:scale-95 hover:brightness-110 shadow-lg shadow-[#FFD700]/30 transition-all cursor-pointer"
            >
              {t('create_room')}
            </button>
          </div>

          {/* TYPE B: QUICK JOIN RANDOM CITY */}
          <div className="p-5 rounded-3xl bg-gradient-to-b from-[#181A24] to-[#10121A] border-2 border-sky-500/50 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
            <div className="flex items-center gap-2 text-sky-400 mb-2">
              <Radio className="w-5 h-5 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-wider">TYPE B: RANDOM CITY MATCH</h2>
            </div>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              Instantly find and drop into any active public city warfare zone.
            </p>
            <button
              onClick={joinRandomCity}
              type="button"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs uppercase tracking-wider active:scale-95 hover:brightness-110 shadow-lg shadow-sky-500/30 transition-all cursor-pointer"
            >
              {t('random_city')}
            </button>
          </div>

          {/* MANUAL ROOM CODE INPUT */}
          <form
            onSubmit={joinWithCode}
            className="p-4 rounded-3xl bg-black/60 border border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={customRoomInput}
              onChange={(e) => setCustomRoomInput(e.target.value)}
              placeholder={t('invite_code')}
              className="flex-1 bg-transparent px-3 py-2 text-xs font-mono font-bold text-white placeholder-gray-500 focus:outline-none uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase active:scale-95 cursor-pointer"
            >
              JOIN
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-gray-500 font-medium">
          Supports up to 20 players per city • Auto-synchronized with BroadcastChannel
        </div>
      </div>
    );
  }

  // ==========================================
  // IN-GAME MULTIPLAYER HUD
  // ==========================================
  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* TOP LEFT: DISTRICT & HEALTH */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-2 max-w-xs pointer-events-none">
        <div className="p-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playSfx('click');
                onBack();
              }}
              type="button"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-white"
            >
              <ArrowLeft className="w-4 h-4 text-[#FFD700]" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  {roomCode} • {cityData.streetName}
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                {cityData.cityName} ({activePlayerCount} {t('players_online')})
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(roomCode);
              setCopiedCode(true);
              onToast(`Copied Room Code: ${roomCode}`);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            type="button"
            className="p-1.5 rounded-xl bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] pointer-events-auto"
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Health & Ammo */}
        <div className="p-2.5 rounded-2xl bg-black/85 border border-[#FFD700]/30 backdrop-blur-md shadow-xl space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1 text-red-400">
                <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                <span>{t('health')}</span>
              </span>
              <span className="font-mono text-white">{hudHealth}%</span>
            </div>
            <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, hudHealth))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1 text-[#FFD700]">
                <Zap className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" />
                <span>{t('ammo')}</span>
              </span>
              <span className="font-mono text-white">
                {hudAmmo} / {hudMaxAmmo}
              </span>
            </div>
            <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-[#FFD700] transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, (hudAmmo / hudMaxAmmo) * 100))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] font-mono">
            <span className="text-[#FFD700] font-black">
              {hudCoins} SC (+10/player)
            </span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                myTeam === 'blue' ? 'bg-sky-500/20 text-sky-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {myTeam === 'blue' ? 'TEAM BLUE' : 'TEAM RED'}
            </span>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: EMOJI REACTIONS BAR & RADAR */}
      <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md">
          {['🔥', '💀', '💰', '👑', '🔫', '🛡️'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              type="button"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-base active:scale-90 transition-all cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>


      </div>

      {/* TOP BAR UTILITIES: SHOP [B] & TEAM [T] */}
      <div className="absolute top-3 right-60 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => {
            playSfx('click');
            setShowShopModal(true);
          }}
          type="button"
          className="px-3 py-2 rounded-2xl bg-black/85 border border-[#FFD700]/70 text-[#FFD700] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,215,0,0.25)] active:scale-95 transition-all cursor-pointer backdrop-blur-md"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="hidden sm:inline">SHOP [B]</span>
        </button>

        <button
          onClick={() => {
            playSfx('click');
            setShowTeamModal(true);
          }}
          type="button"
          className="p-2 rounded-2xl bg-black/85 border border-white/20 text-white font-black text-xs uppercase active:scale-95 transition-all cursor-pointer hover:border-[#FFD700] backdrop-blur-md"
          title="Change Team"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

      {/* GANG CHAT COMPONENT (Real-Time Messaging with BroadcastChannel & Emoji Reactions) */}
      <GangChat
        roomCode={roomCode}
        playerId={myPlayerId}
        playerName={myPlayerName}
        playerTeam={myTeam}
        onToast={onToast}
      />

      {/* VIRTUAL JOYSTICK & ACTION CONTROLS: Left, Right, Jump, Shoot, Hijack Car when close to car, Run */}
      <StreetJoystick
        onMove={(movement) => {
          gameStateRef.current.joystickMovement = movement;
          if (movement.isMoving) {
            gameStateRef.current.isMouseActive = false;
          }
        }}
        onJump={handleJump}
        onShoot={shootPlayerLaser}
        onRunToggle={(running) => {
          gameStateRef.current.isRunActive = running;
        }}
        onHijackOrEnterCar={handleToggleCar}
        isNearCar={hudIsNearCar}
        isInCar={hudInCar}
        isCover={hudInCover}
        onCoverToggle={handleToggleCover}
        onReload={handleReload}
        ammo={hudAmmo}
        maxAmmo={hudMaxAmmo}
      />

      {/* TEAM SELECTION MODAL [T] */}
      {showTeamModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {t('team_join')}
              </h3>
              <button
                onClick={() => setShowTeamModal(false)}
                type="button"
                className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setMyTeam('blue');
                  gameStateRef.current.player.team = 'blue';
                  setShowTeamModal(false);
                  playSfx('click');
                  onToast('Switched to Blue Syndicate Defend Team!');
                }}
                type="button"
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  myTeam === 'blue'
                    ? 'bg-sky-950/60 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'bg-black/50 border-white/10'
                }`}
              >
                <h4 className="text-xs font-black uppercase text-sky-400">{t('team_blue')}</h4>
                <p className="text-[11px] text-gray-300 mt-1">{t('team_blue_desc')}</p>
              </button>

              <button
                onClick={() => {
                  setMyTeam('red');
                  gameStateRef.current.player.team = 'red';
                  setShowTeamModal(false);
                  playSfx('click');
                  onToast('Switched to Red Corsairs Free-For-All!');
                }}
                type="button"
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  myTeam === 'red'
                    ? 'bg-red-950/60 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    : 'bg-black/50 border-white/10'
                }`}
              >
                <h4 className="text-xs font-black uppercase text-red-400">{t('team_red')}</h4>
                <p className="text-[11px] text-gray-300 mt-1">{t('team_red_desc')}</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Typing aliases for export compatibility
type StreetGangStarPropsMultiplayer = StreetGangStarMultiplayerProps;
