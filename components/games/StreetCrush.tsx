'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Sparkles, Trophy, Tv, AlertCircle } from 'lucide-react';
import { playCoinSound, playSuccessSound, playClickSound, playPickupSound, playSirenSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { consumeCrushDailyFreeMoves, getTodayDailyClaim } from '@/lib/dailyFree';
import confetti from 'canvas-confetti';

interface StreetCrushProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

type FruitType = 'apple' | 'banana' | 'mango' | 'grape' | 'orange' | 'berry';

interface Tile {
  id: string;
  type: FruitType;
  isSpecial?: 'bomb' | 'rainbow' | null;
  isPopping?: boolean;
}

const FRUITS: { type: FruitType; label: string; emoji: string; color: string; border: string }[] = [
  { type: 'apple', label: 'Red Apple', emoji: '🍎', color: 'from-red-500 to-rose-700', border: 'border-red-400' },
  { type: 'banana', label: 'Yellow Banana', emoji: '🍌', color: 'from-amber-400 to-yellow-600', border: 'border-yellow-300' },
  { type: 'mango', label: 'Green Mango', emoji: '🥭', color: 'from-emerald-400 to-green-600', border: 'border-emerald-400' },
  { type: 'grape', label: 'Purple Grape', emoji: '🍇', color: 'from-purple-500 to-indigo-700', border: 'border-purple-400' },
  { type: 'orange', label: 'Orange', emoji: '🍊', color: 'from-orange-400 to-amber-600', border: 'border-orange-400' },
  { type: 'berry', label: 'Blue Berry', emoji: '🫐', color: 'from-blue-500 to-sky-700', border: 'border-sky-400' },
];

const BOARD_SIZE = 8;

// Generate random fruit tile
function getRandomTile(): Tile {
  const item = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  return {
    id: `tile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: item.type,
    isSpecial: null,
  };
}

// Initialize board with no starting 3-matches
function createInitialBoard(): Tile[][] {
  const newBoard: Tile[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let tile: Tile;
      do {
        tile = getRandomTile();
      } while (
        (r >= 2 && newBoard[r - 1][c].type === tile.type && newBoard[r - 2][c].type === tile.type) ||
        (c >= 2 && row[c - 1].type === tile.type && row[c - 2].type === tile.type)
      );
      row.push(tile);
    }
    newBoard.push(row);
  }
  return newBoard;
}

export function StreetCrush({ onBack, onToast }: StreetCrushProps) {
  const [level, setLevel] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const saved = localStorage.getItem('streetlife_crush_level');
    return saved ? Math.min(100, Math.max(1, parseInt(saved, 10))) : 1;
  });

  const targetScore = level * 500;
  const initialMoves = Math.max(18, 30 - Math.floor((level - 1) / 10));

  // Initialize board with no starting 3-matches
  const [board, setBoard] = useState<Tile[][]>(() => createInitialBoard());
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(initialMoves);
  const [selectedPos, setSelectedPos] = useState<{ r: number; c: number } | null>(null);
  const [gameState, setGameState] = useState<'playing' | 'level_complete' | 'game_over'>('playing');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [adWatching, setAdWatching] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const isProcessingRef = useRef(false);

  // Daily Free Moves (Prompt 12)
  const [dailyFreeMovesLeft, setDailyFreeMovesLeft] = useState<number>(() => {
    try {
      return getTodayDailyClaim().crush_free_moves_remaining;
    } catch {
      return 1;
    }
  });

  const handleApplyDailyFreeMoves = () => {
    if (dailyFreeMovesLeft <= 0) {
      onToast('No daily free moves remaining today!');
      return;
    }
    const res = consumeCrushDailyFreeMoves();
    setDailyFreeMovesLeft(res.remaining);
    setMovesLeft((prev) => prev + 5);
    playSfx('pop');
    onToast('🍬 +5 Daily Free Moves Added!');
  };

  const playSfx = useCallback(
    (type: 'coin' | 'success' | 'click' | 'pop' | 'fail') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'success') playSuccessSound();
        else if (type === 'pop') playPickupSound();
        else if (type === 'fail') playSirenSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Level Complete handler
  const handleLevelComplete = useCallback(() => {
    setGameState('level_complete');
    const levelBonus = 100;
    setEarnedCoins((prev) => prev + levelBonus);
    addGameCoins(levelBonus, `+${levelBonus} SC - Street Crush Level ${level} Complete!`, 'task_reward');
    playSfx('success');
    onToast(`Level ${level} Complete! +100 SC Awarded!`);
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#F59E0B', '#10B981', '#FFFFFF'],
      });
    } catch {}
  }, [level, onToast, playSfx]);

  // Start / Restart Level
  const initLevel = useCallback(
    (lvlNum: number) => {
      setLevel(lvlNum);
      if (typeof window !== 'undefined') {
        localStorage.setItem('streetlife_crush_level', lvlNum.toString());
      }
      setBoard(createInitialBoard());
      setScore(0);
      setMovesLeft(initialMoves);
      setSelectedPos(null);
      setGameState('playing');
      setEarnedCoins(0);
      isProcessingRef.current = false;
    },
    [initialMoves]
  );

  // Find matches on the current board
  const findMatches = (grid: Tile[][]) => {
    const matchedCoords = new Set<string>();
    const matchGroups: { coords: { r: number; c: number }[]; type: FruitType; length: number }[] = [];

    // Horizontal check
    for (let r = 0; r < BOARD_SIZE; r++) {
      let matchCount = 1;
      for (let c = 0; c < BOARD_SIZE; c++) {
        const isSameAsNext = c < BOARD_SIZE - 1 && grid[r][c].type === grid[r][c + 1].type;
        if (isSameAsNext) {
          matchCount++;
        } else {
          if (matchCount >= 3) {
            const group: { r: number; c: number }[] = [];
            for (let i = 0; i < matchCount; i++) {
              matchedCoords.add(`${r},${c - i}`);
              group.push({ r, c: c - i });
            }
            matchGroups.push({ coords: group, type: grid[r][c].type, length: matchCount });
          }
          matchCount = 1;
        }
      }
    }

    // Vertical check
    for (let c = 0; c < BOARD_SIZE; c++) {
      let matchCount = 1;
      for (let r = 0; r < BOARD_SIZE; r++) {
        const isSameAsNext = r < BOARD_SIZE - 1 && grid[r][c].type === grid[r + 1][c].type;
        if (isSameAsNext) {
          matchCount++;
        } else {
          if (matchCount >= 3) {
            const group: { r: number; c: number }[] = [];
            for (let i = 0; i < matchCount; i++) {
              matchedCoords.add(`${r - i},${c}`);
              group.push({ r: r - i, c });
            }
            matchGroups.push({ coords: group, type: grid[r][c].type, length: matchCount });
          }
          matchCount = 1;
        }
      }
    }

    return { matchedCoords, matchGroups };
  };

  // Process cascading drops and refills
  const processCascades = useCallback(
    async (currentBoard: Tile[][], moveTriggered = false) => {
      let grid = currentBoard.map((row) => [...row]);
      let hadMatches = false;
      let cascadeCount = 0;

      while (cascadeCount < 8) {
        cascadeCount++;
        const { matchedCoords, matchGroups } = findMatches(grid);
        if (matchedCoords.size === 0) break;

        hadMatches = true;

        // Calculate rewards according to Prompt 11:
        // Match 3 = 10 SC, Match 4 = 25 SC + Bomb, Match 5 = 50 SC + Rainbow
        let roundCoins = 0;
        let roundPoints = 0;
        let specialToSpawn: { r: number; c: number; type: 'bomb' | 'rainbow' } | null = null;

        matchGroups.forEach((grp) => {
          if (grp.length >= 5) {
            roundCoins += 50;
            roundPoints += 250;
            specialToSpawn = { r: grp.coords[0].r, c: grp.coords[0].c, type: 'rainbow' };
          } else if (grp.length === 4) {
            roundCoins += 25;
            roundPoints += 150;
            specialToSpawn = { r: grp.coords[0].r, c: grp.coords[0].c, type: 'bomb' };
          } else {
            roundCoins += 10;
            roundPoints += 80;
          }
        });

        if (roundCoins > 0) {
          playSfx('pop');
          setEarnedCoins((prev) => prev + roundCoins);
          addGameCoins(roundCoins, `+${roundCoins} SC - Street Crush Match`, 'task_reward');
        }

        setScore((prev) => {
          const nextScore = prev + roundPoints;
          if (nextScore >= targetScore && gameState === 'playing') {
            handleLevelComplete();
          }
          return nextScore;
        });

        // Clear matched tiles
        const newGrid = grid.map((row, r) =>
          row.map((tile, c) => {
            if (matchedCoords.has(`${r},${c}`)) {
              if (specialToSpawn && specialToSpawn.r === r && specialToSpawn.c === c) {
                return {
                  ...tile,
                  isSpecial: specialToSpawn.type,
                  isPopping: false,
                };
              }
              return null as unknown as Tile;
            }
            return tile;
          })
        );

        // Drop tiles down (gravity)
        for (let c = 0; c < BOARD_SIZE; c++) {
          const columnTiles: Tile[] = [];
          for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            if (newGrid[r][c] !== null) {
              columnTiles.push(newGrid[r][c]);
            }
          }
          // Refill top with new random tiles
          while (columnTiles.length < BOARD_SIZE) {
            columnTiles.push(getRandomTile());
          }
          for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            newGrid[r][c] = columnTiles[BOARD_SIZE - 1 - r];
          }
        }

        grid = newGrid;
        setBoard(grid);
        // Small delay for satisfying cascading pop
        await new Promise((res) => setTimeout(res, 220));
      }

      if (moveTriggered) {
        setMovesLeft((m) => {
          const next = m - 1;
          if (next <= 0 && score + 50 < targetScore) {
            setGameState('game_over');
            playSfx('fail');
          }
          return Math.max(0, next);
        });
      }

      isProcessingRef.current = false;
      return hadMatches;
    },
    [gameState, handleLevelComplete, playSfx, score, targetScore]
  );

  // Drag and Drop & Phone Touch Swipe handlers
  const draggedPosRef = useRef<{ r: number; c: number } | null>(null);
  const touchStartCoordRef = useRef<{ x: number; y: number; r: number; c: number } | null>(null);

  // Click / Select Tile to Swap
  const handleTileClick = async (r: number, c: number, overridePrev?: { r: number; c: number }) => {
    if (isProcessingRef.current || gameState !== 'playing') return;

    // Check special click: Bomb or Rainbow
    const clicked = board[r][c];
    if (clicked.isSpecial === 'bomb') {
      // Clear 3x3 surrounding
      isProcessingRef.current = true;
      playSfx('pop');
      const newGrid = board.map((row) => [...row]);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            newGrid[nr][nc] = getRandomTile();
          }
        }
      }
      setBoard(newGrid);
      setScore((s) => s + 300);
      setEarnedCoins((coins) => coins + 25);
      addGameCoins(25, '+25 SC - Street Crush Bomb Exploded!', 'task_reward');
      await new Promise((res) => setTimeout(res, 250));
      processCascades(newGrid, true);
      return;
    }

    const prevPos = overridePrev || selectedPos;

    if (!prevPos) {
      setSelectedPos({ r, c });
      playClickSound();
      return;
    }

    // Check adjacency
    const dist = Math.abs(prevPos.r - r) + Math.abs(prevPos.c - c);
    if (dist !== 1) {
      setSelectedPos({ r, c });
      playClickSound();
      return;
    }

    // Try Swap
    isProcessingRef.current = true;
    setSelectedPos(null);

    const swappedBoard = board.map((row) => [...row]);
    const temp = swappedBoard[prevPos.r][prevPos.c];
    swappedBoard[prevPos.r][prevPos.c] = swappedBoard[r][c];
    swappedBoard[r][c] = temp;

    setBoard(swappedBoard);
    playClickSound();

    // Check if swap makes any matches
    const { matchedCoords } = findMatches(swappedBoard);
    if (matchedCoords.size === 0) {
      // Revert swap if no matches
      await new Promise((res) => setTimeout(res, 220));
      const reverted = swappedBoard.map((row) => [...row]);
      reverted[prevPos.r][prevPos.c] = swappedBoard[r][c];
      reverted[r][c] = swappedBoard[prevPos.r][prevPos.c];
      setBoard(reverted);
      isProcessingRef.current = false;
      return;
    }

    // Process cascade
    await processCascades(swappedBoard, true);
  };

  // Drag & Drop Handlers for Desktop Candies
  const handleDragStart = (r: number, c: number) => {
    draggedPosRef.current = { r, c };
  };

  const handleDragDrop = (r: number, c: number) => {
    if (!draggedPosRef.current) return;
    const from = draggedPosRef.current;
    draggedPosRef.current = null;
    const dist = Math.abs(from.r - r) + Math.abs(from.c - c);
    if (dist === 1) {
      handleTileClick(r, c, from);
    }
  };

  // Touch Swipe Handlers for Mobile Candies
  const handleTouchStart = (e: React.TouchEvent, r: number, c: number) => {
    const touch = e.touches[0];
    touchStartCoordRef.current = { x: touch.clientX, y: touch.clientY, r, c };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartCoordRef.current) return;
    const start = touchStartCoordRef.current;
    touchStartCoordRef.current = null;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.hypot(dx, dy) > 20) {
      let targetR = start.r;
      let targetC = start.c;
      if (Math.abs(dx) > Math.abs(dy)) {
        targetC += dx > 0 ? 1 : -1;
      } else {
        targetR += dy > 0 ? 1 : -1;
      }
      if (targetR >= 0 && targetR < BOARD_SIZE && targetC >= 0 && targetC < BOARD_SIZE) {
        handleTileClick(targetR, targetC, { r: start.r, c: start.c });
      }
    }
  };

  // Watch Ad for +5 Moves
  const handleWatchAdMoves = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      setMovesLeft((prev) => prev + 5);
      setGameState('playing');
      onToast('+5 Moves Added! Keep crushing!');
      playSfx('coin');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0E] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* TOP HEADER HUD */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#121218] border-b border-[#FFD700]/30 shrink-0">
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
              <span>STREET CRUSH</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">
                LVL {level}/100
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">Match 3+ Shiny Fruits • Bombs & Rainbows</p>
          </div>
        </div>

        {/* HUD Quick Stats */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/60 border border-[#FFD700]/40 text-xs font-black text-[#FFD700]">
            <span>🪙</span>
            <span>+{earnedCoins} SC</span>
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

      {/* SUB-HEADER HUD: SCORE, TARGET, MOVES LEFT */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-black via-[#16161F] to-black border-b border-white/10">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Target Score</span>
          <span className="text-sm font-black text-cyan-400">
            {score} <span className="text-xs text-gray-500">/ {targetScore}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 mx-4 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-300"
            style={{ width: `${Math.min(100, (score / targetScore) * 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          {dailyFreeMovesLeft > 0 && (
            <button
              onClick={handleApplyDailyFreeMoves}
              type="button"
              className="px-2 py-1 rounded-xl bg-pink-500/20 border border-pink-400 text-pink-300 text-[9px] font-black uppercase active:scale-95 transition-all shadow-[0_0_10px_rgba(236,72,153,0.3)] cursor-pointer"
            >
              +5 Free Moves (1/1)
            </button>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Moves Left</span>
            <span
              className={`text-base font-black font-mono ${
                movesLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-[#FFD700]'
              }`}
            >
              {movesLeft}
            </span>
          </div>
        </div>
      </div>

      {/* 8x8 MATCH BOARD */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="relative p-2.5 rounded-3xl bg-gradient-to-b from-[#161622] via-[#0E0E16] to-[#0A0A0E] border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.2)] max-w-sm w-full aspect-square">
          <div className="grid grid-cols-8 grid-rows-8 gap-1.5 w-full h-full">
            {board.map((row, r) =>
              row.map((tile, c) => {
                const isSelected = selectedPos?.r === r && selectedPos?.c === c;
                const fruitDef = FRUITS.find((f) => f.type === tile.type) || FRUITS[0];

                return (
                  <button
                    key={tile.id || `${r}-${c}`}
                    onClick={() => handleTileClick(r, c)}
                    draggable
                    onDragStart={() => handleDragStart(r, c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDragDrop(r, c)}
                    onTouchStart={(e) => handleTouchStart(e, r, c)}
                    onTouchEnd={handleTouchEnd}
                    type="button"
                    className={`candy relative rounded-xl flex items-center justify-center transition-all duration-150 select-none cursor-pointer ${
                      isSelected
                        ? 'ring-4 ring-[#FFD700] scale-110 z-10 bg-yellow-400/30'
                        : 'hover:brightness-110 active:scale-95'
                    } bg-gradient-to-br ${fruitDef.color} border ${fruitDef.border} shadow-md`}
                  >
                    {/* Glossy reflection bubble */}
                    <div className="absolute top-1 left-1.5 w-2 h-1 bg-white/40 rounded-full pointer-events-none" />

                    {/* Fruit Emoji or Special icon */}
                    <span className="text-xl sm:text-2xl drop-shadow-md transition-transform">
                      {tile.isSpecial === 'bomb' ? (
                        '💣'
                      ) : tile.isSpecial === 'rainbow' ? (
                        '🌈'
                      ) : (
                        fruitDef.emoji
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM INFO BAR */}
      <div className="px-4 py-2.5 bg-[#101016] border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span>Match 3:</span>
          <span className="font-bold text-[#FFD700]">+10 SC</span>
          <span>•</span>
          <span>Match 4:</span>
          <span className="font-bold text-orange-400">+25 SC (Bomb)</span>
          <span>•</span>
          <span>Match 5:</span>
          <span className="font-bold text-pink-400">+50 SC (Rainbow)</span>
        </div>
      </div>

      {/* LEVEL COMPLETE POPUP */}
      {gameState === 'level_complete' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181B26] via-[#11131C] to-[#0A0B10] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_40px_rgba(255,215,0,0.4)]">
            <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(255,215,0,0.3)]">
              <Trophy className="w-9 h-9 text-[#FFD700]" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">LEVEL COMPLETE!</h3>
            <p className="text-xs text-gray-400 mt-1">Awesome hustle! You cleared the board in style.</p>

            <div className="my-4 py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400">Level Bonus:</span>
              <span className="text-xl font-black text-[#FFD700]">🪙 +100 SC</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  playClickSound();
                  initLevel(Math.min(100, level + 1));
                }}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                NEXT LEVEL {Math.min(100, level + 1)}
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

      {/* OUT OF MOVES / FAIL POPUP */}
      {gameState === 'game_over' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#211414] via-[#160D0D] to-[#0A0707] border-2 border-red-500/50 p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.3)]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-9 h-9 text-red-400" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">OUT OF MOVES!</h3>
            <p className="text-xs text-gray-400 mt-1">You ran out of moves before reaching target score.</p>

            <div className="flex flex-col gap-2.5 mt-5">
              <button
                onClick={handleWatchAdMoves}
                disabled={adWatching}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4 fill-black" />
                {adWatching ? 'Watching Ad...' : 'Watch Ad for +5 Moves'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  initLevel(level);
                }}
                type="button"
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Retry Level
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
