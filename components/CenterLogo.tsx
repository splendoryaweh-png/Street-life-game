'use client';

import React from 'react';
import { Zap } from 'lucide-react';

export function CenterLogo() {
  return (
    <div className="flex flex-col items-center justify-center my-4">
      {/* Street Sign Shape with Gold Border */}
      <div className="relative group">
        {/* Outer ambient glow */}
        <div className="absolute -inset-2 bg-gradient-to-r from-[#FFD700]/20 via-[#FFC300]/10 to-[#FFD700]/20 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition duration-700" />

        {/* Street Sign Rectangle with Gold border */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-b from-[#1c1c1c] to-[#0e0e0e] border-2 border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.25)] flex items-center justify-center overflow-visible">
          
          {/* Subtle inner street plate rivet accents in 4 corners */}
          <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#FFD700]/60" />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FFD700]/60" />
          <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#FFD700]/60" />
          <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FFD700]/60" />

          {/* Continuous 360 Rotating Orbit with Thunderbolt & Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-spin-slow">
            <div className="absolute -top-3.5 flex items-center justify-center">
              <div className="relative">
                <Zap
                  className="w-7 h-7 text-[#FFD700] fill-[#FFD700]"
                  style={{
                    filter: 'drop-shadow(0 0 15px #FFD700) drop-shadow(0 0 5px #FFC300)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Big Letter S, bold, Gold */}
          <span className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFF099] via-[#FFD700] to-[#FF9900] select-none tracking-tighter drop-shadow-[0_2px_12px_rgba(255,215,0,0.5)]">
            S
          </span>
        </div>
      </div>

      {/* Small text below logo: STREET LIFE */}
      <div className="mt-3 text-center">
        <h1 className="text-xs sm:text-sm font-black tracking-[0.35em] text-[#FFD700] uppercase drop-shadow-[0_1px_6px_rgba(255,215,0,0.4)]">
          STREET LIFE
        </h1>
        <p className="text-[10px] text-[#9CA3AF] tracking-wider mt-0.5">
          DARK LUXURY CRIME EMPIRE
        </p>
      </div>
    </div>
  );
}
