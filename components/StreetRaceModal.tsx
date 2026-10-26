'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Trophy,
  Coins,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Flame,
  Zap,
  Gauge,
} from 'lucide-react';
import { playCoinSound, playSirenSound, playClickSound, playSuccessSound } from '@/lib/sound';
import { awardGameCompletionReward } from '@/lib/storage';

export const DIFFICULTY = 'NORMAL_HARD';

interface StreetRaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetCoin: number;
  ownedCars?: string[];
  selectedCar?: string;
  onToast: (msg: string) => void;
}

interface TrafficCar {
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
  color: string;
  lane: number;
}

interface RoadCoin {
  x: number;
  y: number;
  lane: number;
  collected: boolean;
}

// 3 Lanes: 90 (left), 180 (center), 270 (right)
const LANES = [90, 180, 270];

export function StreetRaceModal({
  isOpen,
  onClose,
  onToast,
}: StreetRaceModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [coinsClaimed, setCoinsClaimed] = useState<number>(0);
  const [playerHealth, setPlayerHealth] = useState<number>(100);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);

  // Mutable Game Loop State
  const gameStateRef = useRef({
    laneIndex: 1, // Start in center lane
    targetX: 180,
    currentX: 180,
    y: 380, // Near bottom
    health: 100,
    traffic: [] as TrafficCar[],
    coins: [] as RoadCoin[],
    coinsCollected: 0,
    distance: 0,
    speed: 4,
    lastSpawnTime: 0,
    isRunning: false,
  });

  // Start / Restart Game
  const startGame = useCallback(() => {
    setScore(0);
    setCoinsClaimed(0);
    setPlayerHealth(100);
    setGameOver(false);
    setGameWon(false);

    const state = gameStateRef.current;
    state.laneIndex = 1;
    state.targetX = 180;
    state.currentX = 180;
    state.y = 380;
    state.health = 100;
    state.traffic = [];
    state.coins = [];
    state.coinsCollected = 0;
    state.distance = 0;
    state.speed = 4;
    state.lastSpawnTime = Date.now();
    state.isRunning = true;
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

  // MOVEMENT CONTROLS: EXACT SPECIFICATION
  // LEFT = left (steers left lane)
  // RIGHT = right (steers right lane)
  const handleSteer = useCallback((dir: 'left' | 'right') => {
    const s = gameStateRef.current;
    if (!s.isRunning) return;

    if (dir === 'left') {
      if (s.laneIndex > 0) {
        s.laneIndex -= 1;
        s.targetX = LANES[s.laneIndex];
        playClickSound();
      }
    } else if (dir === 'right') {
      if (s.laneIndex < LANES.length - 1) {
        s.laneIndex += 1;
        s.targetX = LANES[s.laneIndex];
        playClickSound();
      }
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleSteer('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleSteer('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleSteer]);

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
      state.distance += 1;
      setScore(state.distance);

      // Smooth horizontal interpolation towards target lane
      state.currentX += (state.targetX - state.currentX) * 0.22;

      // Normal Hard: Traffic cars spawn every 2 seconds (not 3x faster, normal health)
      if (now - state.lastSpawnTime >= 2000) {
        state.lastSpawnTime = now;

        // Choose random lane for oncoming traffic
        const laneIdx = Math.floor(Math.random() * LANES.length);
        const trafficColors = ['#EF4444', '#3B82F6', '#8B5CF6', '#F97316'];
        const chosenColor = trafficColors[Math.floor(Math.random() * trafficColors.length)];

        state.traffic.push({
          x: LANES[laneIdx],
          y: -60,
          speed: 3.5 + Math.random() * 1.5, // Normal speed
          width: 32,
          height: 52,
          color: chosenColor,
          lane: laneIdx,
        });

        // Spawn gold road coin in another lane
        const coinLane = (laneIdx + 1) % LANES.length;
        if (Math.random() < 0.6) {
          state.coins.push({
            x: LANES[coinLane],
            y: -40,
            lane: coinLane,
            collected: false,
          });
        }
      }

      // Update Traffic Cars
      for (let i = state.traffic.length - 1; i >= 0; i--) {
        const car = state.traffic[i];
        car.y += car.speed + state.speed * 0.5;

        // Check Collision with player car: 3-4 hits die (each hit deals 30 damage)
        const dx = Math.abs(car.x - state.currentX);
        const dy = Math.abs(car.y - state.y);
        if (dx < 28 && dy < 44) {
          state.traffic.splice(i, 1);
          state.health -= 30; // 3-4 hits die
          setPlayerHealth(Math.max(0, state.health));
          playSirenSound();

          if (state.health <= 0) {
            state.isRunning = false;
            setGameOver(true);
            return;
          }
          continue;
        }

        // Clean up when off screen
        if (car.y > canvas.height + 80) {
          state.traffic.splice(i, 1);
        }
      }

      // Update Coins
      for (let i = state.coins.length - 1; i >= 0; i--) {
        const cn = state.coins[i];
        cn.y += state.speed + 1.5;

        // Collect Coin
        const dist = Math.hypot(cn.x - state.currentX, cn.y - state.y);
        if (dist < 26) {
          state.coins.splice(i, 1);
          state.coinsCollected += 1;
          setCoinsClaimed(state.coinsCollected);
          playCoinSound();
          continue;
        }

        if (cn.y > canvas.height + 40) {
          state.coins.splice(i, 1);
        }
      }

      // Win Condition: Complete 300 meters
      if (state.distance >= 300 && !gameWon) {
        state.isRunning = false;
        setGameWon(true);
        playSuccessSound();
        const res = awardGameCompletionReward('Street Race');
        onToast(res.message);
        return;
      }

      // ---------------- RENDER CANVAS ----------------
      ctx.fillStyle = '#09090D';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Highway Road Surface
      ctx.fillStyle = '#141419';
      ctx.fillRect(40, 0, 280, canvas.height);

      // Road Borders (Glowing Neon Curbs)
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(40, canvas.height);
      ctx.moveTo(320, 0);
      ctx.lineTo(320, canvas.height);
      ctx.stroke();

      // Dashed Lane Dividers (Animated scroll)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -(state.distance * 5) % 40;

      // Divider 1 (between lane 0 and lane 1)
      ctx.beginPath();
      ctx.moveTo(135, 0);
      ctx.lineTo(135, canvas.height);
      ctx.stroke();

      // Divider 2 (between lane 1 and lane 2)
      ctx.beginPath();
      ctx.moveTo(225, 0);
      ctx.lineTo(225, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Draw Gold Road Coins
      state.coins.forEach((cn) => {
        ctx.save();
        ctx.translate(cn.x, cn.y);
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
        ctx.restore();
      });

      // Draw Traffic Cars (Normal oncoming cars)
      state.traffic.forEach((car) => {
        ctx.save();
        ctx.translate(car.x, car.y);

        // Car chassis
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 6);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 8, car.width - 8, 12);

        // Headlights
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-car.width / 2 + 3, car.height / 2 - 4, 6, 4);
        ctx.fillRect(car.width / 2 - 9, car.height / 2 - 4, 6, 4);

        // Wheels
        ctx.fillStyle = '#000000';
        ctx.fillRect(-car.width / 2 - 3, -car.height / 2 + 8, 3, 10);
        ctx.fillRect(car.width / 2, -car.height / 2 + 8, 3, 10);
        ctx.fillRect(-car.width / 2 - 3, car.height / 2 - 18, 3, 10);
        ctx.fillRect(car.width / 2, car.height / 2 - 18, 3, 10);

        ctx.restore();
      });

      // DRAW PLAYER: NORMAL SPORTS / RACE CAR
      ctx.save();
      ctx.translate(state.currentX, state.y);

      // Exhaust Trail
      ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(-8, 28, 4, 0, Math.PI * 2);
      ctx.arc(8, 28, 4, 0, Math.PI * 2);
      ctx.fill();

      // Main Sports Car Body (Gold / Black Luxury Race Car)
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(-16, -26, 32, 52, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dark racing stripes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-4, -26, 8, 52);

      // Front Windshield
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-11, -12, 22, 14, 4);
      ctx.fill();

      // Rear window
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-10, 10, 20, 8, 2);
      ctx.fill();

      // Headlights (Glowing Xenon Yellow)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-13, -26, 6, 4);
      ctx.fillRect(7, -26, 6, 4);

      // Wheels
      ctx.fillStyle = '#000000';
      ctx.fillRect(-19, -18, 3, 10);
      ctx.fillRect(16, -18, 3, 10);
      ctx.fillRect(-19, 10, 3, 10);
      ctx.fillRect(16, 10, 3, 10);

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, gameWon, onToast]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black flex flex-col items-center justify-between p-3 select-none overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TOP BAR */}
      <div className="w-full max-w-md flex items-center justify-between pb-2 border-b border-white/10 z-20">
        <div className="flex items-center gap-2">
          <span className="font-black text-white text-sm uppercase">STREET RACE</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-600/30 border border-emerald-500 text-emerald-400 text-[10px] font-black uppercase">
            NORMAL HARD
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[#FFD700] text-xs font-mono font-bold">
            <Coins className="w-4 h-4" />
            <span>+{coinsClaimed}</span>
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
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="relative flex-1 w-full max-w-md flex items-center justify-center my-1 overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_0_25px_rgba(255,215,0,0.15)]">
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
            <h3 className="text-2xl font-black text-white uppercase">CAR CRASHED!</h3>
            <p className="text-xs text-gray-400 mt-1">Totaled your vehicle in heavy highway traffic.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={startGame}
                type="button"
                className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30"
              >
                Restart Race
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
            <h3 className="text-2xl font-black text-[#FFD700] uppercase">FINISH LINE REACHED!</h3>
            <p className="text-xs text-emerald-400 font-bold mt-1">Awarded +10 Street Coins! (30s Cooldown)</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={startGame}
                type="button"
                className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 cursor-pointer shadow-lg shadow-[#FFD700]/30"
              >
                Race Again
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

      {/* 2 STEERING BUTTONS: LEFT = left, RIGHT = right */}
      <div className="w-full max-w-md flex items-center justify-between px-4 py-3 z-50">
        {/* LEFT button */}
        <button
          onPointerDown={() => handleSteer('left')}
          type="button"
          aria-label="Steer Left"
          className="flex-1 max-w-[130px] h-16 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center gap-2 active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer font-black text-sm uppercase"
        >
          <ArrowLeft className="w-6 h-6 stroke-[3]" />
          <span>LEFT</span>
        </button>

        {/* Center Dashboard Emblem */}
        <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-gray-300">
          <Gauge className="w-6 h-6 text-[#FFD700]" />
        </div>

        {/* RIGHT button */}
        <button
          onPointerDown={() => handleSteer('right')}
          type="button"
          aria-label="Steer Right"
          className="flex-1 max-w-[130px] h-16 rounded-2xl bg-black/85 border-2 border-[#FFD700] text-[#FFD700] flex items-center justify-center gap-2 active:scale-90 active:bg-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer font-black text-sm uppercase"
        >
          <span>RIGHT</span>
          <ArrowRight className="w-6 h-6 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
