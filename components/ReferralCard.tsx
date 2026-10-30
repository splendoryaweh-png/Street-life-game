
'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Users,
  Gift,
  Send,
  Share2,
} from 'lucide-react';

interface ReferralCardProps {
  myReferralCode: string;
  referralsCount: number;
  hasClaimedWelcomeBonus: boolean;
  appliedReferralCode: string | null;
  onApplyInviteCode: (code: string) => void;
  onSimulateReferral: () => void;
  onToast: (msg: string) => void;
}

// Confirmed bot username from your Telegram screenshot.
// Change this only if Telegram shows a different active username.
const BOT_USERNAME = 'Streetlifebot_bot';

export function ReferralCard({
  myReferralCode,
  referralsCount,
  hasClaimedWelcomeBonus,
  appliedReferralCode,
  onApplyInviteCode,
  onToast,
}: ReferralCardProps) {
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Generate Telegram Mini App referral link
  const referralLink = myReferralCode
    ? `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(myReferralCode)}`
    : '';

  const handleCopy = async () => {
    if (!referralLink) {
      onToast('Your referral code is not ready yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedCode(true);
      onToast('Referral link copied successfully! 📋');

      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onToast('Unable to copy link. Please try sharing instead.');
    }
  };

  const handleShare = async () => {
    if (!referralLink) {
      onToast('Your referral link is not ready yet.');
      return;
    }

    const shareData = {
      title: 'Join STREET LIFE',
      text: `Join me in STREET LIFE and claim your 520 welcome coins! Use my referral link:`,
      url: referralLink,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          `${shareData.text} ${referralLink}`
        );
        onToast('Invitation copied! Send it to your friends.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      onToast('Unable to share. Please copy your referral link.');
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    const code = inputCode.trim().toUpperCase();

    if (!code) {
      onToast('Please enter a referral code.');
      return;
    }

    onApplyInviteCode(code);
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

        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[10px] font-bold text-[#FFD700] uppercase">
          Earn +100 / Invite
        </div>
      </div>

      {/* Rewards */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
          <span className="text-[10px] text-[#9CA3AF] block">
            Your Reward
          </span>
          <span className="text-sm font-mono font-extrabold text-[#FFD700]">
            +100 Coins
          </span>
          <span className="text-[9px] text-[#9CA3AF] block">
            Per qualified friend
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
          <span className="text-[10px] text-[#9CA3AF] block">
            Friend Gets
          </span>
          <span className="text-sm font-mono font-extrabold text-emerald-400">
            520 Coins
          </span>
          <span className="text-[9px] text-[#9CA3AF] block">
            Welcome reward
          </span>
        </div>
      </div>

      {/* Referral Link */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-white/90 block">
          Your Personal Referral Link:
        </span>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[10px] text-[#FFD700] break-all">
            {referralLink || 'Generating referral link...'}
          </div>

          <button
            onClick={handleCopy}
            type="button"
            disabled={!referralLink}
            className="px-3.5 py-3 rounded-xl bg-[#FFD700] text-black font-bold text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button
          onClick={handleShare}
          type="button"
          disabled={!referralLink}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          Invite Friends on Telegram
        </button>
      </div>

      {/* Apply Referral Code */}
      {!hasClaimedWelcomeBonus ? (
        <form
          onSubmit={handleApply}
          className="space-y-1.5 pt-2 border-t border-white/5"
        >
          <span className="text-[11px] font-semibold text-white/90 flex items-center gap-1">
            <Gift className="w-3 h-3 text-[#FFD700]" />
            Were you invited? Enter inviter code:
          </span>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter referral code"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-white focus:outline-none focus:border-[#FFD700]"
            />

            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[#FFD700] text-black font-bold text-xs flex items-center gap-1 shrink-0"
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
            Welcome bonus claimed
          </div>

          {appliedReferralCode && (
            <span className="font-mono text-[10px] text-white/80">
              Code: {appliedReferralCode}
            </span>
          )}
        </div>
      )}

      {/* Referral Statistics */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
        <span className="text-[#9CA3AF]">
          Hustlers Invited:
          {' '}
          <strong className="text-white font-mono">
            {referralsCount}
          </strong>
        </span>

        <span className="text-[#FFD700] font-bold">
          STREET LIFE
        </span>
      </div>
    </div>
  );
}
