'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Zap,
  Shield,
  Trophy,
  Coins,
  Crosshair,
  Volume2,
  VolumeX,
  BatteryCharging,
  Flame,
  Tv,
} from 'lucide-react';
import {
  playCoinSound,
  playSuccessSound,
  playClickSound,
  playShootSound,
  playPickupSound,
  playSirenSound,
} from '@/lib/sound';
import { addGameCoins, saveShooterLevel } from '@/lib/storage';
import {
  getOrGrantShooterDailyPowerup,
  claimShooterAdPowerup,
  getTodayDailyClaim,
} from '@/lib/dailyFree';
import confetti from 'canvas-confetti';

interface StreetGalaxyShooterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLevel: number;
  onToast: (msg: string) => void;
}

type NormalPowerUpType = 'green_battery' | 'blue_double' | 'purple_quad';
type BossPowerUpType = 'gold_battery' | 'red_laser' | 'blue_shield' | 'gold_mega_quad';

interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  width: number;
  height: number;
  isEnemy: boolean;
  damage: number;
  isLaser?: boolean;
}

interface Enemy {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: string;
  canShoot: boolean;
  shootCooldown: number;
  isBoss: boolean;
  bossName?: string;
}

interface FallingPowerUp {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: NormalPowerUpType | BossPowerUpType;
  isBossBox: boolean;
  size: number;
  icon: string;
  label: string;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  radius: number;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  color: string;
  size?: number;
}

