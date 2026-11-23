'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserGameState, NavTab } from '@/types/game';
import { claimWatchAdReward, claimWatchMilestoneReward } from '@/lib/storage';
import { showAdsgramRewardedAd } from '@/lib/adsgram';
import { playClickSound, playCoinSound } from '@/lib/sound';
import confetti from 'canvas-confetti';
import {
  Eye,
  Play,
  Clock,
  Sparkles,
  Zap,
  ListChecks,
  CheckCircle2,
  X,
  Gift,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface WatchScreenProps {
  gameState: UserGameState;
  onNavigateTab: (tab: NavTab) => void;
  onToast: (msg: string) => void;
  onBack?: () => void;
}

export function WatchScreen({
  gameState,
  onNavigateTab,
  onToast,
  onBack,
}: WatchScreenProps) {
  const { t } = useLanguage();

  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<5 | 10 | null>(null);
  const adRequestInProgress = useRef(false);

  const [rewardModal, setRewardModal] = useState<{
    isOpen: boolean;
    amount: number;
    multiplier: number;
  }>({
    isOpen: false,
    amount: 10,
    multiplier: 1,
  });

  const [timeUntilReset, setTimeUntilReset] = useState<string>('5h 23m');
  const [boostRemaining, setBoostRemaining] = useState<string | null>(null);

  const adsWatchedToday = gameState.watchCountDaily ?? 0;
  const todayUtc = new Date().toISOString().split('T')[0];
  const claimedMilestonesToday = gameState.lastWatchDate === todayUtc ? (gameState.watchMilestonesClaimedToday || []) : [];
  const maxDailyAds = 33;
  const isLimitReached = adsWatchedToday >= maxDailyAds;

  const currentMultiplier = 1;
  const nextTarget = null;
  const nextMultiplier = null;

  useEffect(() => {
    const updateResetTime = () => {
      const now = new Date();
      // Watch & Earn daily claims are keyed to the UTC date in lib/storage.ts.
      // Keep the displayed countdown aligned with that same reset boundary.
      const nextUtcDay = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )
      );

      const diffMs = nextUtcDay.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor(
        (diffMs % (1000 * 60 * 60)) / (1000 * 60)
      );

      setTimeUntilReset(`${hours}h ${minutes}m`);

      if (gameState.boostUntil && gameState.boostUntil > Date.now()) {
        const boostDiff = gameState.boostUntil - Date.now();
        const bMinutes = Math.floor(boostDiff / 60000);
        const bSeconds = Math.floor((boostDiff % 60000) / 1000);

        setBoostRemaining(
          `${bMinutes}m ${bSeconds < 10 ? '0' : ''}${bSeconds}s`
        );
      } else {
        setBoostRemaining(null);
      }
    };

    updateResetTime();

    const interval = setInterval(updateResetTime, 1000);

    return () => clearInterval(interval);
  }, [gameState.boostUntil]);

  const handleStartAd = async () => {
    // The ref closes the small window before React applies the disabled state.
    if (adRequestInProgress.current) return;

    if (isLimitReached) {
      onToast('Daily limit reached! Come back after reset.');
      return;
    }

    adRequestInProgress.current = true;
    playClickSound();
    setIsPlayingAd(true);

    try {
      // This shared helper resolves only when Adsgram explicitly confirms
      // done === true. Failed, skipped, or incomplete ads reject instead.
      await showAdsgramRewardedAd();

      // Keep the fixed reward and the existing daily limit/boost logic in
      // the storage layer. No reward is granted before verified completion.
      const res = claimWatchAdReward(10);

      if (!res.success) {
        onToast('Daily ad limit reached. No coins were added.');
        return;
      }

      playCoinSound();

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FFFFFF', '#A855F7'],
        });
      } catch {}

      setRewardModal({
        isOpen: true,
        amount: res.reward,
        multiplier: res.multiplier,
      });

      if (res.boostActivated) {
        onToast('🚀 1-Hour 2x Boost Activated!');
      }
    } catch (error) {
      console.error('Adsgram rewarded ad error:', error);
      onToast('The ad was not completed or is unavailable. No coins were added.');
    } finally {
      adRequestInProgress.current = false;
      setIsPlayingAd(false);
    }
  };

  const handleClaimMilestone = async (milestone: 5 | 10) => {
    if (adRequestInProgress.current || isPlayingAd) return;
    if (adsWatchedToday < milestone) return;
    if (claimedMilestonesToday.includes(milestone)) return;
    if (isLimitReached) { onToast(t('watch_daily_limit', 'Daily ad limit reached.')); return; }
    adRequestInProgress.current = true;
    setIsPlayingAd(true);
    try {
      await showAdsgramRewardedAd();
      const result = claimWatchMilestoneReward(milestone);
      if (!result.success) {
        const message = result.reason === 'claimed' ? t('watch_milestone_already_claimed', 'You already claimed this milestone today.') : result.reason === 'locked' ? t('watch_milestone_locked', 'Watch the required ads to unlock this milestone.') : t('watch_daily_limit', 'Daily ad limit reached.');
        onToast(message); return;
      }
      playCoinSound();
      setSelectedMilestone(null);
      setRewardModal({ isOpen: true, amount: result.reward, multiplier: 1 });
      onToast(t('watch_milestone_claimed', 'Milestone reward claimed!'));
      try { confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#FFD700', '#A855F7', '#FFFFFF'] }); } catch {}
    } catch (error) {
      console.error('Watch milestone rewarded ad error:', error);
      onToast(t('watch_ad_incomplete', 'The ad was not completed. No reward was added.'));
    } finally {
      adRequestInProgress.current = false;
      setIsPlayingAd(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none flex flex-col space-y-4 animate-fadeIn">

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={() => {
                playClickSound();
                onBack();
              }}
              type="button"
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#FFD700] cursor-pointer shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30">
                <Eye className="w-5 h-5 text-[#FFD700]" />
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase">
                {t('watch_screen_title', 'WATCH & EARN')}
              </h1>
            </div>

            <p className="text-xs text-[#9CA3AF] font-medium tracking-wide mt-0.5">
              {t('watch_screen_subtitle', 'Watch short video sponsors • Earn instant Street Coins')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {t('watch_ad_counter', 'AD COUNTER')}
          </span>

          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#FFD700] text-black shadow-[0_0_8px_rgba(255,215,0,0.5)]">
            Ad {Math.min(33, adsWatchedToday + 1)}/33
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#16161C] to-[#0D0D10] border border-[#FFD700]/30 p-4 shadow-lg">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#FFD700]" />

            <span className="font-extrabold text-white text-sm">
              {t('watch_ad_number', 'Ad')} {Math.min(33, adsWatchedToday + 1)}/33 ({adsWatchedToday}/{maxDailyAds} {t('watch_watched_suffix', 'Watched')})
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{t('watch_reset_in', 'Reset in')} {timeUntilReset}</span>
          </div>
        </div>

        <div className="w-full h-3.5 bg-black/70 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-[#FFD700] to-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.6)] transition-all duration-500"
            style={{
              width: `${Math.min(
                100,
                (adsWatchedToday / maxDailyAds) * 100
              )}%`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 text-gray-300">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>{t('watch_earn_per_video', 'Earn 10 Street Coins per video sponsor')}</span>
          </div>

          <span className="font-mono font-bold text-[#FFD700]">
            {t('watch_coins_per_ad', '+10 Coins / ad')}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <button
          type="button"
          disabled={isLimitReached || isPlayingAd}
          onClick={handleStartAd}
          aria-label={isLimitReached ? t('watch_daily_limit', 'DAILY LIMIT REACHED (33/33)') : t('watch_ad_get_10_sc', 'WATCH AD TO GET 10 SC')}
          className={`group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border-[3px] border-[#E2B522] bg-[radial-gradient(circle_at_50%_18%,#76530D_0%,#49330A_42%,#171207_100%)] p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.24),inset_0_0_30px_rgba(255,215,0,0.10)] transition-all duration-200 touch-manipulation ${isLimitReached || isPlayingAd ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:brightness-110 active:scale-[0.985]'}`}
        >
          <div className="pointer-events-none absolute inset-3 rounded-[1.45rem] border border-[#FFD700]/35" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#FFD700]/10 blur-2xl" />
          <div className="relative z-10 flex w-full flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-[#FFD700]/70 bg-black/35 shadow-[0_0_25px_rgba(255,215,0,0.22)] sm:h-24 sm:w-24">
              <Play className="h-12 w-12 translate-x-0.5 text-[#FFD700] fill-[#FFD700]/20 sm:h-16 sm:w-16" strokeWidth={2.8} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.28em] text-[#FFE58A] sm:text-sm">
              {t('watch_screen_title', 'WATCH & EARN')}
            </span>
            <span className="mt-2 text-4xl font-black leading-none tracking-tight text-[#FFD700] drop-shadow-[0_2px_10px_rgba(255,215,0,0.35)] sm:text-5xl">
              +10 SC
            </span>
            <span className="mt-3 max-w-[260px] text-base font-black uppercase leading-tight tracking-[0.12em] text-white sm:text-lg">
              {isLimitReached
                ? t('watch_daily_limit', 'DAILY LIMIT REACHED (33/33)')
                : isPlayingAd
                  ? t('watch_loading', 'LOADING ADSGRAM...')
                  : t('watch_ad_get_10_sc', 'WATCH AD TO GET 10 SC')}
            </span>
            <div className="mt-6 w-full max-w-[270px] rounded-2xl border border-[#FFD700]/35 bg-black/35 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-extrabold text-white">
                <span>{t('watch_ad_counter', 'ADS WATCHED')}</span>
                <span className="font-mono text-[#FFD700]">{adsWatchedToday}/{maxDailyAds}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-200 transition-all duration-500"
                  style={{ width: `${Math.min(100, (adsWatchedToday / maxDailyAds) * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#E8D9A5]">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('watch_reset_in', 'Resets in')} {timeUntilReset}</span>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="rounded-2xl bg-[#14141A] border border-[#FFD700]/30 p-4">
        <h3 className="text-xs font-black tracking-wider text-white uppercase mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FFD700]" />
          {t('watch_bonus_multipliers', 'DAILY BONUS MULTIPLIERS')}
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {([5, 10] as const).map((milestone) => {
            const unlocked = adsWatchedToday >= milestone;
            const claimed = claimedMilestonesToday.includes(milestone);
            const isFirst = milestone === 5;
            return (
              <button key={milestone} type="button" onClick={() => { playClickSound(); setSelectedMilestone(milestone); }}
                className={`p-3 rounded-xl border flex flex-col justify-between text-left transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#FFD700] ${unlocked ? (isFirst ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-purple-950/40 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]') : 'bg-black/40 border-white/10'}`}>
                <div className="flex w-full items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-300">{isFirst ? t('watch_milestone_one', 'MILESTONE 1 (5 ADS)') : t('watch_milestone_two', 'MILESTONE 2 (10 ADS)')}</span>
                  {claimed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : unlocked ? <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> : null}
                </div>
                <div className="my-1.5"><div className={`text-xl font-black ${isFirst ? 'text-amber-400' : 'text-purple-400'}`}>+10 SC</div><p className="text-[10px] text-gray-300">{t('watch_milestone_bonus_label', 'Extra milestone reward')}</p></div>
                <span className="text-[9px] font-mono text-gray-300">{claimed ? t('watch_milestone_claimed_short', 'CLAIMED') : unlocked ? t('watch_milestone_ready', 'READY TO CLAIM') : `${adsWatchedToday}/${milestone} ${t('watch_watched_suffix', 'Watched')}`}</span>
                <span className="mt-2 text-[9px] font-bold text-[#FFD700]">{t('watch_tap_for_details', 'TAP FOR DETAILS')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <div
          onClick={() => {
            playClickSound();
            onNavigateTab('TASKS');
          }}
          className="rounded-2xl bg-gradient-to-r from-[#171720] to-[#121217] border border-white/10 hover:border-[#FFD700]/50 p-4 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <ListChecks className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white group-hover:text-[#FFD700] transition-colors">
                  {t('watch_task_title', 'Watch 2 Ads Task')}
                </h4>

                {adsWatchedToday >= 2 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                    {adsWatchedToday}/2
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400">
                {t('watch_task_desc', 'Complete daily challenge in TASKS tab')} • +1,000 S
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FFD700] hover:text-black text-xs font-black uppercase tracking-wider text-gray-200 transition-all"
          >
            OPEN
          </button>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#191624] to-[#110F1B] border border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">
                  {t('watch_boost_title', 'Boost x2 for 1 hour')}
                </h4>

                {boostRemaining ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    ⚡ {boostRemaining}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                    {t('watch_after_five_ads', 'After 5 Ads')}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400">
                {t('watch_boost_desc', 'Double coins in Galaxy Shooter, Street Race & Delivery')}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-amber-400">
              {adsWatchedToday >= 5
                ? t('watch_unlocked', 'UNLOCKED')
                : `${adsWatchedToday}/5`}
            </span>
          </div>
        </div>
      </div>

      {selectedMilestone !== null && (() => {
        const milestone = selectedMilestone;
        const unlocked = adsWatchedToday >= milestone;
        const claimed = claimedMilestonesToday.includes(milestone);
        return (
          <div className="fixed inset-0 z-[260] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C1C24] to-[#0E0E12] border border-[#FFD700]/60 p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.2)]">
              <button type="button" onClick={() => setSelectedMilestone(null)} className="absolute top-3 right-3 p-2 rounded-full bg-white/10 text-gray-300" aria-label={t('studio_close_camera', 'Close')}><X className="w-4 h-4" /></button>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD700]/15 text-[#FFD700]"><Gift className="h-8 w-8" /></div>
              <h3 className="text-lg font-black text-white">{milestone === 5 ? t('watch_milestone_one', 'MILESTONE 1 (5 ADS)') : t('watch_milestone_two', 'MILESTONE 2 (10 ADS)')}</h3>
              <p className="mt-2 text-sm text-gray-300">{t('watch_milestone_details', 'Watch the required number of regular ads to unlock this milestone. Then watch one more rewarded video to claim the bonus.')}</p>
              <div className="mt-4 rounded-xl bg-black/40 border border-white/10 p-3">
                <div className="flex justify-between text-xs text-gray-300"><span>{t('watch_milestone_progress', 'Progress')}</span><strong className="text-white">{Math.min(adsWatchedToday, milestone)}/{milestone}</strong></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#FFD700]" style={{ width: `${Math.min(100, adsWatchedToday / milestone * 100)}%` }} /></div>
                <p className="mt-3 text-sm font-bold text-[#FFD700]">{t('watch_milestone_bonus', 'Milestone bonus: +10 SC')}</p>
                <p className="mt-1 text-[11px] text-gray-400">{t('watch_milestone_ad_note', 'The claim video also earns its regular +10 SC ad reward and counts toward your daily ad limit.')}</p>
              </div>
              {claimed ? <div className="mt-4 rounded-xl bg-green-500/15 border border-green-500/30 p-3 text-sm font-bold text-green-300">{t('watch_milestone_claimed', 'Milestone reward claimed!')}</div> : unlocked ? <button type="button" disabled={isPlayingAd || isLimitReached} onClick={() => handleClaimMilestone(milestone)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 text-sm font-black text-black disabled:opacity-50">{isPlayingAd ? t('watch_ad_loading', 'Loading ad...') : t('watch_milestone_watch_claim', 'WATCH AD & CLAIM +10 SC')}</button> : <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 text-sm font-semibold text-gray-300">{t('watch_milestone_need_ads', 'Watch more regular ads to unlock this reward.')}</div>}
            </div>
          </div>
        );
      })()}
      {rewardModal.isOpen && (
        <div className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C1C24] to-[#0E0E12] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.35)]">
            <button
              type="button"
              onClick={() =>
                setRewardModal({
                  ...rewardModal,
                  isOpen: false,
                })
              }
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#FFD700] to-yellow-200 flex items-center justify-center text-black mb-4 shadow-[0_0_20px_#FFD700] animate-bounce">
              <Gift className="w-10 h-10 stroke-[2.5]" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 rounded-full">
              {t('watch_reward_unlocked', 'REWARD UNLOCKED')}
            </span>

            <h3 className="text-3xl font-black text-white mt-3 mb-1 tracking-tight">
              +{rewardModal.amount.toLocaleString()} S {t('watch_claimed', 'CLAIMED')}
            </h3>

            {rewardModal.multiplier > 1 && (
              <p className="text-xs text-amber-400 font-bold mb-3">
                Includes {rewardModal.multiplier}x Daily Tier Bonus!
              </p>
            )}

            <p className="text-xs text-gray-400 mb-6">
              Street Coins added directly to your Syndicate balance.
            </p>

            <button
              type="button"
              onClick={() => {
                playClickSound();

                setRewardModal({
                  ...rewardModal,
                  isOpen: false,
                });
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#E5C100] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(255,215,0,0.5)] active:scale-95 transition-all"
            >
              COLLECT &amp; CONTINUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
