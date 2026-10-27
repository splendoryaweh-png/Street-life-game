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
  ChevronRight,
  Sparkles,
  Trophy,
  Flame,
  Radio,
  Eye,
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
  Building,
  Compound,
  Road,
  isPointInsideBuilding,
} from './CityGenerator';
import { getGangStarText, GangStarTextKey } from './language';
import { StreetGangStarIntro } from './Intro';
import { StreetJoystick, JoystickMovement } from './StreetJoystick';

export type WeaponType = 'pistol' | 'shotgun_laser' | 'ak_laser' | 'sniper_laser';

export interface WeaponDef {
  id: WeaponType;
  nameKey: GangStarTextKey;
  damage: number;
  maxAmmo: number;
  fireRateMs: number;
  laserColor: string;
  price: number;
  bulletSpeed: number;
  spread: number;
}

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  pistol: {
    id: 'pistol',
    nameKey: 'weapon_pistol',
    damage: 10,
    maxAmmo: 30,
    fireRateMs: 240,
    laserColor: '#38BDF8', // Cyan
    price: 0,
    bulletSpeed: 18,
    spread: 1,
  },
  shotgun_laser: {
    id: 'shotgun_laser',
    nameKey: 'weapon_shotgun',
    damage: 25,
    maxAmmo: 10,
    fireRateMs: 650,
    laserColor: '#FACC15', // Gold
    price: 50,
    bulletSpeed: 16,
    spread: 3,
  },
  ak_laser: {
    id: 'ak_laser',
    nameKey: 'weapon_ak',
    damage: 15,
    maxAmmo: 60,
    fireRateMs: 120,
    laserColor: '#EC4899', // Pink / Magenta
    price: 100,
    bulletSpeed: 20,
    spread: 1,
  },
  sniper_laser: {
    id: 'sniper_laser',
    nameKey: 'weapon_sniper',
    damage: 50,
    maxAmmo: 5,
    fireRateMs: 900,
    laserColor: '#22C55E', // Red
    price: 200,
    bulletSpeed: 58,
    spread: 5,
  },
};

export interface LaserBeam {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
  isPlayer: boolean;
  damage: number;
}

export interface CityCar {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  direction: 'horizontal' | 'vertical';
  width: number;
  height: number;
  color: string;
  isOccupied: boolean;
  hasDriver: boolean;
  driverType: 'civilian' | 'player' | 'gangster' | null;
}

export interface Civilian {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  facingAngle: number;
  state: 'walking' | 'scared' | 'saved';
  color: string;
}

export interface Gangster {
  id: string;
  type: 'fighter_motor' | 'fighter_bus';
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  speed: number;
  facingAngle: number;
  gun: WeaponType;
  lastShootTime: number;
  vehicleType: 'motorcycle' | 'bus';
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

interface StreetGangStarProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  language?: string;
  initialCountry?: string;
}

