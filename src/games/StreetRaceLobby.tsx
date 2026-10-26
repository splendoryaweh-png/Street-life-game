'use client';

import React, { useState, useEffect } from 'react';
import {
  Flag,
  Users,
  Copy,
  Check,
  Play,
  ArrowLeft,
  Crown,
  Sparkles,
  Clock,
  Coins,
  Flame,
  Radio,
  Zap,
  Gauge,
  Shield,
  Volume2,
  Trophy,
} from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface RaceCarSkin {
  id: string;
  name: string;
  color: string;
  accent: string;
  topSpeed: number; // km/h
  handling: number; // 1-10
  nitroBoost: number; // 1-10
}

export const RACE_CARS: RaceCarSkin[] = [
  {
    id: 'crimson_fury',
    name: 'Crimson Fury',
    color: '#DC2626',
    accent: '#EF4444',
    topSpeed: 180,
    handling: 8,
    nitroBoost: 9,
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    color: '#06B6D4',
    accent: '#22D3EE',
    topSpeed: 175,
    handling: 9,
    nitroBoost: 8,
  },
  {
    id: 'viper_gold',
    name: 'Viper Gold',
    color: '#F59E0B',
    accent: '#FBBF24',
    topSpeed: 185,
    handling: 7,
    nitroBoost: 9,
  },
  {
    id: 'midnight_stealth',
    name: 'Midnight Stealth',
    color: '#4F46E5',
    accent: '#818CF8',
    topSpeed: 178,
    handling: 8,
    nitroBoost: 8,
  },
];

export interface RaceLobbyPlayer {
  id: string;
  name: string;
  carSkin: RaceCarSkin;
  avatar: string;
  isHost: boolean;
  ready: boolean;
  ping: number;
}

interface StreetRaceLobbyProps {
  onBack: () => void;
  onStartRace: (roomCode: string, isHost: boolean, selectedCar: RaceCarSkin, players: RaceLobbyPlayer[]) => void;
  currentCoins: number;
  initialRoomCode?: string;
  onToast: (msg: string) => void;
}

