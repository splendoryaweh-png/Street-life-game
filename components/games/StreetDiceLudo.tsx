'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, Dices, Trophy, Skull, Coins, ShieldAlert } from 'lucide-react';
import { playCoinSound, playSuccessSound, playClickSound, playSirenSound, playPunchSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { consumeDiceDailyFreeEntry, getTodayDailyClaim } from '@/lib/dailyFree';
import confetti from 'canvas-confetti';
import { StreetDiceMultiplayer } from '@/src/games/StreetDice/StreetDiceMultiplayer';

interface StreetDiceLudoProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

interface Player {
  id: 'yellow' | 'red' | 'blue' | 'green';
  name: string;
  gang: string;
  isHuman: boolean;
  colorHex: string;
  pos: number; // 0 to 28 (0: base, 28: home target)
  rank: number | null; // 1, 2, 3, 4
}

const TOTAL_TRACK_STEPS = 28;

export function StreetDiceLudo({ onBack, onToast, currentCoins }: StreetDiceLudoProps) {
  const [playMode, setPlayMode] = useState<'single' | 'multiplayer'>('single');
  // Pre-game betting: 100 SC, 200 SC, 500 SC
  const [selectedBet, setSelectedBet] = useState<100 | 200 | 500>(100);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'game_over'>('betting');

  // Players
  const [players, setPlayers] = useState<Player[]>([
    { id: 'yellow', name: 'You (Yellow)', gang: 'Lagos Hustlers', isHuman: true, colorHex: '#FACC15', pos: 0, rank: null },
    { id: 'red', name: 'Red Gang', gang: 'Area Boys', isHuman: false, colorHex: '#EF4444', pos: 0, rank: null },
    { id: 'blue', name: 'Blue Crew', gang: 'Marina Mafia', isHuman: false, colorHex: '#3B82F6', pos: 0, rank: null },
    { id: 'green', name: 'Green Mob', gang: 'Kano Ryders', isHuman: false, colorHex: '#10B981', pos: 0, rank: null },
  ]);

  const [dailyFreeEntries, setDailyFreeEntries] = useState<number>(() => {
    try {
      return getTodayDailyClaim().dice_free_entries_remaining;
    } catch {
      return 1;
    }
  });

  const [currentTurn, setCurrentTurn] = useState<number>(0); // 0: yellow, 1: red, 2: blue, 3: green
  const [diceValue, setDiceValue] = useState<number>(6);
  const [isRolling, setIsRolling] = useState(false);
  const [finishOrder, setFinishOrder] = useState<Player[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastEventMsg, setLastEventMsg] = useState<string>('Select your stake to start the street ludo gang match!');

  const playSfx = useCallback(
    (type: 'coin' | 'success' | 'click' | 'roll' | 'kick' | 'lose') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'success') playSuccessSound();
        else if (type === 'kick') playPunchSound();
        else if (type === 'lose') playSirenSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Start game with free entry (Prompt 12)
  const handleStartWithFreeEntry = () => {
    if (dailyFreeEntries <= 0) {
      onToast('No free entries remaining today!');
      return;
    }
    const res = consumeDiceDailyFreeEntry();
    setDailyFreeEntries(res.remaining);
    playClickSound();
    setPlayers([
      { id: 'yellow', name: 'You (Yellow)', gang: 'Lagos Hustlers', isHuman: true, colorHex: '#FACC15', pos: 0, rank: null },
      { id: 'red', name: 'Red Gang', gang: 'Area Boys', isHuman: false, colorHex: '#EF4444', pos: 0, rank: null },
      { id: 'blue', name: 'Blue Crew', gang: 'Marina Mafia', isHuman: false, colorHex: '#3B82F6', pos: 0, rank: null },
      { id: 'green', name: 'Green Mob', gang: 'Kano Ryders', isHuman: false, colorHex: '#10B981', pos: 0, rank: null },
    ]);
    setFinishOrder([]);
    setCurrentTurn(0);
    setGameState('playing');
    setLastEventMsg(`Match started with FREE DAILY ENTRY (100 SC Prize Base)! Roll your dice!`);
    onToast('🎲 Daily Free Entry Activated! Win still pays SC!');
  };

  // Start game with bet deduction
  const handleStartGame = () => {
    if (currentCoins < selectedBet) {
      onToast(`Need at least ${selectedBet} SC to enter!`);
      playClickSound();
      return;
    }

    addGameCoins(-selectedBet, `-${selectedBet} SC - Street Ludo Gang Stake`, 'task_reward');
    playClickSound();
    setPlayers([
      { id: 'yellow', name: 'You (Yellow)', gang: 'Lagos Hustlers', isHuman: true, colorHex: '#FACC15', pos: 0, rank: null },
      { id: 'red', name: 'Red Gang', gang: 'Area Boys', isHuman: false, colorHex: '#EF4444', pos: 0, rank: null },
      { id: 'blue', name: 'Blue Crew', gang: 'Marina Mafia', isHuman: false, colorHex: '#3B82F6', pos: 0, rank: null },
      { id: 'green', name: 'Green Mob', gang: 'Kano Ryders', isHuman: false, colorHex: '#10B981', pos: 0, rank: null },
    ]);
    setFinishOrder([]);
    setCurrentTurn(0);
    setGameState('playing');
    setLastEventMsg(`Match started with ${selectedBet} SC stake! Roll your dice!`);
  };

  // Roll Dice animation & logic
  const handleRollDice = () => {
    if (isRolling || gameState !== 'playing') return;
    setIsRolling(true);
    playSfx('click');

    let rollAnimCount = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollAnimCount++;
      if (rollAnimCount >= 8) {
        clearInterval(interval);
        const finalRoll = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalRoll);
        setIsRolling(false);
        executePlayerMove(currentTurn, finalRoll);
      }
    }, 60);
  };

  // Helper to find the next active player who hasn't reached home yet
  const getNextActivePlayer = (startIdx: number, playerList: Player[]): number => {
    for (let i = 1; i <= 4; i++) {
      const idx = (startIdx + i) % 4;
      if (playerList[idx].rank === null) {
        return idx;
      }
    }
    return -1; // All finished
  };

  // Execute Move for current player
  const executePlayerMove = (playerIdx: number, roll: number) => {
    setPlayers((prevPlayers) => {
      const updated = prevPlayers.map((p) => ({ ...p }));
      const p = updated[playerIdx];

      if (p.rank !== null) {
        // Player already finished - advance to next active
        const next = getNextActivePlayer(playerIdx, updated);
        if (next !== -1) {
          advanceTurn(next, updated);
        }
        return updated;
      }

      // Check bringing out of base or moving
      if (p.pos === 0) {
        if (roll === 6) {
          p.pos = 1;
          setLastEventMsg(`${p.name} rolled a 6 and stepped out onto the street!`);
          playSfx('click');
        } else {
          setLastEventMsg(`${p.name} rolled a ${roll} (needs a 6 to enter the street).`);
        }
      } else {
        const nextPos = Math.min(TOTAL_TRACK_STEPS, p.pos + roll);
        p.pos = nextPos;
        setLastEventMsg(`${p.name} advanced +${roll} steps to block ${p.pos}!`);

        // Check if finished
        if (p.pos >= TOTAL_TRACK_STEPS && p.rank === null) {
          const rank = updated.filter((pl) => pl.rank !== null).length + 1;
          p.rank = rank;
          setFinishOrder((fo) => [...fo, p]);
          setLastEventMsg(`🏆 ${p.name} reached Home in Rank #${rank}!`);
          if (p.isHuman) {
            playSfx('success');
            onToast(`🏆 You reached Home in Rank #${rank}!`);
          } else {
            onToast(`${p.name} reached Home in Rank #${rank}!`);
          }
        } else {
          // Check Kick Opponent: if landed on exact same pos
          updated.forEach((other, oIdx) => {
            if (oIdx !== playerIdx && other.pos === p.pos && other.pos > 0 && other.pos < TOTAL_TRACK_STEPS) {
              other.pos = 0; // Kicked back to base
              playSfx('kick');
              setLastEventMsg(`💥 ${p.name} KICKED ${other.name} back to base!`);
              onToast(`💥 ${p.name} Kicked ${other.name} back to base!`);
            }
          });
        }
      }

      // Check how many players have finished
      const finishedCount = updated.filter((pl) => pl.rank !== null).length;

      if (finishedCount >= 3) {
        // Automatically rank the 4th player
        const remaining = updated.find((pl) => pl.rank === null);
        if (remaining) {
          remaining.rank = 4;
        }
        const human = updated.find((pl) => pl.isHuman);
        setTimeout(() => handleGameOver(human?.rank || 4), 900);
      } else {
        const nextActive = getNextActivePlayer(playerIdx, updated);
        if (nextActive === -1) {
          const human = updated.find((pl) => pl.isHuman);
          setTimeout(() => handleGameOver(human?.rank || 4), 900);
        } else {
          advanceTurn(nextActive, updated);
        }
      }

      return updated;
    });
  };

  // Turn management (AI auto roll & seamless progression)
  const advanceTurn = (nextIdx: number, currentPlayers: Player[]) => {
    setCurrentTurn(nextIdx);
    const nextPlayer = currentPlayers[nextIdx];

    if (!nextPlayer) return;

    if (!nextPlayer.isHuman && nextPlayer.rank === null) {
      setTimeout(() => {
        const aiRoll = Math.floor(Math.random() * 6) + 1;
        setDiceValue(aiRoll);
        executePlayerMove(nextIdx, aiRoll);
      }, 750);
    }
  };

  // Match Over & Reward distribution
  const handleGameOver = (userRank: number) => {
    setGameState('game_over');

    // Prompt 11 Game 2 Rewards:
    // 1st = 4X bet (Bet 100 win 400), 2nd = Bet back, 3rd/4th = Lose bet
    let winAward = 0;
    if (userRank === 1) {
      winAward = selectedBet * 4;
      addGameCoins(winAward, `+${winAward} SC - 1st Place Street Ludo Gang (4X Bet)`, 'task_reward');
      playSfx('success');
      onToast(`🏆 1st PLACE! Won 4X Stake: +${winAward} SC!`);
      try {
        confetti({
          particleCount: 110,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#FFD700', '#FACC15', '#10B981', '#FFFFFF'],
        });
      } catch {}
    } else if (userRank === 2) {
      winAward = selectedBet;
      addGameCoins(winAward, `+${winAward} SC - 2nd Place Street Ludo Gang (Stake Refund)`, 'task_reward');
      playSfx('coin');
      onToast(`🥈 2nd Place! Stake Refunded: +${winAward} SC.`);
    } else {
      playSfx('lose');
      onToast(`Rank #${userRank}. Stake lost to the rival gangs!`);
    }
  };

  if (playMode === 'multiplayer') {
    return (
      <StreetDiceMultiplayer
        onBack={() => setPlayMode('single')}
        onToast={onToast}
        currentCoins={currentCoins}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090A0E] text-white flex flex-col select-none overflow-y-auto overscroll-contain font-sans pb-24"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TOP HEADER WITH MODE SELECTOR */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#12131A] border-b border-[#FFD700]/30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-[#FFD700]" />
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
              <span>LUDO GANG</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">
                STREET DICE
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">4 Gangs • 3D Dice • Kick Opponents to Base</p>
          </div>
        </div>

        {/* [Single] [Multiplayer] Toggle */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            type="button"
            className="p-1.5 rounded-lg bg-white/5 border border-white/10"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#FFD700]" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* BET SELECTION SCREEN */}
      {gameState === 'betting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#13141F] to-[#0A0B10]">
          <div className="w-20 h-20 rounded-3xl bg-[#FFD700]/15 border-2 border-[#FFD700]/50 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
            <Dices className="w-10 h-10 text-[#FFD700]" />
          </div>

          <h2 className="text-2xl font-black italic uppercase text-white mb-1">STREET LUDO GANG</h2>
          <p className="text-xs text-gray-400 max-w-sm mb-6">
            Roll the 3D dice, navigate the street circuit, and kick rival gang tokens back to their base.
            Winner takes a massive 4X multiplier on their stake!
          </p>

          {/* BET SELECTOR PILLS */}
          <div className="w-full max-w-xs mb-6">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2.5">
              Select Your Bet Stake:
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {([100, 200, 500] as const).map((bet) => (
                <button
                  key={bet}
                  onClick={() => {
                    playClickSound();
                    setSelectedBet(bet);
                  }}
                  type="button"
                  className={`py-3 rounded-2xl font-black text-sm uppercase transition-all ${
                    selectedBet === bet
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-105'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  🪙 {bet} SC
                </button>
              ))}
            </div>
          </div>

          {/* PAYOUT TABLE */}
          <div className="w-full max-w-xs p-3.5 rounded-2xl bg-black/60 border border-white/10 text-left mb-6 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold">🥇 1st Place:</span>
              <span className="font-black text-[#FFD700]">4X Stake (+{selectedBet * 4} SC)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-bold">🥈 2nd Place:</span>
              <span className="font-bold text-gray-300">Stake Refund (+{selectedBet} SC)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-400 font-bold">🥉 3rd / 4th Place:</span>
              <span className="font-bold text-red-400">Lose Stake</span>
            </div>
          </div>

          {dailyFreeEntries > 0 && (
            <button
              onClick={handleStartWithFreeEntry}
              type="button"
              className="w-full max-w-xs mb-3 py-3 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🎁</span>
              <span>PLAY WITH DAILY FREE ENTRY (NO BET)</span>
            </button>
          )}

          <button
            onClick={handleStartGame}
            type="button"
            className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
          >
            START MATCH (BET {selectedBet} SC)
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'playing' && (
        <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
          {/* GANG PLAYERS BAR */}
          <div className="grid grid-cols-4 gap-2">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  currentTurn === idx
                    ? 'ring-2 ring-white scale-105 bg-white/10'
                    : 'bg-black/40 border-white/10 opacity-80'
                }`}
                style={{ borderColor: p.colorHex }}
              >
                <div
                  className="w-4 h-4 rounded-full mb-1 shadow-sm"
                  style={{ backgroundColor: p.colorHex }}
                />
                <span className="text-[10px] font-black uppercase truncate max-w-full">{p.name.split(' ')[0]}</span>
                <span className="text-[9px] font-mono text-gray-400">
                  {p.pos === 0 ? 'BASE' : p.pos >= TOTAL_TRACK_STEPS ? 'HOME' : `${p.pos}/${TOTAL_TRACK_STEPS}`}
                </span>
              </div>
            ))}
          </div>

          {/* CIRCULAR / RACETRACK LUDO BOARD CANVAS */}
          <div className="relative my-auto w-full max-w-xs aspect-square mx-auto p-4 rounded-3xl bg-gradient-to-b from-[#181A24] via-[#10121A] to-[#0A0C12] border-2 border-[#FFD700]/50 shadow-[0_0_35px_rgba(255,215,0,0.25)] flex items-center justify-center">
            {/* 4 Colored Corner Bases */}
            <div className="absolute top-3 left-3 w-16 h-16 rounded-2xl bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center">
              <span className="text-[10px] font-black text-yellow-300">YOU (Y)</span>
            </div>
            <div className="absolute top-3 right-3 w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-red-400">RED</span>
            </div>
            <div className="absolute bottom-3 left-3 w-16 h-16 rounded-2xl bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-blue-400">BLUE</span>
            </div>
            <div className="absolute bottom-3 right-3 w-16 h-16 rounded-2xl bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-green-400">GREEN</span>
            </div>

            {/* Circuit Track Ring */}
            <div className="w-56 h-56 rounded-full border-4 border-dashed border-white/20 relative flex items-center justify-center">
              {/* Player tokens positioned along circumference */}
              {players.map((p) => {
                if (p.pos === 0) return null;
                const angle = (p.pos / TOTAL_TRACK_STEPS) * Math.PI * 2 - Math.PI / 2;
                const radius = 95;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <div
                    key={p.id}
                    className="absolute w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-black shadow-lg transition-all duration-300"
                    style={{
                      backgroundColor: p.colorHex,
                      boxShadow: `0 0 12px ${p.colorHex}`,
                      transform: `translate(${x}px, ${y}px)`,
                    }}
                  >
                    {p.name[0]}
                  </div>
                );
              })}

              {/* 3D-STYLED DICE IN THE CENTER */}
              <div
                onClick={() => {
                  if (currentTurn === 0) handleRollDice();
                }}
                className={`w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-300 to-white text-black font-black flex flex-col items-center justify-center shadow-[0_0_25px_rgba(250,204,21,0.7)] transition-transform duration-150 ${
                  isRolling ? 'rotate-45 scale-90' : 'scale-100 hover:scale-105 active:scale-95'
                } ${currentTurn === 0 ? 'cursor-pointer animate-pulse ring-4 ring-yellow-400/60' : 'opacity-80'}`}
              >
                <span className="text-3xl font-black">{diceValue}</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-black/80">
                  {currentTurn === 0 ? 'TAP ROLL' : 'ROLLING'}
                </span>
              </div>
            </div>
          </div>

          {/* EVENT MESSAGE STRIP */}
          <div className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-center text-xs text-yellow-300 font-medium">
            {lastEventMsg}
          </div>

          {/* ACTION BUTTON (FOR HUMAN PLAYER) */}
          <div className="pt-2">
            {currentTurn === 0 ? (
              <button
                onClick={handleRollDice}
                disabled={isRolling}
                type="button"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
              >
                ROLL DICE (YOUR TURN)
              </button>
            ) : (
              <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                Gang Rival Rolling...
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME OVER POPUP */}
      {gameState === 'game_over' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181B26] via-[#11131C] to-[#0A0B10] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_40px_rgba(255,215,0,0.4)]">
            {players[0].rank === 1 ? (
              <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                <Trophy className="w-9 h-9 text-[#FFD700]" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-3">
                <Skull className="w-9 h-9 text-red-400" />
              </div>
            )}

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">
              {players[0].rank === 1 ? 'LUDO CHAMPION!' : `RANK #${players[0].rank || 4}`}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {players[0].rank === 1
                ? 'You dominated all 3 rival gangs on the Lagos street circuit!'
                : 'Better luck next time against the street syndicates.'}
            </p>

            <div className="my-4 py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400">Outcome:</span>
              <span className="text-xl font-black text-[#FFD700]">
                {players[0].rank === 1
                  ? `+${selectedBet * 4} SC (4X)`
                  : players[0].rank === 2
                  ? `+${selectedBet} SC (Refund)`
                  : `-${selectedBet} SC`}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setGameState('betting')}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                PLAY AGAIN
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
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
