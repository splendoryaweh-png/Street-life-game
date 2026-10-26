'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Dices,
  Trophy,
  Coins,
  Crown,
  Clock,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Users,
} from 'lucide-react';
import { Lobby } from '../../multiplayer/Lobby';
import {
  GameType,
  PlayerInRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  updateRoom,
  sendUpdate,
  onUpdate,
  tryRejoin,
  saveRejoin,
  clearRejoin,
} from '../../multiplayer/multiplayerManager';
import {
  playCoinSound,
  playSuccessSound,
  playClickSound,
  playPunchSound,
  playSirenSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';

interface StreetDiceMultiplayerProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
  initialRoomCode?: string;
}

// 28 board steps for street gang ludo circuit
const TOTAL_TRACK_STEPS = 28;
const SAFE_STEPS = [1, 8, 15, 22]; // Safe zone stops

const PLAYER_COLORS = [
  { id: 'yellow', name: 'Lagos Hustlers', color: '#FACC15', bg: 'bg-yellow-400', border: 'border-yellow-400' },
  { id: 'red', name: 'Area Boys', color: '#EF4444', bg: 'bg-red-500', border: 'border-red-500' },
  { id: 'blue', name: 'Marina Mafia', color: '#3B82F6', bg: 'bg-blue-500', border: 'border-blue-500' },
  { id: 'green', name: 'Kano Ryders', color: '#10B981', bg: 'bg-emerald-500', border: 'border-emerald-500' },
];

