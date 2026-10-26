'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Shield,
  Zap,
  Crosshair,
  Volume2,
  VolumeX,
  Heart,
  Skull,
  Award,
  Tv,
  Coins,
  MapPin,
} from 'lucide-react';
import {
  playPunchSound,
  playShootSound,
  playReloadSound,
  playPickupSound,
  playCoinSound,
  playSuccessSound,
  playSirenSound,
  playClickSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';
import { TurfWarMultiplayer } from '@/src/games/TurfWar/TurfWarMultiplayer';

interface TurfWar2DProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

export type TurfWeapon = 'fists' | 'pistol' | 'shotgun';

interface Zone {
  id: 'A' | 'B' | 'C';
  name: string;
  x: number;
  y: number;
  radius: number;
  captureProgress: number; // -100 (Enemy full) to +100 (Player full)
  owner: 'neutral' | 'player' | 'enemy';
  contested: boolean;
}

interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  isRanged: boolean; // pistol / gun
  hasBat: boolean; // bat brawler
  isBoss: boolean;
  attackCooldown: number;
  shootCooldown: number;
  radius: number;
  color: string;
  targetZoneId: 'A' | 'B' | 'C' | null;
}

interface Pickup {
  id: string;
  type: 'health' | 'ammo' | 'armor' | 'pistol' | 'shotgun';
  x: number;
  y: number;
  radius: number;
}

interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPlayer: boolean;
  damage: number;
}

