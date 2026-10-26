'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Smile,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Flame,
  Radio,
} from 'lucide-react';
import { playClickSound, playPickupSound, playSuccessSound } from '@/lib/sound';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  team: 'blue' | 'red';
  text: string;
  timestamp: number;
  reactions: Record<string, string[]>; // emoji -> array of senderNames
}

export interface GangChatProps {
  roomCode: string;
  playerId: string;
  playerName: string;
  playerTeam: 'blue' | 'red';
  onToast?: (msg: string) => void;
}

const COMMON_EMOJIS = ['🔥', '💀', '🔫', '💰', '👑', '🚀', '🚔', '💣', '❤️', '👏', '😂', '👀'];

const QUICK_PHRASES = [
  'Cover me! 🛡️',
  'Hijacking car! 🚗',
  'Enemy gang spotted! 💀',
  'Need backup at compound! 🚨',
  'I got your back! 🤝',
  'Regroup here! 📍',
  'Let\'s rule this district! 👑',
];

export function GangChat({
  roomCode,
  playerId,
  playerName,
  playerTeam,
  onToast,
}: GangChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'sys_welcome',
      senderId: 'system',
      senderName: 'DISTRICT RADIO',
      team: 'blue',
      text: `Connected to Gang Frequency [${roomCode}]. Coordinate attacks, call out targets, and rule the streets!`,
      timestamp: Date.now(),
      reactions: { '👑': ['District Central'] },
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId for reaction picker
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);

  // Connect to room BroadcastChannel
  useEffect(() => {
    if (!roomCode) return;

    const channelName = `gangstar_chat_${roomCode}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'NEW_CHAT_MESSAGE') {
        const newMsg: ChatMessage = data.payload;
        if (newMsg.senderId !== playerId) {
          setMessages((prev) => [...prev, newMsg]);
          if (!isOpen) {
            setUnreadCount((c) => c + 1);
          }
          if (soundEnabled) {
            playPickupSound();
          }
        }
      } else if (data.type === 'ADD_CHAT_REACTION') {
        const { messageId, emoji, reactorName } = data.payload;
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;
            const existingReactors = msg.reactions[emoji] || [];
            const hasReacted = existingReactors.includes(reactorName);

            const updatedReactors = hasReacted
              ? existingReactors.filter((name) => name !== reactorName)
              : [...existingReactors, reactorName];

            const newReactions = { ...msg.reactions };
            if (updatedReactors.length === 0) {
              delete newReactions[emoji];
            } else {
              newReactions[emoji] = updatedReactors;
            }

            return { ...msg, reactions: newReactions };
          })
        );
      }
    };

    return () => {
      channel.close();
    };
  }, [roomCode, playerId, isOpen, soundEnabled]);

  // Send a text message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: playerId,
      senderName: playerName,
      team: playerTeam,
      text: trimmed,
      timestamp: Date.now(),
      reactions: {},
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setShowInputEmojiPicker(false);
    playClickSound();

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'NEW_CHAT_MESSAGE',
        payload: newMsg,
      });
    }
  };

  // Toggle reaction on a message
  const handleToggleReaction = (messageId: string, emoji: string) => {
    playClickSound();
    setShowEmojiPicker(null);

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const existingReactors = msg.reactions[emoji] || [];
        const hasReacted = existingReactors.includes(playerName);

        const updatedReactors = hasReacted
          ? existingReactors.filter((name) => name !== playerName)
          : [...existingReactors, playerName];

        const newReactions = { ...msg.reactions };
        if (updatedReactors.length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = updatedReactors;
        }

        return { ...msg, reactions: newReactions };
      })
    );

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'ADD_CHAT_REACTION',
        payload: {
          messageId,
          emoji,
          reactorName: playerName,
        },
      });
    }
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON (Always visible in-game top right) */}
      {!isOpen && (
        <button
          onClick={() => {
            playClickSound();
            setIsOpen(true);
            setUnreadCount(0);
          }}
          type="button"
          className="fixed top-16 right-3 z-40 px-3 py-2 rounded-2xl bg-black/85 border-2 border-[#FFD700]/70 text-white shadow-[0_0_20px_rgba(255,215,0,0.3)] backdrop-blur-md flex items-center gap-2 active:scale-95 transition-all hover:brightness-110 cursor-pointer pointer-events-auto"
        >
          <div className="relative">
            <Radio className="w-4 h-4 text-[#FFD700] animate-pulse" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-red-600 text-[9px] font-black text-white animate-bounce">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-white">
            GANG CHAT
          </span>
        </button>
      )}

      {/* EXPANDED CHAT PANEL */}
      {isOpen && (
        <div className="fixed top-14 right-3 z-40 w-80 sm:w-96 max-h-[75vh] flex flex-col rounded-3xl bg-[#0C0E17]/95 border-2 border-[#FFD700]/60 shadow-[0_0_35px_rgba(0,0,0,0.8)] backdrop-blur-xl pointer-events-auto animate-in slide-in-from-right-5 duration-200">
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700]">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                  <span>ROOM {roomCode} FREQUENCY</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    LIVE
                  </span>
                </h3>
                <p className="text-[10px] text-gray-400">Real-time Gang Communication</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundEnabled((v) => !v)}
                type="button"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                title={soundEnabled ? 'Mute Chat Sound' : 'Enable Chat Sound'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#FFD700]" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
              </button>
              <button
                onClick={() => {
                  playClickSound();
                  setIsOpen(false);
                }}
                type="button"
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Phrases Strip */}
          <div className="px-2.5 py-1.5 bg-black/40 border-b border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                onClick={() => {
                  setInputText(phrase);
                }}
                type="button"
                className="shrink-0 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-gray-300 hover:text-white transition-all active:scale-95"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[38vh] text-left text-xs">
            {messages.map((msg) => {
              const isMe = msg.senderId === playerId;
              const isSystem = msg.senderId === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="p-2.5 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/30 text-center">
                    <p className="text-[11px] text-[#FFD700] font-semibold">{msg.text}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono">
                    <span
                      className={`font-black ${
                        msg.team === 'blue' ? 'text-sky-400' : 'text-red-400'
                      }`}
                    >
                      {msg.senderName} {isMe ? '(You)' : ''}
                    </span>
                    <span className="text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`relative p-2.5 rounded-2xl max-w-[85%] break-words leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-amber-500/20 to-[#FFD700]/20 border border-[#FFD700]/60 text-white rounded-tr-none'
                        : msg.team === 'blue'
                        ? 'bg-sky-950/40 border border-sky-500/40 text-white rounded-tl-none'
                        : 'bg-red-950/40 border border-red-500/40 text-white rounded-tl-none'
                    }`}
                  >
                    <p className="text-xs">{msg.text}</p>

                    {/* Reactions Display */}
                    {Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/10">
                        {Object.entries(msg.reactions).map(([emoji, reactors]) => {
                          const hasMyReaction = reactors.includes(playerName);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              type="button"
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                                hasMyReaction
                                  ? 'bg-[#FFD700]/30 border border-[#FFD700] text-white'
                                  : 'bg-white/10 border border-white/10 text-gray-300 hover:bg-white/20'
                              }`}
                              title={reactors.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="text-[9px]">{reactors.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Hover Reaction Trigger */}
                    <button
                      onClick={() =>
                        setShowEmojiPicker((curr) => (curr === msg.id ? null : msg.id))
                      }
                      type="button"
                      className="absolute -top-2.5 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-[#181A24] border border-white/20 text-gray-300 hover:text-white shadow transition-all cursor-pointer"
                      title="React with Emoji"
                    >
                      <Smile className="w-3 h-3 text-[#FFD700]" />
                    </button>
                  </div>

                  {/* Emoji Reaction Bar Popup */}
                  {showEmojiPicker === msg.id && (
                    <div className="p-1.5 rounded-2xl bg-[#181A24] border border-[#FFD700]/50 shadow-xl flex items-center gap-1 mt-1 z-20 animate-in zoom-in-95">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          type="button"
                          className="hover:scale-125 transition-transform p-1 text-sm cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowEmojiPicker(null)}
                        type="button"
                        className="p-1 text-gray-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Input Emojis Bar */}
          {showInputEmojiPicker && (
            <div className="p-2 border-t border-white/10 bg-black/60 flex flex-wrap gap-1.5 justify-center">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputText((prev) => prev + emoji);
                    setShowInputEmojiPicker(false);
                  }}
                  type="button"
                  className="text-base hover:scale-125 transition-transform p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t border-white/10 bg-black/50 flex items-center gap-1.5"
          >
            <button
              onClick={() => setShowInputEmojiPicker((v) => !v)}
              type="button"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFD700] transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send radio message..."
              className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#FFD700] text-black disabled:opacity-40 transition-all font-black active:scale-95 cursor-pointer shadow-md shadow-[#FFD700]/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