export const StreetRaceLobby: React.FC<StreetRaceLobbyProps> = ({
  onBack,
  onStartRace,
  currentCoins,
  initialRoomCode,
  onToast,
}) => {
  const [roomCode, setRoomCode] = useState<string>(
    initialRoomCode || `RACE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );
  const [joinInputCode, setJoinInputCode] = useState('');
  const [isJoinedRoom, setIsJoinedRoom] = useState(false);
  const [isHost, setIsHost] = useState(true);
  const [selectedCar, setSelectedCar] = useState<RaceCarSkin>(RACE_CARS[0]);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // My player
  const [myId] = useState<string>(() => 'racer_' + Math.random().toString(36).substring(2, 8));
  const [players, setPlayers] = useState<RaceLobbyPlayer[]>([]);

  // Setup lobby channel
  useEffect(() => {
    if (!isJoinedRoom) return;

    const channelName = `streetrace_lobby_${roomCode.toUpperCase().trim()}`;
    const channel = new BroadcastChannel(channelName);

    // Broadcast my presence
    const broadcastMyPresence = (readyStatus = isReady) => {
      channel.postMessage({
        type: 'PLAYER_JOINED',
        player: {
          id: myId,
          name: isHost ? 'Host Driver (You)' : 'Racer (You)',
          carSkin: selectedCar,
          avatar: isHost ? '🏎️' : '🏁',
          isHost,
          ready: readyStatus,
          ping: Math.floor(Math.random() * 20 + 15),
        },
      });
    };

    broadcastMyPresence();

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PLAYER_JOINED') {
        setPlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== data.player.id);
          return [...filtered, data.player];
        });
        // Respond with own state so new joiner sees us
        broadcastMyPresence();
      } else if (data.type === 'READY_TOGGLE') {
        setPlayers((prev) =>
          prev.map((p) => (p.id === data.playerId ? { ...p, ready: data.ready } : p))
        );
      } else if (data.type === 'START_RACE_SIGNAL') {
        playSuccessSound();
        onStartRace(roomCode, false, selectedCar, data.players);
      }
    };

    return () => {
      channel.close();
    };
  }, [isJoinedRoom, roomCode, myId, isHost, selectedCar, isReady, onStartRace]);

  // Handle Create Room
  const handleCreateRoom = () => {
    const code = `RACE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setRoomCode(code);
    setIsHost(true);
    setIsJoinedRoom(true);
    setIsReady(true);
    setPlayers([
      {
        id: myId,
        name: 'Host Driver (You)',
        carSkin: selectedCar,
        avatar: '🏎️',
        isHost: true,
        ready: true,
        ping: 18,
      },
    ]);
    playClickSound();
    onToast(`Race Room Created: ${code}`);
  };

  // Handle Join with Code
  const handleJoinWithCode = () => {
    if (!joinInputCode.trim()) {
      onToast('Enter a valid 4-character Room Code');
      return;
    }
    const cleanCode = joinInputCode.toUpperCase().trim();
    setRoomCode(cleanCode);
    setIsHost(false);
    setIsJoinedRoom(true);
    setIsReady(false);
    setPlayers([
      {
        id: myId,
        name: 'Challenger (You)',
        carSkin: selectedCar,
        avatar: '🏁',
        isHost: false,
        ready: false,
        ping: 24,
      },
    ]);
    playClickSound();
    onToast(`Joined Race Room ${cleanCode}!`);
  };

  // Handle Quick Match (Random Join)
  const handleQuickMatch = () => {
    const randomCode = 'RACE-OPEN';
    setRoomCode(randomCode);
    setIsHost(false);
    setIsJoinedRoom(true);
    setIsReady(true);
    setPlayers([
      {
        id: myId,
        name: 'Speed Demon (You)',
        carSkin: selectedCar,
        avatar: '⚡',
        isHost: false,
        ready: true,
        ping: 20,
      },
    ]);
    playClickSound();
    onToast('Matched into Highway Lobby!');
  };

  // Copy Room Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    playClickSound();
    setTimeout(() => setCopied(false), 2000);
    onToast('Room Code Copied to Clipboard!');
  };

  // Toggle Ready
  const handleToggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    playClickSound();

    const channelName = `streetrace_lobby_${roomCode.toUpperCase().trim()}`;
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({
      type: 'READY_TOGGLE',
      playerId: myId,
      ready: next,
    });
    channel.close();
  };

  // Host starts match
  const handleLaunchRace = () => {
    playSuccessSound();
    const channelName = `streetrace_lobby_${roomCode.toUpperCase().trim()}`;
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({
      type: 'START_RACE_SIGNAL',
      players,
    });
    channel.close();

    onStartRace(roomCode, isHost, selectedCar, players);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col p-4 md:p-6 select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wider flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300">
              <Flag className="w-6 h-6 text-red-500 inline" /> STREET RACE MULTIPLAYER
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              7KM Curved Highway Endurance • 3rd Person Back View • 10-30 Mins Pacing
            </p>
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 px-3.5 py-1.5 rounded-xl shadow-lg shadow-amber-500/10">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-sm font-black text-amber-300">
            {currentCoins.toLocaleString()} SC
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 max-w-6xl mx-auto w-full">
        {/* LEFT COLUMN: ROOM SETUP OR LOBBY SLOTS (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {!isJoinedRoom ? (
            /* CREATE / JOIN ACTIONS */
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" /> MULTIPLAYER ROOM SELECTION
                </span>
                <span className="text-xs text-slate-400">Max 4 Racers</span>
              </div>

              {/* 1. Create Room */}
              <button
                onClick={handleCreateRoom}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:brightness-110 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-[0.99]"
              >
                <Crown className="w-5 h-5 text-amber-300" /> CREATE NEW 7KM RACE ROOM
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-xs font-mono text-slate-500 uppercase">OR</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* 2. Join with Code */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER ROOM CODE (E.G. RACE-A1B2)"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-red-500 uppercase"
                />
                <button
                  onClick={handleJoinWithCode}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-bold text-sm text-white transition-all"
                >
                  Join Code
                </button>
              </div>

              {/* 3. Quick Match */}
              <button
                onClick={handleQuickMatch}
                className="w-full py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 font-bold text-sm text-amber-400 flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="w-4 h-4" /> Quick Match (Public Highway)
              </button>
            </div>
          ) : (
            /* ACTIVE LOBBY ROOM */
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
              {/* Room Code Display */}
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest block">
                    ROOM CODE
                  </span>
                  <span className="text-2xl font-black text-amber-400 font-mono tracking-widest">
                    {roomCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              {/* Racers in Room */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-cyan-400" /> RACERS IN ROOM ({players.length}/4)
                  </span>
                  <span className="text-xs text-emerald-400 font-mono">BROADCAST SYNC ACTIVE</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const player = players[slotIdx];
                    if (player) {
                      return (
                        <div
                          key={player.id}
                          className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                              style={{ backgroundColor: player.carSkin.color + '22', color: player.carSkin.color }}
                            >
                              {player.avatar}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-white">{player.name}</span>
                                {player.isHost && (
                                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                                )}
                              </div>
                              <span className="text-xs text-slate-400 font-mono">
                                {player.carSkin.name}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                player.ready
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {player.ready ? 'READY' : 'WAITING'}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                              {player.ping}ms
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={slotIdx}
                        className="bg-slate-950/40 p-3.5 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-600 font-mono"
                      >
                        + WAITING FOR RACER {slotIdx + 1}...
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ready / Launch Actions */}
              <div className="flex gap-3 pt-2">
                {!isHost && (
                  <button
                    onClick={handleToggleReady}
                    className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                      isReady
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-amber-400 border border-slate-700'
                    }`}
                  >
                    <Check className="w-4 h-4" /> {isReady ? 'READY TO RACE' : 'CLICK WHEN READY'}
                  </button>
                )}

                {isHost && (
                  <button
                    onClick={handleLaunchRace}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:brightness-110 font-black text-slate-950 text-base shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <Play className="w-5 h-5 fill-slate-950" /> START 7KM HIGHWAY RACE
                  </button>
                )}
              </div>
            </div>
          )}

          {/* CAR SELECTOR */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400" /> SELECT YOUR RACING MACHINE
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {RACE_CARS.map((car) => {
                const isSelected = selectedCar.id === car.id;
                return (
                  <div
                    key={car.id}
                    onClick={() => {
                      setSelectedCar(car);
                      playClickSound();
                    }}
                    className={`cursor-pointer p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-full h-8 rounded-lg mb-2 flex items-center justify-center font-black text-xs"
                      style={{ backgroundColor: car.color }}
                    >
                      🏎️
                    </div>
                    <span className="text-xs font-bold text-white block truncate">{car.name}</span>
                    <span className="text-[10px] text-amber-400 font-mono block">
                      {car.topSpeed} km/h max
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RULES & REWARDS (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Rules Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-400">
              <Trophy className="w-5 h-5" />
              <h3 className="text-sm font-black uppercase tracking-wider">7KM HIGHWAY RULES</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">10 to 30 Minute Race Pace:</span>
                  Realistic 7km highway endurance. Avoid crashes, maintain 120-180 km/h, and draft behind rivals.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Highway Curves & Obstacles:</span>
                  Highway bends continuously using dynamic curves. Dodge broken cars, oil slicks, and traffic cones!
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Crash Recovery & Off-Road:</span>
                  Hitting obstacles stops your car for 3s recovery. Driving on the shoulder reduces speed to 20%.
                </div>
              </div>
            </div>

            {/* Payouts */}
            <div className="border-t border-slate-800 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                FINISH LINE STREET COIN REWARDS
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[10px] text-amber-400 font-bold block">1ST PLACE</span>
                  <span className="text-sm font-black text-white font-mono">+500 SC</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold block">2ND PLACE</span>
                  <span className="text-sm font-black text-white font-mono">+300 SC</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold block">3RD PLACE</span>
                  <span className="text-sm font-black text-white font-mono">+100 SC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreetRaceLobby;