export function StreetDiceMultiplayer({
  onBack,
  onToast,
  currentCoins,
  initialRoomCode,
}: StreetDiceMultiplayerProps) {
  const [myId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('street_multiplayer_player_id');
      if (!saved) {
        saved = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        localStorage.setItem('street_multiplayer_player_id', saved);
      }
      return saved;
    }
    return `p_${Date.now()}`;
  });

  const [myName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const tgName = window.Telegram?.WebApp?.initDataUnsafe?.user?.username;
        if (tgName) return `@${tgName}`;
      } catch {}
    }
    return 'Street Boss';
  });

  // Room & Phase State with automatic rejoin initialization
  const [initialRejoinRoom] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    const rejoinData = tryRejoin();
    if (rejoinData) {
      const room = getRoom(rejoinData.code);
      if (room && room.gameType === 'dice') return room;
    }
    return null;
  });

  const [roomCode, setRoomCode] = useState<string | null>(
    initialRoomCode || initialRejoinRoom?.code || null
  );
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'game_over'>('lobby');
  const [inputJoinCode, setInputJoinCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(() => {
    return initialRejoinRoom ? initialRejoinRoom.hostId === myId : false;
  });

  // Gameplay State
  const [players, setPlayers] = useState<PlayerInRoom[]>(() => {
    return initialRejoinRoom?.players || [];
  });
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [diceValue, setDiceValue] = useState<number>(6);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(30);
  const [winner, setWinner] = useState<PlayerInRoom | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [eventMessage, setEventMessage] = useState<string>('Welcome to Street Ludo Multiplayer!');

  // Tokens: each player has 4 tokens on the board (0 = Yard base, 1-27 = Track, 28 = Home Goal)
  // Structure: { [playerId]: [pos0, pos1, pos2, pos3] }
  const [tokens, setTokens] = useState<Record<string, number[]>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const botTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Host creates room
  const handleHostCreate = () => {
    playClickSound();
    const code = createRoom('dice', myId, myName, '👑');
    const room = getRoom(code);
    if (room) {
      setRoomCode(code);
      setIsHost(true);
      setPlayers(room.players);
      saveRejoin(code, myId);
      onToast(`Created room ${code}! Share code with squad.`);
    }
  };

  // Player joins room
  const handlePlayerJoin = (codeToJoin?: string) => {
    const targetCode = (codeToJoin || inputJoinCode).toUpperCase().trim();
    if (!targetCode) {
      onToast('Enter a valid room code!');
      return;
    }

    playClickSound();
    const playerObj: PlayerInRoom = {
      id: myId,
      name: myName,
      avatar: '🎲',
      ready: false,
      isBot: false,
      latency: Math.floor(25 + Math.random() * 30),
      team: 'blue',
    };

    const success = joinRoom(targetCode, playerObj);
    if (success) {
      setRoomCode(targetCode);
      setIsHost(false);
      const room = getRoom(targetCode);
      if (room) {
        setPlayers(room.players);
      }
      saveRejoin(targetCode, myId);
      onToast(`Joined room ${targetCode}!`);
    } else {
      onToast('Could not join room (not found or full)!');
    }
  };

  // Toggle Ready in Lobby
  const handleToggleReady = () => {
    if (!roomCode) return;
    playClickSound();
    updateRoom(roomCode, (prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === myId ? { ...p, ready: !p.ready } : p)),
    }));
    sendUpdate(roomCode, myId, { action: 'toggle_ready', playerId: myId });
  };

  // Fill lobby with bots if user wants to play immediately
  const handleAddBot = () => {
    if (!roomCode || !isHost || players.length >= 4) return;
    playClickSound();
    const botIndex = players.length;
    const botNames = ['Area Boy Chidi', 'Marina Boss Gambo', 'Surulere Swift'];
    const botPlayer: PlayerInRoom = {
      id: `bot_${Date.now()}_${botIndex}`,
      name: botNames[botIndex - 1] || `Street Bot ${botIndex}`,
      avatar: '🤖',
      ready: true,
      isBot: true,
      latency: 18,
      color: PLAYER_COLORS[botIndex]?.color || '#EF4444',
      team: 'blue',
    };

    updateRoom(roomCode, (prev) => ({
      ...prev,
      players: [...prev.players, botPlayer],
    }));
    sendUpdate(roomCode, myId, { action: 'add_bot', bot: botPlayer });
    onToast(`Added AI Hustler ${botPlayer.name}!`);
  };

  // Host starts the match
  const handleHostStart = () => {
    if (!roomCode || !isHost) return;
    playSuccessSound();

    // Initialize 4 tokens per player at base 0
    const initialTokens: Record<string, number[]> = {};
    players.forEach((p) => {
      initialTokens[p.id] = [0, 0, 0, 0];
    });

    updateRoom(roomCode, (prev) => ({
      ...prev,
      status: 'playing',
    }));

    sendUpdate(roomCode, myId, {
      action: 'start_game',
      initialTokens,
      turnIndex: 0,
    });

    setTokens(initialTokens);
    setTurnIndex(0);
    setPhase('playing');
    setEventMessage(`${players[0]?.name}'s turn to roll!`);
  };

  // Advance turn to next player
  const nextTurn = useCallback(() => {
    if (!roomCode) return;
    setHasRolled(false);
    setIsRolling(false);
    setTimer(30);

    const nextIdx = (turnIndex + 1) % players.length;
    setTurnIndex(nextIdx);

    const activeP = players[nextIdx];
    setEventMessage(`${activeP?.name}'s turn!`);

    sendUpdate(roomCode, myId, {
      action: 'next_turn',
      turnIndex: nextIdx,
    });
  }, [roomCode, turnIndex, players, myId]);

  // Roll Dice Action
  const handleRollDice = () => {
    const activePlayer = players[turnIndex];
    if (!activePlayer || activePlayer.id !== myId || isRolling || hasRolled || phase !== 'playing') {
      return;
    }

    if (soundEnabled) playClickSound();
    setIsRolling(true);

    setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1;
      setDiceValue(rolled);
      setIsRolling(false);
      setHasRolled(true);

      if (soundEnabled) playSuccessSound();

      // Check if player has any valid moves
      const playerTokens = tokens[myId] || [0, 0, 0, 0];
      const canMove = playerTokens.some((pos) => {
        if (pos === 0) return rolled === 6; // Need 6 to exit yard
        return pos + rolled <= TOTAL_TRACK_STEPS;
      });

      setEventMessage(`You rolled a ${rolled}! ${canMove ? 'Select a token to move.' : 'No valid moves. Passing turn...'}`);

      sendUpdate(roomCode!, myId, {
        action: 'dice_rolled',
        diceValue: rolled,
        playerId: myId,
      });

      // If no valid moves, automatically pass turn after 1.5s
      if (!canMove) {
        setTimeout(() => {
          nextTurn();
        }, 1500);
      }
    }, 600);
  };

  // Move Token Action
  const handleMoveToken = (tokenIndex: number) => {
    const activePlayer = players[turnIndex];
    if (!activePlayer || activePlayer.id !== myId || !hasRolled || phase !== 'playing') {
      return;
    }

    const currentPositions = tokens[myId] || [0, 0, 0, 0];
    const currentPos = currentPositions[tokenIndex];

    let newPos = currentPos;

    if (currentPos === 0) {
      if (diceValue !== 6) {
        onToast('Need a 6 to bring token out of base!');
        return;
      }
      newPos = 1; // Exit to starting block
    } else {
      if (currentPos + diceValue > TOTAL_TRACK_STEPS) {
        onToast('Roll exceeds home goal track!');
        return;
      }
      newPos = currentPos + diceValue;
    }

    if (soundEnabled) playClickSound();

    // Check knockout of opponents
    const updatedTokens: Record<string, number[]> = { ...tokens };
    const myNewTokens = [...currentPositions];
    myNewTokens[tokenIndex] = newPos;
    updatedTokens[myId] = myNewTokens;

    // Check if newPos knocks out any enemy token (unless in safe spots)
    if (!SAFE_STEPS.includes(newPos) && newPos < TOTAL_TRACK_STEPS) {
      players.forEach((p) => {
        if (p.id !== myId) {
          const enemyTokens = [...(updatedTokens[p.id] || [0, 0, 0, 0])];
          let knocked = false;
          enemyTokens.forEach((ePos, eIdx) => {
            if (ePos === newPos && ePos !== 0) {
              enemyTokens[eIdx] = 0; // Send back to base!
              knocked = true;
            }
          });
          if (knocked) {
            updatedTokens[p.id] = enemyTokens;
            if (soundEnabled) playPunchSound();
            onToast(`🥊 KNOCKOUT! Sent ${p.name}'s token back to base!`);
          }
        }
      });
    }

    setTokens(updatedTokens);
    setHasRolled(false);

    // Win Check: all 4 tokens at home (step 28)
    const isWin = myNewTokens.every((p) => p === TOTAL_TRACK_STEPS);
    if (isWin) {
      handleDeclareWinner(activePlayer);
      return;
    }

    // Broadcast token move to all peers
    sendUpdate(roomCode!, myId, {
      action: 'token_moved',
      playerId: myId,
      tokens: updatedTokens,
      movedTokenIndex: tokenIndex,
      newPos,
    });

    // Bonus roll on rolling a 6! Otherwise next turn
    if (diceValue === 6) {
      onToast('Rolled a 6! You get another roll! 🎲');
      setHasRolled(false);
      setTimer(30);
    } else {
      nextTurn();
    }
  };

  // Declare Winner
  const handleDeclareWinner = useCallback(
    (winningPlayer: PlayerInRoom) => {
      setWinner(winningPlayer);
      setPhase('game_over');
      if (winningPlayer.id === myId) {
        playSuccessSound();
        playCoinSound();
        addGameCoins(100, '+100 SC - Street Ludo Multiplayer Champion', 'task_reward');
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        onToast('🏆 CHAMPION! You won 100 Street Coins!');
      } else {
        playSirenSound();
        onToast(`${winningPlayer.name} won the Street Ludo match!`);
      }

      sendUpdate(roomCode!, myId, {
        action: 'declare_winner',
        winner: winningPlayer,
      });
    },
    [myId, onToast, roomCode]
  );

  // AI Bot Auto-Play logic
  useEffect(() => {
    if (phase !== 'playing' || !players[turnIndex]) return;

    const currentPlayer = players[turnIndex];
    if (!currentPlayer.isBot) return;

    // Host acts as authority to drive bots
    if (!isHost) return;

    botTimeoutRef.current = setTimeout(() => {
      // 1. Bot rolls
      const rolled = Math.floor(Math.random() * 6) + 1;
      setDiceValue(rolled);

      sendUpdate(roomCode!, myId, {
        action: 'dice_rolled',
        diceValue: rolled,
        playerId: currentPlayer.id,
      });

      // 2. Bot selects first valid move
      setTimeout(() => {
        const botTokens = tokens[currentPlayer.id] || [0, 0, 0, 0];
        let chosenIdx = -1;

        // Priority 1: bring out token if 6 rolled and token at base
        if (rolled === 6) {
          chosenIdx = botTokens.findIndex((p) => p === 0);
        }

        // Priority 2: advance furthest forward token
        if (chosenIdx === -1) {
          chosenIdx = botTokens.findIndex((p) => p > 0 && p + rolled <= TOTAL_TRACK_STEPS);
        }

        if (chosenIdx !== -1) {
          const newPos = botTokens[chosenIdx] === 0 ? 1 : botTokens[chosenIdx] + rolled;
          const updatedTokens = { ...tokens };
          const updatedBotPositions = [...botTokens];
          updatedBotPositions[chosenIdx] = newPos;
          updatedTokens[currentPlayer.id] = updatedBotPositions;

          setTokens(updatedTokens);

          sendUpdate(roomCode!, myId, {
            action: 'token_moved',
            playerId: currentPlayer.id,
            tokens: updatedTokens,
            movedTokenIndex: chosenIdx,
            newPos,
          });

          // Check bot win
          if (updatedBotPositions.every((p) => p === TOTAL_TRACK_STEPS)) {
            handleDeclareWinner(currentPlayer);
            return;
          }

          if (rolled === 6) {
            // bot rolls again
            return;
          }
        }

        nextTurn();
      }, 1000);
    }, 1200);

    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, [phase, turnIndex, players, isHost, tokens, roomCode, myId, nextTurn, handleDeclareWinner]);

  // Turn timer countdown (30s)
  useEffect(() => {
    if (phase !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Time expired, auto advance turn
          const activeP = players[turnIndex];
          if (activeP && activeP.id === myId) {
            onToast('Turn timed out! Passing to next player...');
            nextTurn();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, turnIndex, players, myId, nextTurn, onToast]);

  // Peer-to-Peer real-time message handler
  useEffect(() => {
    if (!roomCode) return;

    const unsubscribe = onUpdate(roomCode, (msg) => {
      const { type, playerId, data } = msg;

      if (type === 'room_state') {
        setPlayers(data.players || []);
        if (data.status === 'playing' && phase === 'lobby') {
          setPhase('playing');
        }
      } else if (type === 'update') {
        const action = data?.action;

        if (action === 'start_game') {
          setTokens(data.initialTokens || {});
          setTurnIndex(data.turnIndex || 0);
          setPhase('playing');
          playSuccessSound();
        } else if (action === 'dice_rolled') {
          setDiceValue(data.diceValue);
          setIsRolling(false);
          setHasRolled(true);
        } else if (action === 'token_moved') {
          setTokens(data.tokens);
          setHasRolled(false);
        } else if (action === 'next_turn') {
          setTurnIndex(data.turnIndex);
          setHasRolled(false);
          setIsRolling(false);
          setTimer(30);
          const p = players[data.turnIndex];
          if (p) setEventMessage(`${p.name}'s turn!`);
        } else if (action === 'player_left') {
          // If player left, convert to bot immediately
          setPlayers((prev) =>
            prev.map((p) => (p.id === data.playerId ? { ...p, isBot: true, name: `${p.name} (Bot)` } : p))
          );
          onToast('A player disconnected - replaced by AI Bot!');
        } else if (action === 'declare_winner') {
          setWinner(data.winner);
          setPhase('game_over');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, phase, players, onToast]);

  // Leave room cleanly
  const handleLeaveRoom = () => {
    playClickSound();
    if (roomCode) {
      leaveRoom(roomCode, myId);
      clearRejoin();
    }
    setRoomCode(null);
    setPhase('lobby');
    onBack();
  };

  // LOBBY PHASE
  if (!roomCode || phase === 'lobby') {
    if (!roomCode) {
      // Create or Join Entry View
      return (
        <div className="w-full max-w-md mx-auto p-4 flex flex-col min-h-[85vh] justify-between text-white animate-in fade-in select-none">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                type="button"
                className="p-2.5 rounded-2xl bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-xs font-black">
                <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
                <span>{currentCoins.toLocaleString()} SC</span>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-600 mx-auto flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(255,215,0,0.4)] mb-3">
                🎲
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                STREET LUDO GANG
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Real-Time Peer-to-Peer 2-4 Player Board Match
              </p>
            </div>

            {/* Host Game Option */}
            <div className="p-4 rounded-3xl bg-[#141414] border border-[#FFD700]/40 shadow-xl mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/20 text-[#FFD700] flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">Host Match</h3>
                  <p className="text-[11px] text-gray-400">
                    Create a private room code and invite friends
                  </p>
                </div>
              </div>
              <button
                onClick={handleHostCreate}
                type="button"
                className="w-full py-3 rounded-2xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all cursor-pointer active:scale-95"
              >
                Create Room (Host)
              </button>
            </div>

            {/* Join Game Option */}
            <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">Join With Code</h3>
                  <p className="text-[11px] text-gray-400">
                    Enter your friend&apos;s room code to jump in
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. STREET542"
                  value={inputJoinCode}
                  onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="flex-1 bg-black/60 border border-white/20 rounded-2xl px-3 py-2.5 text-xs text-white uppercase font-mono font-bold tracking-widest placeholder:text-gray-600 focus:outline-none focus:border-[#FFD700]"
                />
                <button
                  onClick={() => handlePlayerJoin()}
                  type="button"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-500 font-mono py-2">
            P2P Broadcast Sync • 4 Tokens Per Gang • Knockout Enabled
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-xl mx-auto">
        <Lobby
          gameType="dice"
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          currentUserId={myId}
          onStart={handleHostStart}
          onReady={handleToggleReady}
          onLeave={handleLeaveRoom}
          minPlayers={2}
        />
        {isHost && players.length < 4 && (
          <div className="px-4 pb-4 max-w-xl mx-auto">
            <button
              onClick={handleAddBot}
              type="button"
              className="w-full py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>+ Add AI Gang Bot ({players.length}/4)</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE MATCH PLAYING PHASE
  const activePlayer = players[turnIndex] || players[0];
  const isMyTurn = activePlayer?.id === myId;
  const myPlayerObj = players.find((p) => p.id === myId);
  const myPlayerColorIndex = players.findIndex((p) => p.id === myId);
  const myColorCfg = PLAYER_COLORS[myPlayerColorIndex >= 0 ? myPlayerColorIndex : 0];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col h-full min-h-[92vh] bg-[#0A0A0A] text-white p-3 select-none justify-between animate-in fade-in">
      {/* MATCH HUD HEADER */}
      <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleLeaveRoom}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-wider">
              ROOM {roomCode}
            </span>
            <div className="text-xs font-black text-white uppercase">Street Ludo</div>
          </div>
        </div>

        {/* Turn Indicator & Timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/60 border border-white/10">
            <Clock className={`w-3.5 h-3.5 ${timer <= 5 ? 'text-red-500 animate-ping' : 'text-[#FFD700]'}`} />
            <span className={`text-xs font-mono font-black ${timer <= 5 ? 'text-red-400' : 'text-white'}`}>
              {timer}s
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            type="button"
            className="p-1.5 rounded-xl bg-white/5 text-gray-400 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#FFD700]" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* EVENT BANNER */}
      <div className="mb-2 p-2 rounded-xl bg-gradient-to-r from-[#181818] to-[#121212] border border-[#FFD700]/30 text-center">
        <p className="text-[11px] font-bold text-gray-200">{eventMessage}</p>
      </div>

      {/* PLAYERS SQUAD BAR */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {players.map((p, idx) => {
          const isCurrent = idx === turnIndex;
          const colorCfg = PLAYER_COLORS[idx % PLAYER_COLORS.length];
          const tokensHome = (tokens[p.id] || []).filter((pos) => pos === TOTAL_TRACK_STEPS).length;

          return (
            <div
              key={p.id}
              className={`p-2 rounded-xl border flex flex-col items-center text-center transition-all ${
                isCurrent
                  ? 'bg-gradient-to-b from-[#201A08] to-[#121212] border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.3)] scale-[1.03]'
                  : 'bg-black/40 border-white/10 opacity-70'
              }`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs mb-1 font-bold border"
                style={{ backgroundColor: colorCfg.color, borderColor: '#fff' }}
              >
                {p.avatar || '🎲'}
              </div>
              <span className="text-[10px] font-black truncate max-w-full text-white">
                {p.name.slice(0, 7)}
              </span>
              <span className="text-[9px] font-mono text-[#FFD700]">
                {tokensHome}/4 Home
              </span>
            </div>
          );
        })}
      </div>

      {/* STREET LUDO CIRCUIT BOARD */}
      <div className="p-3 rounded-3xl bg-[#121212] border-2 border-white/10 shadow-2xl relative flex-1 flex flex-col justify-between my-1">
        {/* Board Track Visualization */}
        <div className="grid grid-cols-7 gap-1.5 p-2 bg-black/60 rounded-2xl border border-white/10">
          {Array.from({ length: TOTAL_TRACK_STEPS }).map((_, stepIdx) => {
            const stepNum = stepIdx + 1;
            const isSafe = SAFE_STEPS.includes(stepNum);

            // Find all tokens currently on this step
            const tokensHere: { playerId: string; playerIndex: number; tokenIndex: number }[] = [];
            players.forEach((p, pIdx) => {
              const pTokens = tokens[p.id] || [0, 0, 0, 0];
              pTokens.forEach((pos, tIdx) => {
                if (pos === stepNum) {
                  tokensHere.push({ playerId: p.id, playerIndex: pIdx, tokenIndex: tIdx });
                }
              });
            });

            return (
              <div
                key={stepNum}
                className={`h-9 rounded-lg border flex flex-col items-center justify-center relative ${
                  isSafe
                    ? 'bg-amber-500/20 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'bg-[#181818] border-white/5'
                }`}
              >
                <span className="text-[8px] font-mono text-gray-500 absolute top-0.5 left-1">
                  {stepNum}
                </span>

                {isSafe && (
                  <Shield className="w-2.5 h-2.5 text-amber-400/60 absolute bottom-0.5 right-0.5" />
                )}

                {/* Tokens Stack */}
                <div className="flex items-center gap-0.5 flex-wrap justify-center">
                  {tokensHere.map((th, i) => {
                    const c = PLAYER_COLORS[th.playerIndex % PLAYER_COLORS.length];
                    const isMyToken = th.playerId === myId;
                    return (
                      <div
                        key={i}
                        onClick={() => isMyTurn && isMyToken && handleMoveToken(th.tokenIndex)}
                        className={`w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] font-black text-black transition-all ${
                          isMyTurn && isMyToken && hasRolled ? 'animate-bounce ring-2 ring-white cursor-pointer' : ''
                        }`}
                        style={{ backgroundColor: c.color }}
                      >
                        {th.tokenIndex + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* MY GANG YARD & TOKEN SELECTION */}
        <div className="mt-3 p-3 rounded-2xl bg-black/60 border border-[#FFD700]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-[#FFD700] tracking-wider">
              Your Gang Tokens ({myColorCfg.name})
            </span>
            <span className="text-[9px] font-mono text-gray-400">
              {hasRolled && isMyTurn ? '👉 Tap a token to move' : 'Roll dice first'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(tokens[myId] || [0, 0, 0, 0]).map((pos, tIdx) => {
              const isHome = pos === TOTAL_TRACK_STEPS;
              const isBase = pos === 0;
              const canMove =
                isMyTurn &&
                hasRolled &&
                ((isBase && diceValue === 6) || (!isBase && pos + diceValue <= TOTAL_TRACK_STEPS));

              return (
                <button
                  key={tIdx}
                  onClick={() => handleMoveToken(tIdx)}
                  disabled={!canMove}
                  type="button"
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                    canMove
                      ? 'bg-[#FFD700]/20 border-[#FFD700] shadow-[0_0_12px_#FFD700] animate-pulse cursor-pointer active:scale-95'
                      : isHome
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 cursor-default'
                      : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-xs font-black text-black"
                    style={{ backgroundColor: myColorCfg.color }}
                  >
                    {tIdx + 1}
                  </div>
                  <span className="text-[9px] font-mono font-bold text-white">
                    {isBase ? 'Base (0)' : isHome ? 'HOME 🏆' : `Step ${pos}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLLER: ROLL DICE BUTTON */}
      <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-between gap-3">
        {/* Animated Dice Cube */}
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-white flex items-center justify-center text-3xl font-black text-black shadow-lg shrink-0 ${
            isRolling ? 'animate-spin' : ''
          }`}
        >
          {diceValue}
        </div>

        {/* Action Button */}
        <button
          onClick={handleRollDice}
          disabled={!isMyTurn || hasRolled || isRolling}
          type="button"
          className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
            isMyTurn && !hasRolled && !isRolling
              ? 'bg-[#FFD700] hover:bg-[#FFD700]/90 text-black shadow-[0_0_20px_rgba(255,215,0,0.4)] active:scale-95 cursor-pointer'
              : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5'
          }`}
        >
          <Dices className="w-4 h-4" />
          <span>
            {isRolling
              ? 'Rolling Dice...'
              : isMyTurn && !hasRolled
              ? 'ROLL DICE NOW!'
              : isMyTurn && hasRolled
              ? 'SELECT TOKEN TO MOVE'
              : `WAITING FOR ${activePlayer?.name?.toUpperCase()}`}
          </span>
        </button>
      </div>

      {/* GAME OVER WINNER MODAL */}
      {winner && phase === 'game_over' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.3)]">
            <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 border-2 border-[#FFD700] mx-auto flex items-center justify-center text-4xl mb-4 shadow-[0_0_20px_#FFD700]">
              🏆
            </div>

            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              STREET LUDO VICTORY!
            </h2>
            <p className="text-xs text-gray-300 mt-1">
              <span className="text-[#FFD700] font-black">{winner.name}</span> moved all 4 tokens into the home goal!
            </p>

            {winner.id === myId && (
              <div className="my-4 py-2.5 px-4 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/40 flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-[#FFD700]" />
                <span className="text-sm font-black text-[#FFD700]">+100 Street Coins Earned</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => {
                  setPhase('lobby');
                  setWinner(null);
                }}
                type="button"
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase transition-all cursor-pointer"
              >
                Back to Lobby
              </button>

              <button
                onClick={handleLeaveRoom}
                type="button"
                className="flex-1 py-3 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase shadow-[0_0_15px_#FFD700] transition-all cursor-pointer active:scale-95"
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
