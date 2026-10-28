'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { NavTab, TelegramUser, LeaderboardEntry, UserGameState } from '@/types/game';
import {
  subscribeGameState,
  getGameStateSnapshot,
  SERVER_GAME_STATE_SNAPSHOT,
  getLeaderboard,
  saveDailyClaim,
  saveHasPlayedToday,
  resetDailyTestState,
  applyInviteCode,
  simulateReferralInvited,
  tickGameState,
} from '@/lib/storage';
import { initTelegramWebApp, BotNotification } from '@/lib/telegram';
import { playCoinSound, playClickSound, playSuccessSound } from '@/lib/sound';
import Link from 'next/link';
import { Bot, X, Eye, EyeOff, Wallet, CheckSquare, Tv, Gift, Swords, Mic2, Gamepad2, Shield } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { CenterLogo } from '@/components/CenterLogo';
import { HeroBalanceCard } from '@/components/HeroBalanceCard';
import { DailyRewardStrip } from '@/components/DailyRewardStrip';
import { ReferralCard } from '@/components/ReferralCard';
import { Leaderboard } from '@/components/Leaderboard';
import { GameCards } from '@/components/GameCards';
import { BankScreen } from '@/components/BankScreen';
import { InventoryScreen } from '@/components/InventoryScreen';
import { WatchScreen } from '@/components/WatchScreen';
import { TasksScreen } from '@/components/TasksScreen';
import { GamesScreen } from '@/components/GamesScreen';
import { BottomNav } from '@/components/BottomNav';
import { TabPlaceholder } from '@/components/TabPlaceholder';
import { StudioScreen } from '@/components/StudioScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { AdminPanelScreen } from '@/components/AdminPanelScreen';
import { ToughWarScreen } from '@/components/ToughWarScreen';
import { ProfileModal } from '@/components/ProfileModal';
import { TonModal } from '@/components/TonModal';
import { StreetGalaxyShooterModal } from '@/components/StreetGalaxyShooterModal';
import { StreetRaceModal } from '@/components/StreetRaceModal';
import { StreetRiderModal } from '@/components/StreetRiderModal';
import { TransactionsModal } from '@/components/TransactionsModal';

let cachedTelegramUser: TelegramUser | null = null;
let isTelegramChecked = false;

function getTelegramUserSnapshot(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  if (!isTelegramChecked) {
    cachedTelegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    isTelegramChecked = true;
  }
  return cachedTelegramUser;
}

function subscribeTelegramUser(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('load', callback);
  return () => window.removeEventListener('load', callback);
}

