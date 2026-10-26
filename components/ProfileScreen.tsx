'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TelegramUser, UserGameState, NavTab } from '@/types/game';
import {
  Copy,
  Check,
  Shield,
  Clock,
  Mail,
  Lock,
  ReceiptText,
  KeyRound,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Globe,
  Headphones,
  HelpCircle,
  FileText,
  Info,
  X,
  Send,
  Sparkles,
  CheckCircle2,
  Wallet,
  CheckSquare,
  Tv,
  Gift,
  Flame,
} from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import { useLanguage, LanguageCode } from '@/src/contexts/LanguageContext';
import {
  ADMIN_EMAIL,
  getDaysRemainingOnRent,
  isStudioRentExpired,
  setUserEmail,
} from '@/lib/storage';

interface ProfileScreenProps {
  gameState: UserGameState;
  telegramUser: TelegramUser | null;
  onOpenAdmin: () => void;
  onOpenTransactions: () => void;
  onToast: (msg: string) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export function ProfileScreen({
  gameState,
  telegramUser,
  onOpenAdmin,
  onOpenTransactions,
  onToast,
  onNavigateTab,
}: ProfileScreenProps) {
  const { language, setLanguage, languages, t } = useLanguage();
  const [activeModal, setActiveModal] = useState<
    'settings' | 'support' | 'how_to_play' | 'terms' | 'privacy' | 'about' | null
  >(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || gameState.userEmail || '';
    }
    return gameState.userEmail || '';
  });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userEmail') || '';
      return stored.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    }
    return false;
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminLoginInput, setAdminLoginInput] = useState<string>('');
  const [longPressProgress, setLongPressProgress] = useState<number>(0);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const displayName = telegramUser?.first_name
    ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim()
    : 'Street Hustler (Guest)';
  const username = telegramUser?.username ? `@${telegramUser.username}` : 'No Telegram handle';
  const userId = telegramUser?.id ? String(telegramUser.id) : 'STREET-GUEST-001';
  const referralLink = `https://t.me/StreetLifeBot?start=${gameState.myReferralCode}`;

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
      onToast(`Copied ${type === 'code' ? 'Code' : 'Invite Link'} to clipboard!`);
    }
  };

  // Avatar Long Press (3 seconds secret)
  const handleAvatarPointerDown = () => {
    setLongPressProgress(0);
    const start = Date.now();

    longPressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / 3000) * 100));
      setLongPressProgress(pct);
    }, 100);

    longPressTimerRef.current = setTimeout(() => {
      if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
      setLongPressProgress(0);
      playSuccessSound();
      setShowAdminLoginModal(true);
    }, 3000);
  };

  const handleAvatarPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
    setLongPressProgress(0);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    setUserEmail(clean);
    if (clean === ADMIN_EMAIL.toLowerCase()) {
      setIsAdminUnlocked(true);
      playSuccessSound();
      onToast('Admin identity confirmed! Gold Admin Panel unlocked.');
    } else {
      playClickSound();
      onToast('Email saved to profile.');
    }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = adminLoginInput.trim().toLowerCase();
    if (clean === ADMIN_EMAIL.toLowerCase()) {
      setUserEmail(clean);
      setEmailInput(clean);
      setIsAdminUnlocked(true);
      setShowAdminLoginModal(false);
      playSuccessSound();
      onToast('Admin authenticated!');
      onOpenAdmin();
    } else {
      playClickSound();
      onToast('Invalid admin credentials. Only augustinejackson222@gmail.com has access.');
    }
  };

  const daysRemaining = getDaysRemainingOnRent();
  const isRentExpired = isStudioRentExpired();
  const isAdmin = emailInput.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() || isAdminUnlocked;

  return (
    <div
      className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* PROFILE HEADER CARD */}
      <div className="rounded-3xl bg-[#151515] border border-white/10 p-5 shadow-2xl mb-4">
        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFD700] bg-black flex items-center justify-center shrink-0 shadow-lg shadow-[#FFD700]/20 relative">
            {telegramUser?.photo_url ? (
              <img
                src={telegramUser.photo_url}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xl font-black text-[#FFD700]">SL</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white truncate">{displayName}</h2>
            <p className="text-xs text-gray-400 truncate">{username}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFD700]/15 text-[#FFD700] font-bold">
                ID: {userId}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                Streak: {gameState.dailyStreak}d
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STUDIO RENT COUNTDOWN TIMER */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#1E1B10] via-[#161510] to-[#121212] border border-[#FFD700]/30 flex items-center justify-between mb-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">
              Studio Rent Status
            </span>
            <span className="text-sm font-black text-[#FFD700]">
              {isRentExpired ? 'Rent Expired 🔒' : `Rent expires in ${daysRemaining} days`}
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
            isRentExpired
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {isRentExpired ? 'Locked' : 'Active 30d'}
        </span>
      </div>

      {/* BALANCE & STATS CARDS */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-3xl bg-[#151515] border border-white/10">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Street Coins</span>
          <span className="text-lg font-black text-[#FFD700] font-mono tabular-nums">
            {gameState.streetCoin.toLocaleString()} SC
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-[#151515] border border-white/10">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Studio Tier</span>
          <span className="text-sm font-black text-white">
            Level {gameState.studioLevel || 0} ({gameState.studioLevel === 1 ? '7 Beats' : '4 Beats'})
          </span>
        </div>
      </div>

      {/* EMAIL SETTINGS & ADMIN ACTIVATION */}
      <div className="p-4 rounded-3xl bg-[#151515] border border-white/10 mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#FFD700]" />
          <h3 className="text-xs font-black uppercase text-white tracking-wider">
            Email & Identity (Admin Link)
          </h3>
        </div>

        <form onSubmit={handleSaveEmail} className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter your email"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase active:scale-95 transition-all"
          >
            Save
          </button>
        </form>

        <p className="text-[10px] text-gray-400">
          Save your personal email to receive system rewards, updates, and notifications.
        </p>
      </div>

      {/* SYNDICATE REFERRALS */}
      <div className="p-4 rounded-3xl bg-[#151515] border border-white/10 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-white tracking-wider">
            Syndicate Invite Code
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            Invited: {gameState.referralsCount || 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-black border border-white/10 font-mono text-sm text-[#FFD700] font-black text-center tracking-widest">
            {gameState.myReferralCode}
          </div>
          <button
            onClick={() => copyToClipboard(gameState.myReferralCode, 'code')}
            type="button"
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 active:scale-95 transition-all"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={() => copyToClipboard(referralLink, 'link')}
          type="button"
          className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Shareable Telegram Link'}</span>
        </button>
      </div>

      {/* QUICK FEATURE SHORTCUTS */}
      <div className="mb-4 space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">
          Hustle Empire Modules
        </span>
        <div className="grid grid-cols-2 gap-2">
          {onNavigateTab && (
            <button
              onClick={() => {
                playClickSound();
                onNavigateTab('BANK');
              }}
              type="button"
              className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 hover:from-amber-500/20 border border-[#FFD700]/30 text-left active:scale-95 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <Wallet className="w-4 h-4 text-[#FFD700]" />
                <span className="text-[9px] font-mono text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="text-xs font-black text-white">Street Bank</div>
              <div className="text-[10px] text-gray-400">Vault &amp; Payouts</div>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => {
                playClickSound();
                onNavigateTab('TASKS');
              }}
              type="button"
              className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 hover:from-blue-500/20 border border-cyan-500/30 text-left active:scale-95 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <CheckSquare className="w-4 h-4 text-cyan-400" />
                <span className="text-[9px] font-mono text-cyan-300 font-bold">10 TASKS</span>
              </div>
              <div className="text-xs font-black text-white">Tasks &amp; Bounties</div>
              <div className="text-[10px] text-gray-400">Earn up to 5k SC</div>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => {
                playClickSound();
                onNavigateTab('WATCH');
              }}
              type="button"
              className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 hover:from-purple-500/20 border border-purple-500/30 text-left active:scale-95 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <Tv className="w-4 h-4 text-purple-400" />
                <span className="text-[9px] font-mono text-purple-300 font-bold">+10 SC</span>
              </div>
              <div className="text-xs font-black text-white">Watch &amp; Earn</div>
              <div className="text-[10px] text-gray-400">Video Sponsors</div>
            </button>
          )}

          <Link
            href="/daily-free"
            onClick={() => playClickSound()}
            className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:from-emerald-500/20 border border-emerald-500/30 text-left active:scale-95 transition-all cursor-pointer block"
          >
            <div className="flex items-center justify-between mb-1">
              <Gift className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-mono text-emerald-300 font-bold">FREE</span>
            </div>
            <div className="text-xs font-black text-white">Daily Free Vault</div>
            <div className="text-[10px] text-gray-400">Free Nitro &amp; Spins</div>
          </Link>
        </div>
      </div>

      {/* PROFILE NAVIGATION & SYSTEM MENU */}
      <div className="rounded-3xl bg-[#151515] border border-white/10 p-2.5 mb-6 space-y-1 shadow-xl">
        {/* Row 1: Settings & Language (7 Flags Grid) */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('settings');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-[#FFD700] flex items-center justify-center border border-[#FFD700]/30 shadow-sm">
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('settings')} &amp; {t('language')}</span>
              <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                <span>{languages.find((l) => l.code === language)?.flag}</span>
                <span>{languages.find((l) => l.code === language)?.label}</span>
                {language === 'en' && (
                  <span className="px-1.5 py-0.2 rounded bg-[#FFD700]/20 text-[#FFD700] text-[9px] font-black">
                    Default
                  </span>
                )}
                {language === 'pcm' && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                    Pidgin
                  </span>
                )}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Row 2: Support / Contact Us */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('support');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-sm">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('support')}</span>
              <span className="text-[10px] text-cyan-300 font-mono">Telegram @Gammyadmin</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Row 3: How to Play */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('how_to_play');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('how_to_play')}</span>
              <span className="text-[10px] text-gray-400 font-mono">Game rules &amp; rewards</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Row 4: Terms of Service */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('terms');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('terms')}</span>
              <span className="text-[10px] text-gray-400 font-mono">Fair play &amp; community</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Row 5: Privacy Policy */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('privacy');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('privacy')}</span>
              <span className="text-[10px] text-gray-400 font-mono">Player data protection</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Row 6: About Street Life */}
        <button
          onClick={() => {
            playClickSound();
            setActiveModal('about');
          }}
          type="button"
          className="w-full py-3 px-3.5 rounded-2xl hover:bg-white/5 text-xs font-bold text-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center border border-white/10">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-white">{t('about')}</span>
              <span className="text-[10px] text-gray-400 font-mono">Street Life v2.5 Edition</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* ADMIN LOGIN SECRET MODAL (TRIGGERED BY 3S AVATAR LONG PRESS) */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-[#FFD700] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-[#FFD700]">
              <KeyRound className="w-6 h-6" />
              <h3 className="text-base font-black uppercase text-white">SECRET ADMIN LOGIN</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Long-press triggered. Enter the administrator email to unlock system controls:
            </p>

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
              <input
                type="email"
                value={adminLoginInput}
                onChange={(e) => setAdminLoginInput(e.target.value)}
                placeholder="Enter admin email..."
                autoFocus
                className="w-full px-3.5 py-3 rounded-xl bg-black border border-white/20 text-sm text-white focus:outline-none focus:border-[#FFD700]"
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. SETTINGS & LANGUAGE SELECTOR MODAL (7 FLAGS GRID) */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-[#FFD700] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#FFD700]">
                <Globe className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  {t('settings')} &amp; {t('language')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Select your interface language. English is default; tap Pidgin for Naija Pidgin:
            </p>

            {/* 7 Flags Language Selector Grid */}
            <div className="grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {languages.map((item) => {
                const isSelected = language === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      playSuccessSound();
                      setLanguage(item.code);
                      onToast(`Language set to ${item.label} (${item.code.toUpperCase()})`);
                    }}
                    className={`p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#FFD700]/15 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                        : 'bg-black/50 border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.flag}</span>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${isSelected ? 'text-[#FFD700]' : 'text-white'}`}>
                            {item.label}
                          </span>
                          {item.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#FFD700] text-black text-[9px] font-black uppercase tracking-wider">
                              Default
                            </span>
                          )}
                          {item.code === 'pcm' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider">
                              Naija Pidgin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{item.sublabel}</span>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-[#FFD700] text-black flex items-center justify-center font-black">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-white/20" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-3 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 2. SUPPORT & CONTACT US MODAL */}
      {activeModal === 'support' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-cyan-400 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <Headphones className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  {t('support')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Official Support Telegram Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-400/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/20 border border-cyan-400/50 text-cyan-300 mx-auto flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                <Send className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-sm font-black text-white">Direct Telegram Support</h4>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  Reach our dedicated administrator directly on Telegram.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  window.open('https://t.me/Gammyadmin', '_blank');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Contact Support on Telegram @Gammyadmin
              </button>

              <span className="text-[10px] text-gray-400 font-mono block">
                Official Telegram handle: <span className="text-cyan-300 font-bold">@Gammyadmin</span>
              </span>
            </div>

            {/* Small FAQ Section */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-[#FFD700]">
                <Sparkles className="w-4 h-4" />
                <h5 className="text-xs font-black uppercase text-white tracking-wide">
                  FAQ: How to earn?
                </h5>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-semibold">
                Win games and tap <span className="text-[#FFD700] font-black">{t('watch_earn')}</span>
              </p>
              <p className="text-[11px] text-gray-400 leading-normal">
                Compete across Street Races, Courier missions, Turf Wars, and Dice circuits to stack coins. Tap the Watch tab to collect instant coin rewards daily!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 3. HOW TO PLAY MODAL */}
      {activeModal === 'how_to_play' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-emerald-500/50 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <HelpCircle className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  {t('how_to_play')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                <h5 className="font-black text-[#FFD700] uppercase text-[11px] mb-1">1. Play Street Games</h5>
                <p className="text-[11px] text-gray-400">
                  Compete in 3D Street Racing, Okada Courier delivery, Arcade Galaxy Shooter, Turf War Brawler, and mini-games to win Street Coins.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                <h5 className="font-black text-[#FFD700] uppercase text-[11px] mb-1">2. Earn Watch Rewards</h5>
                <p className="text-[11px] text-gray-400">
                  Tap {t('watch_earn')} on the Watch screen to grab instant coin bundles with daily multipliers up to 3x.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                <h5 className="font-black text-[#FFD700] uppercase text-[11px] mb-1">3. Record Freestyle Hits</h5>
                <p className="text-[11px] text-gray-400">
                  Rent or upgrade your Music Studio. Pick an unlocked beat, record vocals, and upload your track to the street charts.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                <h5 className="font-black text-[#FFD700] uppercase text-[11px] mb-1">4. Build Your Syndicate</h5>
                <p className="text-[11px] text-gray-400">
                  Invite fellow hustlers using your referral code to unlock welcome bonuses and passive reward cuts.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* 4. TERMS OF SERVICE MODAL */}
      {activeModal === 'terms' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-purple-500/50 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-purple-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  {t('terms')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-[11px] text-gray-300 leading-relaxed">
              <p>
                Welcome to Street Life. By accessing or playing the game, you agree to these standard gameplay terms:
              </p>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">1. Fair Play &amp; Sportsmanship</h5>
                <p className="text-gray-400">
                  All players must compete fairly in single player and multiplayer matches. Exploitation or unauthorized automation is strictly prohibited.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">2. In-Game Economy &amp; Coins</h5>
                <p className="text-gray-400">
                  Street Coins (SC) are virtual in-game points used for progression, studio upgrades, car garages, and leaderboards. They do not constitute securities.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">3. Account Responsibility</h5>
                <p className="text-gray-400">
                  You are responsible for maintaining your device access and Telegram account session.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* 5. PRIVACY POLICY MODAL */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-cyan-400/50 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  {t('privacy')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-[11px] text-gray-300 leading-relaxed">
              <p>
                Your privacy and data safety are fundamental to our architecture:
              </p>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">Local Data Storage</h5>
                <p className="text-gray-400">
                  Game save data, sound settings, inventory, and language selections are safely stored in your local browser sandbox.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">Telegram Authentication</h5>
                <p className="text-gray-400">
                  Telegram user identifiers are used solely for leaderboard display and verification of game achievements.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                <h5 className="font-black text-white uppercase text-[10px]">No Data Selling</h5>
                <p className="text-gray-400">
                  We never sell, rent, or distribute personal information to third parties.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 6. ABOUT STREET LIFE MODAL */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#181818] border-2 border-[#FFD700] p-5 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-[#FFD700] text-black mx-auto flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(255,215,0,0.4)]">
              SL
            </div>

            <div>
              <h3 className="text-base font-black uppercase text-white tracking-wider">
                STREET LIFE
              </h3>
              <span className="text-[10px] font-mono text-[#FFD700] font-bold">
                Edition v2.5 • Dark Luxury Urban Hustle
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Street Life brings high-energy urban hustle, 3D street racing, courier okada runs, arcade galaxy battles, and music studio recording directly to your fingertips.
            </p>

            <div className="p-3 rounded-2xl bg-black/60 border border-white/10 text-[10px] font-mono text-gray-400 text-left space-y-1">
              <div>Version: <span className="text-white font-bold">2.5.0</span></div>
              <div>Platform: <span className="text-white font-bold">Web &amp; Telegram Mini App</span></div>
              <div>Support: <span className="text-cyan-300 font-bold">@Gammyadmin</span></div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase cursor-pointer"
            >
              Back to Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
