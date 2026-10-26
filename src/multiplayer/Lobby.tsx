'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  Share2,
  Users,
  Send,
  Crown,
  Wifi,
  Sparkles,
  ArrowLeft,
  Flame,
  Swords,
  ShieldAlert,
  Car,
  Dices,
  Volume2,
  Radio,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  GameType,
  PlayerInRoom,
  ChatMessage,
  copyCode,
  sendChatMessage,
  sendReaction,
  onUpdate,
  getNetworkDot,
} from './multiplayerManager';
import { playClickSound, playCoinSound, playSuccessSound } from '@/lib/sound';

export interface LobbyProps {
  gameType: GameType;
  roomCode: string;
  players: PlayerInRoom[];
  isHost: boolean;
  currentUserId: string;
  onStart: () => void;
  onReady: () => void;
  onLeave: () => void;
  onModeChange?: (mode: string) => void;
  selectedMode?: string;
  minPlayers?: number;
}

const QUICK_CHAT_OPTIONS = ["Come on!", "Let's go!", "Nice shot!", "Ready?"];
const EMOJI_OPTIONS = ['😂', '🔥', '💀', '👍', '👑', '⚡'];

export function Lobby({
  gameType,
  roomCode,
  players,
  isHost,
  currentUserId,
  onStart,
  onReady,
  onLeave,
  onModeChange,
  selectedMode = 'Team vs Bots - 10 Waves',
  minPlayers = 2,
}: LobbyProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeReaction, setActiveReaction] = useState<{ emoji: string; playerId: string } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const currentPlayer = players.find((p) => p.id === currentUserId) || players[0];
  const isReady = currentPlayer?.ready ?? false;
  const canStart = players.length >= 1; // In waves mode, host can even solo or duo vs bots; for pvp min 2

  // Subscribe to real-time chat & reactions via BroadcastChannel
  useEffect(() => {
    const unsubscribe = onUpdate(roomCode, (msg) => {
      if (msg.type === 'chat') {
        const chatData = msg.data as ChatMessage;
        setMessages((prev) => [...prev.slice(-30), chatData]);
        playClickSound();
      } else if (msg.type === 'reaction') {
        const { emoji, timestamp } = msg.data;
        setActiveReaction({ emoji, playerId: msg.playerId });
        setTimeout(() => setActiveReaction(null), 2500);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Code Copy
  const handleCopyCode = async () => {
    playClickSound();
    const success = await copyCode(roomCode);
    if (success) {
      setCopied(true);
      playSuccessSound();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle Share (Telegram WebApp share or Web Share API)
  const handleShare = () => {
    playClickSound();
    const shareText = `🔥 Join my STREET LIFE multiplayer match!\nRoom Code: ${roomCode}\nGame: ${
      gameType === 'war' ? 'Turf War (10 Waves / Last Man Standing)' : gameType === 'race' ? 'Street Race 3D' : 'Street Dice Ludo'
    }`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openTelegramLink) {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
      (window as any).Telegram.WebApp.openTelegramLink(tgUrl);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Street Life Multiplayer',
        text: shareText,
        url: shareUrl,
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  // Send message
  const handleSendChat = (textToSend?: string) => {
    const text = (textToSend ?? chatInput).trim();
    if (!text) return;

    playClickSound();
    sendChatMessage(roomCode, currentUserId, currentPlayer?.name || 'Street Hustler', text);
    setMessages((prev) => [
      ...prev.slice(-30),
      {
        id: `local_${Date.now()}`,
        playerId: currentUserId,
        playerName: currentPlayer?.name || 'You',
        text,
        timestamp: Date.now(),
      },
    ]);

    if (!textToSend) {
      setChatInput('');
    }
  };

  // Send floating emoji reaction
  const handleSendReaction = (emoji: string) => {
    playClickSound();
    sendReaction(roomCode, currentUserId, emoji);
    setActiveReaction({ emoji, playerId: currentUserId });
    setTimeout(() => setActiveReaction(null), 2500);
  };

  const getGameBadge = () => {
    switch (gameType) {
      case 'war':
        return { label: 'TURF WAR MULTIPLAYER', icon: <Swords className="w-5 h-5 text-red-500" />, color: 'from-red-600 to-amber-600' };
      case 'race':
        return { label: 'STREET RACE MULTIPLAYER', icon: <Car className="w-5 h-5 text-amber-400" />, color: 'from-amber-500 to-yellow-600' };
      case 'dice':
        return { label: 'STREET DICE (LUDO) MULTIPLAYER', icon: <Dices className="w-5 h-5 text-emerald-400" />, color: 'from-emerald-500 to-teal-600' };
    }
  };

  const badge = getGameBadge();

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col h-full min-h-[90vh] bg-[#0A0A0A] text-white p-4 select-none animate-in fade-in duration-300">
      {/* TOP HEADER: ROOM CODE & ACTION BUTTONS */}
      <div className="relative mb-4 p-4 rounded-3xl bg-gradient-to-b from-[#181818] to-[#101010] border-2 border-[#FFD700]/40 shadow-[0_0_25px_rgba(255,215,0,0.15)]">
        {/* Game Title */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center">
              {badge.icon}
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#FFD700] uppercase">
                {badge.label}
              </span>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Multiplayer Lobby
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              playClickSound();
              onLeave();
            }}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black uppercase transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Room Code Display & Copy / Share */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-black/70 border border-[#FFD700]/30 shadow-inner">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-[#FFD700] animate-pulse" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                P2P Room Code
              </div>
              <div className="text-2xl font-black font-mono tracking-widest text-[#FFD700] drop-shadow-[0_0_8px_#FFD700]">
                {roomCode}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyCode}
              type="button"
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(255,215,0,0.4)] active:scale-95 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleShare}
              type="button"
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* MIDDLE: PLAYERS SQUAD LIST */}
      <div className="mb-4 p-4 rounded-3xl bg-[#121212] border border-white/10 shadow-xl flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FFD700]" />
            <span className="text-xs font-black uppercase text-white tracking-wider">
              Connected Hustlers ({players.length}/{gameType === 'war' ? 6 : 4})
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Real-time Broadcast Sync
          </span>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          {players.map((player) => {
            const isMe = player.id === currentUserId;
            const isHostPlayer = player.ready && player.avatar === '👑';
            const dot = getNetworkDot(player.latency || 30);
            const dotBg =
              dot === 'green' ? 'bg-emerald-400' : dot === 'yellow' ? 'bg-amber-400' : 'bg-red-500';

            return (
              <div
                key={player.id}
                className={`p-3 rounded-2xl border transition-all relative overflow-hidden flex items-center justify-between ${
                  isMe
                    ? 'bg-gradient-to-r from-[#201A06] to-[#141414] border-[#FFD700]/60 shadow-[0_0_15px_rgba(255,215,0,0.15)]'
                    : 'bg-black/40 border-white/10'
                }`}
              >
                {/* Floating Reaction Bubble */}
                {activeReaction && activeReaction.playerId === player.id && (
                  <div className="absolute top-1 right-2 animate-bounce text-2xl z-20 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                    {activeReaction.emoji}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {/* Avatar Circle */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-white/20 relative shadow-inner"
                    style={{ backgroundColor: player.color ? `${player.color}25` : '#FFD70025' }}
                  >
                    <span>{player.avatar || '😎'}</span>
                    {player.avatar === '👑' && (
                      <Crown className="w-3.5 h-3.5 text-[#FFD700] absolute -top-1 -right-1 fill-[#FFD700]" />
                    )}
                  </div>

                  {/* Player Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white truncate max-w-[110px]">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-[#FFD700] text-black">
                          YOU
                        </span>
                      )}
                      {player.isBot && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          BOT
                        </span>
                      )}
                    </div>

                    {/* Network Latency Dot & Status */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${dotBg} animate-pulse`} />
                      <span className="text-[10px] font-mono text-gray-400">
                        {player.latency || 28}ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ready Status Badge */}
                <div>
                  {player.ready ? (
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-xl bg-white/5 text-gray-400 border border-white/10">
                      Waiting...
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CHAT BOX */}
        <div className="flex-1 flex flex-col bg-black/60 rounded-2xl border border-white/10 p-3 min-h-[160px] max-h-[220px]">
          {/* Messages list */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-gray-500 italic">
                Chat with your squad before the match begins...
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="text-xs flex items-baseline gap-1.5">
                  <span className="font-black text-[#FFD700] shrink-0">{m.playerName}:</span>
                  <span className="text-gray-200 break-words">{m.text}</span>
                  {m.emoji && <span className="text-base">{m.emoji}</span>}
                </div>
              ))
            )}
          </div>

          {/* Quick Chat Buttons */}
          <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar shrink-0 border-t border-white/5 mt-2">
            {QUICK_CHAT_OPTIONS.map((phrase) => (
              <button
                key={phrase}
                onClick={() => handleSendChat(phrase)}
                type="button"
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white text-[10px] font-bold whitespace-nowrap border border-white/10 transition-all cursor-pointer active:scale-95"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Emoji Reactions & Text Input */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5 shrink-0">
            {/* Emojis */}
            <div className="flex items-center gap-1">
              {EMOJI_OPTIONS.map((emo) => (
                <button
                  key={emo}
                  onClick={() => handleSendReaction(emo)}
                  type="button"
                  className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-sm active:scale-125 transition-all cursor-pointer"
                >
                  {emo}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex-1 flex items-center gap-1 bg-white/5 rounded-xl px-2.5 py-1 border border-white/10">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChat();
                }}
                placeholder="Type message..."
                maxLength={80}
                className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => handleSendChat()}
                type="button"
                disabled={!chatInput.trim()}
                className="p-1 rounded-lg text-[#FFD700] hover:bg-[#FFD700]/20 disabled:text-gray-600 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: HOST MODE SELECTOR & START / READY BUTTON */}
      <div className="p-4 rounded-3xl bg-gradient-to-t from-[#151515] to-[#101010] border border-white/10 shadow-2xl">
        {/* TURF WAR MODE SELECTOR (Only Host Can Choose) */}
        {gameType === 'war' && (
          <div className="mb-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-[#FFD700] tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Turf War Mode {isHost ? '(Host Choice)' : '(Locked)'}</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {selectedMode === 'Team vs Bots - 10 Waves' ? 'Co-op Defense' : 'PvP Free For All'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (isHost && onModeChange) {
                    playClickSound();
                    onModeChange('Last Man Standing');
                  }
                }}
                disabled={!isHost}
                type="button"
                className={`p-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 border transition-all ${
                  selectedMode === 'Last Man Standing'
                    ? 'bg-red-500/20 text-red-400 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'bg-black/50 text-gray-400 border-white/10 hover:border-white/20'
                } ${!isHost ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                <Flame className="w-4 h-4 text-red-500" />
                <span>Last Man Standing</span>
              </button>

              <button
                onClick={() => {
                  if (isHost && onModeChange) {
                    playClickSound();
                    onModeChange('Team vs Bots - 10 Waves');
                  }
                }}
                disabled={!isHost}
                type="button"
                className={`p-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 border transition-all ${
                  selectedMode === 'Team vs Bots - 10 Waves'
                    ? 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                    : 'bg-black/50 text-gray-400 border-white/10 hover:border-white/20'
                } ${!isHost ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                <Crown className="w-4 h-4 text-[#FFD700]" />
                <span>Team vs Bots - 10 Waves</span>
              </button>
            </div>
          </div>
        )}

        {/* ACTION BUTTON: HOST START OR PLAYER READY */}
        <div className="flex items-center gap-2">
          {isHost ? (
            <button
              onClick={() => {
                playClickSound();
                onStart();
              }}
              disabled={!canStart}
              type="button"
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                canStart
                  ? 'bg-gradient-to-r from-[#FFD700] to-amber-500 text-black shadow-[0_0_20px_rgba(255,215,0,0.4)] active:scale-95 hover:brightness-110'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <Crown className="w-4 h-4 fill-black" />
              <span>
                {players.length < 2 && selectedMode === 'Last Man Standing'
                  ? 'Waiting For Opponent (Min 2)'
                  : 'START MATCH NOW'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                playClickSound();
                onReady();
              }}
              type="button"
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
                isReady
                  ? 'bg-emerald-500 text-black shadow-[0_0_18px_#10B981]'
                  : 'bg-[#FFD700] text-black shadow-[0_0_18px_#FFD700]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isReady ? 'READY! (Click to Unready)' : "I'M READY TO PLAY"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
