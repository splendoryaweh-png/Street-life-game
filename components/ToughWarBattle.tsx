'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Trophy,
  Coins,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Flame,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  playCoinSound,
  playSirenSound,
  playClickSound,
  playSuccessSound,
  playShootSound,
  playPunchSound,
} from '@/lib/sound';
import { awardGameCompletionReward } from '@/lib/storage';

interface ToughWarBattleProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  territoryName?: string;
}

interface WarEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: string;
  type: 'thug' | 'brawler';
}

interface WarBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export function ToughWarBattle({
  isOpen,
  onClose,
  onToast,
  territoryName = 'Lagos Warzone',
}: ToughWarBattleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [kills, setKills] = useState<number>(0);
  const [playerHealth, setPlayerHealth] = useState<number>(100);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Mutable Game Loop State
  const gameStateRef = useRef({
    // Player: normal soldier with gun
    x: 180,
    y: 240,
    facingAngle: -Math.PI / 2, // facing up
    health: 100,
    enemies: [] as WarEnemy[],
    bullets: [] as WarBullet[],
    particles: [] as Particle[],
    kills: 0,
    lastSpawnTime: 0,
    lastShootTime: 0,
    isRunning: false,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
  });

  // Start / Restart Game
  const startGame = useCallback(() => {
    setScore(0);
    setKills(0);
    setPlayerHealth(100);
    setGameOver(false);
    setGameWon(false);

    const state = gameStateRef.current;
    state.x = 180;
    state.y = 240;
    state.facingAngle = -Math.PI / 2;
    state.health = 100;
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.kills = 0;
    state.lastSpawnTime = Date.now();
    state.lastShootTime = Date.now();
    state.isRunning = true;
    state.input = { up: false, down: false, left: false, right: false };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startGame();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      gameStateRef.current.isRunning = false;
    }
  }, [isOpen, startGame]);

  // Movement handler with discrete speed
  const handleMove = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    const s = gameStateRef.current;
    if (!s.isRunning) return;

    const step = 20;
    if (dir === 'up') {
      s.y = Math.max(30, s.y - step);
      s.facingAngle = -Math.PI / 2;
    } else if (dir === 'down') {
      s.y = Math.min(450, s.y + step);
      s.facingAngle = Math.PI / 2;
    } else if (dir === 'left') {
      s.x = Math.max(30, s.x - step);
      s.facingAngle = Math.PI;
    } else if (dir === 'right') {
      s.x = Math.min(330, s.x + step);
      s.facingAngle = 0;
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleMove('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleMove('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleMove('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleMove('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleMove]);

  // Main 2D Loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const state = gameStateRef.current;
      if (!state.isRunning) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const now = Date.now();

      // Normal Hard: Spawn enemies every 2 seconds from all 4 sides (not 3x faster, normal health)
      if (now - state.lastSpawnTime >= 2000) {
        state.lastSpawnTime = now;
        const dirs: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
        const chosenDir = dirs[Math.floor(Math.random() * dirs.length)];

        let ex = 0;
        let ey = 0;
        const normalSpeed = 1.8 + Math.random() * 0.6; // normal speed

        if (chosenDir === 'top') {
          ex = Math.random() * (canvas.width - 40) + 20;
          ey = -20;
        } else if (chosenDir === 'bottom') {
          ex = Math.random() * (canvas.width - 40) + 20;
          ey = canvas.height + 20;
        } else if (chosenDir === 'left') {
          ex = -20;
          ey = Math.random() * (canvas.height - 40) + 20;
        } else {
          ex = canvas.width + 20;
          ey = Math.random() * (canvas.height - 40) + 20;
        }

        // Aim towards player
        const dx = state.x - ex;
        const dy = state.y - ey;
        const dist = Math.hypot(dx, dy) || 1;
        const vx = (dx / dist) * normalSpeed;
        const vy = (dy / dist) * normalSpeed;

        state.enemies.push({
          x: ex,
          y: ey,
          vx,
          vy,
          hp: 1, // normal health: 1-2 hits
          maxHp: 1,
          radius: 14,
          color: chosenDir === 'top' ? '#EF4444' : chosenDir === 'bottom' ? '#DC2626' : '#B91C1C',
          type: Math.random() > 0.4 ? 'thug' : 'brawler',
        });
      }

      // Soldier Auto-Fires at nearest enemy every 400ms
      if (state.enemies.length > 0 && now - state.lastShootTime >= 400) {
        state.lastShootTime = now;
        // Find nearest enemy
        let nearest: WarEnemy | null = null;
        let minDist = Infinity;
        for (const en of state.enemies) {
          const d = Math.hypot(en.x - state.x, en.y - state.y);
          if (d < minDist) {
            minDist = d;
            nearest = en;
          }
        }

        if (nearest) {
          const dx = nearest.x - state.x;
          const dy = nearest.y - state.y;
          const angle = Math.atan2(dy, dx);
          state.facingAngle = angle;

          const bulletSpeed = 7.5;
          state.bullets.push({
            x: state.x + Math.cos(angle) * 20,
            y: state.y + Math.sin(angle) * 20,
            vx: Math.cos(angle) * bulletSpeed,
            vy: Math.sin(angle) * bulletSpeed,
            damage: 1,
          });

          if (soundEnabled) {
            playShootSound();
          }
        }
      }

      // Update Bullets
      for (let b = state.bullets.length - 1; b >= 0; b--) {
        const bl = state.bullets[b];
        bl.x += bl.vx;
        bl.y += bl.vy;

        // Check bullet hit on enemies
        let hit = false;
        for (let e = state.enemies.length - 1; e >= 0; e--) {
          const en = state.enemies[e];
          const dist = Math.hypot(en.x - bl.x, en.y - bl.y);
          if (dist < en.radius + 4) {
            en.hp -= bl.damage;
            hit = true;

            // Spawn sparks
            for (let p = 0; p < 4; p++) {
              state.particles.push({
                x: en.x,
                y: en.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: '#FFD700',
                life: 15,
              });
            }

            if (en.hp <= 0) {
              state.enemies.splice(e, 1);
              state.kills += 1;
              setKills(state.kills);
              setScore((prev) => prev + 10);
              if (soundEnabled) {
                playPunchSound();
              }

              // Win condition: 15 kills secured
              if (state.kills >= 15 && !gameWon) {
                state.isRunning = false;
                setGameWon(true);
                playSuccessSound();
                const res = awardGameCompletionReward('Tough War');
                onToast(res.message);
                return;
              }
            }
            break;
          }
        }

        if (hit || bl.x < -20 || bl.x > canvas.width + 20 || bl.y < -20 || bl.y > canvas.height + 20) {
          state.bullets.splice(b, 1);
        }
      }

      // Update Enemies (Normal Speed, Move towards player)
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const en = state.enemies[i];
        // Dynamic re-aim towards player
        const dx = state.x - en.x;
        const dy = state.y - en.y;
        const dist = Math.hypot(dx, dy) || 1;
        const normalSpeed = 1.8;
        en.x += (dx / dist) * normalSpeed;
        en.y += (dy / dist) * normalSpeed;

        // Player collision: 3-4 hits die (each hit does 28 damage, health 100)
        if (dist < en.radius + 14) {
          state.enemies.splice(i, 1);
          state.health -= 28; // 3-4 hits die
          setPlayerHealth(Math.max(0, state.health));
          playSirenSound();

          // Blood / damage particles
          for (let p = 0; p < 6; p++) {
            state.particles.push({
              x: state.x,
              y: state.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              color: '#EF4444',
              life: 20,
            });
          }

          if (state.health <= 0) {
            state.isRunning = false;
            setGameOver(true);
            return;
          }
          continue;
        }

        // Clean up out of bounds
        if (en.x < -60 || en.x > canvas.width + 60 || en.y < -60 || en.y > canvas.height + 60) {
          state.enemies.splice(i, 1);
        }
      }

      // Update Particles
      for (let p = state.particles.length - 1; p >= 0; p--) {
        const pt = state.particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 1;
        if (pt.life <= 0) {
          state.particles.splice(p, 1);
        }
      }

      // ---------------- RENDER CANVAS ----------------
      ctx.fillStyle = '#08080C';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Warzone Grid
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw Zone Ring in center
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Particles
      state.particles.forEach((pt) => {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Bullets
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      state.bullets.forEach((bl) => {
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Draw Enemies (Syndicate Thugs)
      state.enemies.forEach((en) => {
        ctx.save();
        ctx.translate(en.x, en.y);

        // Enemy body
        ctx.fillStyle = en.color;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Enemy spikes / fists
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-3, -en.radius - 3, 6, 4);

        // Skull eye dots
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-4, -2, 2, 0, Math.PI * 2);
        ctx.arc(4, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // DRAW PLAYER: NORMAL SOLDIER WITH GUN
      ctx.save();
      ctx.translate(state.x, state.y);
      ctx.rotate(state.facingAngle);

      // Soldier tactical body armor (Combat Vest)
      ctx.fillStyle = '#1E3A1E'; // Military olive green
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FACC15'; // Yellow tactical accents
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Tactical vest straps
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-10, -6, 20, 4);
      ctx.fillRect(-10, 2, 20, 4);

      // Soldier Combat Helmet
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Helmet visor / Night goggles
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(2, -4, 5, 8);

      // Gun / Rifle barrel extending forward
      ctx.fillStyle = '#334155';
      ctx.fillRect(8, 2, 14, 4); // Main barrel
      ctx.fillStyle = '#64748B';
      ctx.fillRect(12, 1, 6, 2); // Scope

      // Muzzle flash hint
      if (now - state.lastShootTime < 60) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(24, 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Player HP mini bar above head
      ctx.fillStyle = '#000000';
      ctx.fillRect(state.x - 18, state.y - 26, 36, 4);
      ctx.fillStyle = state.health > 50 ? '#22C55E' : '#EF4444';
      ctx.fillRect(state.x - 18, state.y - 26, 36 * (Math.max(0, state.health) / 100), 4);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, gameWon, soundEnabled, onToast]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black flex flex-col items-center justify-between p-3 select-none overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TOP BAR */}
      <div className="w-full max-w-md flex items-center justify-between pb-2 border-b border-white/10 z-20">
        <div className="flex items-center gap-2">
          <span className="font-black text-white text-sm uppercase tracking-wider">
            TOUGH WAR
          </span>
          <span className="px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500 text-red-400 text-[10px] font-black uppercase">
            NORMAL HARD
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[#FFD700] text-xs font-mono font-bold">
            <Coins className="w-4 h-4" />
            <span>Kills: {kills}/15</span>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
            <span>HP:</span>
            <span
              className={
                playerHealth <= 40 ? 'text-red-400 font-mono font-black' : 'text-emerald-400 font-mono font-black'
              }
            >
              {playerHealth}%
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            type="button"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="relative flex-1 w-full max-w-md flex items-center justify-center my-1 overflow-hidden rounded-3xl border border-red-500/30 bg-black shadow-[0_0_25px_rgba(239,68,68,0.15)]">
        <canvas
          ref={canvasRef}
          width={360}
          height={480}
          className="w-full h-full object-contain touch-none"
        />

        {/* GAME OVER POPUP */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center z-30 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500 flex items-center justify-center text-red-500 mb-2">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase">SOLDIER DOWN!</h3>
            <p className="text-xs text-gray-400 mt-1">
              Syndicate thugs overran your position in {territoryName}.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={startGame}
                type="button"
                className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30"
              >
                Retry Battle
              </button>
              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs cursor-pointer hover:bg-white/20"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        {/* GAME WON POPUP (10 COINS ONLY, 30s COOLDOWN) */}
        {gameWon && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center z-30 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-3xl mb-2 text-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)]">
              🏆
            </div>
            <h3 className="text-2xl font-black text-[#FFD700] uppercase">
              ZONE SECURED!
            </h3>
            <p className="text-xs text-emerald-400 font-bold mt-1">
              Awarded +10 Street Coins! (30s Cooldown)
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={startGame}
                type="button"
                className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30"
              >
                Fight Again
              </button>
              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs cursor-pointer hover:bg-white/20"
              >
                Exit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4 BIG ARROW BUTTONS: UP top center, DOWN bottom center, LEFT bottom left, RIGHT bottom right */}
      <div className="w-full max-w-md relative h-36 flex items-center justify-center z-50 pt-1 pb-2">
        {/* UP top center */}
        <button
          onPointerDown={() => handleMove('up')}
          type="button"
          aria-label="Move Up"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer"
        >
          <ArrowUp className="w-7 h-7 stroke-[3]" />
        </button>

        {/* DOWN bottom center */}
        <button
          onPointerDown={() => handleMove('down')}
          type="button"
          aria-label="Move Down"
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer"
        >
          <ArrowDown className="w-7 h-7 stroke-[3]" />
        </button>

        {/* LEFT bottom left */}
        <button
          onPointerDown={() => handleMove('left')}
          type="button"
          aria-label="Move Left"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer"
        >
          <ArrowLeft className="w-8 h-8 stroke-[3]" />
        </button>

        {/* RIGHT bottom right */}
        <button
          onPointerDown={() => handleMove('right')}
          type="button"
          aria-label="Move Right"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer"
        >
          <ArrowRight className="w-8 h-8 stroke-[3]" />
        </button>

        {/* Center Soldier Emblem */}
        <div className="w-10 h-10 rounded-full border border-red-500/40 bg-red-950/40 flex items-center justify-center text-xs text-red-400">
          <Crosshair className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
