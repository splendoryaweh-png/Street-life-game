'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Shield,
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
  Skull,
  Crosshair,
  Volume2,
} from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export type TurfRole = 'attacker' | 'defender';

export interface TurfLobbyPlayer {
  id: string;
  name: string;
  role: TurfRole;
  avatar: string;
  color: string;
  isHost: boolean;
  ready: boolean;
  ping: number;
}

interface TurfWarLobbyProps {
  onBack: () => void;
  onStartMatch: (roomCode: string, isHost: boolean, role: TurfRole, players: TurfLobbyPlayer[]) => void;
  currentCoins: number;
  initialRoomCode?: string;
  onToast: (msg: string) => void;
}

const ROLES_INFO = {
  attacker: {
    title: 'ATTACKER',
    icon: '⚔️',
    color: '#EF4444',
    badge: 'STRIKE FORCE',
    perk: '+20% Gun Damage & Faster Laser Spread',
    desc: 'Charge enemy waves, breach armored syndicate buses, and hunt hostile bosses.',
  },
  defender: {
    title: 'DEFENDER',
    icon: '🛡️',
    color: '#3B82F6',
    badge: 'FORTRESS GUARD',
    perk: '+35% Max Armor Shield & Zone Health Regeneration',
    desc: 'Protect turf control capture zones, absorb heavy fire, and revive fallen teammates.',
  },
};

