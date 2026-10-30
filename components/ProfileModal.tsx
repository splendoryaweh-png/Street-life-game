
'use client';

import React, { useState, useRef } from 'react';
import { TelegramUser } from '@/types/game';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  ReceiptText,
  Clock,
  Mail,
  Send,
} from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import {
  ADMIN_EMAIL,
  getDaysRemainingOnRent,
  isStudioRentExpired,
  setUserEmail,
} from '@/lib/storage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramUser: TelegramUser | null;
  myReferralCode: string;
  deviceId: string;
  streetCoin: number;
  dailyStreak: number;
  userEmail?: string;
  onOpenTransactions?: () => void;
  onOpenAdmin?: () => void;
}

const BOT_USERNAME = 'Streetlifebot_bot';

export function ProfileModal({
  isOpen,
  onClose,
  telegramUser,
  myReferralCode,
  deviceId,
  streetCoin,
  dailyStreak,
  userEmail: propEmail,
  onOpenTransactions,
  onOpenAdmin,
}: ProfileModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || propEmail || '';
    }
    return propEmail || '';
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

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!isOpen) return null;

  const displayName = telegramUser?.first_name
    ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim()
    : 'Street Hustler (Guest)';
  const username = telegramUser?.username ? `@${telegramUser.username}` : 'No Telegram handle';
  const userId = telegramUser?.id ? String(telegramUser.id) : 'STREET-GUEST-001';

  const referralLink = `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(myReferralCode)}`;

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (error) {
      console.error('Could not copy to clipboard:', error);
    }
  };

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
    } else {
      playClickSound();
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
      if (onOpenAdmin) {
        onClose();
        onOpenAdmin();
      }
    } else {
      playClickSound();
      console.warn('Invalid admin credentials. Only the configured admin email has access.');
    }
  };

  const daysRemaining = getDaysRemainingOnRent();
  const isRentExpired = isStudioRentExpired();
  const isAdmin = emailInput.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() || isAdminUnlocked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#151515] border border-white/10 p-5 shadow-2xl text-left space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close Profile"
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pt-1">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#FFD700] bg-black flex items-center justify-center shrink-0 shadow-lg shadow-[#FFD700]/20 relative">
            {telegramUser?.photo_url ? (
              <img
                src={telegramUser.photo_url}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-lg font-black text-[#FFD700]">SL</span>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{displayName}</h3>
            <p className="text-xs text-[#9CA3AF] truncate">{username}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FFD700]/15 text-[#FFD700] font-bold">
                ID: {userId}
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-gradient-to-r from-[#1E1B10] to-[#141414] border border-[#FFD700]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block font-bold uppercase">
                Studio Rent Status
              </span>
              <span className="text-xs font-black text-[#FFD700]">
                {isRentExpired ? 'Rent Expired 🔒' : `Rent expires in ${daysRemaining} days`}
              </span>
            </div>
          </div>

          <span
            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
              isRentExpired
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isRentExpired ? 'Expired' : 'Active 30d'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-[#9CA3AF] block">Street Coins</span>
            <span className="text-sm font-extrabold text-[#FFD700] font-mono tabular-nums">
              {streetCoin.toLocaleString()} SC
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-[#9CA3AF] block">Daily Streak</span>
            <span className="text-sm font-extrabold text-white font-mono">
              {dailyStreak} Days 🔥
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveEmail} className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>Email Address</span>
            </span>
            {isAdmin && <span className="text-[9px] text-amber-400 font-bold">Admin Verified</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="e.g. yourname@gmail.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FFD700]"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-[#FFD700] hover:text-black text-xs font-bold transition-colors"
            >
              Save
            </button>
          </div>
        </form>

        {onOpenTransactions && (
          <button
            onClick={() => {
              playClickSound();
              onClose();
              onOpenTransactions();
            }}
            type="button"
            className="w-full py-2.5 px-3 rounded-xl bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm shadow-[#FFD700]/10"
          >
            <ReceiptText className="w-4 h-4" />
            <span>View Coin Transactions Ledger</span>
          </button>
        )}

        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-white flex items-center justify-between">
            <span>My Referral Code</span>
            <span className="text-[10px] font-normal text-[#FFD700]">+10 for you / +10 for friend</span>
          </label>

          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/10 font-mono text-xs font-bold text-[#FFD700] tracking-wider select-all">
              {myReferralCode}
            </div>
            <button
              onClick={() => copyToClipboard(myReferralCode, 'code')}
              type="button"
              className="px-3.5 py-2 rounded-xl bg-[#FFD700] text-black font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shrink-0"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            onClick={() => copyToClipboard(referralLink, 'link')}
            type="button"
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center gap-1.5 transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Full Invite Link'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/5 space-y-2">
          <button
            onClick={() => {
              playClickSound();
              window.open('https://t.me/Gammyadmin', '_blank');
            }}
            type="button"
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Contact Support on Telegram @Gammyadmin
          </button>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-[10px] text-gray-300">
            <span className="text-[#FFD700] font-black uppercase">How to earn?</span> Win games and tap <span className="text-[#FFD700] font-black">WATCH +10</span> to earn Street Coins!
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>One Device One Account Verified</span>
          </div>
          <div className="text-[9px] font-mono text-[#9CA3AF]/60 truncate">
            Device ID: {deviceId}
          </div>
        </div>
      </div>
    </div>
  );
}