export function TurfWar2D({ onBack, onToast, currentCoins = 0 }: TurfWar2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [playMode, setPlayMode] = useState<'single' | 'multiplayer'>('single');
  // Level selector (1, 2, 3)
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'win' | 'lose'>('lobby');

  // Player Stats for HUD
  const [playerHp, setPlayerHp] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [weapon, setWeapon] = useState<TurfWeapon>('fists');
  const [unlockedWeapons, setUnlockedWeapons] = useState<Record<TurfWeapon, boolean>>({
    fists: true,
    pistol: false,
    shotgun: false,
  });
  const [armorActive, setArmorActive] = useState(false);
  const [armorTimeRemaining, setArmorTimeRemaining] = useState(0);

  // Turf Stats
  const [playerTurfPct, setPlayerTurfPct] = useState(0);
  const [enemyTurfPct, setEnemyTurfPct] = useState(0);
  const [enemyDominanceTimer, setEnemyDominanceTimer] = useState(0); // LOSE if reaches 30s
  const [zonesState, setZonesState] = useState<{ id: 'A' | 'B' | 'C'; owner: 'neutral' | 'player' | 'enemy'; progress: number }[]>([
    { id: 'A', owner: 'neutral', progress: 0 },
    { id: 'B', owner: 'neutral', progress: 0 },
    { id: 'C', owner: 'neutral', progress: 0 },
  ]);

  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedShopCoins, setEarnedShopCoins] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Ad simulation
  const [adWatching, setAdWatching] = useState(false);
  const [adDoubled, setAdDoubled] = useState(false);

  // Mutable Game Loop State Refs
  const playerRef = useRef({
    x: 80,
    y: 250,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    speed: 3.4,
    facingAngle: 0,
    weapon: 'fists' as TurfWeapon,
    ammo: 30,
    maxAmmo: 30,
    isArmor: false,
    armorTimer: 0,
    attackCooldown: 0,
  });

  const unlockedWeaponsRef = useRef<Record<TurfWeapon, boolean>>({
    fists: true,
    pistol: false,
    shotgun: false,
  });

  const zonesRef = useRef<Zone[]>([
    { id: 'A', name: 'Danfo Garage', x: 220, y: 160, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
    { id: 'B', name: 'Balogun Market', x: 380, y: 340, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
    { id: 'C', name: 'Lekki Junction', x: 540, y: 160, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
  ]);

  const enemiesRef = useRef<Enemy[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const lastTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  // Spawn Timers (every 20s health, 15s ammo, 25s armor)
  const healthSpawnTimerRef = useRef(20);
  const ammoSpawnTimerRef = useRef(15);
  const armorSpawnTimerRef = useRef(25);
  const enemyDominanceRef = useRef(0);

  // Joystick state
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, dx: 0, dy: 0 });
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0, active: false });

  // Sound helper
  const playSfx = useCallback((type: 'punch' | 'shoot' | 'reload' | 'pickup' | 'coin' | 'success' | 'lose') => {
    if (!soundEnabled) return;
    try {
      if (type === 'punch') playPunchSound();
      else if (type === 'shoot') playShootSound();
      else if (type === 'reload') playReloadSound();
      else if (type === 'pickup') playPickupSound();
      else if (type === 'coin') playCoinSound();
      else if (type === 'success') playSuccessSound();
      else if (type === 'lose') playSirenSound();
    } catch {}
  }, [soundEnabled]);

  // Win Level Handler
  const handleWin = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setGameState('win');
    const winReward = 300;
    const shopCoinsReward = 50;
    setEarnedCoins(winReward);
    setEarnedShopCoins(shopCoinsReward);
    addGameCoins(winReward, `+${winReward} SC - Turf War Victory (Level ${level})`, 'wave_complete');
    playSfx('success');
    onToast(`TURF CAPTURED! +${winReward} SC & +${shopCoinsReward} Shop Coins!`);
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#22C55E', '#3B82F6', '#FFFFFF'],
      });
    } catch {}
  }, [level, onToast, playSfx]);

  // Lose Level Handler
  const handleLose = useCallback((reason = 'Defeated') => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setGameState('lose');
    const loseReward = 50;
    setEarnedCoins(loseReward);
    addGameCoins(loseReward, `+${loseReward} SC - Turf War Consolation`, 'wave_complete');
    playSfx('lose');
    onToast(`TURF LOST (${reason})! +${loseReward} SC consolation awarded.`);
  }, [onToast, playSfx]);

  // Start / Restart Level
  const startLevel = useCallback((lvl: 1 | 2 | 3) => {
    setLevel(lvl);
    setGameState('playing');
    isPlayingRef.current = true;
    setAdDoubled(false);
    setEarnedCoins(0);
    setEarnedShopCoins(0);
    setEnemiesDefeated(0);
    setEnemyDominanceTimer(0);
    enemyDominanceRef.current = 0;
    healthSpawnTimerRef.current = 20;
    ammoSpawnTimerRef.current = 15;
    armorSpawnTimerRef.current = 25;

    // Reset Player (yellow shirt guy in Base Yellow)
    playerRef.current = {
      x: 70,
      y: 250,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      speed: 3.4,
      facingAngle: 0,
      weapon: 'fists',
      ammo: 30,
      maxAmmo: 30,
      isArmor: false,
      armorTimer: 0,
      attackCooldown: 0,
    };
    unlockedWeaponsRef.current = { fists: true, pistol: false, shotgun: false };
    setUnlockedWeapons({ fists: true, pistol: false, shotgun: false });
    setPlayerHp(100);
    setAmmo(30);
    setWeapon('fists');
    setArmorActive(false);
    setArmorTimeRemaining(0);

    // Reset Zones
    zonesRef.current = [
      { id: 'A', name: 'Danfo Garage', x: 220, y: 160, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
      { id: 'B', name: 'Balogun Market', x: 380, y: 340, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
      { id: 'C', name: 'Lekki Junction', x: 540, y: 160, radius: 48, captureProgress: 0, owner: 'neutral', contested: false },
    ];
    setZonesState([
      { id: 'A', owner: 'neutral', progress: 0 },
      { id: 'B', owner: 'neutral', progress: 0 },
      { id: 'C', owner: 'neutral', progress: 0 },
    ]);
    setPlayerTurfPct(0);
    setEnemyTurfPct(0);

    // Initial Pickups on Map: Health pack, Ammo box, Armor, Pistol & Shotgun pickups
    pickupsRef.current = [
      { id: 'p_health', type: 'health', x: 220, y: 380, radius: 14 },
      { id: 'p_ammo', type: 'ammo', x: 380, y: 180, radius: 14 },
      { id: 'p_armor', type: 'armor', x: 540, y: 380, radius: 14 },
      { id: 'p_pistol', type: 'pistol', x: 180, y: 250, radius: 14 },
      { id: 'p_shotgun', type: 'shotgun', x: 380, y: 250, radius: 15 },
    ];

    // Spawn Enemies based on Level:
    // Level 1 = 5 enemies (gang boys with bats)
    // Level 2 = 10 enemies with guns
    // Level 3 = 15 enemies + 1 Boss gang leader bigger
    const enemyCount = lvl === 1 ? 5 : lvl === 2 ? 10 : 16;
    const newEnemies: Enemy[] = [];
    const zoneIds: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];

    for (let i = 0; i < enemyCount; i++) {
      const isBoss = lvl === 3 && i === enemyCount - 1;
      // In all levels, rivals have firearms to shoot players from far
      const isRanged = isBoss ? true : lvl === 1 ? i % 2 === 1 : true;
      const hasBat = !isRanged && !isBoss;

      newEnemies.push({
        id: `enemy_${i}`,
        x: 650 + Math.random() * 80,
        y: 140 + Math.random() * 220,
        hp: isBoss ? 400 : isRanged ? 55 : 70,
        maxHp: isBoss ? 400 : isRanged ? 55 : 70,
        speed: isBoss ? 1.6 : isRanged ? 1.9 : 2.4,
        isRanged,
        hasBat,
        isBoss,
        attackCooldown: Math.random() * 30,
        shootCooldown: Math.random() * 50,
        radius: isBoss ? 28 : 16,
        color: isBoss ? '#DC2626' : isRanged ? '#EF4444' : '#F87171',
        targetZoneId: zoneIds[i % zoneIds.length],
      });
    }
    enemiesRef.current = newEnemies;
    bulletsRef.current = [];
  }, []);

  // Attack Action (Punch / Shoot)
  const handleActionAttack = useCallback(() => {
    const p = playerRef.current;
    if (p.attackCooldown > 0) return;

    if (p.weapon === 'fists') {
      p.attackCooldown = 14;
      playSfx('punch');
      // Punch melee attack hitting enemies in front
      enemiesRef.current.forEach((en) => {
        if (en.hp <= 0) return;
        const dist = Math.hypot(en.x - p.x, en.y - p.y);
        if (dist < 50) {
          en.hp -= 30;
          en.x += Math.cos(p.facingAngle) * 24;
          en.y += Math.sin(p.facingAngle) * 24;
          if (en.hp <= 0) {
            setEnemiesDefeated((prev) => prev + 1);
          }
        }
      });
    } else if (p.weapon === 'pistol') {
      if (p.ammo <= 0) {
        playSfx('reload');
        onToast('Pistol empty! Tap RELOAD.');
        return;
      }
      p.ammo -= 1;
      setAmmo(p.ammo);
      p.attackCooldown = 16;
      playSfx('shoot');

      // Spawn pistol bullet
      const bSpeed = 12;
      bulletsRef.current.push({
        id: `pb_${Date.now()}_${Math.random()}`,
        x: p.x + Math.cos(p.facingAngle) * 20,
        y: p.y + Math.sin(p.facingAngle) * 20,
        vx: Math.cos(p.facingAngle) * bSpeed,
        vy: Math.sin(p.facingAngle) * bSpeed,
        isPlayer: true,
        damage: 40,
      });
    } else if (p.weapon === 'shotgun') {
      if (p.ammo <= 1) {
        playSfx('reload');
        onToast('Shotgun empty! Tap RELOAD.');
        return;
      }
      p.ammo -= 2;
      setAmmo(p.ammo);
      p.attackCooldown = 26;
      playSfx('shoot');

      // Shotgun blast: 4 pellets in spread cone
      const pelletCount = 4;
      const spreadAngles = [-0.18, -0.06, 0.06, 0.18];
      const bSpeed = 11;

      for (let s = 0; s < pelletCount; s++) {
        const angle = p.facingAngle + spreadAngles[s];
        bulletsRef.current.push({
          id: `ps_${Date.now()}_${s}_${Math.random()}`,
          x: p.x + Math.cos(p.facingAngle) * 20,
          y: p.y + Math.sin(p.facingAngle) * 20,
          vx: Math.cos(angle) * bSpeed,
          vy: Math.sin(angle) * bSpeed,
          isPlayer: true,
          damage: 25,
        });
      }
    }
  }, [onToast, playSfx]);

  // Reload Action
  const handleReload = useCallback(() => {
    playSfx('reload');
    playerRef.current.ammo = playerRef.current.maxAmmo;
    setAmmo(playerRef.current.maxAmmo);
    onToast(`Reloaded ${playerRef.current.maxAmmo} ammo!`);
  }, [onToast, playSfx]);

  // Switch Weapon Action (fists -> pistol -> shotgun -> fists)
  const handleSwitchWeapon = useCallback(() => {
    playClickSound();
    const order: TurfWeapon[] = ['fists', 'pistol', 'shotgun'];
    const curIdx = order.indexOf(playerRef.current.weapon);
    let nextIdx = (curIdx + 1) % order.length;
    let attempts = 0;

    // Only switch to unlocked weapon
    while (attempts < 3 && !unlockedWeaponsRef.current[order[nextIdx]]) {
      nextIdx = (nextIdx + 1) % order.length;
      attempts++;
    }

    const next = order[nextIdx];
    playerRef.current.weapon = next;
    setWeapon(next);
  }, []);

  // Watch Ad to Double reward to 600 SC
  const handleDoubleRewardAd = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      setAdDoubled(true);
      const extraCoins = 300;
      setEarnedCoins((prev) => prev + extraCoins);
      addGameCoins(extraCoins, `+${extraCoins} SC - Turf War Ad Doubler Bonus`, 'ad_reward');
      playSfx('coin');
      onToast(`Bonus +300 SC added! Total: 600 SC!`);
    }, 2000);
  };

  // Watch Ad to Retry
  const handleRetryAd = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      startLevel(level);
      onToast(`Respawned on same map with full health! Defend the turf!`);
    }, 1500);
  };

  // Joystick touch handlers
  const handleTouchStartJoystick = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    joystickRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      dx: 0,
      dy: 0,
    };
    setJoystickPos({ x: 0, y: 0, active: true });
  };

  const handleTouchMoveJoystick = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickRef.current.active) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const maxDist = 45;
    let dx = clientX - joystickRef.current.startX;
    let dy = clientY - joystickRef.current.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    joystickRef.current.currentX = clientX;
    joystickRef.current.currentY = clientY;
    joystickRef.current.dx = dx / maxDist;
    joystickRef.current.dy = dy / maxDist;

    setJoystickPos({ x: dx, y: dy, active: true });
  };

  const handleTouchEndJoystick = () => {
    joystickRef.current.active = false;
    joystickRef.current.dx = 0;
    joystickRef.current.dy = 0;
    setJoystickPos({ x: 0, y: 0, active: false });
  };

  // Keyboard controls
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key === 'Enter') {
        handleActionAttack();
      } else if (e.key.toLowerCase() === 'r') {
        handleReload();
      } else if (e.key.toLowerCase() === 'q') {
        handleSwitchWeapon();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    const interval = setInterval(() => {
      if (!isPlayingRef.current) return;
      let kx = 0;
      let ky = 0;
      if (keys['w'] || keys['arrowup']) ky -= 1;
      if (keys['s'] || keys['arrowdown']) ky += 1;
      if (keys['a'] || keys['arrowleft']) kx -= 1;
      if (keys['d'] || keys['arrowright']) kx += 1;

      if (kx !== 0 || ky !== 0) {
        const mag = Math.hypot(kx, ky);
        joystickRef.current.dx = kx / mag;
        joystickRef.current.dy = ky / mag;
      } else if (!joystickRef.current.active) {
        joystickRef.current.dx = 0;
        joystickRef.current.dy = 0;
      }
    }, 16);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleActionAttack, handleReload, handleSwitchWeapon]);

  // Main Canvas & Gameplay Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const p = playerRef.current;

      // 1. Move Player
      if (joystickRef.current.dx !== 0 || joystickRef.current.dy !== 0) {
        p.vx = joystickRef.current.dx * p.speed;
        p.vy = joystickRef.current.dy * p.speed;
        p.facingAngle = Math.atan2(joystickRef.current.dy, joystickRef.current.dx);
      } else {
        p.vx = 0;
        p.vy = 0;
      }

      p.x = Math.max(30, Math.min(canvas.width - 30, p.x + p.vx));
      p.y = Math.max(30, Math.min(canvas.height - 30, p.y + p.vy));

      if (p.attackCooldown > 0) p.attackCooldown--;

      // Armor countdown
      if (p.isArmor) {
        p.armorTimer -= dt;
        setArmorTimeRemaining(Math.max(0, Math.ceil(p.armorTimer)));
        if (p.armorTimer <= 0) {
          p.isArmor = false;
          setArmorActive(false);
        }
      }

      // Respawn Timers for Pickups
      healthSpawnTimerRef.current -= dt;
      if (healthSpawnTimerRef.current <= 0) {
        healthSpawnTimerRef.current = 20; // Every 20 sec
        if (!pickupsRef.current.some((pk) => pk.type === 'health')) {
          pickupsRef.current.push({
            id: `hp_${Date.now()}`,
            type: 'health',
            x: 180 + Math.random() * 360,
            y: 120 + Math.random() * 260,
            radius: 14,
          });
        }
      }

      ammoSpawnTimerRef.current -= dt;
      if (ammoSpawnTimerRef.current <= 0) {
        ammoSpawnTimerRef.current = 15; // Every 15 sec
        if (!pickupsRef.current.some((pk) => pk.type === 'ammo')) {
          pickupsRef.current.push({
            id: `ammo_${Date.now()}`,
            type: 'ammo',
            x: 200 + Math.random() * 320,
            y: 140 + Math.random() * 220,
            radius: 14,
          });
        }
      }

      armorSpawnTimerRef.current -= dt;
      if (armorSpawnTimerRef.current <= 0) {
        armorSpawnTimerRef.current = 25;
        if (!pickupsRef.current.some((pk) => pk.type === 'armor')) {
          pickupsRef.current.push({
            id: `armor_${Date.now()}`,
            type: 'armor',
            x: 240 + Math.random() * 240,
            y: 160 + Math.random() * 200,
            radius: 14,
          });
        }
      }

      // 2. Zone Capture & Contesting Logic
      zonesRef.current.forEach((z) => {
        const playerInZone = Math.hypot(p.x - z.x, p.y - z.y) <= z.radius;
        const enemiesInZone = enemiesRef.current.filter(
          (en) => en.hp > 0 && Math.hypot(en.x - z.x, en.y - z.y) <= z.radius
        );

        z.contested = playerInZone && enemiesInZone.length > 0;

        // Player capturing: 5 seconds uninterrupted = 100% (20% per sec)
        if (playerInZone && enemiesInZone.length === 0) {
          if (z.captureProgress < 100) {
            z.captureProgress = Math.min(100, z.captureProgress + dt * 20);
            if (z.captureProgress >= 100 && z.owner !== 'player') {
              z.owner = 'player';
              playSfx('coin');
              addGameCoins(20, `+20 SC - Zone ${z.id} captured!`, 'task_reward');
              onToast(`Zone ${z.id} Secured! +20 SC claimed!`);
            }
          }
        } else if (!playerInZone && enemiesInZone.length > 0) {
          // Enemies capturing zone
          if (z.captureProgress > -100) {
            z.captureProgress = Math.max(-100, z.captureProgress - dt * 15);
            if (z.captureProgress <= -100 && z.owner !== 'enemy') {
              z.owner = 'enemy';
              onToast(`⚠️ Enemy Gang captured Zone ${z.id}!`);
            }
          }
        }
      });

      // Update Zone states for mini-map & HUD
      setZonesState(
        zonesRef.current.map((z) => ({
          id: z.id,
          owner: z.owner,
          progress: z.captureProgress,
        }))
      );

      // Turf %: Player owned zones vs Enemy owned zones
      const playerZonesCount = zonesRef.current.filter((z) => z.owner === 'player').length;
      const enemyZonesCount = zonesRef.current.filter((z) => z.owner === 'enemy').length;

      // Exact Turf % calculation
      const pPct = Math.round((playerZonesCount / 3) * 100);
      const ePct = Math.round((enemyZonesCount / 3) * 100);
      setPlayerTurfPct(pPct);
      setEnemyTurfPct(ePct);

      // WIN CONDITION: Capture all 3 zones = WIN!
      if (playerZonesCount === 3) {
        handleWin();
        return;
      }

      // LOSE CONDITION 1: Enemies hold 2+ zones for 30 seconds!
      if (enemyZonesCount >= 2) {
        enemyDominanceRef.current += dt;
        setEnemyDominanceTimer(Math.floor(enemyDominanceRef.current));
        if (enemyDominanceRef.current >= 30) {
          handleLose('Enemies held 2 zones for 30s!');
          return;
        }
      } else {
        // Slowly decay dominance if player contests
        enemyDominanceRef.current = Math.max(0, enemyDominanceRef.current - dt * 0.5);
        setEnemyDominanceTimer(Math.floor(enemyDominanceRef.current));
      }

      // 3. Update Enemies
      enemiesRef.current.forEach((en) => {
        if (en.hp <= 0) return;

        // Choose target: either the player or the target zone
        let targetX = p.x;
        let targetY = p.y;

        const targetZone = zonesRef.current.find((z) => z.id === en.targetZoneId);
        const distToPlayer = Math.hypot(p.x - en.x, p.y - en.y);

        // If player is far and target zone is not enemy owned, move towards zone
        if (distToPlayer > 180 && targetZone && targetZone.owner !== 'enemy') {
          targetX = targetZone.x;
          targetY = targetZone.y;
        }

        const dx = targetX - en.x;
        const dy = targetY - en.y;
        const dist = Math.hypot(dx, dy);

        // Movement
        if (dist > (en.isRanged ? 130 : 25)) {
          en.x += (dx / dist) * en.speed;
          en.y += (dy / dist) * en.speed;
        }

        // Enemy Melee Attack (Bats / Fists)
        if (!en.isRanged && distToPlayer < 34) {
          en.attackCooldown--;
          if (en.attackCooldown <= 0) {
            en.attackCooldown = 40;
            const dmg = (en.isBoss ? 28 : 12) * (p.isArmor ? 0.5 : 1.0);
            p.hp = Math.max(0, p.hp - dmg);
            setPlayerHp(p.hp);
            playSfx('punch');
            if (p.hp <= 0) {
              handleLose('Knocked out by Gang');
              return;
            }
          }
        }

        // Enemy Gun Attack - Allow rivals to shoot players from far (up to 520px)
        if (en.isRanged && distToPlayer < 520) {
          en.shootCooldown--;
          if (en.shootCooldown <= 0) {
            en.shootCooldown = en.isBoss ? 45 : 75; // Boss shoots faster
            const angle = Math.atan2(p.y - en.y, p.x - en.x);
            const bSpeed = en.isBoss ? 8 : 6.5;
            bulletsRef.current.push({
              id: `eb_${Date.now()}_${Math.random()}`,
              x: en.x,
              y: en.y,
              vx: Math.cos(angle) * bSpeed,
              vy: Math.sin(angle) * bSpeed,
              isPlayer: false,
              damage: en.isBoss ? (p.isArmor ? 15 : 30) : (p.isArmor ? 8 : 16),
            });
            playSfx('shoot');
          }
        }
      });

      // 4. Update Bullets
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        b.x += b.vx;
        b.y += b.vy;

        // Boundary check
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
          bulletsRef.current.splice(i, 1);
          continue;
        }

        if (b.isPlayer) {
          // Hits enemy
          let hit = false;
          for (const en of enemiesRef.current) {
            if (en.hp > 0 && Math.hypot(en.x - b.x, en.y - b.y) < en.radius + 6) {
              en.hp -= b.damage;
              hit = true;
              if (en.hp <= 0) {
                setEnemiesDefeated((prev) => prev + 1);
                // Drop ammo or health occasionally
                if (Math.random() < 0.35) {
                  pickupsRef.current.push({
                    id: `drop_${Date.now()}`,
                    type: Math.random() < 0.5 ? 'ammo' : 'health',
                    x: en.x,
                    y: en.y,
                    radius: 12,
                  });
                }
              }
              break;
            }
          }
          if (hit) bulletsRef.current.splice(i, 1);
        } else {
          // Enemy bullet hits player
          if (Math.hypot(p.x - b.x, p.y - b.y) < 20) {
            p.hp = Math.max(0, p.hp - b.damage);
            setPlayerHp(p.hp);
            playSfx('punch');
            bulletsRef.current.splice(i, 1);
            if (p.hp <= 0) {
              handleLose('Shot down by rivals');
              return;
            }
          }
        }
      }

      // 5. Update Pickups & Weapon Pickups
      for (let i = pickupsRef.current.length - 1; i >= 0; i--) {
        const pk = pickupsRef.current[i];
        if (Math.hypot(p.x - pk.x, p.y - pk.y) < 28) {
          playSfx('pickup');
          if (pk.type === 'health') {
            p.hp = Math.min(100, p.hp + 50);
            setPlayerHp(p.hp);
            onToast('+50% Health Restored! 💚');
          } else if (pk.type === 'ammo') {
            p.ammo = Math.min(60, p.ammo + 30);
            setAmmo(p.ammo);
            onToast('+30 Ammo Box Collected! 📦');
          } else if (pk.type === 'armor') {
            p.isArmor = true;
            p.armorTimer = 15;
            setArmorActive(true);
            setArmorTimeRemaining(15);
            onToast('Armor Vest! 50% damage reduction for 15s! 🛡️');
          } else if (pk.type === 'pistol') {
            unlockedWeaponsRef.current.pistol = true;
            setUnlockedWeapons((prev) => ({ ...prev, pistol: true }));
            p.weapon = 'pistol';
            p.ammo = Math.min(60, p.ammo + 20);
            setWeapon('pistol');
            setAmmo(p.ammo);
            onToast('🔫 Pistol Picked Up! +20 Ammo!');
          } else if (pk.type === 'shotgun') {
            unlockedWeaponsRef.current.shotgun = true;
            setUnlockedWeapons((prev) => ({ ...prev, shotgun: true }));
            p.weapon = 'shotgun';
            p.ammo = Math.min(60, p.ammo + 16);
            setWeapon('shotgun');
            setAmmo(p.ammo);
            onToast('💥 Shotgun Picked Up! Spread fire loaded!');
          }
          pickupsRef.current.splice(i, 1);
        }
      }

      // ----------------------------------------------------
      // DRAW CANVAS SCENE
      // ----------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Asphalt ground
      ctx.fillStyle = '#0F1014';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Main Road Cross
      ctx.fillStyle = '#17181F';
      ctx.fillRect(0, 220, canvas.width, 60);
      ctx.fillRect(350, 0, 60, canvas.height);

      // Yellow road divider dashes
      ctx.strokeStyle = '#FACC15';
      ctx.setLineDash([14, 14]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 250);
      ctx.lineTo(canvas.width, 250);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3 LAGOS BUILDINGS (As specified)
      // Building 1: Danfo Bus Station (Top-left)
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(50, 25, 120, 85);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 25, 120, 85);
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('DANFO PARK', 65, 70);

      // Building 2: Balogun Market Complex (Bottom-center)
      ctx.fillStyle = '#151922';
      ctx.fillRect(320, 410, 120, 75);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, 410, 120, 75);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('BALOGUN STORE', 330, 450);

      // Building 3: Lekki Club / Crib (Top-right)
      ctx.fillStyle = '#1F1522';
      ctx.fillRect(550, 25, 120, 85);
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2;
      ctx.strokeRect(550, 25, 120, 85);
      ctx.fillStyle = '#C084FC';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('LEKKI LOUNGE', 570, 70);

      // YOUR GANG BASE: Base Yellow (Left)
      ctx.fillStyle = 'rgba(234, 179, 8, 0.16)';
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(15, 160, 90, 180);
      ctx.fillStyle = '#EAB308';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('BASE YELLOW', 22, 255);

      // ENEMY GANG BASE: Base Red (Right)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(canvas.width - 105, 160, 90, 180);
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('BASE RED', canvas.width - 92, 255);

      // 3 CAPTURE ZONES (Zone A, B, C)
      zonesRef.current.forEach((z) => {
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          z.owner === 'player'
            ? 'rgba(234, 179, 8, 0.28)'
            : z.owner === 'enemy'
            ? 'rgba(239, 68, 68, 0.28)'
            : 'rgba(255, 255, 255, 0.05)';
        ctx.fill();

        ctx.strokeStyle =
          z.owner === 'player' ? '#EAB308' : z.owner === 'enemy' ? '#EF4444' : '#64748B';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Capture Progress Arc
        if (z.captureProgress !== 0) {
          ctx.beginPath();
          const progressAbs = Math.abs(z.captureProgress) / 100;
          ctx.arc(
            z.x,
            z.y,
            z.radius,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * progressAbs
          );
          ctx.strokeStyle = z.captureProgress > 0 ? '#22C55E' : '#EF4444';
          ctx.lineWidth = 5;
          ctx.stroke();
        }

        // Zone Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`ZONE ${z.id}`, z.x, z.y - 4);
        ctx.font = '9px sans-serif';
        ctx.fillStyle =
          z.owner === 'player'
            ? '#FACC15'
            : z.owner === 'enemy'
            ? '#F87171'
            : '#94A3B8';
        const displayPct =
          z.owner === 'player'
            ? 'YOU 100%'
            : z.owner === 'enemy'
            ? 'ENEMY 100%'
            : `${Math.round(Math.abs(z.captureProgress))}%`;
        ctx.fillText(displayPct, z.x, z.y + 11);
        ctx.textAlign = 'start';
      });

      // DRAW PICKUPS (Health, Ammo, Armor, Pistol, Shotgun)
      pickupsRef.current.forEach((pk) => {
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, pk.radius, 0, Math.PI * 2);

        if (pk.type === 'health') {
          ctx.fillStyle = '#22C55E';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+', pk.x, pk.y + 4);
        } else if (pk.type === 'ammo') {
          ctx.fillStyle = '#EAB308';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AMMO', pk.x, pk.y + 3);
        } else if (pk.type === 'armor') {
          ctx.fillStyle = '#3B82F6';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('VEST', pk.x, pk.y + 3);
        } else if (pk.type === 'pistol') {
          ctx.fillStyle = '#F97316';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('GUN', pk.x, pk.y + 3);
        } else if (pk.type === 'shotgun') {
          ctx.fillStyle = '#A855F7';
          ctx.fill();
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SHOT', pk.x, pk.y + 3);
        }
        ctx.textAlign = 'start';
      });

      // DRAW BULLETS
      bulletsRef.current.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isPlayer ? 3.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = b.isPlayer ? '#FDE047' : '#EF4444';
        ctx.shadowColor = b.isPlayer ? '#EAB308' : '#EF4444';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // DRAW ENEMIES (Red shirt gang boys coming from enemy base)
      enemiesRef.current.forEach((en) => {
        if (en.hp <= 0) return;

        ctx.beginPath();
        ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
        ctx.fillStyle = en.color; // Red shirt gang boy
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Weapon indicator
        if (en.hasBat) {
          ctx.strokeStyle = '#FDBA74';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.lineTo(en.x - 10, en.y - 10);
          ctx.stroke();
        } else if (en.isRanged) {
          ctx.strokeStyle = '#1F2937';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.lineTo(en.x - 12, en.y);
          ctx.stroke();
        }

        // Enemy HP bar
        const barW = en.radius * 2;
        const hpPct = Math.max(0, en.hp / en.maxHp);
        ctx.fillStyle = '#000000';
        ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, barW, 4);
        ctx.fillStyle = en.isBoss ? '#EF4444' : '#22C55E';
        ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, barW * hpPct, 4);

        if (en.isBoss) {
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('👑 BOSS GANG LEADER', en.x - 42, en.y - en.radius - 12);
        }
      });

      // DRAW PLAYER (Street guy with yellow shirt)
      if (p.isArmor) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#FACC15'; // Yellow shirt
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Facing attack line / weapon
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.facingAngle) * 24, p.y + Math.sin(p.facingAngle) * 24);
      ctx.strokeStyle =
        p.weapon === 'fists'
          ? '#F97316'
          : p.weapon === 'pistol'
          ? '#94A3B8'
          : '#A855F7';
      ctx.lineWidth = p.weapon === 'shotgun' ? 5 : 3.5;
      ctx.stroke();

      // Player HP bar
      ctx.fillStyle = '#000000';
      ctx.fillRect(p.x - 16, p.y - 25, 32, 5);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(p.x - 16, p.y - 25, 32 * (p.hp / p.maxHp), 5);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState, handleLose, handleWin, onToast, playSfx]);

  if (playMode === 'multiplayer') {
    return (
      <TurfWarMultiplayer
        onBack={() => setPlayMode('single')}
        onToast={onToast}
        currentCoins={currentCoins}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#07080B] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER HUD: Mini-map, Zones, Health, Ammo, Turf % */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#0F1017] border-b border-white/10 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 text-[#FFD700]" />
          </button>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase text-[#FFD700] tracking-wider">
                TURF WAR
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/40">
                LVL {level}
              </span>
            </div>
            <p className="text-[9px] text-gray-400">Base Yellow vs Base Red</p>
          </div>
        </div>

        {/* [Single] [Multiplayer] Mode Switch Toggle */}
        <div className="flex items-center p-0.5 bg-black/60 rounded-xl border border-white/10">
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-[#FFD700] text-black shadow-sm"
          >
            Single
          </button>
          <button
            onClick={() => {
              playClickSound();
              setPlayMode('multiplayer');
            }}
            type="button"
            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 text-[#FFD700] hover:text-white"
          >
            <span>🌐</span>
            <span>Multiplayer</span>
          </button>
        </div>

        {/* TOP MINI-MAP (Lagos Area with Zones A, B, C) */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 border border-white/10">
          <MapPin className="w-3.5 h-3.5 text-[#FFD700]" />
          <div className="flex items-center gap-2">
            {zonesState.map((z) => (
              <span
                key={z.id}
                className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                  z.owner === 'player'
                    ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                    : z.owner === 'enemy'
                    ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {z.id}: {z.owner === 'player' ? 'YOU' : z.owner === 'enemy' ? 'RED' : '0%'}
              </span>
            ))}
          </div>
        </div>

        {/* STATS: Turf %, Health Bar, Ammo */}
        <div className="flex items-center gap-2">
          {/* Turf % (You X% - Enemy Y%) */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Turf Control
            </span>
            <div className="flex items-center gap-1 text-[11px] font-black font-mono">
              <span className="text-yellow-400">You {playerTurfPct}%</span>
              <span className="text-gray-500">-</span>
              <span className="text-red-400">Enemy {enemyTurfPct}%</span>
            </div>
          </div>

          {/* Health Bar */}
          <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-xl border border-white/10">
            <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
            <div className="w-12 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${playerHp}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-gray-200">
              {Math.round(playerHp)}%
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            type="button"
            className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-[#FFD700]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* SUB-BAR: Ammo Count, Weapon & Enemy Dominance Warning */}
      <div className="bg-black/60 border-b border-white/5 px-3 py-1 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Weapon:</span>
          <span className="font-black text-[#FFD700] uppercase">{weapon}</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">Ammo:</span>
          <span className="font-mono font-bold text-white">{ammo}/60</span>
          {armorActive && (
            <span className="ml-2 px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5 text-blue-400" /> {armorTimeRemaining}s
            </span>
          )}
        </div>

        {/* Enemy Dominance Warning if >= 2 zones captured */}
        {enemyDominanceTimer > 0 && (
          <div className="flex items-center gap-1 text-red-400 font-black animate-pulse">
            <Skull className="w-3 h-3" />
            <span>Enemies holding turf: {enemyDominanceTimer}s / 30s!</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LOBBY / LEVEL SELECTOR SCREEN (TOUGH WAR LIST) */}
      {/* ------------------------------------------------------------- */}
      {gameState === 'lobby' && (
        <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain flex flex-col items-center p-6 text-center bg-gradient-to-b from-[#13141F] to-[#0A0B10]">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <Skull className="w-10 h-10 text-red-400" />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-black italic uppercase text-white">
              TOUGH WAR: LAGOS GANG BRAWLER
            </h2>
          </div>
          <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed">
            Lead the Yellow Shirt Gang to capture all 3 Zones (A, B, C) in Lagos! Stand in zone circles for 5s to capture. Don’t let enemies hold 2 zones for 30s!
          </p>

          {/* FEATURED MULTIPLAYER: 10 WAVES DEFENSE VS BUSES */}
          <div className="w-full max-w-md mb-5 p-4 rounded-3xl bg-gradient-to-r from-[#2A0F0F] via-[#1A1210] to-[#121212] border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)] text-left flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span>🔥</span>
                <span>NEW MULTIPLAYER MODE</span>
              </span>
              <span className="text-xl">🚌⚔️</span>
            </div>
            <h3 className="text-base font-black uppercase text-white tracking-tight">
              TEAM VS BOTS - 10 WAVES DEFENSE
            </h3>
            <p className="text-xs text-red-300 font-medium mt-0.5">
              Defend the street with your squad against armored syndicate buses & 100 thugs!
            </p>
            <p className="text-[10px] text-gray-300 mt-1 font-mono">
              +5 SC per fighter kill • +20 SC per bus • +100 SC Wave 10 Victory Bonus
            </p>

            <button
              onClick={() => {
                playClickSound();
                setPlayMode('multiplayer');
              }}
              type="button"
              className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-red-500 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚔️</span>
              <span>ENTER 10 WAVES MULTIPLAYER (P2P)</span>
            </button>
          </div>

          <div className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
            Solo Tough War Levels (AI Brawler):
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
            <button
              onClick={() => startLevel(1)}
              type="button"
              className="p-3.5 rounded-2xl bg-gradient-to-b from-[#1C1F2B] to-[#12141C] border border-[#FFD700]/40 hover:border-[#FFD700] active:scale-95 transition-all text-center cursor-pointer"
            >
              <div className="text-xs font-black text-[#FFD700] uppercase">LEVEL 1</div>
              <div className="text-[10px] text-gray-400 mt-1">5 Bat Thugs</div>
              <div className="text-[10px] font-bold text-emerald-400 mt-1">+10 SC (30s Cooldown)</div>
            </button>

            <button
              onClick={() => startLevel(2)}
              type="button"
              className="p-3.5 rounded-2xl bg-gradient-to-b from-[#1C1F2B] to-[#12141C] border border-orange-500/40 hover:border-orange-500 active:scale-95 transition-all text-center cursor-pointer"
            >
              <div className="text-xs font-black text-orange-400 uppercase">LEVEL 2</div>
              <div className="text-[10px] text-gray-400 mt-1">10 Gun Thugs</div>
              <div className="text-[10px] font-bold text-emerald-400 mt-1">+10 SC (30s Cooldown)</div>
            </button>

            <button
              onClick={() => startLevel(3)}
              type="button"
              className="p-3.5 rounded-2xl bg-gradient-to-b from-[#1C1F2B] to-[#12141C] border border-red-500/40 hover:border-red-500 active:scale-95 transition-all text-center cursor-pointer"
            >
              <div className="text-xs font-black text-red-400 uppercase">LEVEL 3</div>
              <div className="text-[10px] text-gray-400 mt-1">15 + Giant Boss</div>
              <div className="text-[10px] font-bold text-emerald-400 mt-1">+10 SC (30s Cooldown)</div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-gray-300 bg-black/50 p-3 rounded-2xl border border-white/10 max-w-md">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Health (+50%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Ammo (+30)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Armor (15s)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Pistol Pickup
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Shotgun Pickup
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* GAME CANVAS & ON-SCREEN CONTROLS */}
      {/* ------------------------------------------------------------- */}
      {gameState === 'playing' && (
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={720}
            height={500}
            className="w-full h-full object-contain touch-none"
          />

          {/* LEFT VIRTUAL JOYSTICK */}
          <div
            className="absolute bottom-5 left-5 w-32 h-32 rounded-full border-2 border-white/20 bg-black/50 backdrop-blur-sm flex items-center justify-center touch-none select-none z-10"
            onTouchStart={handleTouchStartJoystick}
            onTouchMove={handleTouchMoveJoystick}
            onTouchEnd={handleTouchEndJoystick}
            onMouseDown={handleTouchStartJoystick}
            onMouseMove={handleTouchMoveJoystick}
            onMouseUp={handleTouchEndJoystick}
          >
            <div
              className="w-12 h-12 rounded-full bg-yellow-400/90 shadow-[0_0_15px_#FACC15] pointer-events-none transition-transform"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            />
            <span className="absolute bottom-1 text-[9px] font-bold text-gray-400 pointer-events-none uppercase">
              Move
            </span>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="absolute bottom-5 right-5 flex flex-col gap-2 items-end touch-none select-none z-10">
            <div className="flex gap-2">
              {/* RELOAD BUTTON */}
              <button
                onClick={handleReload}
                type="button"
                className="w-12 h-12 rounded-2xl bg-gray-800/90 border border-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-[9px] font-black text-gray-200 shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#FFD700]" />
                RELOAD
              </button>

              {/* SWITCH WEAPON BUTTON */}
              <button
                onClick={handleSwitchWeapon}
                type="button"
                className="w-12 h-12 rounded-2xl bg-purple-900/80 border border-purple-500/40 active:scale-95 transition-all flex flex-col items-center justify-center text-[9px] font-black text-purple-200 shadow-md cursor-pointer"
              >
                <Zap className="w-4 h-4 text-purple-300" />
                SWITCH
              </button>
            </div>

            {/* BIG PUNCH / SHOOT BUTTON */}
            <button
              onClick={handleActionAttack}
              type="button"
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-yellow-500 text-black font-black text-xs uppercase shadow-[0_0_25px_rgba(239,68,68,0.8)] active:scale-90 transition-all flex flex-col items-center justify-center cursor-pointer border-2 border-white/30"
            >
              {weapon === 'fists' ? (
                <>
                  <span className="text-2xl">👊</span>
                  <span className="text-[10px] tracking-wider font-black">PUNCH</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-6 h-6 stroke-[3]" />
                  <span className="text-[10px] tracking-wider font-black">SHOOT</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WIN POPUP: TURF CAPTURED */}
      {/* Title TURF CAPTURED - Buttons: Home Base (300 SC claimed) | Watch Ad to Double Reward (600 SC) */}
      {/* ------------------------------------------------------------- */}
      {gameState === 'win' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181B26] via-[#11131C] to-[#0A0B10] border-2 border-emerald-500/60 p-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto mb-3">
              <Award className="w-9 h-9 text-emerald-400" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">
              TURF CAPTURED
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              All 3 Lagos Zones under Yellow Gang dominance!
            </p>

            <div className="my-4 py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-gray-400">Claimed Rewards:</span>
                <span className="text-xs font-bold text-gray-300">+50 Shop Coins</span>
              </div>
              <span className="text-xl font-black text-[#FFD700]">🪙 {earnedCoins} SC</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {!adDoubled && (
                <button
                  onClick={handleDoubleRewardAd}
                  disabled={adWatching}
                  type="button"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.6)] active:scale-95 transition-all cursor-pointer"
                >
                  <Tv className="w-4 h-4 fill-black" />
                  {adWatching ? 'Watching Ad...' : 'Watch Ad to Double Reward (600 SC)'}
                </button>
              )}

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/10"
              >
                Home Base (300 SC claimed)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LOSE POPUP: TURF LOST */}
      {/* Title TURF LOST - Buttons: Home Base | Watch Ad to Retry */}
      {/* ------------------------------------------------------------- */}
      {gameState === 'lose' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#211414] via-[#160D0D] to-[#0A0707] border-2 border-red-500/60 p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.35)]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center mx-auto mb-3">
              <Skull className="w-9 h-9 text-red-400" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">
              TURF LOST
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Rival Red Gang boys took over the territory.
            </p>

            <div className="my-4 py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400">Consolation:</span>
              <span className="text-lg font-black text-[#FFD700]">🪙 50 SC</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleRetryAd}
                disabled={adWatching}
                type="button"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.6)] active:scale-95 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4 fill-white" />
                {adWatching ? 'Loading Ad...' : 'Watch Ad to Retry (Restart same map)'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/10"
              >
                Home Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