export function StreetGangStar({
  onBack,
  onToast,
  language = 'en',
  initialCountry = 'NG',
}: StreetGangStarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Translation helper
  const t = useCallback(
    (key: GangStarTextKey) => getGangStarText(language, key),
    [language]
  );

  // Story Intro State
  const [showIntro, setShowIntro] = useState<boolean>(true);

  // Avatar Customization Modal
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(false);
  const [avatarColor, setAvatarColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gangstar_avatar_color') || '#FFD700';
    }
    return '#FFD700';
  });
  const [avatarMask, setAvatarMask] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gangstar_avatar_mask') || 'bandana';
    }
    return 'bandana';
  });

  // Gun Shop Modal
  const [showShopModal, setShowShopModal] = useState<boolean>(false);

  // Faction / Team selection modal
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [playerTeam, setPlayerTeam] = useState<'blue' | 'red'>('blue');

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // City Map Definition
  const [cityData] = useState<CityData>(() =>
    getRandomCityByCountry(initialCountry, 'single_player_seed')
  );

  // HUD / React Display State
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

  // Mutable Game Loop State
  const gameStateRef = useRef({
    player: {
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
      jumpOffset: 0,
      jumpVy: 0,
      isJumping: false,
    },
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

  // Initialize Traffic Cars & Civilians
  const initTrafficAndCivilians = useCallback(() => {
    const s = gameStateRef.current;

    // 1. 10 Traffic Cars along roads
    const cars: CityCar[] = [];
    const colors = ['#38BDF8', '#F97316', '#A855F7', '#EF4444', '#10B981', '#E2E8F0', '#FACC15'];

    cityData.roads.forEach((road, idx) => {
      if (idx < 10) {
        const isHoriz = road.direction === 'horizontal';
        const carW = isHoriz ? 54 : 30;
        const carH = isHoriz ? 30 : 54;
        const startX = isHoriz ? (idx * 380) % cityData.mapWidth : road.x + 30;
        const startY = isHoriz ? road.y + 40 : (idx * 380) % cityData.mapHeight;
        const speed = 2.4 + (idx % 3) * 0.5;

        cars.push({
          id: `car_${idx}`,
          x: startX,
          y: startY,
          vx: isHoriz ? speed : 0,
          vy: isHoriz ? 0 : speed,
          speed,
          direction: road.direction,
          width: carW,
          height: carH,
          color: colors[idx % colors.length],
          isOccupied: false,
          hasDriver: true, // civilian driver
          driverType: 'civilian',
        });
      }
    });
    s.cars = cars;

    // 2. 15 Civilians Walking on sidewalks / alleys
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
  }, [cityData]);

  // Restart / Setup Game
  const setupGame = useCallback(() => {
    const s = gameStateRef.current;
    s.player.x = 1900;
    s.player.y = 1800;
    s.player.health = 100;
    s.player.ammo = WEAPONS.pistol.maxAmmo;
    s.player.maxAmmo = WEAPONS.pistol.maxAmmo;
    s.player.gun = 'pistol';
    s.player.isCover = false;
    s.player.inCarId = null;
    s.gangsters = [];
    s.lasers = [];
    s.sparks = [];
    s.lastSpawnTime = Date.now();
    s.isRunning = true;

    setHudHealth(100);
    setHudAmmo(WEAPONS.pistol.maxAmmo);
    setHudMaxAmmo(WEAPONS.pistol.maxAmmo);
    setHudGun('pistol');
    setHudInCover(false);
    setHudInCar(false);

    initTrafficAndCivilians();
  }, [initTrafficAndCivilians]);

  // Handle Intro Finished
  const handleStartFromIntro = () => {
    setShowIntro(false);
    setupGame();
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
      // Exit Vehicle
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

    // Try Enter Nearest Empty Car within 60px
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
        // Hijack vehicle from civilian driver
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

    // Check if player is near any building (within 50px)
    let nearBuildingOrCar = false;
    for (const bld of cityData.buildings) {
      if (
        p.x >= bld.x - 40 &&
        p.x <= bld.x + bld.width + 40 &&
        p.y >= bld.y - 40 &&
        p.y <= bld.y + bld.height + 40
      ) {
        nearBuildingOrCar = true;
        break;
      }
    }

    if (!nearBuildingOrCar) {
      for (const car of s.cars) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 65) {
          nearBuildingOrCar = true;
          break;
        }
      }
    }

    if (nearBuildingOrCar) {
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

  // Fire Player Laser
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

    // Laser Origin (Player position)
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
      const beamLength = 450;
      const endX = startX + Math.cos(ang) * beamLength;
      const endY = startY + Math.sin(ang) * beamLength;

      s.lasers.push({
        id: `laser_${Date.now()}_${Math.random()}`,
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
    });
  }, [handleReload, playSfx]);

  // Purchase Weapon in Shop
  const handleBuyWeapon = (wKey: WeaponType) => {
    const s = gameStateRef.current;
    const wDef = WEAPONS[wKey];

    if (s.player.coins < wDef.price) {
      onToast(t('insufficient_coins'));
      return;
    }

    s.player.coins -= wDef.price;
    s.unlockedGuns[wKey] = true;
    s.player.gun = wKey;
    s.player.ammo = wDef.maxAmmo;
    s.player.maxAmmo = wDef.maxAmmo;

    setHudCoins(s.player.coins);
    setHudGun(wKey);
    setHudAmmo(wDef.maxAmmo);
    setHudMaxAmmo(wDef.maxAmmo);

    playSfx('success');
    onToast(`${t('purchased')} ${t(wDef.nameKey)}`);
    setShowShopModal(false);
  };

  // Keyboard Event Listeners
  useEffect(() => {
    if (showIntro) return;

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
  }, [showIntro, handleReload, handleToggleCar, handleToggleCover, handleJump, playSfx]);

  // Main Canvas 60FPS Game Loop
  useEffect(() => {
    if (showIntro) return;
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

    // Main Update & Render Loop
    const loop = () => {
      const s = gameStateRef.current;
      const p = s.player;
      const now = Date.now();

      // Continuous shooting while mouse held down
      if (s.keys.mouseLeft) {
        shootPlayerLaser();
      }

      // 1. GANGSTER SPAWN SYSTEM: 1-2 gangsters every 5 seconds
      if (now - s.lastSpawnTime >= 5000) {
        s.lastSpawnTime = now;
        const edge = cityData.gangsterSpawnEdges[Math.floor(Math.random() * cityData.gangsterSpawnEdges.length)];
        const isBus = Math.random() > 0.65;

        s.gangsters.push({
          id: `gangster_${Date.now()}_${Math.random()}`,
          type: isBus ? 'fighter_bus' : 'fighter_motor',
          x: edge.x,
          y: edge.y,
          vx: 0,
          vy: 0,
          health: isBus ? 20 : 30,
          maxHealth: isBus ? 20 : 30,
          speed: isBus ? 1.8 : 3.2,
          facingAngle: 0,
          gun: isBus ? 'shotgun_laser' : 'ak_laser',
          lastShootTime: now,
          vehicleType: isBus ? 'bus' : 'motorcycle',
        });
      }

      // 2. JUMP PHYSICS & CAR PROXIMITY CHECK
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

      // 3. PLAYER MOVEMENT & CAR PHYSICS (Supports Keyboard + Joystick + Run)
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

          // Clamp to city
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

        // Collision with Building walls (Allow clearing low fences when leaping/jumping)
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

      // Player Aim Angle towards Mouse (if mouse has interacted)
      if (s.isMouseActive) {
        const playerScreenX = p.x - cameraX;
        const playerScreenY = p.y - cameraY;
        p.facingAngle = Math.atan2(
          s.mousePos.y - playerScreenY,
          s.mousePos.x - playerScreenX
        );
      }

      // 3. UPDATE TRAFFIC CARS
      s.cars.forEach((car) => {
        if (!car.isOccupied) {
          if (car.direction === 'horizontal') {
            car.x += car.vx;
            if (car.x > cityData.mapWidth + 80) car.x = -80;
            if (car.x < -80) car.x = cityData.mapWidth + 80;
          } else {
            car.y += car.vy;
            if (car.y > cityData.mapHeight + 80) car.y = -80;
            if (car.y < -80) car.y = cityData.mapHeight + 80;
          }
        }
      });

      // 4. UPDATE CIVILIANS & GANGSTER AI
      s.civilians.forEach((civ) => {
        // Check if any gangster is near (< 3000px)
        let threatNear = false;
        let threatX = 0;
        let threatY = 0;

        for (const g of s.gangsters) {
          const d = Math.hypot(g.x - civ.x, g.y - civ.y);
          if (d < 110) {
            threatNear = true;
            threatX = g.x;
            threatY = g.y;
            break;
          }
        }

        if (threatNear) {
          civ.state = 'scared';
          // Run in opposite direction
          const awayAngle = Math.atan2(civ.y - threatY, civ.x - threatX);
          civ.x += Math.cos(awayAngle) * 2.8;
          civ.y += Math.sin(awayAngle) * 2.8;
          civ.facingAngle = awayAngle;
        } else {
          // Wander peacefully
          if (civ.state === 'scared') {
            civ.state = 'saved';
            setCiviliansSavedCount((c) => c + 1);
            p.coins += 2;
            setHudCoins(p.coins);
          }
          civ.x += Math.cos(civ.facingAngle) * civ.speed;
          civ.y += Math.sin(civ.facingAngle) * civ.speed;
          if (Math.random() < 0.02) {
            civ.facingAngle += (Math.random() - 0.5) * 1.5;
          }
        }

        // Clamp
        civ.x = Math.max(80, Math.min(cityData.mapWidth - 80, civ.x));
        civ.y = Math.max(80, Math.min(cityData.mapHeight - 80, civ.y));
      });

      // 5. GANGSTERS AI (Priority 1: Civilian, Priority 2: Player)
      for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
        const g = s.gangsters[gIdx];

        // Find Target: Nearest Civilian
        let targetX = p.x;
        let targetY = p.y;
        let targetDist = Math.hypot(p.x - g.x, p.y - g.y);

        for (const c of s.civilians) {
          const cDist = Math.hypot(c.x - g.x, c.y - g.y);
          if (cDist < targetDist) {
            targetDist = cDist;
            targetX = c.x;
            targetY = c.y;
          }
        }

        // Move towards target
        const aimAngle = Math.atan2(targetY - g.y, targetX - g.x);
        g.facingAngle = aimAngle;
        g.x += Math.cos(aimAngle) * g.speed;
        g.y += Math.sin(aimAngle) * g.speed;

        // Shoot Laser at target if < 260px away
        if (targetDist < 260 && now - g.lastShootTime >= 500) {
          g.lastShootTime = now;
          const beamLen = 320;
          const laserEndX = g.x + Math.cos(aimAngle) * beamLen;
          const laserEndY = g.y + Math.sin(aimAngle) * beamLen;

          s.lasers.push({
            id: `laser_g_${now}_${Math.random()}`,
            x1: g.x + Math.cos(aimAngle) * 16,
            y1: g.y + Math.sin(aimAngle) * 16,
            x2: laserEndX,
            y2: laserEndY,
            color: '#EF4444', // Red hostile laser
            life: 6,
            maxLife: 6,
            isPlayer: false,
            damage: 10,
          });

          // If close to player, damage player
          const distToPlayer = Math.hypot(p.x - g.x, p.y - g.y);
          if (distToPlayer < 240) {
            if (distToPlayer < 240) {
  // Don't auto damage, only damage when bullet hits
}
            

            setHudHealth(p.health);

            if (p.health <= 0) {
              playSfx('siren');
              onToast(t('player_down'));
              p.health = 100;
              p.x = 1900;
              p.y = 1800;
              setHudHealth(100);
            }
          }
        }
      }

      // 6. UPDATE LASERS & DETECT HITS
      for (let lIdx = s.lasers.length - 1; lIdx >= 0; lIdx--) {
        const l = s.lasers[lIdx];
        l.life -= 1;

        if (l.isPlayer) {
          // Check collision with Gangsters
          for (let gIdx = s.gangsters.length - 1; gIdx >= 0; gIdx--) {
            const g = s.gangsters[gIdx];
            const dist = Math.hypot(g.x - l.x2, g.y - l.y2);
            if (dist < 45) {
              g.health -= l.damage;

              // Spark particles
              for (let sp = 0; sp < 5; sp++) {
                s.sparks.push({g.health -= l.damage;
                  x: g.x,
                  y: g.y,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  color: l.color,
                  life: 14,
                });
              }

              if (g.health <= 0) {
                s.gangsters.splice(gIdx, 1);
                p.coins += 5; // +5 coins per gangster kill
                setHudCoins(p.coins);
                setGangstersKilledCount((k) => k + 1);
                addGameCoins(5, '+5 SC - Gangster Neutralized!', 'task_reward');
                playSfx('coin');
              }
              break;
            }
          }
        }

        if (l.life <= 0) {
          s.lasers.splice(lIdx, 1);
        }
      }

      // 7. UPDATE SPARK PARTICLES
      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) {
        const sp = s.sparks[spIdx];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 1;
        if (sp.life <= 0) s.sparks.splice(spIdx, 1);
      }

      // ==========================================
      // RENDER CANVAS
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Background Ground (Dark pavement)
      ctx.fillStyle = cityData.theme.groundGrassColor;
      ctx.fillRect(0, 0, cityData.mapWidth, cityData.mapHeight);

      // Draw Roads
      cityData.roads.forEach((road) => {
        ctx.fillStyle = cityData.theme.asphaltColor;
        ctx.fillRect(road.x, road.y, road.width, road.height);

        // Curbs
        ctx.strokeStyle = cityData.theme.curbColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(road.x, road.y, road.width, road.height);

        // Dashed Lane Dividers
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

      // Draw Walled Compounds
      cityData.compounds.forEach((comp) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(comp.x, comp.y, comp.width, comp.height);

        ctx.strokeStyle = comp.fenceColor;
        ctx.lineWidth = 6;
        ctx.strokeRect(comp.x, comp.y, comp.width, comp.height);

        // Compound Gates
        comp.gates.forEach((gate) => {
          ctx.clearRect(gate.x, gate.y, gate.width, gate.height);
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2;
          ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);
        });
      });

      // Draw Buildings (3D Isometric shadow + roof)
      cityData.buildings.forEach((bld) => {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(bld.x + 8, bld.y + 12, bld.width, bld.height);

        // Walls
        ctx.fillStyle = bld.wallColor;
        ctx.fillRect(bld.x, bld.y, bld.width, bld.height);

        // Roof Top Border
        ctx.strokeStyle = bld.roofColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(bld.x + 6, bld.y + 6, bld.width - 12, bld.height - 12);

        // Entrance Door
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(bld.door.x, bld.door.y, bld.door.width, bld.door.height);

        // Neon Signage
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(bld.name, bld.x + 14, bld.y + 24);
      });

      // Draw Traffic Cars
      s.cars.forEach((car) => {
        ctx.save();
        ctx.translate(car.x, car.y);

        // Car chassis
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-car.width / 4, -car.height / 4, car.width / 2, car.height / 2);

        // Headlights
        ctx.fillStyle = '#FEF08A';
        if (car.direction === 'horizontal') {
          ctx.fillRect(car.width / 2 - 3, -car.height / 2 + 2, 4, 4);
          ctx.fillRect(car.width / 2 - 3, car.height / 2 - 6, 4, 4);
        } else {
          ctx.fillRect(-car.width / 2 + 2, car.height / 2 - 3, 4, 4);
          ctx.fillRect(car.width / 2 - 6, car.height / 2 - 3, 4, 4);
        }

        ctx.restore();
      });

      // Draw Civilians
      s.civilians.forEach((civ) => {
        ctx.save();
        ctx.translate(civ.x, civ.y);
        ctx.rotate(civ.facingAngle);

        ctx.fillStyle = civ.state === 'scared' ? '#F87171' : civ.color;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Scared Indicator exclamation
        if (civ.state === 'scared') {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('!', -2, -14);
        }

        ctx.restore();
      });

      // Draw Gangsters (Motorcycles & Syndicate Buses)
      s.gangsters.forEach((g) => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.facingAngle);

        if (g.vehicleType === 'bus') {
          // Armored Bus Body
          ctx.fillStyle = '#7F1D1D';
          ctx.beginPath();
          ctx.roundRect(-30, -18, 60, 36, 6);
          ctx.fill();

          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Bus Roof Turret
          ctx.fillStyle = '#18181B';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Motorcycle Chassis
          ctx.fillStyle = '#18181B';
          ctx.fillRect(-14, -4, 28, 8);

          // Red Rider Body
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fill();
        }

        // Gangster Health Bar
        ctx.rotate(-g.facingAngle);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-16, -28, 32, 4);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-16, -28, 32 * (g.health / g.maxHealth), 4);

        ctx.restore();
      });

      // Draw Spark Particles
      s.sparks.forEach((sp) => {
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Laser Beams (Glow effect, NO BLOOD)
      s.lasers.forEach((l) => {
        ctx.save();
        ctx.strokeStyle = l.color;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = l.isPlayer ? 3.5 : 2.5;

        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.restore();
      });

      // Draw Player (Tactical Hustler / Car)
      if (!p.inCarId) {
        // Dynamic Ground Shadow (shrinks when player leaps in air)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        const shadowScale = Math.max(0.4, 1 - (p.jumpOffset || 0) / 45);
        ctx.beginPath();
        ctx.ellipse(0, 6, 14 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Elevated player body based on jumpOffset
        ctx.save();
        ctx.translate(p.x, p.y - (p.jumpOffset || 0));
        ctx.rotate(p.facingAngle);

        // Tactical Gear Body
        ctx.fillStyle = avatarColor;
        ctx.shadowColor = avatarColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Team Colored Band / Vest
        ctx.fillStyle = playerTeam === 'blue' ? '#38BDF8' : '#EF4444';
        ctx.fillRect(-8, -4, 16, 8);

        // Laser Rifle Barrel
        ctx.fillStyle = '#334155';
        ctx.fillRect(8, 2, 16, 4);

        // Cover Shield Ring
        if (p.isCover) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore(); // Restore camera offset

      // --- SCREEN OVERLAY: HIGH-TECH MINIMAP RADAR (TOP RIGHT) ---
      const mmSize = 120;
      const mmX = s.screenDim.w - mmSize - 16;
      const mmY = 16;

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

      // Civilians (small subtle dots)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      s.civilians.forEach((c) => {
        const cx = mmX + (c.x / cityData.mapWidth) * mmSize;
        const cy = mmY + (c.y / cityData.mapHeight) * mmSize;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      });

      // Gangsters (Red glowing blips)
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 4;
      s.gangsters.forEach((g) => {
        const gx = mmX + (g.x / cityData.mapWidth) * mmSize;
        const gy = mmY + (g.y / cityData.mapHeight) * mmSize;
        ctx.beginPath();
        ctx.arc(gx, gy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Local Player (Cyan blip)
      const px = mmX + (p.x / cityData.mapWidth) * mmSize;
      const py = mmY + (p.y / cityData.mapHeight) * mmSize;
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Radar Label
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('RADAR 4KM', mmX + mmSize - 6, mmY + mmSize - 6);

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
  }, [showIntro, cityData, avatarColor, playerTeam, shootPlayerLaser, playSfx, onToast, t]);

  // If Story Intro is active, render Intro screen
  if (showIntro) {
    return (
      <StreetGangStarIntro
        language={language}
        cityName={cityData.cityName}
        streetName={cityData.streetName}
        onStartGame={handleStartFromIntro}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden font-sans">
      {/* 2D CANVAS ARENA (4000x4000 SIMULATION) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* TOP LEFT HUD: HEALTH, AMMO, COINS, DISTRICT */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-2 max-w-xs pointer-events-none">
        {/* District & Faction Card */}
        <div className="p-2.5 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playSfx('click');
                onBack();
              }}
              type="button"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-[#FFD700]" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  {cityData.streetName}
                </span>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                    playerTeam === 'blue'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  {playerTeam === 'blue' ? 'BLUE' : 'RED'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400">{cityData.cityName}</p>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 pointer-events-auto text-gray-300"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#FFD700]" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
        </div>

        {/* Health & Ammo Bars */}
        <div className="p-2.5 rounded-2xl bg-black/85 border border-[#FFD700]/30 backdrop-blur-md shadow-xl space-y-2">
          {/* Health Bar (Red) */}
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

          {/* Ammo Bar (Yellow) */}
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

          {/* Street Cash & Stats */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] font-mono">
            <div className="flex items-center gap-1 text-[#FFD700] font-black">
              <Coins className="w-3.5 h-3.5" />
              <span>{hudCoins} SC (+5/kill)</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">
              Kills: {gangstersKilledCount} | Saved: {civiliansSavedCount}
            </span>
          </div>

          {/* Cover & Car Badges */}
          <div className="flex items-center gap-1.5 pt-1">
            {hudInCover && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40">
                {t('cover_active')}
              </span>
            )}
            {hudInCar && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                DRIVING VEHICLE [E]
              </span>
            )}
          </div>
        </div>
      </div>



      {/* TOP QUICK UTILITY BAR: SHOP [B] & AVATAR [T] */}
      <div className="absolute top-3 right-36 z-30 flex items-center gap-2 pointer-events-auto">
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
            setShowAvatarModal(true);
          }}
          type="button"
          className="p-2 rounded-2xl bg-black/85 border border-white/20 text-white font-black text-xs uppercase active:scale-95 transition-all cursor-pointer hover:border-[#FFD700] backdrop-blur-md"
          title="Customize Avatar"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

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

      {/* GUN SHOP MODAL ([B]) */}
      {showShopModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-[#FFD700] p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)] text-left relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2 text-[#FFD700]">
                <ShoppingBag className="w-5 h-5" />
                <h3 className="text-base font-black uppercase tracking-wider">{t('gun_shop')}</h3>
              </div>
              <button
                onClick={() => setShowShopModal(false)}
                type="button"
                className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(Object.keys(WEAPONS) as WeaponType[]).map((wKey) => {
                const w = WEAPONS[wKey];
                const isOwned = gameStateRef.current.unlockedGuns[wKey];
                const isEquipped = hudGun === wKey;

                return (
                  <div
                    key={wKey}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      isEquipped
                        ? 'bg-[#FFD700]/15 border-[#FFD700]'
                        : 'bg-black/60 border-white/10'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black text-white">{t(w.nameKey)}</h4>
                      <p className="text-[10px] text-gray-400">
                        DMG: {w.damage} | Ammo: {w.maxAmmo} | Lasers: {w.spread}
                      </p>
                    </div>

                    {isEquipped ? (
                      <span className="text-[10px] font-mono text-[#FFD700] font-black uppercase">
                        EQUIPPED
                      </span>
                    ) : isOwned ? (
                      <button
                        onClick={() => {
                          gameStateRef.current.player.gun = wKey;
                          gameStateRef.current.player.ammo = w.maxAmmo;
                          gameStateRef.current.player.maxAmmo = w.maxAmmo;
                          setHudGun(wKey);
                          setHudAmmo(w.maxAmmo);
                          setHudMaxAmmo(w.maxAmmo);
                          playSfx('click');
                          setShowShopModal(false);
                        }}
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase active:scale-95"
                      >
                        EQUIP
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyWeapon(wKey)}
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 hover:brightness-110 shadow-md"
                      >
                        {w.price} SC
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AVATAR CUSTOMIZATION MODAL */}
      {showAvatarModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#12131C] border-2 border-white/20 p-5 shadow-2xl text-left relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {t('customize_avatar')}
              </h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                type="button"
                className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Color Palette */}
            <div className="mb-4">
              <span className="text-xs font-bold text-gray-300 block mb-2">{t('choose_color')}</span>
              <div className="flex items-center gap-2">
                {['#FFD700', '#22C55E', '#3B82F6', '#EF4444', '#A855F7', '#E2E8F0'].map((col) => (
                  <button
                    key={col}
                    onClick={() => {
                      setAvatarColor(col);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('gangstar_avatar_color', col);
                      }
                      playSfx('click');
                    }}
                    type="button"
                    className={`w-9 h-9 rounded-2xl border-2 transition-all cursor-pointer ${
                      avatarColor === col ? 'scale-110 border-white shadow-lg' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Mask Selection */}
            <div className="mb-4">
              <span className="text-xs font-bold text-gray-300 block mb-2">{t('choose_face')}</span>
              <div className="grid grid-cols-2 gap-2">
                {['bandana', 'tactical', 'shades', 'hoodie'].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setAvatarMask(m);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('gangstar_avatar_mask', m);
                      }
                      playSfx('click');
                    }}
                    type="button"
                    className={`py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all cursor-pointer ${
                      avatarMask === m
                        ? 'bg-[#FFD700] text-black border-[#FFD700]'
                        : 'bg-black/50 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowAvatarModal(false)}
              type="button"
              className="w-full py-3 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

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
              {/* Blue Syndicate */}
              <button
                onClick={() => {
                  setPlayerTeam('blue');
                  setShowTeamModal(false);
                  playSfx('click');
                  onToast('Joined Blue Syndicate Defend Team!');
                }}
                type="button"
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  playerTeam === 'blue'
                    ? 'bg-sky-950/60 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'bg-black/50 border-white/10'
                }`}
              >
                <h4 className="text-xs font-black uppercase text-sky-400">{t('team_blue')}</h4>
                <p className="text-[11px] text-gray-300 mt-1">{t('team_blue_desc')}</p>
              </button>

              {/* Red Corsairs */}
              <button
                onClick={() => {
                  setPlayerTeam('red');
                  setShowTeamModal(false);
                  playSfx('click');
                  onToast('Joined Red Corsairs Free-For-All!');
                }}
                type="button"
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  playerTeam === 'red'
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
