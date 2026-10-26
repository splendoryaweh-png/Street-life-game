'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Crosshair,
  ArrowUp,
  Flame,
  Car,
  ChevronLeft,
  ChevronRight,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { playClickSound, playPickupSound } from '@/lib/sound';

export interface JoystickMovement {
  dx: number; // -1 (left) to 1 (right)
  dy: number; // -1 (up) to 1 (down)
  isMoving: boolean;
}

export interface StreetJoystickProps {
  onMove: (movement: JoystickMovement) => void;
  onJump: () => void;
  onShoot: () => void;
  onRunToggle: (isRunning: boolean) => void;
  onHijackOrEnterCar: () => void;
  isNearCar: boolean;
  isInCar: boolean;
  isCover?: boolean;
  onCoverToggle?: () => void;
  onReload?: () => void;
  ammo?: number;
  maxAmmo?: number;
}

export function StreetJoystick({
  onMove,
  onJump,
  onShoot,
  onRunToggle,
  onHijackOrEnterCar,
  isNearCar,
  isInCar,
  isCover,
  onCoverToggle,
  onReload,
  ammo,
  maxAmmo,
}: StreetJoystickProps) {
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeDirection, setActiveDirection] = useState<string | null>(null);

  const radius = 48; // Max knob distance from center

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handlePointerUpdate = useCallback((clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const distance = Math.hypot(rawDx, rawDy);

    const clampedDist = Math.min(distance, radius);
    const angle = Math.atan2(rawDy, rawDx);

    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: posX, y: posY });

    // Normalized dx, dy (-1 to 1)
    const normalizedDx = posX / radius;
    const normalizedDy = posY / radius;

    // Detect direction label for visual feedback
    if (Math.abs(normalizedDx) > Math.abs(normalizedDy)) {
      setActiveDirection(normalizedDx > 0.3 ? 'RIGHT' : normalizedDx < -0.3 ? 'LEFT' : null);
    } else {
      setActiveDirection(normalizedDy > 0.3 ? 'DOWN' : normalizedDy < -0.3 ? 'UP' : null);
    }

    onMoveRef.current({
      dx: normalizedDx,
      dy: normalizedDy,
      isMoving: distance > 6,
    });
  }, [radius]);

  const handlePointerStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    handlePointerUpdate(clientX, clientY);
  };

  const handlePointerEnd = useCallback(() => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    setActiveDirection(null);
    onMoveRef.current({ dx: 0, dy: 0, isMoving: false });
  }, []);

  // Touch and mouse listeners for smooth drag anywhere on the joystick base
  useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerUpdate(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handlePointerEnd();

    const onMouseMove = (e: MouseEvent) => {
      handlePointerUpdate(e.clientX, e.clientY);
    };
    const onMouseUp = () => handlePointerEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handlePointerUpdate, handlePointerEnd]);

  // Handle run toggle
  const toggleRun = () => {
    playClickSound();
    const next = !isRunning;
    setIsRunning(next);
    onRunToggle(next);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-30 pointer-events-none flex items-end justify-between px-3 sm:px-6 select-none font-sans">
      {/* ======================================================== */}
      {/* LEFT: ANALOG VIRTUAL JOYSTICK & QUICK LEFT/RIGHT CONTROLS */}
      {/* ======================================================== */}
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        {/* Direction Tag */}
        <div className="h-5 flex items-center justify-center">
          {activeDirection && (
            <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 text-[#FFD700] text-[9px] font-black uppercase tracking-widest animate-pulse">
              {activeDirection}
            </span>
          )}
        </div>

        {/* Joystick Base */}
        <div className="relative">
          <div
            ref={joystickBaseRef}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handlePointerStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onMouseDown={(e) => {
              handlePointerStart(e.clientX, e.clientY);
            }}
            className="w-28 h-28 rounded-full bg-black/75 border-2 border-[#FFD700]/40 backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.8)] relative flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          >
            {/* Direction Arrows on Base */}
            <span className="absolute top-1 text-[10px] text-gray-500 font-bold">▲</span>
            <span className="absolute bottom-1 text-[10px] text-gray-500 font-bold">▼</span>
            <span className="absolute left-1.5 text-[10px] text-gray-500 font-bold">◄</span>
            <span className="absolute right-1.5 text-[10px] text-gray-500 font-bold">►</span>

            {/* Inner Center Guide Ring */}
            <div className="w-12 h-12 rounded-full border border-white/10 pointer-events-none" />

            {/* Draggable Knob */}
            <div
              className={`w-12 h-12 rounded-full transition-transform duration-75 flex items-center justify-center shadow-lg ${
                isDragging
                  ? 'bg-gradient-to-br from-amber-400 to-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.6)] scale-110'
                  : 'bg-white/20 border border-white/40'
              }`}
              style={{
                transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
              }}
            >
              <div
                className={`w-4 h-4 rounded-full ${
                  isDragging ? 'bg-black' : 'bg-[#FFD700]'
                }`}
              />
            </div>
          </div>

          {/* Quick Left & Right Tap Buttons on Bottom Corners */}
          <div className="flex items-center justify-between w-full mt-1.5 px-0.5">
            <button
              onPointerDown={() => {
                onMove({ dx: -1, dy: 0, isMoving: true });
                setActiveDirection('LEFT');
              }}
              onPointerUp={() => {
                onMove({ dx: 0, dy: 0, isMoving: false });
                setActiveDirection(null);
              }}
              onPointerLeave={() => {
                onMove({ dx: 0, dy: 0, isMoving: false });
                setActiveDirection(null);
              }}
              type="button"
              className="px-2.5 py-1.5 rounded-xl bg-black/80 border border-white/20 text-[#FFD700] text-[10px] font-black uppercase flex items-center gap-0.5 active:bg-[#FFD700] active:text-black transition-all cursor-pointer shadow"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>LEFT</span>
            </button>

            <button
              onPointerDown={() => {
                onMove({ dx: 1, dy: 0, isMoving: true });
                setActiveDirection('RIGHT');
              }}
              onPointerUp={() => {
                onMove({ dx: 0, dy: 0, isMoving: false });
                setActiveDirection(null);
              }}
              onPointerLeave={() => {
                onMove({ dx: 0, dy: 0, isMoving: false });
                setActiveDirection(null);
              }}
              type="button"
              className="px-2.5 py-1.5 rounded-xl bg-black/80 border border-white/20 text-[#FFD700] text-[10px] font-black uppercase flex items-center gap-0.5 active:bg-[#FFD700] active:text-black transition-all cursor-pointer shadow"
            >
              <span>RIGHT</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT: ACTION CONTROLS (JUMP, SHOOT, RUN, HIJACK CAR) */}
      {/* ======================================================== */}
      <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* HIJACK / CAR INTERACTION BUTTON (Appears Prominently when near vehicle or inside car) */}
        {(isNearCar || isInCar) && (
          <button
            onClick={() => {
              playClickSound();
              onHijackOrEnterCar();
            }}
            type="button"
            className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl active:scale-95 transition-all cursor-pointer animate-in zoom-in-90 ${
              isInCar
                ? 'bg-red-600 border-2 border-white text-white shadow-red-600/50'
                : 'bg-gradient-to-r from-amber-500 to-[#FFD700] border-2 border-white text-black shadow-[0_0_25px_rgba(255,215,0,0.7)] animate-bounce'
            }`}
          >
            <Car className="w-5 h-5" />
            <span>{isInCar ? 'EXIT CAR [E]' : 'HIJACK CAR [E]'}</span>
          </button>
        )}

        {/* Action Buttons Cluster */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* SHOOT BUTTON (Center Right / Primary Red/Gold) */}
          <button
            onPointerDown={() => {
              onShoot();
            }}
            type="button"
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 via-rose-600 to-red-700 border-2 border-white text-white flex flex-col items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.6)] active:scale-90 transition-transform cursor-pointer"
            title="Shoot Laser Gun"
          >
            <Crosshair className="w-6 h-6 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
              FIRE
            </span>
          </button>

          {/* JUMP BUTTON (Top Position) */}
          <button
            onClick={() => {
              playPickupSound();
              onJump();
            }}
            type="button"
            className="absolute top-0 right-14 w-12 h-12 rounded-full bg-black/85 border-2 border-sky-400 text-sky-400 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)] active:scale-90 transition-transform cursor-pointer"
            title="Jump / Leap Obstacles"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase">JUMP</span>
          </button>

          {/* RUN / SPRINT BUTTON (Left Position) */}
          <button
            onClick={toggleRun}
            type="button"
            className={`absolute left-0 top-12 w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center shadow-lg active:scale-90 transition-all cursor-pointer ${
              isRunning
                ? 'bg-[#FFD700] border-white text-black shadow-[0_0_20px_rgba(255,215,0,0.6)]'
                : 'bg-black/85 border-[#FFD700]/50 text-[#FFD700]'
            }`}
            title="Sprint / Run"
          >
            <Flame className={`w-5 h-5 ${isRunning ? 'animate-bounce' : ''}`} />
            <span className="text-[8px] font-black uppercase">
              {isRunning ? 'FAST' : 'RUN'}
            </span>
          </button>

          {/* COVER BUTTON (Bottom Position) */}
          {onCoverToggle && (
            <button
              onClick={() => {
                playClickSound();
                onCoverToggle();
              }}
              type="button"
              className={`absolute bottom-0 right-14 w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer ${
                isCover
                  ? 'bg-sky-600 border-white text-white shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                  : 'bg-black/85 border-white/20 text-gray-300'
              }`}
              title="Take Cover Behind Building/Car"
            >
              <Shield className="w-4 h-4" />
              <span className="text-[7px] font-black uppercase">COVER</span>
            </button>
          )}

          {/* RELOAD BUTTON (Top Right Position) */}
          {onReload && (
            <button
              onClick={() => {
                onReload();
              }}
              type="button"
              className="absolute top-2 right-0 w-9 h-9 rounded-full bg-black/85 border border-white/20 text-gray-300 flex items-center justify-center active:scale-90 transition-transform cursor-pointer hover:border-[#FFD700]"
              title="Reload Ammo"
            >
              <RotateCcw className="w-4 h-4 text-[#FFD700]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