export default function StreetLifeApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('HOME');
  const [leaderboard] = useState<LeaderboardEntry[]>(() => getLeaderboard());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const gameState: UserGameState = useSyncExternalStore(
    subscribeGameState,
    getGameStateSnapshot,
    () => SERVER_GAME_STATE_SNAPSHOT
  );

  const telegramUser = useSyncExternalStore<TelegramUser | null>(
    subscribeTelegramUser,
    getTelegramUserSnapshot,
    () => null
  );

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const activeGameState = isMounted ? gameState : SERVER_GAME_STATE_SNAPSHOT;
  const activeTelegramUser = isMounted ? telegramUser : null;

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTonModalOpen, setIsTonModalOpen] = useState(false);
  const [isShooterModalOpen, setIsShooterModalOpen] = useState(false);
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);
  const [isRiderModalOpen, setIsRiderModalOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [showNovelModal, setShowNovelModal] = useState<boolean>(false);
  const [is3DGameActive, setIs3DGameActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [botAlert, setBotAlert] = useState<BotNotification | null>(null);
  const [isChromeHidden, setIsChromeHidden] = useState<boolean>(false);

  const closeAllModals = () => {
    setIsProfileOpen(false);
    setIsTonModalOpen(false);
    setIsShooterModalOpen(false);
    setIsRaceModalOpen(false);
    setIsRiderModalOpen(false);
    setIsTransactionsOpen(false);
    setShowNovelModal(false);
  };

  // FIXED - CLEAN SINGLE TELEGRAM AUTH (NO MORE DUPLICATES - NO MORE GUEST BUG)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      try {
        window?.Telegram?.WebApp?.ready?.();
        window?.Telegram?.WebApp?.expand?.();
      } catch {}
    }
    initTelegramWebApp();
    
    // Automatically register or recognize Telegram players - ONE TIME ONLY
    const telegramWebApp = window.Telegram?.WebApp as any;
    const telegramInitData = telegramWebApp?.initData;

    if (telegramInitData) {
      console.log("Sending real Telegram ID to server - No more Guest!");
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData }),
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            console.error('Telegram account setup failed:', result.error || response.status);
          } else {
            console.log('Telegram player account verified - Real account!');
          }
        })
        .catch((error) => {
          console.error('Telegram account setup network error:', error);
        });
    } else {
      console.log("Opened outside Telegram - Guest mode (Open inside Telegram bot to get real ID)");
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

    const decayTimer = setInterval(() => {
      tickGameState();
    }, 10000);

    const handleBotNotification = (e: Event) => {
      const customEvent = e as CustomEvent<BotNotification>;
      if (customEvent.detail) {
        setBotAlert(customEvent.detail);
        playSuccessSound();
      }
    };

    window.addEventListener('streetlife_bot_notification', handleBotNotification);

    return () => {
      clearTimeout(timer);
      clearInterval(decayTimer);
      window.removeEventListener('streetlife_bot_notification', handleBotNotification);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleClaimDailyReward = (rewardAmount: number, bonusItem?: string) => {
    playCoinSound();
    const newTotal = gameState.streetCoin + rewardAmount;
    const nextStreak = gameState.dailyStreak >= 7 ? 1 : gameState.dailyStreak + 1;

    saveDailyClaim(newTotal, nextStreak);
    showToast(
      `Claimed +${rewardAmount} Street Coins ${bonusItem ? `& ${bonusItem}` : ''}! Total: ${newTotal.toLocaleString()} SC`
    );
  };

  const handleSimulatePlayGame = () => {
    playCoinSound();
    saveHasPlayedToday(true);
    showToast('Game completed! Daily Reward is now unlocked 🔓');
  };

  const handleResetTestLock = () => {
    playClickSound();
    resetDailyTestState();
    showToast('Daily Reward locked again for testing 🔒');
  };

  const handleComingSoonGame = (title: string) => {
    playClickSound();
    showToast(`${title} will arrive in future updates!`);
  };

  const handleApplyInvite = (code: string) => {
    const res = applyInviteCode(code);
    if (res.success) {
      playSuccessSound();
      playCoinSound();
    } else {
      playClickSound();
    }
    showToast(res.message);
  };

  const handleSimulateReferral = () => {
    playCoinSound();
    simulateReferralInvited();
    showToast('🤝 Someone joined via your invite! +10 Coins earned.');
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-between selection:bg-[#FFD700] selection:text-black overflow-y-auto">
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#FFD700] text-black font-bold text-xs shadow-xl shadow-[#FFD700]/30 animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {botAlert && (
        <div className="fixed top-16 left-4 right-4 z-[260] max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="rounded-2xl bg-[#0D1520]/95 border-2 border-cyan-400 p-3.5 shadow-[0_0_30px_rgba(6,182,212,0.4)] backdrop-blur-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                  Telegram Bot Notification • @StreetLifeGameBot
                </span>
                <button
                  onClick={() => setBotAlert(null)}
                  type="button"
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <h4 className="text-xs font-black text-white mt-0.5">{botAlert.title}</h4>
              <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">{botAlert.message}</p>
              {botAlert.reward && (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFD700]/20 text-[#FFD700] text-[10px] font-black border border-[#FFD700]/30">
                  <span>🪙 +{botAlert.reward} SC Credited</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isChromeHidden
            ? '-translate-y-full opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <TopBar
          telegramUser={activeTelegramUser}
          streetCoin={activeGameState.streetCoin}
          onOpenProfile={() => {
            closeAllModals();
            setActiveTab('PROFILE');
          }}
          onConnectWallet={() => setIsTonModalOpen(true)}
          onOpenTransactions={() => setIsTransactionsOpen(true)}
        />
      </div>

      <button
        onClick={() => {
          playClickSound();
          setIsChromeHidden((prev) => !prev);
          showToast(
            !isChromeHidden
              ? '🕶️ Top & bottom controls hidden.'
              : '👁️ Top & bottom controls visible.'
          );
        }}
        type="button"
        title={isChromeHidden ? 'Show top & bottom bars' : 'Hide top & bottom bars'}
        className={`fixed z-50 transition-all duration-300 ${
          isChromeHidden
            ? 'top-3 right-3 bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.6)]'
            : 'bottom-20 right-3 bg-black/80 text-[#FFD700] border border-[#FFD700]/40 shadow-lg'
        } p-2.5 rounded-full flex items-center justify-center active:scale-95 cursor-pointer backdrop-blur-md`}
      >
        {isChromeHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      <main
        className={`w-full max-w-md mx-auto ${
          isChromeHidden ? 'pt-3 pb-16' : 'pt-14 pb-28'
        } flex-1 flex flex-col min-h-screen overflow-y-auto transition-all duration-300`}
      >
        {activeTab === 'STUDIO' ? (
          <StudioScreen
            gameState={activeGameState}
            onToast={showToast}
            onNavigateTab={(tab) => {
              closeAllModals();
              setActiveTab(tab as NavTab);
            }}
          />
        ) : activeTab === 'GAMES' || activeTab === 'CRIB' ? (
          <GamesScreen
            gameState={activeGameState}
            onToast={showToast}
            onGameActiveChange={(isActive) => setIs3DGameActive(isActive)}
          />
        ) : activeTab === 'SHOP' || activeTab === 'INVENTORY' ? (
          <InventoryScreen gameState={activeGameState} onToast={showToast} />
        ) : activeTab === 'WAR' ? (
          <ToughWarScreen gameState={activeGameState} onToast={showToast} />
        ) : activeTab === 'PROFILE' ? (
          <ProfileScreen
            gameState={activeGameState}
            telegramUser={activeTelegramUser}
            onOpenAdmin={() => {
              closeAllModals();
              setActiveTab('ADMIN');
            }}
            onOpenTransactions={() => setIsTransactionsOpen(true)}
            onToast={showToast}
            onNavigateTab={(tab) => {
              closeAllModals();
              setActiveTab(tab);
            }}
          />
        ) : activeTab === 'ADMIN' ? (
          <AdminPanelScreen
            gameState={activeGameState}
            onToast={showToast}
            onBack={() => {
              closeAllModals();
              setActiveTab('PROFILE');
            }}
          />
        ) : activeTab === 'BANK' ? (
          <BankScreen
            gameState={activeGameState}
            onToast={showToast}
            onBack={() => {
              closeAllModals();
              setActiveTab('HOME');
            }}
          />
        ) : activeTab === 'WATCH' ? (
          <WatchScreen
            gameState={activeGameState}
            onNavigateTab={(tab) => {
              closeAllModals();
              setActiveTab(tab);
            }}
            onToast={showToast}
            onBack={() => {
              closeAllModals();
              setActiveTab('HOME');
            }}
          />
        ) : activeTab === 'TASKS' ? (
          <TasksScreen
            gameState={activeGameState}
            onToast={showToast}
            onNavigateTab={(tab) => {
              closeAllModals();
              setActiveTab(tab);
            }}
            onBack={() => {
              closeAllModals();
              setActiveTab('HOME');
            }}
          />
        ) : (
          <div className="w-full flex-1 min-h-[calc(100dvh-5rem)] overflow-y-auto pb-40 pt-4 px-4 overscroll-contain space-y-4">
            <CenterLogo />
            <HeroBalanceCard
              streetCoin={activeGameState.streetCoin}
              onOpenTransactions={() => setIsTransactionsOpen(true)}
              onOpenNovel={() => setShowNovelModal(true)}
            />
            <div className="rounded-2xl bg-[#121214] border border-white/10 p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1">
                  <span>⚡ Quick Hustle Hub</span>
                </span>
                <span className="text-[9px] font-mono text-gray-400">All Modules Active</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('TASKS');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-cyan-400 truncate w-full">
                    Tasks
                  </span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('BANK');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-[#FFD700]/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-[#FFD700] truncate w-full">
                    Bank
                  </span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('WATCH');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-purple-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Tv className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-purple-400 truncate w-full">
                    Watch
                  </span>
                </button>
                <Link
                  href="/daily-free"
                  onClick={() => playClickSound()}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Gift className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-emerald-400 truncate w-full">
                    Daily Free
                  </span>
                </Link>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('WAR');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-red-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Swords className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-red-400 truncate w-full">
                    Warzone
                  </span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('STUDIO');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-amber-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mic2 className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-amber-400 truncate w-full">
                    Studio
                  </span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('GAMES');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-yellow-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-yellow-400 truncate w-full">
                    Games
                  </span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    closeAllModals();
                    setActiveTab('ADMIN');
                  }}
                  type="button"
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-amber-400/40 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 text-[#FFD700] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[9.5px] font-black text-white group-hover:text-[#FFD700] truncate w-full">
                    Admin
                  </span>
                </button>
              </div>
            </div>
            <DailyRewardStrip
              hasPlayedToday={activeGameState.hasPlayedToday}
              dailyStreak={activeGameState.dailyStreak}
              lastClaimDate={activeGameState.lastClaimDate}
              onClaim={handleClaimDailyReward}
              onSimulatePlayGame={handleSimulatePlayGame}
              onResetTestLock={handleResetTestLock}
            />
            <ReferralCard
              myReferralCode={activeGameState.myReferralCode}
              referralsCount={activeGameState.referralsCount}
              hasClaimedWelcomeBonus={activeGameState.hasClaimedWelcomeBonus}
              appliedReferralCode={activeGameState.appliedReferralCode}
              onApplyInviteCode={handleApplyInvite}
              onSimulateReferral={handleSimulateReferral}
              onToast={showToast}
            />
            <Leaderboard
              entries={leaderboard}
              userCoins={activeGameState.streetCoin}
              userName={activeTelegramUser?.first_name ? `${activeTelegramUser.first_name}` : 'You'}
              isLoading={isLoading}
            />
            <GameCards
              onPlayShooter={() => setIsShooterModalOpen(true)}
              onPlayRace={() => setIsRaceModalOpen(true)}
              onPlayRider={() => setIsRiderModalOpen(true)}
              onComingSoonGame={handleComingSoonGame}
              isLoading={isLoading}
            />
          </div>
        )}
      </main>

      {!is3DGameActive && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
            isChromeHidden
              ? 'translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100'
          }`}
        >
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              playClickSound();
              closeAllModals();
              setActiveTab(tab);
            }}
          />
        </div>
      )}

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        telegramUser={activeTelegramUser}
        myReferralCode={activeGameState.myReferralCode}
        deviceId={activeGameState.deviceId}
        streetCoin={activeGameState.streetCoin}
        dailyStreak={activeGameState.dailyStreak}
        onOpenTransactions={() => setIsTransactionsOpen(true)}
      />

      <TonModal
        isOpen={isTonModalOpen}
        onClose={() => setIsTonModalOpen(false)}
        streetCoin={activeGameState.streetCoin}
        onToast={showToast}
      />

      <StreetGalaxyShooterModal
        isOpen={isShooterModalOpen}
        onClose={() => setIsShooterModalOpen(false)}
        initialLevel={activeGameState.shooterLevel || 1}
        onToast={showToast}
      />

      <StreetRaceModal
        isOpen={isRaceModalOpen}
        onClose={() => setIsRaceModalOpen(false)}
        streetCoin={activeGameState.streetCoin}
        ownedCars={activeGameState.ownedCars || ['basic']}
        selectedCar={activeGameState.selectedCar || 'basic'}
        onToast={showToast}
      />

      <StreetRiderModal
        isOpen={isRiderModalOpen}
        onClose={() => setIsRiderModalOpen(false)}
        streetCoin={activeGameState.streetCoin}
        ownedBikes={activeGameState.ownedBikes || ['scooter']}
        selectedBike={activeGameState.selectedBike || 'scooter'}
        missionNumber={activeGameState.riderMission || 1}
        onToast={showToast}
      />

      <TransactionsModal
        isOpen={isTransactionsOpen}
        onClose={() => setIsTransactionsOpen(false)}
        transactions={activeGameState.transactions || []}
        currentBalance={activeGameState.streetCoin}
      />

      {showNovelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowNovelModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-[#111] border-2 border-[#FFD700] p-6 shadow-[0_0_35px_rgba(255,215,0,0.35)] text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#FFD700] uppercase tracking-wider mb-3">
              📚 STREET NOVEL
            </h3>
            <div id="novelContent" className="space-y-2 mb-6">
              <div className="text-2xl font-bold text-white">
                Coming Soon
              </div>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                The streets have stories. Chapters will unlock as your empire grows.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setShowNovelModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
