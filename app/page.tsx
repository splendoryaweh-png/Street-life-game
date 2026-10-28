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

function getTelegramUserSnapshot(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

function subscribeTelegramUser(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('load', callback);
  const interval = setInterval(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      callback();
      clearInterval(interval);
    }
  }, 500);
  setTimeout(() => clearInterval(interval), 10000);
  return () => {
    window.removeEventListener('load', callback);
    clearInterval(interval);
  };
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

  // 🔒 ADMIN ONLY YOU: 7184752443
  const ADMIN_IDS = ["7184752443"];
  const ADMIN_USERNAMES = ["Gammyadmin", "gammyadmin"];
  const isAdmin = Boolean(
    activeTelegramUser && (
      ADMIN_IDS.includes(String(activeTelegramUser.id)) ||
      ADMIN_USERNAMES.includes(activeTelegramUser.username || "") ||
      ADMIN_USERNAMES.map(u => u.toLowerCase()).includes((activeTelegramUser.username || "").toLowerCase())
    )
  );

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

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      try {
        window?.Telegram?.WebApp?.ready?.();
        window?.Telegram?.WebApp?.expand?.();
      } catch {}
    }
    initTelegramWebApp();
    
    const telegramWebApp = (window as any).Telegram?.WebApp;
    const telegramInitData = telegramWebApp?.initData;

    if (telegramInitData) {
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData }),
        cache: 'no-store',
      }).catch((error) => {
        console.error('Telegram account setup network error:', error);
      });
    }

    const timer = setTimeout(() => setIsLoading(false), 600);
    const decayTimer = setInterval(() => tickGameState(), 10000);

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
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleClaimDailyReward = (rewardAmount: number, bonusItem?: string) => {
    playCoinSound();
    const newTotal = gameState.streetCoin + rewardAmount;
    const nextStreak = gameState.dailyStreak >= 7 ? 1 : gameState.dailyStreak + 1;
    saveDailyClaim(newTotal, nextStreak);
    showToast(`Claimed +${rewardAmount} SC ${bonusItem ? `& ${bonusItem}` : ''}!`);
  };
  const handleSimulatePlayGame = () => { playCoinSound(); saveHasPlayedToday(true); showToast('Game completed! Daily Reward unlocked 🔓'); };
  const handleResetTestLock = () => { playClickSound(); resetDailyTestState(); showToast('Daily Reward locked again 🔒'); };
  const handleComingSoonGame = (title: string) => { playClickSound(); showToast(`${title} will arrive in future updates!`); };
  const handleApplyInvite = (code: string) => { const res = applyInviteCode(code); if (res.success) { playSuccessSound(); playCoinSound(); } else { playClickSound(); } showToast(res.message); };
  const handleSimulateReferral = () => { playCoinSound(); simulateReferralInvited(); showToast('🤝 Someone joined via your invite! +10 Coins earned.'); };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-between selection:bg-[#FFD700] selection:text-black overflow-y-auto">
      {toastMessage && (<div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#FFD700] text-black font-bold text-xs shadow-xl">{toastMessage}</div>)}
      {botAlert && (
        <div className="fixed top-16 left-4 right-4 z-[260] max-w-md mx-auto">
          <div className="rounded-2xl bg-[#0D1520]/95 border-2 border-cyan-400 p-3.5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shrink-0"><Bot className="w-5 h-5 text-cyan-400" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-cyan-400">Telegram Bot Notification</span><button onClick={() => setBotAlert(null)} type="button"><X className="w-3.5 h-3.5" /></button></div>
              <h4 className="text-xs font-black text-white mt-0.5">{botAlert.title}</h4><p className="text-[11px] text-gray-300 mt-0.5">{botAlert.message}</p>
            </div>
          </div>
        </div>
      )}
      <div className={`fixed top-0 left-0 right-0 z-40 ${isChromeHidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <TopBar telegramUser={activeTelegramUser} streetCoin={activeGameState.streetCoin} onOpenProfile={() => { closeAllModals(); setActiveTab('PROFILE'); }} onConnectWallet={() => setIsTonModalOpen(true)} onOpenTransactions={() => setIsTransactionsOpen(true)} />
      </div>
      <button onClick={() => { playClickSound(); setIsChromeHidden((prev) => !prev); }} type="button" className={`fixed z-50 ${isChromeHidden ? 'top-3 right-3 bg-[#FFD700] text-black' : 'bottom-20 right-3 bg-black/80 text-[#FFD700] border border-[#FFD700]/40'} p-2.5 rounded-full`}>{isChromeHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
      <main className={`w-full max-w-md mx-auto ${isChromeHidden ? 'pt-3 pb-16' : 'pt-14 pb-28'} flex-1 flex flex-col min-h-screen overflow-y-auto`}>
        {activeTab === 'STUDIO' ? (<StudioScreen gameState={activeGameState} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab as NavTab); }} />) : activeTab === 'GAMES' || activeTab === 'CRIB' ? (<GamesScreen gameState={activeGameState} onToast={showToast} onGameActiveChange={(isActive) => setIs3DGameActive(isActive)} />) : activeTab === 'SHOP' || activeTab === 'INVENTORY' ? (<InventoryScreen gameState={activeGameState} onToast={showToast} />) : activeTab === 'WAR' ? (<ToughWarScreen gameState={activeGameState} onToast={showToast} />) : activeTab === 'PROFILE' ? (<ProfileScreen gameState={activeGameState} telegramUser={activeTelegramUser} isAdmin={isAdmin} onOpenAdmin={() => { if (isAdmin) { closeAllModals(); setActiveTab('ADMIN'); } }} onOpenTransactions={() => setIsTransactionsOpen(true)} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} />) : activeTab === 'ADMIN' ? (
          isAdmin ? (<AdminPanelScreen gameState={activeGameState} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('PROFILE'); }} />) : (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-10 text-center min-h-[60vh]">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-4"><Shield className="w-8 h-8 text-red-400" /></div>
              <h2 className="text-lg font-black text-white">ACCESS DENIED</h2>
              <button onClick={() => setActiveTab('HOME')} className="mt-6 px-6 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs">Go Home</button>
            </div>
          )
        ) : activeTab === 'BANK' ? (<BankScreen gameState={activeGameState} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : activeTab === 'WATCH' ? (<WatchScreen gameState={activeGameState} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : activeTab === 'TASKS' ? (<TasksScreen gameState={activeGameState} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : (
          <div className="w-full flex-1 min-h-[calc(100dvh-5rem)] overflow-y-auto pb-40 pt-4 px-4 space-y-4">
            <CenterLogo />
            <HeroBalanceCard streetCoin={activeGameState.streetCoin} onOpenTransactions={() => setIsTransactionsOpen(true)} onOpenNovel={() => setShowNovelModal(true)} />
            <DailyRewardStrip hasPlayedToday={activeGameState.hasPlayedToday} dailyStreak={activeGameState.dailyStreak} lastClaimDate={activeGameState.lastClaimDate} onClaim={handleClaimDailyReward} onSimulatePlayGame={handleSimulatePlayGame} onResetTestLock={handleResetTestLock} />
            <ReferralCard myReferralCode={activeGameState.myReferralCode} referralsCount={activeGameState.referralsCount} hasClaimedWelcomeBonus={activeGameState.hasClaimedWelcomeBonus} appliedReferralCode={activeGameState.appliedReferralCode} onApplyInviteCode={handleApplyInvite} onSimulateReferral={handleSimulateReferral} onToast={showToast} />
            <Leaderboard entries={leaderboard} userCoins={activeGameState.streetCoin} userName={activeTelegramUser?.first_name ? `${activeTelegramUser.first_name}` : 'You'} isLoading={isLoading} />
            <GameCards onPlayShooter={() => setIsShooterModalOpen(true)} onPlayRace={() => setIsRaceModalOpen(true)} onPlayRider={() => setIsRiderModalOpen(true)} onComingSoonGame={handleComingSoonGame} isLoading={isLoading} />
          </div>
        )}
      </main>
      {!is3DGameActive && (<div className={`fixed bottom-0 left-0 right-0 z-40 ${isChromeHidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}><BottomNav activeTab={activeTab} onTabChange={(tab) => { playClickSound(); closeAllModals(); setActiveTab(tab); }} /></div>)}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} telegramUser={activeTelegramUser} myReferralCode={activeGameState.myReferralCode} deviceId={activeGameState.deviceId} streetCoin={activeGameState.streetCoin} dailyStreak={activeGameState.dailyStreak} onOpenTransactions={() => setIsTransactionsOpen(true)} />
      <TonModal isOpen={isTonModalOpen} onClose={() => setIsTonModalOpen(false)} streetCoin={activeGameState.streetCoin} onToast={showToast} />
      <StreetGalaxyShooterModal isOpen={isShooterModalOpen} onClose={() => setIsShooterModalOpen(false)} initialLevel={activeGameState.shooterLevel || 1} onToast={showToast} />
      <StreetRaceModal isOpen={isRaceModalOpen} onClose={() => setIsRaceModalOpen(false)} streetCoin={activeGameState.streetCoin} ownedCars={activeGameState.ownedCars || ['basic']} selectedCar={activeGameState.selectedCar || 'basic'} onToast={showToast} />
      <StreetRiderModal isOpen={isRiderModalOpen} onClose={() => setIsRiderModalOpen(false)} streetCoin={activeGameState.streetCoin} ownedBikes={activeGameState.ownedBikes || ['scooter']} selectedBike={activeGameState.selectedBike || 'scooter'} missionNumber={activeGameState.riderMission || 1} onToast={showToast} />
      <TransactionsModal isOpen={isTransactionsOpen} onClose={() => setIsTransactionsOpen(false)} transactions={activeGameState.transactions || []} currentBalance={activeGameState.streetCoin} />
      {showNovelModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowNovelModal(false)}><div className="relative w-full max-w-sm rounded-2xl bg-[#111] border-2 border-[#FFD700] p-6 text-center" onClick={(e) => e.stopPropagation()}><h3 className="text-lg font-bold text-[#FFD700] mb-3">📚 STREET NOVEL</h3><div className="text-2xl font-bold text-white">Coming Soon</div><button type="button" onClick={() => { playClickSound(); setShowNovelModal(false); }} className="w-full mt-6 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs">Close</button></div></div>)}
    </div>
  );
}
