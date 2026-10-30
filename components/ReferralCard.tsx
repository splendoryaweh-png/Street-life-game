
'use client';

import React, { useState } from 'react';
import { Copy, Check, Users, Gift, Sparkles, Send, ExternalLink } from 'lucide-react';

interface ReferralCardProps {
  myReferralCode: string;
  referralsCount: number;
  hasClaimedWelcomeBonus: boolean;
  appliedReferralCode: string | null;
  onApplyInviteCode: (code: string) => void;
  onSimulateReferral: () => void;
  onToast: (msg: string) => void;
}

const BOT_USERNAME = 'Streetlifebot_bot';

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

  const referralLink = myReferralCode
    ? `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(myReferralCode)}`
    : '';

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myReferralCode);
      setCopiedCode(true);
      onToast('Referral code copied! 📋');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onToast('Could not copy referral code.');
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) {
      onToast('Your referral link is not ready yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      onToast('Telegram invitation link copied! 🔗');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onToast('Could not copy invitation link.');
    }
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

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
          <span className="text-[10px] text-[#9CA3AF] block">Your Reward</span>
          <span className="text-sm font-mono font-extrabold text-[#FFD700]">
            +100 Coins
          </span>
          <span className="text-[9px] text-[#9CA3AF] block leading-tight">
            Per friend invited
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
          <span className="text-[10px] text-[#9CA3AF] block">Friend Gets</span>
          <span className="text-sm font-mono font-extrabold text-emerald-400">
            520 Coins
          </span>
          <span className="text-[9px] text-[#9CA3AF] block leading-tight">
            20 + 500 welcome bonus
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-white/90 block">
          Your Personal Referral Code:
        </span>

        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs font-bold text-[#FFD700] tracking-wider select-all">
            {myReferralCode}
          </div>

          <button
            onClick={handleCopyCode}
            type="button"
            className="px-3.5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shrink-0"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/30 p-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[#29B6F6]" />
          <span className="text-[11px] font-bold text-white">
            Your Telegram Invitation Link
          </span>
        </div>

        <p className="text-[10px] text-[#9CA3AF]">
          Friends who open this link will be directed to the STREET LIFE
          Telegram bot with your referral code.
        </p>

        <div className="break-all rounded-lg bg-black/50 border border-white/10 p-2 text-[10px] font-mono text-[#29B6F6]">
          {referralLink}
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold text-xs py-2.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {copiedLink ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copiedLink ? 'Invitation Link Copied' : 'Copy Telegram Invitation Link'}
        </button>

        <a
          href={referralLink || `https://t.me/${BOT_USERNAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-lg border border-[#0088cc]/40 text-[#29B6F6] font-bold text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open STREET LIFE Bot
        </a>
      </div>

      {!hasClaimedWelcomeBonus ? (
        <form
          onSubmit={handleApply}
          className="space-y-1.5 pt-1 border-t border-white/5"
        >
          <span className="text-[11px] font-semibold text-white/90 flex items-center gap-1">
            <Gift className="w-3 h-3 text-[#FFD700]" />
            <span>Were you invited? Enter inviter code:</span>
          </span>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="e.g. SL9K7B2"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#FFD700]"
            />

            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shrink-0"
            >
              <Send className="w-3 h-3" />
              Claim 520
            </button>
          </div>
        </form>
      ) : (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>Welcome bonus claimed (+520 coins)</span>
          </div>

          {appliedReferralCode && (
            <span className="font-mono text-[10px] text-white/80">
              Code: {appliedReferralCode}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
        <span className="text-[#9CA3AF]">
          Hustlers Invited:{' '}
          <strong className="text-white font-mono">
            {referralsCount}
          </strong>
        </span>

        <button
          onClick={onSimulateReferral}
          type="button"
          className="px-2.5 py-1 rounded-md bg-[#FFD700]/15 hover:bg-[#FFD700]/25 text-[#FFD700] text-[10px] font-bold border border-[#FFD700]/30 transition-all flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Simulate 1 Invite (+100)
        </button>
      </div>
    </div>
  );
}