export function StreetGalaxyShooterModal({
  isOpen,
  onClose,
  initialLevel,
  onToast,
}: StreetGalaxyShooterModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Level & Wave Tracking (Level 1..3, 5 waves each level)
  const [level, setLevel] = useState<number>(initialLevel || 1);
  const [wave, setWave] = useState<number>(1);
  const [energy, setEnergy] = useState<number>(100);
  const [score, setScore] = useState<number>(0);
  const [coinsEarned, setCoinsEarned] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active weapon power-up timers
  const [doubleBulletTimer, setDoubleBulletTimer] = useState<number>(0);
  const [quadBulletTimer, setQuadBulletTimer] = useState<number>(0);
  const [megaQuadTimer, setMegaQuadTimer] = useState<number>(0);
  const [laserTimer, setLaserTimer] = useState<number>(0);
  const [shieldTimer, setShieldTimer] = useState<number>(0);

  // Boss Health HUD
  const [activeBossHp, setActiveBossHp] = useState<{ current: number; max: number; name: string } | null>(null);

  // Game States
  const [gameState, setGameState] = useState<'playing' | 'wave_clear' | 'level_complete' | 'failed'>('playing');
  const [adWatching, setAdWatching] = useState<boolean>(false);

  // Daily Free Power-up System (Prompt 12)
  const [dailyPowerupBanner, setDailyPowerupBanner] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [shooterAdsCount, setShooterAdsCount] = useState<number>(() => {
    try {
      return getTodayDailyClaim().shooter_ad_powerups_count;
    } catch {
      return 0;
    }
  });
  const [isWatchingShooterAd, setIsWatchingShooterAd] = useState(false);

  // Touch & Joystick Input Refs
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  const [joystickThumb, setJoystickThumb] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const isShootingRef = useRef<boolean>(false);

  // Mutable Game Loop State
  const gameRef = useRef({
    isRunning: false,
    player: { x: 180, y: 440, width: 36, height: 42, speed: 5.2 },
    energy: 100,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    powerUps: [] as FallingPowerUp[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    stars: [] as { x: number; y: number; s: number; alpha: number }[],
    lastShootTime: 0,
    lastEnergyDecayTime: 0,
    doubleGunExpiry: 0,
    quadGunExpiry: 0,
    megaQuadExpiry: 0,
    laserExpiry: 0,
    shieldExpiry: 0,
    bossesSpawnedThisWave: 0,
    enemiesSpawnedThisWave: 0,
    waveTargetEnemies: 9,
    isWaveBossDefeated: false,
  });

  const playSfx = useCallback(
    (type: 'coin' | 'success' | 'click' | 'shoot' | 'pickup' | 'fail' | 'hit') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'success') playSuccessSound();
        else if (type === 'shoot') playShootSound();
        else if (type === 'pickup') playPickupSound();
        else if (type === 'fail') playSirenSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Start / Init Level and Wave
  const startWave = useCallback(
    (newLevel: number, newWave: number) => {
      setLevel(newLevel);
      setWave(newWave);
      setGameState('playing');
      setActiveBossHp(null);
      isShootingRef.current = false;

      const g = gameRef.current;
      g.isRunning = true;
      g.energy = 100;
      setEnergy(100);
      g.player = { x: 180, y: 440, width: 36, height: 42, speed: 5.2 };
      g.bullets = [];
      g.enemies = [];
      g.powerUps = [];
      g.floatingTexts = [];
      g.bossesSpawnedThisWave = 0;
      g.enemiesSpawnedThisWave = 0;
      // Wave 1-3: groups of 3 (9 enemies), Wave 4: Mini-boss + normal (8), Wave 5: BIG BOSS + normal (6)
      g.waveTargetEnemies = newWave <= 3 ? 9 : newWave === 4 ? 8 : 6;
      g.isWaveBossDefeated = false;
      g.lastEnergyDecayTime = Date.now();
    },
    []
  );

  // Initialize game running state & Daily Free Power-up (Prompt 12)
  useEffect(() => {
    if (isOpen) {
      gameRef.current.isRunning = true;
      gameRef.current.energy = 100;
      gameRef.current.bullets = [];
      gameRef.current.enemies = [];
      gameRef.current.powerUps = [];
      gameRef.current.floatingTexts = [];
      gameRef.current.bossesSpawnedThisWave = 0;
      gameRef.current.enemiesSpawnedThisWave = 0;
      gameRef.current.waveTargetEnemies = wave <= 3 ? 9 : wave === 4 ? 8 : 6;
      gameRef.current.lastEnergyDecayTime = Date.now();

      // Prompt 12: Daily Free Power-up for Shooter
      let bannerTimer: ReturnType<typeof setTimeout> | undefined;
      const initTimer = setTimeout(() => {
        try {
          const { powerup } = getOrGrantShooterDailyPowerup();
          if (powerup === 'double_bullet') {
            gameRef.current.doubleGunExpiry = Date.now() + 30000;
            setDoubleBulletTimer(30);
            setDailyPowerupBanner({
              title: 'DAILY FREE POWER-UP',
              description: 'Double Bullet Activated for 30 sec!',
            });
          } else {
            gameRef.current.energy = 100;
            setEnergy(100);
            setDailyPowerupBanner({
              title: 'DAILY FREE POWER-UP',
              description: 'Energy Pack Activated: 100% Supercharged!',
            });
          }
          playPickupSound();
          bannerTimer = setTimeout(() => setDailyPowerupBanner(null), 4500);
        } catch {}
      }, 0);

      return () => {
        clearTimeout(initTimer);
        if (bannerTimer) clearTimeout(bannerTimer);
      };
    } else {
      gameRef.current.isRunning = false;
      const resetTimer = setTimeout(() => {
        setDailyPowerupBanner(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, wave]);

  const handleWatchAdForShooterPowerup = useCallback(() => {
    if (shooterAdsCount >= 3) {
      onToast('Maximum 3 power-up ads reached today!');
      return;
    }
    setIsWatchingShooterAd(true);
    playClickSound();
    setTimeout(() => {
      const res = claimShooterAdPowerup();
      setIsWatchingShooterAd(false);
      if (res.success && res.powerup) {
        setShooterAdsCount(res.count);
        if (res.powerup === 'double_bullet') {
          gameRef.current.doubleGunExpiry = Date.now() + 30000;
          setDoubleBulletTimer(30);
          onToast('🎯 Double Bullet granted from Ad for 30 sec!');
        } else {
          gameRef.current.energy = 100;
          setEnergy(100);
          onToast('🔋 Energy Pack granted from Ad (100% Energy)!');
        }
        playPickupSound();
      }
    }, 1500);
  }, [onToast, shooterAdsCount]);

  // Touch Joystick Handlers
  const handleJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    joystickRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      dx: 0,
      dy: 0,
    };
    setJoystickThumb({ x: 0, y: 0, active: true });
  };

  const handleJoystickMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickRef.current.active) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const maxDist = 38;
    let dx = clientX - joystickRef.current.startX;
    let dy = clientY - joystickRef.current.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    joystickRef.current.dx = dx / maxDist;
    joystickRef.current.dy = dy / maxDist;
    setJoystickThumb({ x: dx, y: dy, active: true });
  };

  const handleJoystickEnd = () => {
    joystickRef.current.active = false;
    joystickRef.current.dx = 0;
    joystickRef.current.dy = 0;
    setJoystickThumb({ x: 0, y: 0, active: false });
  };

  // Keyboard controls
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        isShootingRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        isShootingRef.current = false;
      }
    };

    const interval = setInterval(() => {
      if (!gameRef.current.isRunning) return;
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
  }, []);

  // Fail Handler
  const handleFail = useCallback(() => {
    gameRef.current.isRunning = false;
    setGameState('failed');
    playSfx('fail');
  }, [playSfx]);

  // Watch Ad to Continue with 50% energy
  const handleWatchAdContinue = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      gameRef.current.energy = 50;
      gameRef.current.bullets = [];
      setEnergy(50);
      setGameState('playing');
      gameRef.current.isRunning = true;
      onToast('Shields recharged to 50%! Keep fighting!');
      playSfx('pickup');
    }, 1800);
  };

  // Main Canvas Animation Loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Starfield initialization
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      s: Math.random() * 2 + 0.6,
      alpha: Math.random() * 0.8 + 0.2,
    }));
    gameRef.current.stars = stars;

    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      const g = gameRef.current;

      if (g.isRunning) {
        // 1. Move Player Jet
        if (joystickRef.current.dx !== 0 || joystickRef.current.dy !== 0) {
          g.player.x += joystickRef.current.dx * g.player.speed;
          g.player.y += joystickRef.current.dy * g.player.speed;
        }

        g.player.x = Math.max(18, Math.min(canvas.width - 18, g.player.x));
        g.player.y = Math.max(50, Math.min(canvas.height - 24, g.player.y));

        // 2. Active Weapon Buff Timers
        const nowMs = Date.now();

        // Prompt 10: Energy goes down 1% every 2 seconds
        if (nowMs - g.lastEnergyDecayTime >= 2000) {
          g.lastEnergyDecayTime = nowMs;
          g.energy = Math.max(0, g.energy - 1);
          setEnergy(g.energy);
          if (g.energy <= 0) {
            handleFail();
            return;
          }
        }

        setDoubleBulletTimer(Math.max(0, Math.ceil((g.doubleGunExpiry - nowMs) / 1000)));
        setQuadBulletTimer(Math.max(0, Math.ceil((g.quadGunExpiry - nowMs) / 1000)));
        setMegaQuadTimer(Math.max(0, Math.ceil((g.megaQuadExpiry - nowMs) / 1000)));
        setLaserTimer(Math.max(0, Math.ceil((g.laserExpiry - nowMs) / 1000)));
        setShieldTimer(Math.max(0, Math.ceil((g.shieldExpiry - nowMs) / 1000)));

        const isDouble = g.doubleGunExpiry > nowMs;
        const isQuad = g.quadGunExpiry > nowMs;
        const isMegaQuad = g.megaQuadExpiry > nowMs;
        const isLaser = g.laserExpiry > nowMs;
        const isShield = g.shieldExpiry > nowMs;

        // 3. Player Shoot (Auto-fire on hold or shoot button)
        const shootInterval = isLaser ? 80 : isMegaQuad ? 120 : isQuad ? 130 : 150;
        if ((isShootingRef.current || nowMs - g.lastShootTime > shootInterval) && nowMs - g.lastShootTime > shootInterval) {
          g.lastShootTime = nowMs;
          playSfx('shoot');

          if (isLaser) {
            // Super Red Laser column
            g.bullets.push({
              id: `pl_${nowMs}`,
              x: g.player.x,
              y: g.player.y - 20,
              vx: 0,
              vy: -14,
              color: '#EF4444',
              width: 8,
              height: 24,
              isEnemy: false,
              damage: 35,
              isLaser: true,
            });
          } else if (isMegaQuad) {
            // Gold 4 mega quad bullets
            [-12, -4, 4, 12].forEach((offset, idx) => {
              g.bullets.push({
                id: `pmq_${nowMs}_${idx}`,
                x: g.player.x + offset,
                y: g.player.y - 15,
                vx: offset * 0.15,
                vy: -11,
                color: '#FFD700',
                width: 5,
                height: 14,
                isEnemy: false,
                damage: 25,
              });
            });
          } else if (isQuad) {
            // Purple 4 bullets
            [-10, -3, 3, 10].forEach((offset, idx) => {
              g.bullets.push({
                id: `pq_${nowMs}_${idx}`,
                x: g.player.x + offset,
                y: g.player.y - 15,
                vx: offset * 0.12,
                vy: -10,
                color: '#C084FC',
                width: 4,
                height: 12,
                isEnemy: false,
                damage: 18,
              });
            });
          } else if (isDouble) {
            // Blue 2 bullets
            [-6, 6].forEach((offset, idx) => {
              g.bullets.push({
                id: `pd_${nowMs}_${idx}`,
                x: g.player.x + offset,
                y: g.player.y - 15,
                vx: 0,
                vy: -9.5,
                color: '#38BDF8',
                width: 3.5,
                height: 11,
                isEnemy: false,
                damage: 15,
              });
            });
          } else {
            // Standard single yellow bullet
            g.bullets.push({
              id: `pb_${nowMs}`,
              x: g.player.x,
              y: g.player.y - 15,
              vx: 0,
              vy: -9,
              color: '#FACC15',
              width: 3.5,
              height: 10,
              isEnemy: false,
              damage: 12,
            });
          }
        }

        // 4. Enemy Spawning Logic (Prompt 10: Wave 1-3: groups of 3; Wave 4: Mini-boss + normal; Wave 5: BIG BOSS 3X size)
        if (g.enemiesSpawnedThisWave < g.waveTargetEnemies && Math.random() < 0.04) {
          if (wave <= 3) {
            // Wave 1-3: normal fighter jets in groups of 3
            const spawnBatch = Math.min(3, g.waveTargetEnemies - g.enemiesSpawnedThisWave);
            const startX = Math.random() * (canvas.width - 130) + 15;
            for (let k = 0; k < spawnBatch; k++) {
              g.enemiesSpawnedThisWave++;
              const eWidth = 26;
              const eHeight = 26;
              const hp = 15 + level * 5;
              g.enemies.push({
                id: `en_${Date.now()}_${k}_${Math.random()}`,
                x: startX + k * 36,
                y: -eHeight - k * 18,
                vx: (Math.random() - 0.5) * 0.8,
                vy: 1.8 + level * 0.2,
                width: eWidth,
                height: eHeight,
                hp,
                maxHp: hp,
                color: '#DC2626',
                canShoot: wave > 1,
                shootCooldown: Math.random() * 60 + 50,
                isBoss: false,
              });
            }
          } else {
            // Wave 4 & 5: normal fighter jets
            g.enemiesSpawnedThisWave++;
            const eWidth = 26;
            const eHeight = 26;
            const hp = 15 + level * 5;
            g.enemies.push({
              id: `en_${Date.now()}_${Math.random()}`,
              x: Math.random() * (canvas.width - eWidth - 20) + 10,
              y: -eHeight,
              vx: (Math.random() - 0.5) * 1.5,
              vy: 1.9 + level * 0.25,
              width: eWidth,
              height: eHeight,
              hp,
              maxHp: hp,
              color: '#DC2626',
              canShoot: true,
              shootCooldown: Math.random() * 50 + 40,
              isBoss: false,
            });
          }
        }

        // Spawn Mini-Boss on Wave 4
        if (
          wave === 4 &&
          g.bossesSpawnedThisWave === 0 &&
          g.enemiesSpawnedThisWave >= 3 &&
          !g.enemies.some((e) => e.isBoss)
        ) {
          g.bossesSpawnedThisWave = 1;
          const bWidth = 58;
          const bHeight = 44;
          const bHp = 130;
          const bossEnemy: Enemy = {
            id: `miniboss_${Date.now()}`,
            x: canvas.width / 2 - bWidth / 2,
            y: -bHeight,
            vx: 1.5,
            vy: 0.8,
            width: bWidth,
            height: bHeight,
            hp: bHp,
            maxHp: bHp,
            color: '#991B1B',
            canShoot: true,
            shootCooldown: 40,
            isBoss: true,
            bossName: 'MINI-BOMBER STRIKER',
          };
          g.enemies.push(bossEnemy);
          setActiveBossHp({ current: bHp, max: bHp, name: 'MINI-BOMBER STRIKER' });
          onToast('⚠️ MINI-BOSS INCOMING: Mini-Bomber Striker!');
        }

        // Spawn BIG BOSS on Wave 5 (Prompt 10: 3X size, shoots double bullets, takes 20 hits to kill)
        if (
          wave === 5 &&
          g.bossesSpawnedThisWave === 0 &&
          g.enemiesSpawnedThisWave >= 2 &&
          !g.enemies.some((e) => e.isBoss)
        ) {
          g.bossesSpawnedThisWave = 1;
          const bossWidth = 92; // 3X BIGGER black/red bomber
          const bossHeight = 68;
          const bossHp = 240; // takes 20 hits * 12 damage standard
          const bossName = '3X GALAXY DREADNOUGHT';

          const bossEnemy: Enemy = {
            id: `big_boss_${Date.now()}`,
            x: canvas.width / 2 - bossWidth / 2,
            y: -bossHeight,
            vx: 1.7,
            vy: 0.65,
            width: bossWidth,
            height: bossHeight,
            hp: bossHp,
            maxHp: bossHp,
            color: '#18181B',
            canShoot: true,
            shootCooldown: 35,
            isBoss: true,
            bossName,
          };
          g.enemies.push(bossEnemy);
          setActiveBossHp({ current: bossHp, max: bossHp, name: bossName });
          onToast('👑 BIG BOSS APPEARED: 3X Giant Dreadnought!');
        }

        // 5. Update Enemies
        for (let i = g.enemies.length - 1; i >= 0; i--) {
          const en = g.enemies[i];
          en.x += en.vx;
          en.y += en.vy;

          if (en.isBoss) {
            // Boss patrols horizontally near top
            if (en.y < 50) en.y += 0.8;
            if (en.x <= 15 || en.x + en.width >= canvas.width - 15) {
              en.vx *= -1;
            }
          }

          // Enemy Shoots
          if (en.canShoot) {
            en.shootCooldown--;
            if (en.shootCooldown <= 0) {
              en.shootCooldown = en.isBoss ? (wave === 5 ? 32 : 42) : 80 + Math.random() * 40;
              const bSpeed = en.isBoss ? 4.6 : 3.6;

              if (en.isBoss && wave === 5) {
                // Wave 5 BIG BOSS: shoots double bullets!
                g.bullets.push(
                  {
                    id: `eb1_${Date.now()}_${Math.random()}`,
                    x: en.x + en.width * 0.32,
                    y: en.y + en.height,
                    vx: -0.5,
                    vy: bSpeed,
                    color: '#EF4444',
                    width: 6,
                    height: 8,
                    isEnemy: true,
                    damage: 15,
                  },
                  {
                    id: `eb2_${Date.now()}_${Math.random()}`,
                    x: en.x + en.width * 0.68,
                    y: en.y + en.height,
                    vx: 0.5,
                    vy: bSpeed,
                    color: '#EF4444',
                    width: 6,
                    height: 8,
                    isEnemy: true,
                    damage: 15,
                  }
                );
              } else {
                const angle = Math.atan2(g.player.y - en.y, g.player.x - en.x);
                g.bullets.push({
                  id: `eb_${Date.now()}_${Math.random()}`,
                  x: en.x + en.width / 2,
                  y: en.y + en.height,
                  vx: Math.cos(angle) * bSpeed,
                  vy: Math.sin(angle) * bSpeed,
                  color: en.isBoss ? '#EF4444' : '#F97316',
                  width: en.isBoss ? 6 : 4,
                  height: en.isBoss ? 6 : 4,
                  isEnemy: true,
                  damage: 15,
                });
              }
            }
          }

          // Prompt 10: Crash with enemy jet = -25% energy
          const distToPlayer = Math.hypot((en.x + en.width / 2) - g.player.x, (en.y + en.height / 2) - g.player.y);
          if (distToPlayer < (en.isBoss ? 48 : 22)) {
            if (!isShield) {
              g.energy = Math.max(0, g.energy - 25);
              setEnergy(g.energy);
              playSfx('hit');
              onToast('💥 Mid-air Collision! -25% Energy!');
              if (g.energy <= 0) {
                handleFail();
                return;
              }
            }
            if (!en.isBoss) {
              g.enemies.splice(i, 1);
              continue;
            } else {
              g.player.y = Math.min(canvas.height - 24, g.player.y + 35);
            }
          }

          // Energy Penalty: Enemy passes bottom without kill = -10%
          if (en.y > canvas.height + 10) {
            g.enemies.splice(i, 1);
            if (!en.isBoss) {
              g.energy = Math.max(0, g.energy - 10);
              setEnergy(g.energy);
              playSfx('hit');
              onToast('Enemy passed! -10% Energy!');
              if (g.energy <= 0) {
                handleFail();
                return;
              }
            }
            continue;
          }
        }

        // 6. Update Bullets
        for (let i = g.bullets.length - 1; i >= 0; i--) {
          const b = g.bullets[i];
          b.x += b.vx;
          b.y += b.vy;

          // Out of canvas bounds
          if (b.x < -10 || b.x > canvas.width + 10 || b.y < -20 || b.y > canvas.height + 20) {
            g.bullets.splice(i, 1);
            continue;
          }

          if (b.isEnemy) {
            // Prompt 10: Hit by enemy bullet = -15% Energy
            const p = g.player;
            if (Math.hypot(b.x - p.x, b.y - p.y) < 18) {
              g.bullets.splice(i, 1);
              if (!isShield) {
                g.energy = Math.max(0, g.energy - 15);
                setEnergy(g.energy);
                playSfx('hit');
                onToast('Hull Hit by Bullet! -15% Energy!');
                if (g.energy <= 0) {
                  handleFail();
                  return;
                }
              }
            }
          } else {
            // Player bullet hits enemy
            for (let j = g.enemies.length - 1; j >= 0; j--) {
              const en = g.enemies[j];
              if (
                b.x >= en.x - 4 &&
                b.x <= en.x + en.width + 4 &&
                b.y >= en.y &&
                b.y <= en.y + en.height
              ) {
                en.hp -= b.damage;
                if (!b.isLaser) {
                  g.bullets.splice(i, 1);
                }

                if (en.isBoss) {
                  setActiveBossHp({ current: Math.max(0, en.hp), max: en.maxHp, name: en.bossName || 'BOSS' });
                }

                // Enemy Destroyed
                if (en.hp <= 0) {
                  g.enemies.splice(j, 1);
                  setScore((s) => s + (en.isBoss ? 500 : 80));

                  if (!en.isBoss) {
                    // Normal enemy destroyed: Auto +5 SC
                    addGameCoins(5, '+5 SC - Jet Destroyed', 'task_reward');
                    setCoinsEarned((c) => c + 5);
                    playSfx('coin');

                    // Prompt 10: Floating text animation "+5 SC"
                    g.floatingTexts.push({
                      id: `ft_${Date.now()}_${Math.random()}`,
                      text: '+5 SC',
                      x: en.x + en.width / 2,
                      y: en.y,
                      vy: -1.3,
                      alpha: 1,
                      color: '#FFD700',
                      size: 13,
                    });

                    // 30% chance DROP power-up falling down
                    if (Math.random() < 0.3) {
                      const roll = Math.random();
                      let type: NormalPowerUpType = 'green_battery';
                      let label = '+30% Battery';
                      let icon = '🔋';
                      let color = '#22C55E';

                      if (roll > 0.6) {
                        type = 'purple_quad';
                        label = 'Quad Bullets (10s)';
                        icon = '🟣';
                        color = '#A855F7';
                      } else if (roll > 0.3) {
                        type = 'blue_double';
                        label = 'Double Bullets (10s)';
                        icon = '🔵';
                        color = '#38BDF8';
                      }

                      g.powerUps.push({
                        id: `pup_${Date.now()}_${Math.random()}`,
                        x: en.x + en.width / 2,
                        y: en.y + en.height / 2,
                        vy: 2.2,
                        type,
                        isBossBox: false,
                        size: 24,
                        icon,
                        label,
                        color,
                      });
                    }
                  } else {
                    // Boss Destroyed: Auto +20 SC
                    addGameCoins(20, '+20 SC - Giant Bomber Destroyed', 'task_reward');
                    setCoinsEarned((c) => c + 20);
                    setActiveBossHp(null);
                    g.isWaveBossDefeated = true;
                    playSfx('success');
                    onToast('👑 BOSS ELIMINATED! Big Gold Glowing Box dropped!');

                    // Prompt 10: Floating text animation "+20 SC"
                    g.floatingTexts.push({
                      id: `ft_boss_${Date.now()}`,
                      text: '+20 SC',
                      x: en.x + en.width / 2,
                      y: en.y,
                      vy: -1.5,
                      alpha: 1,
                      color: '#FFD700',
                      size: 18,
                    });

                    // Always DROP big gold glowing box falling down
                    const bossBuffs: { type: BossPowerUpType; label: string; icon: string }[] = [
                      { type: 'gold_battery', label: '+100% Full Energy', icon: '🟡' },
                      { type: 'red_laser', label: 'Super Laser (15s)', icon: '🔴' },
                      { type: 'blue_shield', label: 'Invincible Shield (10s)', icon: '🛡️' },
                      { type: 'gold_mega_quad', label: 'Mega Quad (15s)', icon: '⭐' },
                    ];
                    const chosen = bossBuffs[Math.floor(Math.random() * bossBuffs.length)];

                    g.powerUps.push({
                      id: `boss_box_${Date.now()}`,
                      x: en.x + en.width / 2,
                      y: en.y + en.height / 2,
                      vy: 1.8,
                      type: chosen.type,
                      isBossBox: true,
                      size: 34,
                      icon: chosen.icon,
                      label: chosen.label,
                      color: '#FFD700',
                    });
                  }
                }
                break;
              }
            }
          }
        }

        // 7. Update Falling Power-Ups
        for (let i = g.powerUps.length - 1; i >= 0; i--) {
          const p = g.powerUps[i];
          p.y += p.vy;

          // Catch power-up with Player Jet
          if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < p.size + 14) {
            playSfx('pickup');
            onToast(`⚡ Acquired ${p.label}!`);

            if (p.type === 'green_battery') {
              g.energy = Math.min(100, g.energy + 30);
              setEnergy(g.energy);
            } else if (p.type === 'blue_double') {
              g.doubleGunExpiry = Date.now() + 10000;
            } else if (p.type === 'purple_quad') {
              g.quadGunExpiry = Date.now() + 10000;
            } else if (p.type === 'gold_battery') {
              g.energy = 100;
              setEnergy(100);
            } else if (p.type === 'red_laser') {
              g.laserExpiry = Date.now() + 15000;
            } else if (p.type === 'blue_shield') {
              g.shieldExpiry = Date.now() + 10000;
            } else if (p.type === 'gold_mega_quad') {
              g.megaQuadExpiry = Date.now() + 15000;
            }

            g.powerUps.splice(i, 1);
            continue;
          }

          // Off bottom of screen
          if (p.y > canvas.height + 20) {
            g.powerUps.splice(i, 1);
          }
        }

        // 8. Wave Clear Check
        const allEnemiesSpawned = g.enemiesSpawnedThisWave >= g.waveTargetEnemies;
        const allBossesDefeated = wave < 4 || (wave === 4 && g.bossesSpawnedThisWave >= 1) || (wave === 5 && g.isWaveBossDefeated);
        const noActiveEnemies = g.enemies.length === 0;

        if (allEnemiesSpawned && allBossesDefeated && noActiveEnemies) {
          g.isRunning = false;
          if (wave === 5) {
            setGameState('level_complete');
            addGameCoins(10, `+10 SC - Level ${level} Complete`, 'task_reward');
            setCoinsEarned((c) => c + 10);
            onToast(`🎉 LEVEL ${level} COMPLETE! +10 SC Bonus Awarded!`);
          } else {
            setGameState('wave_clear');
          }
          playSfx('success');
          try {
            confetti({
              particleCount: 90,
              spread: 75,
              origin: { y: 0.6 },
              colors: ['#FFD700', '#FACC15', '#00F0FF', '#FFFFFF'],
            });
          } catch {}
        }
      }

      // -----------------------------------------------------------------
      // DRAW CANVAS SCENE
      // -----------------------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep space background
      ctx.fillStyle = '#07080E';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Starfield
      g.stars.forEach((s) => {
        s.y += s.s * 0.8;
        if (s.y > canvas.height) s.y = 0;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      });

      // DRAW FALLING POWER-UPS
      g.powerUps.forEach((pup) => {
        ctx.save();
        ctx.translate(pup.x, pup.y);

        if (pup.isBossBox) {
          // Big Gold Glowing Box
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 15;
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.fillRect(-17, -17, 34, 34);
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.strokeRect(-17, -17, 34, 34);
          ctx.shadowBlur = 0;
        } else {
          // Normal Power-Up Pill / Circle
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fill();
          ctx.strokeStyle = pup.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        ctx.font = pup.isBossBox ? '18px sans-serif' : '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pup.icon, 0, 1);
        ctx.restore();
      });

      // DRAW BULLETS
      g.bullets.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.isLaser ? 12 : 6;
        ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
        ctx.shadowBlur = 0;
      });

      // DRAW ENEMIES
      g.enemies.forEach((en) => {
        ctx.save();
        ctx.translate(en.x + en.width / 2, en.y + en.height / 2);

        if (en.isBoss) {
          // 3X BIGGER BLACK/RED STEALTH BOMBER
          ctx.fillStyle = '#0F0F14';
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 3;

          // Bomber Delta Wing Shape
          ctx.beginPath();
          ctx.moveTo(0, 28); // Nose pointing down
          ctx.lineTo(en.width / 2, -24); // Right wing tip
          ctx.lineTo(en.width / 4, -12);
          ctx.lineTo(0, -28); // Rear
          ctx.lineTo(-en.width / 4, -12);
          ctx.lineTo(-en.width / 2, -24); // Left wing tip
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Red cockpit & engine glow
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(0, 4, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#F97316';
          ctx.fillRect(-14, -28, 6, 8);
          ctx.fillRect(8, -28, 6, 8);
        } else {
          // NORMAL SMALL RED/GREY JET
          ctx.fillStyle = '#27272A';
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;

          ctx.beginPath();
          ctx.moveTo(0, 14);
          ctx.lineTo(13, -12);
          ctx.lineTo(0, -7);
          ctx.lineTo(-13, -12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cockpit
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // DRAW PLAYER JET (Yellow & Black at bottom)
      const p = g.player;
      const isShield = g.shieldExpiry > Date.now();

      // Shield Aura
      if (isShield) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(p.x, p.y);

      // Jet Delta Wings (Black & Yellow)
      ctx.beginPath();
      ctx.moveTo(0, -18); // Nose pointing UP
      ctx.lineTo(16, 16); // Right wing tip
      ctx.lineTo(6, 11);
      ctx.lineTo(0, 15);
      ctx.lineTo(-6, 11);
      ctx.lineTo(-16, 16); // Left wing tip
      ctx.closePath();
      ctx.fillStyle = '#FACC15'; // Bright Lagos Yellow
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Black Cockpit & Core
      ctx.fillStyle = '#111116';
      ctx.beginPath();
      ctx.ellipse(0, -2, 5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Engine Thruster Flame
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(-4, 15);
      ctx.lineTo(0, 24 + Math.random() * 5);
      ctx.lineTo(4, 15);
      ctx.fill();

      ctx.restore();

      // DRAW FLOATING COIN ANIMATIONS (+5 SC, +20 SC)
      for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
        const ft = g.floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.022;
        if (ft.alpha <= 0) {
          g.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = `900 ${ft.size || 13}px sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, level, wave, handleFail, onToast, playSfx]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[9999] bg-black flex items-center justify-center p-2.5 select-none">
      <div
        className="relative w-full max-w-sm h-full max-h-[96vh] rounded-3xl bg-[#0D0D14] border-2 border-[#FFD700]/70 p-3 shadow-2xl flex flex-col items-center overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* TOP HEADER BAR */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-white/10 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-[#FFD700] uppercase tracking-wide">LEVEL {level}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-cyan-300">
              Wave {wave}/100
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWatchAdForShooterPowerup}
              disabled={isWatchingShooterAd || shooterAdsCount >= 3}
              type="button"
              className="px-2 py-0.5 rounded-lg bg-purple-900/40 border border-purple-500/40 text-[9px] font-black text-purple-300 flex items-center gap-1 active:scale-95 transition-all"
            >
              <Tv className="w-3 h-3" />
              <span>{isWatchingShooterAd ? 'Ad...' : `+1 Buff (${shooterAdsCount}/3)`}</span>
            </button>

            <div className="flex items-center gap-1 font-mono text-xs text-[#FFD700] font-bold">
              <Coins className="w-3.5 h-3.5" />
              <span>+{coinsEarned} SC</span>
            </div>

            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              type="button"
              className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#FFD700]" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                playClickSound();
                onClose();
              }}
              type="button"
              className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ENERGY BAR (FAIL IF 0%) */}
        <div className="w-full mt-2 px-1 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-300 font-bold">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>ENERGY:</span>
            <span className={energy <= 30 ? 'text-red-400 font-black animate-pulse' : 'text-emerald-400'}>
              {energy}%
            </span>
          </div>

          {/* ACTIVE BUFF BADGES */}
          <div className="flex items-center gap-1">
            {shieldTimer > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-bold">
                🛡️ {shieldTimer}s
              </span>
            )}
            {laserTimer > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-bold">
                🔴 {laserTimer}s
              </span>
            )}
            {megaQuadTimer > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[9px] font-bold">
                ⭐ {megaQuadTimer}s
              </span>
            )}
            {quadBulletTimer > 0 && megaQuadTimer <= 0 && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-bold">
                🟣 {quadBulletTimer}s
              </span>
            )}
            {doubleBulletTimer > 0 && quadBulletTimer <= 0 && megaQuadTimer <= 0 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold">
                🔵 {doubleBulletTimer}s
              </span>
            )}
          </div>
        </div>

        {/* Energy bar line */}
        <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden my-1">
          <div
            className={`h-full transition-all duration-150 ${
              energy <= 30 ? 'bg-red-500 shadow-[0_0_8px_#EF4444]' : 'bg-emerald-400'
            }`}
            style={{ width: `${energy}%` }}
          />
        </div>

        {/* DAILY FREE POWER-UP POPUP (PROMPT 12) */}
        {dailyPowerupBanner && (
          <div className="w-full my-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500/20 via-amber-500/30 to-yellow-500/20 border border-[#FFD700] flex items-center justify-between text-white animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#FFD700] fill-[#FFD700] animate-bounce shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase text-[#FFD700]">{dailyPowerupBanner.title}</p>
                <p className="text-[9px] text-gray-200">{dailyPowerupBanner.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* BOSS HP BAR (WHEN PRESENT) */}
        {activeBossHp && (
          <div className="w-full p-2 rounded-xl bg-red-950/40 border border-red-500/40 text-[10px] space-y-1 animate-pulse my-1">
            <div className="flex justify-between items-center text-red-400 font-black uppercase tracking-wider">
              <span>👑 {activeBossHp.name}</span>
              <span>
                {activeBossHp.current} / {activeBossHp.max} HP
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-red-500/30">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-amber-400 transition-all duration-100"
                style={{ width: `${Math.max(0, (activeBossHp.current / activeBossHp.max) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* GAME CANVAS SCREEN */}
        <div className="relative w-full aspect-[360/450] max-h-[450px] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner my-1">
          <canvas ref={canvasRef} width={360} height={450} className="w-full h-full touch-none" />

          {/* DUAL CONTROLS */}
          {/* LEFT TOUCH JOYSTICK */}
          <div
            className="absolute bottom-4 left-4 w-28 h-28 rounded-full border-2 border-white/20 bg-black/50 backdrop-blur-sm flex items-center justify-center touch-none select-none"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onMouseDown={handleJoystickStart}
            onMouseMove={handleJoystickMove}
            onMouseUp={handleJoystickEnd}
          >
            <div
              className="w-10 h-10 rounded-full bg-yellow-400/80 shadow-[0_0_15px_#FACC15] pointer-events-none transition-transform"
              style={{
                transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`,
              }}
            />
            <span className="absolute bottom-1 text-[8px] font-bold text-gray-400 pointer-events-none">
              STEER JET
            </span>
          </div>

          {/* RIGHT SHOOT BUTTON */}
          <div className="absolute bottom-4 right-4 touch-none select-none">
            <button
              onTouchStart={() => {
                isShootingRef.current = true;
              }}
              onTouchEnd={() => {
                isShootingRef.current = false;
              }}
              onMouseDown={() => {
                isShootingRef.current = true;
              }}
              onMouseUp={() => {
                isShootingRef.current = false;
              }}
              type="button"
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-400 text-black font-black text-xs uppercase shadow-[0_0_20px_rgba(250,204,21,0.8)] active:scale-90 transition-all flex flex-col items-center justify-center"
            >
              <Zap className="w-7 h-7 fill-black" />
              <span className="text-[9px] tracking-wider font-extrabold">SHOOT</span>
            </button>
          </div>

          {/* FAIL POPUP: GAME OVER */}
          {gameState === 'failed' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-3 animate-in fade-in z-30">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <Crosshair className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-white tracking-wide">GAME OVER</h4>
                <p className="text-xs text-gray-400 mt-0.5">Energy depleted in combat.</p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-[240px] pt-2">
                <button
                  onClick={handleWatchAdContinue}
                  disabled={adWatching}
                  type="button"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
                >
                  <Tv className="w-4 h-4 fill-black" />
                  {adWatching ? 'Loading Ad...' : 'Watch Ad to Continue (50% energy + keep power-ups)'}
                </button>

                <button
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Home Base
                </button>
              </div>
            </div>
          )}

          {/* WAVE CLEAR POPUP */}
          {gameState === 'wave_clear' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-3 animate-in zoom-in-95 z-30">
              <div className="w-14 h-14 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                <Trophy className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  WAVE CLEARED
                </span>
                <h4 className="text-xl font-black text-white">WAVE {wave} COMPLETE!</h4>
                <p className="text-xs text-gray-400">All syndicate jets and bombers neutralized.</p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-[240px] pt-2">
                <button
                  onClick={() => {
                    playClickSound();
                    startWave(level, wave + 1);
                  }}
                  type="button"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
                >
                  START WAVE {wave + 1}
                </button>

                <button
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  type="button"
                  className="w-full py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Home Base
                </button>
              </div>
            </div>
          )}

          {/* LEVEL COMPLETE POPUP */}
          {gameState === 'level_complete' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-3 animate-in zoom-in-95 z-30">
              <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border-2 border-[#FFD700] flex items-center justify-center text-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)]">
                <Trophy className="w-9 h-9" />
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
                  ALL 5 WAVES DEFEATED
                </span>
                <h4 className="text-2xl font-black text-white">LEVEL {level} COMPLETE!</h4>
                <p className="text-xs text-emerald-400 font-bold mt-1">+100 SC Level Completion Bonus Credited!</p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-[240px] pt-2">
                <button
                  onClick={() => {
                    playClickSound();
                    const nextLvl = level + 1;
                    saveShooterLevel(nextLvl);
                    startWave(nextLvl, 1);
                  }}
                  type="button"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
                >
                  START LEVEL {level + 1}
                </button>

                <button
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  type="button"
                  className="w-full py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Home Base
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM QUICK INSTRUCTIONS */}
        <div className="w-full pt-1.5 flex items-center justify-between text-[10px] text-gray-400 px-1">
          <span>Kill jet: +5 SC & 30% drop • Boss: +20 SC & Gold Box</span>
          <span className="text-[#FFD700] font-mono">Enemy pass: -10% | Hit: -20%</span>
        </div>
      </div>
    </div>
  );
}
