'use client';

import React, { useState } from 'react';
import { UserGameState } from '@/types/game';
import { StreetRace3D } from './games/StreetRace3D';
import { StreetRider3D } from './games/StreetRider3D';
import { TurfWar2D } from './games/TurfWar2D';
import { StreetCrush } from './games/StreetCrush';
import { StreetDiceLudo } from './games/StreetDiceLudo';
import { StreetSlot } from './games/StreetSlot';
import { StreetFlip } from './games/StreetFlip';
import { StreetGalaxyShooterModal } from './StreetGalaxyShooterModal';
import { StreetGangStarHub } from '@/src/games/StreetGangStar';
import { playClickSound } from '@/lib/sound';
import { useLanguage } from '@/src/contexts/LanguageContext';
import {
  Gamepad2,
  Car,
  Bike,
  Crosshair,
  ShieldAlert,
  Play,
  Sparkles,
  Trophy,
  Zap,
  Swords,
  Dices,
  Flame,
  Coins,
  Layers,
  Skull,
} from 'lucide-react';

interface GamesScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
  onGameActiveChange?: (isActive: boolean) => void;
}

type ActiveGameType = 'race' | 'rider' | 'turf' | 'crush' | 'dice' | 'slot' | 'flip' | 'gangstar' | null;

export function GamesScreen({ gameState, onToast, onGameActiveChange }: GamesScreenProps) {
  const { t } = useLanguage();
  const [activeGame, setActiveGame] = useState<ActiveGameType>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'minigames'>('action');
  const [isShooterOpen, setIsShooterOpen] = useState(false);

  const handleLaunchGame = (game: ActiveGameType) => {
    playClickSound();
    setActiveGame(game);
    if (onGameActiveChange) {
      onGameActiveChange(true);
    }
  };

  const handleExitGame = () => {
    playClickSound();
    setActiveGame(null);
    if (onGameActiveChange) {
      onGameActiveChange(false);
    }
  };

  // FULL-SCREEN GAME LAUNCH ROUTING
  if (activeGame === 'race') {
    return <StreetRace3D onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'rider') {
    return <StreetRider3D onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'turf') {
    return <TurfWar2D onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'crush') {
    return <StreetCrush onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'dice') {
    return <StreetDiceLudo onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'slot') {
    return <StreetSlot onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'flip') {
    return <StreetFlip onBack={handleExitGame} onToast={onToast} currentCoins={gameState.streetCoin} />;
  }

  if (activeGame === 'gangstar') {
    return <StreetGangStarHub onBack={handleExitGame} onToast={onToast} />;
  }

  return (
    <div className="w-full flex-1 min-h-[calc(100dvh-5rem)] overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none animate-in fade-in duration-200">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-[#FFD700] drop-shadow-[0_0_8px_#FFD700]" />
            <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">STREET GAMES</h1>
          </div>
          <p className="text-xs font-semibold text-[#FFD700]/90 tracking-wide mt-0.5">
            Choose Your Hustle • 8 Street Games Available
          </p>
        </div>

        {/* Total StreetCoins Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/70 border border-[#FFD700]/40 backdrop-blur-md shadow-[0_0_12px_rgba(255,215,0,0.2)]">
          <span className="text-base font-black text-[#FFD700]">🪙</span>
          <span className="text-xs font-black text-white">{gameState.streetCoin.toLocaleString()} SC</span>
        </div>
      </div>

      {/* CATEGORY SWITCHER TABS */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#12131C] border border-white/10">
        <button
          onClick={() => {
            playClickSound();
            setActiveTab('action');
          }}
          type="button"
          className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'action'
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 fill-current" />
          <span>3D ACTION (4)</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveTab('minigames');
          }}
          type="button"
          className={`relative py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'minigames'
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Dices className="w-4 h-4 fill-current" />
          <span>MINI-GAMES (4)</span>
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-500 text-white font-extrabold text-[9px] shadow-sm animate-pulse">
            NEW
          </span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: 3D ACTION GAMES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'action' && (
        <div className="flex flex-col gap-4">
          {/* FEATURED: STREET GANG STAR (NEW MINI-APP) */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#221A10] via-[#15120D] to-[#0A0907] border-2 border-[#FFD700] p-5 shadow-[0_0_35px_rgba(255,215,0,0.35)] overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FFD700]/20 rounded-full blur-3xl pointer-events-none group-hover:bg-[#FFD700]/30 transition-all" />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-[#FFD700] text-black font-black text-[10px] uppercase tracking-wider shadow-[0_0_12px_rgba(255,215,0,0.5)]">
                NEW MINI-APP • 4KM CITY
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/70 border border-white/15 text-[#FFD700] font-bold text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#FFD700]" /> +5 Coins / Kill
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#2A1E0D] to-[#3D2C14] border border-[#FFD700]/30 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center shadow-[0_0_25px_rgba(255,215,0,0.4)]">
                  <Crosshair className="w-9 h-9 text-[#FFD700] animate-pulse" />
                </div>
                <span className="text-[10px] font-black text-amber-200 mt-1 uppercase">
                  Story Campaign &amp; 20-Player District Warfare
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET GANG STAR
                </h2>
                <p className="text-xs text-gray-300 mt-0.5">
                  Stop street robbers • Drive vehicles • Gun Shop &amp; Cover system
                </p>
              </div>

              <button
                onClick={() => handleLaunchGame('gangstar')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-300 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_18px_rgba(250,204,21,0.7)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{t('play')}</span>
              </button>
            </div>
          </div>

          {/* CARD 1: STREET RACE */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#181822] via-[#0E0E14] to-[#0A0A0E] border-2 border-[#FFD700]/70 p-5 shadow-[0_0_25px_rgba(255,215,0,0.25)] overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-[#FFD700]/15 rounded-full blur-3xl pointer-events-none group-hover:bg-[#FFD700]/25 transition-all" />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40 font-black text-[10px] uppercase tracking-wider">
                ENDLESS 3D HIGHWAY
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-cyan-300 font-bold text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> 120 km/h Nitro
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#1C1628] to-[#2B1B40] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                  <Car className="w-9 h-9 text-[#FFD700]" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 mt-1 uppercase">3D Following Camera</span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET RACE
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Race for Coins • Overtake traffic & trigger Nitro</p>
              </div>

              <button
                onClick={() => handleLaunchGame('race')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* CARD 2: STREET RIDER */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#101917] via-[#0B1210] to-[#080D0B] border-2 border-emerald-500/50 p-5 shadow-[0_0_25px_rgba(16,185,129,0.2)] overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-[10px] uppercase tracking-wider">
                OKADA COURIER MISSION
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-emerald-400" /> Dispatch Calls
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#0D241C] to-[#133A2C] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Bike className="w-9 h-9 text-emerald-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 mt-1 uppercase">Lagos Express Okada</span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET RIDER
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Deliver Packages • Computer Village to Lekki</p>
              </div>

              <button
                onClick={() => handleLaunchGame('rider')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(160,185,129,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* CARD 3: STREET SHOOTER */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#18131E] via-[#120E18] to-[#0A070E] border-2 border-purple-500/40 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black text-[10px] uppercase tracking-wider">
                ARCADE DEFENSE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-purple-300 font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-purple-400" /> Boss Battles
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#1E1129] to-[#2B163B] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  <Crosshair className="w-9 h-9 text-purple-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Street Galaxy Shooter</span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET SHOOTER
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Boss Battles & Turf Defense • Heavy plasma weapons</p>
              </div>

              <button
                onClick={() => {
                  playClickSound();
                  setIsShooterOpen(true);
                }}
                type="button"
                className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* CARD 4: TURF WAR */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#221316] via-[#160D10] to-[#0D0709] border-2 border-red-500/50 p-5 overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Swords className="w-3 h-3 text-red-400" /> TOP-DOWN BRAWLER
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-[#FFD700] font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-[#FFD700]" /> Win: 300 SC
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#261014] to-[#3B151C] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <ShieldAlert className="w-9 h-9 text-red-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 mt-1 uppercase">
                  Base Yellow vs Base Red • 3 Zones
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  TURF WAR
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Lagos Street Brawler • Capture Zones A, B, C • Bosses</p>
              </div>

              <button
                onClick={() => handleLaunchGame('turf')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: 4 NEW MINI-GAMES (PROMPT 11) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'minigames' && (
        <div className="flex flex-col gap-4">
          {/* MINI-GAME 1: STREET CRUSH */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#1F1914] via-[#14100D] to-[#0A0806] border-2 border-amber-500/60 p-5 shadow-[0_0_25px_rgba(245,158,11,0.25)] overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-[10px] uppercase tracking-wider">
                MATCH-3 FRUIT CRUSH
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-yellow-300 font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-400" /> 100 Levels
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#261B0E] to-[#3B2812] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-2xl drop-shadow-md">
                  <span>🍎</span>
                  <span>🍌</span>
                  <span>🥭</span>
                  <span>🍇</span>
                </div>
                <span className="text-[10px] font-bold text-amber-300 mt-2 uppercase">
                  8x8 Board • Bombs & Rainbows
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET CRUSH
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Match 3 (10 SC) • Match 4 (25 SC + Bomb) • Match 5 (50 SC + Rainbow)
                </p>
              </div>

              <button
                onClick={() => handleLaunchGame('crush')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* MINI-GAME 2: STREET DICE / LUDO GANG */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#181B26] via-[#10121C] to-[#0A0C14] border-2 border-blue-500/50 p-5 shadow-[0_0_25px_rgba(59,130,246,0.25)] overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-black text-[10px] uppercase tracking-wider">
                LUDO GANG CIRCUIT
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-emerald-400" /> Win 4X Stake
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#111A2E] to-[#16274B] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <Dices className="w-9 h-9 text-blue-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 mt-1 uppercase">
                  3D Center Dice • 4 Rival Gangs
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET DICE
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Bet 100/200/500 SC • 1st = 4X Stake • Kick opponents to base
                </p>
              </div>

              <button
                onClick={() => handleLaunchGame('dice')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-400 to-indigo-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* MINI-GAME 3: STREET SLOT */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#221B10] via-[#16120B] to-[#0D0B07] border-2 border-[#FFD700] p-5 shadow-[0_0_30px_rgba(255,215,0,0.3)] overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40 font-black text-[10px] uppercase tracking-wider">
                CASINO JACKPOT
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-cyan-300 font-bold text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> 3 Daily Free Spins
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#2E200C] to-[#453011] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3 text-3xl">
                  <span>👟</span>
                  <span>🏎️</span>
                  <span>🏠</span>
                </div>
                <span className="text-[10px] font-black text-[#FFD700] mt-2 uppercase tracking-wider">
                  3 Houses = 1,000 SC Jackpot
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET SLOT
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  20 SC / Spin • Shoes, Caps, Chains, Cars, Houses, Dollars
                </p>
              </div>

              <button
                onClick={() => handleLaunchGame('slot')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>

          {/* MINI-GAME 4: STREET FLIP */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#151722] via-[#0E1018] to-[#08090E] border-2 border-cyan-500/50 p-5 shadow-[0_0_25px_rgba(6,182,212,0.25)] overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black text-[10px] uppercase tracking-wider">
                MEMORY HUSTLE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-emerald-400" /> 100 SC Speed Bonus
              </span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-gradient-to-tr from-black via-[#0E202B] to-[#143242] border border-white/10 relative overflow-hidden flex items-center justify-center mb-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-14 rounded-lg bg-black border border-yellow-400 flex items-center justify-center text-xs font-black text-yellow-300">
                    SL
                  </div>
                  <div className="w-10 h-14 rounded-lg bg-yellow-400 text-black flex items-center justify-center text-lg">
                    🏎️
                  </div>
                  <div className="w-10 h-14 rounded-lg bg-black border border-yellow-400 flex items-center justify-center text-xs font-black text-yellow-300">
                    SL
                  </div>
                </div>
                <span className="text-[10px] font-bold text-cyan-300 mt-2 uppercase">
                  Black & Yellow Cards • Match Pairs
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  STREET FLIP
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  10 SC / Pair • Finish under 30s for +100 SC Bonus • 3 Levels
                </p>
              </div>

              <button
                onClick={() => handleLaunchGame('flip')}
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.6)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                {t('play')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Street Shooter Modal integration */}
      <StreetGalaxyShooterModal
        isOpen={isShooterOpen}
        onClose={() => setIsShooterOpen(false)}
        initialLevel={gameState.shooterLevel || 1}
        onToast={onToast}
      />
    </div>
  );
}
