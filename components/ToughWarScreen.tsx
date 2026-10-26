'use client';

import React, { useState } from 'react';
import { UserGameState } from '@/types/game';
import { TurfWar2D } from '@/components/games/TurfWar2D';
import { ToughWarBattle } from '@/components/ToughWarBattle';
import { Swords, Skull, Shield, Trophy, Flame, Play, MapPin, Users } from 'lucide-react';
import { playClickSound } from '@/lib/sound';

interface ToughWarScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
}

export function ToughWarScreen({ gameState, onToast }: ToughWarScreenProps) {
  const [isPlayingWar, setIsPlayingWar] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState('Lagos Warzone');

  if (isPlayingWar) {
    return (
      <ToughWarBattle
        isOpen={true}
        onClose={() => setIsPlayingWar(false)}
        onToast={onToast}
        territoryName={selectedTerritory}
      />
    );
  }

  const territories = [
    {
      id: 1,
      name: 'Oshodi Bus Interchange',
      boss: 'MC Oluomo Syndicate',
      difficulty: 'Hard',
      reward: 10,
      enemies: '5 Bat Thugs',
      controlled: false,
      color: 'from-amber-600/30 to-yellow-900/40',
      borderColor: 'border-yellow-500/40',
    },
    {
      id: 2,
      name: 'Computer Village Sector 4',
      boss: 'Cyber Hustlers Mob',
      difficulty: 'Hard',
      reward: 10,
      enemies: '10 Armed Enforcers',
      controlled: false,
      color: 'from-orange-600/30 to-red-900/40',
      borderColor: 'border-orange-500/40',
    },
    {
      id: 3,
      name: 'Lekki Toll Gate Citadel',
      boss: 'High Command General',
      difficulty: 'Hard',
      reward: 10,
      enemies: '15 Thugs + Giant Tank Boss',
      controlled: false,
      color: 'from-red-600/30 to-rose-950/40',
      borderColor: 'border-red-500/40',
    },
  ];

  return (
    <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-red-500 drop-shadow-[0_0_8px_#EF4444]" />
            <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">
              TOUGH WAR LIST
            </h1>
          </div>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            Territory Control & Syndicate Street Battles
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-red-600/30 border border-red-500 text-red-400 text-[9px] font-black uppercase">
          NORMAL HARD
        </span>
      </div>

      {/* QUICK BATTLE LAUNCH HERO CARD */}
      <div className="rounded-3xl bg-gradient-to-b from-[#1C1114] via-[#120B0D] to-[#0A0708] border-2 border-red-500/60 p-5 shadow-[0_0_25px_rgba(239,68,68,0.25)] mb-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Skull className="w-3.5 h-3.5" /> LIVE BRAWLER
          </span>
          <span className="text-[10px] font-mono text-[#FFD700] font-bold">
            +10 Coins (30s Cooldown)
          </span>
        </div>

        <h2 className="text-xl font-black uppercase text-white tracking-wide">
          LAGOS GANG WAR ZONE
        </h2>
        <p className="text-xs text-gray-300 mt-1 mb-4 leading-relaxed">
          Lead the syndicate unit! Eliminate enemy red waves and secure the street. 4-arrow controls with automatic combat aiming!
        </p>

        <button
          onClick={() => {
            playClickSound();
            setSelectedTerritory('Lagos Gang War Zone');
            setIsPlayingWar(true);
          }}
          type="button"
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.6)] active:scale-95 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>ENTER TOUGH WAR BATTLE</span>
        </button>
      </div>

      {/* TERRITORY LIST */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider px-1">
          SYNDICATE TERRITORIES ({territories.length})
        </h3>

        {territories.map((territory) => (
          <div
            key={territory.id}
            className={`p-4 rounded-3xl bg-gradient-to-r ${territory.color} border ${territory.borderColor} backdrop-blur-md shadow-lg flex items-center justify-between`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-red-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">{territory.name}</h4>
                <p className="text-[11px] text-gray-300 mt-0.5">{territory.boss} • {territory.enemies}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">
                    Reward: +{territory.reward} SC
                  </span>
                  <span className="text-[9px] font-bold text-red-400">
                    {territory.difficulty}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setSelectedTerritory(territory.name);
                setIsPlayingWar(true);
              }}
              type="button"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase active:scale-95 transition-all cursor-pointer"
            >
              ATTACK
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