const AVATARS = ['🔥', '💀', '👑', '⚡', '🦁', '🎯', '🚀', '💣'];
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export function TurfWarLobby({
  onBack,
  onStartMatch,
  currentCoins,
  initialRoomCode,
  onToast,
}: TurfWarLobbyProps) {
  const [myId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('street_turf_player_id');
      if (!saved) {
        saved = `turf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        localStorage.setItem('street_turf_player_id', saved);
      }
      return saved;
    }
    return `turf_${Date.now()}`;
  });

  const [myName, setMyName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const tg = window.Telegram?.WebApp?.initDataUnsafe?.user?.username;
        if (tg) return `@${tg}`;
      } catch {}
      const saved = localStorage.getItem('streetlife_username');
      if (saved) return saved;
    }
    return `Hustler_${Math.floor(100 + Math.random() * 900)}`;
  });

  const [myRole, setMyRole] = useState<TurfRole>('attacker');
  const [myAvatar, setMyAvatar] = useState<string>(AVATARS[0]);
  const [myColor, setMyColor] = useState<string>(COLORS[0]);

  // Room state
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '');
  const [inputCode, setInputCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [players, setPlayers] = useState<TurfLobbyPlayer[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Auto join if initialRoomCode provided
  useEffect(() => {
    if (initialRoomCode) {
      joinRoomWithCode(initialRoomCode, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomCode]);

  // Connect BroadcastChannel for Lobby Sync
  useEffect(() => {
    if (!roomCode || !inRoom) return;

    const channel = new BroadcastChannel(`turfwar_lobby_${roomCode}`);
    channelRef.current = channel;

    // Announce my presence
    const myPlayerObj: TurfLobbyPlayer = {
      id: myId,
      name: myName,
      role: myRole,
      avatar: myAvatar,
      color: myColor,
      isHost,
      ready: isHost,
      ping: Math.floor(15 + Math.random() * 25),
    };

    channel.postMessage({
      type: 'PLAYER_JOIN',
      player: myPlayerObj,
    });

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PLAYER_JOIN') {
        const newP: TurfLobbyPlayer = data.player;
        if (newP.id !== myId) {
          setPlayers((prev) => {
            const filtered = prev.filter((p) => p.id !== newP.id);
            if (filtered.length >= 4) return filtered;
            return [...filtered, newP];
          });
          onToast(`${newP.name} joined the squad!`);
          playSuccessSound();

          // Host replies with existing players
          if (isHost) {
            channel.postMessage({
              type: 'SYNC_PLAYERS',
              players: [myPlayerObj, ...players.filter((p) => p.id !== newP.id), newP],
            });
          }
        }
      } else if (data.type === 'SYNC_PLAYERS') {
        const synced: TurfLobbyPlayer[] = data.players;
        setPlayers(synced);
      } else if (data.type === 'READY_TOGGLE') {
        setPlayers((prev) =>
          prev.map((p) => (p.id === data.playerId ? { ...p, ready: data.ready } : p))
        );
      } else if (data.type === 'ROLE_CHANGE') {
        setPlayers((prev) =>
          prev.map((p) => (p.id === data.playerId ? { ...p, role: data.role } : p))
        );
      } else if (data.type === 'START_MATCH') {
        playSuccessSound();
        onToast('Match started! Loading 1-Hour Turf Warzone...');
        onStartMatch(roomCode, isHost, myRole, data.players || players);
      } else if (data.type === 'PLAYER_LEAVE') {
        setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      }
    };

    return () => {
      channel.postMessage({ type: 'PLAYER_LEAVE', playerId: myId });
      channel.close();
    };
  }, [roomCode, inRoom, isHost, myId, myName, myRole, myAvatar, myColor, onStartMatch, onToast, players]);

  // Create Room
  const handleCreateRoom = () => {
    playClickSound();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codePart = '';
    for (let i = 0; i < 4; i++) {
      codePart += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    const newCode = `TURF-${codePart}`;
    setRoomCode(newCode);
    setIsHost(true);

    const hostPlayer: TurfLobbyPlayer = {
      id: myId,
      name: myName,
      role: myRole,
      avatar: myAvatar,
      color: myColor,
      isHost: true,
      ready: true,
      ping: 20,
    };
    setPlayers([hostPlayer]);
    setInRoom(true);

    // Save in public active rooms list for random join
    try {
      const active = JSON.parse(localStorage.getItem('turf_public_rooms') || '[]');
      active.unshift({ code: newCode, createdAt: Date.now() });
      localStorage.setItem('turf_public_rooms', JSON.stringify(active.slice(0, 10)));
    } catch {}

    onToast(`Squad Room Created: ${newCode}`);
  };

  // Join Room with Code
  const joinRoomWithCode = (targetCode: string, host = false) => {
    const clean = targetCode.trim().toUpperCase();
    if (!clean) {
      onToast('Enter a valid room code!');
      return;
    }
    playClickSound();
    setRoomCode(clean);
    setIsHost(host);

    const me: TurfLobbyPlayer = {
      id: myId,
      name: myName,
      role: myRole,
      avatar: myAvatar,
      color: myColor,
      isHost: host,
      ready: host,
      ping: Math.floor(18 + Math.random() * 20),
    };
    setPlayers([me]);
    setInRoom(true);
    onToast(`Joined room ${clean}! Connecting...`);
  };

  // Random Join
  const handleRandomJoin = () => {
    playClickSound();
    let foundCode = '';
    try {
      const active = JSON.parse(localStorage.getItem('turf_public_rooms') || '[]');
      const valid = active.filter((r: any) => Date.now() - r.createdAt < 30 * 60 * 1000);
      if (valid.length > 0) {
        foundCode = valid[Math.floor(Math.random() * valid.length)].code;
      }
    } catch {}

    if (foundCode) {
      joinRoomWithCode(foundCode, false);
    } else {
      handleCreateRoom();
    }
  };

  // Ready Toggle
  const handleToggleReady = () => {
    playClickSound();
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === myId) {
          const nextReady = !p.ready;
          if (channelRef.current) {
            channelRef.current.postMessage({
              type: 'READY_TOGGLE',
              playerId: myId,
              ready: nextReady,
            });
          }
          return { ...p, ready: nextReady };
        }
        return p;
      })
    );
  };

  // Role Change
  const handleChangeRole = (role: TurfRole) => {
    playClickSound();
    setMyRole(role);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === myId) {
          if (channelRef.current) {
            channelRef.current.postMessage({
              type: 'ROLE_CHANGE',
              playerId: myId,
              role,
            });
          }
          return { ...p, role };
        }
        return p;
      })
    );
  };

  // Host Starts Match
  const handleHostStart = () => {
    if (!isHost) return;
    playSuccessSound();
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'START_MATCH',
        players,
      });
    }
    onStartMatch(roomCode, true, myRole, players);
  };

  // Copy Room Code
  const handleCopyCode = () => {
    playClickSound();
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    onToast(`Copied room code: ${roomCode}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // -------------------------------------------------------------
  // VIEW 1: LOBBY BROWSER (CREATE / JOIN / RANDOM)
  // -------------------------------------------------------------
  if (!inRoom) {
    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col min-h-[90vh] justify-between text-white animate-in fade-in select-none font-sans">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              type="button"
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-xs font-black">
              <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>{currentCoins.toLocaleString()} SC</span>
            </div>
          </div>

          {/* Banner */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-red-600 to-amber-600 mx-auto flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(239,68,68,0.5)] mb-3 border border-white/20">
              ⚔️
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center justify-center gap-2">
              <span>TURF WAR MULTIPLAYER</span>
            </h1>
            <p className="text-xs text-[#FFD700] font-bold mt-1 tracking-wide">
              UNLIMITED PROGRESS • 1 HOUR PER MATCH • 4 PLAYERS
            </p>
          </div>

          {/* Player Profile & Role Pre-select */}
          <div className="p-4 rounded-3xl bg-[#141622] border border-white/10 shadow-xl mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{myAvatar}</span>
                <input
                  type="text"
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  maxLength={18}
                  className="bg-transparent border-b border-white/20 text-xs font-black uppercase text-white focus:outline-none focus:border-[#FFD700] px-1 py-0.5"
                  placeholder="Your Hustler Name"
                />
              </div>
              <span className="text-[10px] text-gray-400 font-mono uppercase">LOBBY HERO</span>
            </div>

            {/* Avatar & Color Pickers */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-1">
                {AVATARS.slice(0, 5).map((av) => (
                  <button
                    key={av}
                    onClick={() => setMyAvatar(av)}
                    type="button"
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs transition-all ${
                      myAvatar === av ? 'bg-[#FFD700] scale-110 shadow-md' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {COLORS.slice(0, 5).map((col) => (
                  <button
                    key={col}
                    onClick={() => setMyColor(col)}
                    type="button"
                    style={{ backgroundColor: col }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      myColor === col ? 'ring-2 ring-white scale-125' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Role Switcher */}
            <div>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block mb-1.5">
                SELECT 1-HOUR ROLE:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['attacker', 'defender'] as TurfRole[]).map((r) => {
                  const info = ROLES_INFO[r];
                  const isSel = myRole === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleChangeRole(r)}
                      type="button"
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#FFD700]/15 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                          : 'bg-black/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase text-white flex items-center gap-1">
                          <span>{info.icon}</span>
                          <span>{info.title}</span>
                        </span>
                        <span
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                            r === 'attacker' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {info.badge}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-tight line-clamp-2">
                        {info.perk}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action 1: Create Custom Squad Room */}
          <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1C1E2B] to-[#12131C] border border-[#FFD700]/50 shadow-xl mb-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#FFD700]/20 text-[#FFD700] flex items-center justify-center">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white">Create Squad Room (Host)</h3>
                <p className="text-[10px] text-gray-400">Generate 4-player room code & lead the war</p>
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              type="button"
              className="w-full py-3 rounded-2xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#FFD700]/20 active:scale-95 transition-all cursor-pointer"
            >
              CREATE TURF ROOM
            </button>
          </div>

          {/* Action 2: Quick Random Join */}
          <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1A1F2E] to-[#121520] border border-sky-500/40 shadow-xl mb-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white">Quick Random Join</h3>
                <p className="text-[10px] text-gray-400">Drop into any open active city warfare match</p>
              </div>
            </div>
            <button
              onClick={handleRandomJoin}
              type="button"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/30 active:scale-95 transition-all cursor-pointer"
            >
              RANDOM JOIN SQUAD
            </button>
          </div>

          {/* Action 3: Join with Code */}
          <div className="p-3.5 rounded-3xl bg-black/60 border border-white/10 shadow-xl flex items-center gap-2">
            <input
              type="text"
              placeholder="ENTER CODE (TURF-XXXX)"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="flex-1 bg-transparent px-3 py-2 text-xs text-white uppercase font-mono font-bold tracking-widest placeholder:text-gray-600 focus:outline-none"
            />
            <button
              onClick={() => joinRoomWithCode(inputCode, false)}
              type="button"
              className="px-5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-black text-xs uppercase active:scale-95 cursor-pointer"
            >
              JOIN
            </button>
          </div>
        </div>

        {/* Rules Card Footer */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-[10px] text-gray-400 space-y-1 my-3">
          <div className="text-white font-black uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>TURF WAR RULES</span>
          </div>
          <p>• Unlimited Waves: Enemies grow stronger every wave without end.</p>
          <p>• 1 Hour Match: Survive for 3600 seconds to claim the +1,000 SC Vault Bonus.</p>
          <p>• Rewards: +10 SC per kill • +100 SC per wave survived.</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE SQUAD LOBBY ROOM
  // -------------------------------------------------------------
  const allReady = players.every((p) => p.ready);

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col min-h-[90vh] justify-between text-white animate-in zoom-in-95 select-none font-sans">
      <div>
        {/* Header with Exit */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              playClickSound();
              setInRoom(false);
            }}
            type="button"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>LOBBY READY ({players.length}/4)</span>
          </div>
        </div>

        {/* Big Room Code Header */}
        <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1C1E2E] to-[#11121C] border-2 border-[#FFD700] text-center shadow-[0_0_35px_rgba(255,215,0,0.25)] mb-4">
          <span className="text-[10px] text-gray-400 uppercase font-mono tracking-widest block mb-1">
            SQUAD ROOM FREQUENCY
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-black font-mono tracking-wider text-white">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              type="button"
              className="p-2 rounded-2xl bg-[#FFD700] text-black active:scale-95 hover:brightness-110 shadow cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-5 h-5 text-black" /> : <Copy className="w-5 h-5 text-black" />}
            </button>
          </div>
          <p className="text-[11px] text-gray-300 mt-2">
            Share this code with teammates to join before the 1-hour warfare begins!
          </p>
        </div>

        {/* 4 Squad Player Slots */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-gray-400">Squad Members (Max 4)</span>
            <span className="text-[10px] font-mono text-emerald-400">BroadcastChannel P2P</span>
          </div>

          {[0, 1, 2, 3].map((slotIdx) => {
            const p = players[slotIdx];
            if (p) {
              const isMe = p.id === myId;
              const roleInfo = ROLES_INFO[p.role];
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-amber-500/15 to-[#FFD700]/15 border-[#FFD700]'
                      : 'bg-[#141520] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border-2"
                      style={{ borderColor: p.color, backgroundColor: `${p.color}25` }}
                    >
                      {p.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{p.name}</span>
                        {p.isHost && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#FFD700] text-black text-[9px] font-black uppercase">
                            HOST
                          </span>
                        )}
                        {isMe && (
                          <span className="text-[9px] text-[#FFD700] font-mono font-bold">(YOU)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                            p.role === 'attacker'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {roleInfo.icon} {roleInfo.title}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">{p.ping}ms</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {p.ready ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                        READY
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-white/10 text-gray-400 text-[10px] font-bold uppercase">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`empty_${slotIdx}`}
                className="p-3 rounded-2xl border border-dashed border-white/15 bg-black/30 flex items-center justify-center text-gray-500 text-xs font-mono"
              >
                + Empty Squad Slot
              </div>
            );
          })}
        </div>

        {/* Change Role While in Lobby */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-black uppercase">Your 1-Hour Role:</span>
            <span className="text-xs font-black text-[#FFD700] uppercase">
              {ROLES_INFO[myRole].icon} {ROLES_INFO[myRole].title}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['attacker', 'defender'] as TurfRole[]).map((r) => (
              <button
                key={r}
                onClick={() => handleChangeRole(r)}
                type="button"
                className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all ${
                  myRole === r
                    ? 'bg-white/20 text-white border border-[#FFD700]'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {ROLES_INFO[r].icon} {ROLES_INFO[r].title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lobby Action Controls */}
      <div className="space-y-2 pt-2">
        {isHost ? (
          <button
            onClick={handleHostStart}
            type="button"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-[#FFD700] to-yellow-400 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(255,215,0,0.5)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-black" />
            <span>START 1-HOUR TURF WAR (HOST)</span>
          </button>
        ) : (
          <button
            onClick={handleToggleReady}
            type="button"
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${
              players.find((p) => p.id === myId)?.ready
                ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                : 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/30'
            }`}
          >
            {players.find((p) => p.id === myId)?.ready ? 'READY! (WAITING FOR HOST)' : 'PRESS TO BE READY'}
          </button>
        )}

        <div className="text-center text-[10px] text-gray-500 font-mono">
          Unlimited Waves • 1-Hour Match Countdown • 10 SC / Kill
        </div>
      </div>
    </div>
  );
}

export default TurfWarLobby;
