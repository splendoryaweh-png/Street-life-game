'use client';

import React, { useState } from 'react';
import { Copy, Check, Users, Gift, Sparkles, Send, Link as LinkIcon, Share2 } from 'lucide-react';

interface ReferralCardProps {
  myReferralCode: string;
  referralsCount: number;
  hasClaimedWelcomeBonus: boolean;
  appliedReferralCode: string | null;
  onApplyInviteCode: (code: string) => void;
  onSimulateReferral: () => void;
  onToast: (msg: string) => void;
}

const BOT_USERNAME = "Streetlifebot_bot"; // ✅ Your bot from screenshot

export function ReferralCard({
  myReferralCode,
  referralsCount,
  hasClaimedWelcomeBonus,
  appliedReferralCode,
  onApplyInviteCode,
  onSimulateReferral,
  onToast,
}: ReferralCardProps) {
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ✅ This is the correct link - matches your BotFather screenshot
  const referralLink = `https://t.me/${BOT_USERNAME}?startapp=${myReferralCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myReferralCode);
    setCopiedCode(true);
    onToast('Code copied! 📋');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    onToast('Invite link copied! Use this link to invite. 🔗');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = () => {
    const text = `Join me on Street Life! Use my link and get 520 Coins bonus 🚀\n${referralLink}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      onToast('Please enter a referral code.');
      return;
    }
    onApplyInviteCode(inputCode.trim().toUpperCase());
    setInputCode('');
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#151515] p-4 shadow-xl space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#FFD700]" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            Syndicate Referrals
          </h2>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">
          Earn +100 / Invite
        </div>
      </div>

      {/* Rewards */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
          <span className="text-[10px] text-[#9CA3AF] block">Your Reward</span>
          <span className="text-sm font-mono font-extrabold text-[#FFD700]">+100 Coins</span>
          <span className="text-[9px] text-[#9CA3AF] block leading-tight">Per friend invited</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
          <span className="text-[10px] text-[#9CA3AF] block">Friend Gets</span>
          <span className="text-sm font-mono font-extrabold text-emerald-400">520 Coins</span>
          <span className="text-[9px] text-[#9CA3AF] block leading-tight">20 + 500 welcome bonus</span>
        </div>
      </div>

      {/* Your Code + Full Link */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-white/90 block">Your Personal Referral Code:</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs font-bold text-[#FFD700] tracking-wider select-all">
            {myReferralCode}
          </div>
          <button onClick={handleCopyCode} type="button" className="px-3 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs flex items-center gap-1.5 active:scale-95">
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* ✅ NEW: Full Invite Link */}
        <span className="text-[11px] font-semibold text-white/90 block pt-1">Your Invite Link (
