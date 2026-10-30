'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { NavTab, TelegramUser, LeaderboardEntry, UserGameState } from '@/types/game';
import { subscribeGameState, getGameStateSnapshot, SERVER_GAME_STATE_SNAPSHOT, getLeaderboard, saveDailyClaim, saveHasPlayedToday, resetDailyTestState, applyInviteCode, simulateReferralInvited, tickGameState } from '@/lib/storage';
import { initTelegramWebApp, BotNotification } from '@/lib/telegram';
import { playCoinSound, playClickSound, playSuccessSound } from '@/lib/sound';
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

function getTelegramUserSnapshot(): TelegramUser | null { if (typeof window === 'undefined') return null; return window.Telegram?.WebApp?.initDataUnsafe?.user || null; }
function subscribeTelegramUser(callback: () => void) { if (typeof window === 'undefined') return () => {}; window.addEventListener('load', callback); const interval = setInterval(() => { if (window.Telegram?.WebApp?.initDataUnsafe?.user) { callback(); clearInterval(interval); } }, 500); setTimeout(() => clearInterval(interval), 10000); return () => { window.removeEventListener('load', callback); clearInterval(interval); }; }

function QuickHustleHub({ isAdmin, onNavigate, onToast }: { isAdmin: boolean; onNavigate: (tab: NavTab) => void; onToast: (msg: string) => void }) {
  const items = [
    { label: 'Tasks', icon: CheckSquare, tab: 'TASKS' },
    { label: 'Bank', icon: Wallet, tab: 'BANK' },
    { label: 'Watch', icon: Tv, tab: 'WATCH' },
    { label: 'Daily Free', icon: Gift, tab: 'HOME', daily: true },
    { label: 'Warzone', icon: Swords, tab: 'WAR' },
    { label: 'Studio', icon: Mic2, tab: 'STUDIO' },
    { label: 'Games', icon: Gamepad2, tab: 'GAMES' },
    { label: 'Admin', icon: Shield, tab: 'ADMIN' },
  ] as any;
  return (
    <div className="w-full rounded-[20px] bg-[#151515] border border-white/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-black tracking-widest text-white">⚡ QUICK HUSTLE HUB</h3>
        <span className="text-[9px] font-bold text-gray-400 px-2.5 py-1 rounded-full bg-[#1E1E1E] border border-white/10">ALL MODULES ACTIVE</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {items.map((it: any) => {
          const Icon = it.icon; const isAdm = it.label === 'Admin';
          return (<button key={it.label} onClick={() => { playClickSound(); if (it.daily) { document.getElementById('daily-strip')?.scrollIntoView({ behavior: 'smooth' }); return; } if (isAdm && !isAdmin) { onToast('🔒 Admin only'); return; } onNavigate(it.tab); }} className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl border bg-[#1E1E1E] border-white/10 active:scale-95 ${isAdm && !isAdmin ? 'opacity-40' : ''}`}><div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isAdm ? 'bg-red-500/10' : 'bg-[#2A2A2A]'}`}><Icon className={`w-5 h-5 ${isAdm ? 'text-red-400' : 'text-white'}`} /></div><span className="text-[10px] font-bold text-gray-300">{it.label}</span></button>);
        })}
      </div>
    </div>
  );
}

export default function StreetLifeApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('HOME');
  const [leaderboard] = useState<LeaderboardEntry[]>(() => getLeaderboard());
  const [isLoading, setIsLoading] = useState(true);
  const gameState: UserGameState = useSyncExternalStore(subscribeGameState, getGameStateSnapshot, () => SERVER_GAME_STATE_SNAPSHOT);
  const telegramUser = useSyncExternalStore<TelegramUser | null>(subscribeTelegramUser, getTelegramUserSnapshot, () => null);
  const [isMounted, setIsMounted] = useState(false);
  const activeGameState = isMounted ? gameState : SERVER_GAME_STATE_SNAPSHOT;
  const activeTelegramUser = isMounted ? telegramUser : null;
  const ADMIN_IDS = ["7184752443"]; const ADMIN_USERNAMES = ["Gammyadmin", "gammyadmin"];
  const isAdmin = Boolean(activeTelegramUser && (ADMIN_IDS.includes(String(activeTelegramUser.id)) || ADMIN_USERNAMES.includes(activeTelegramUser.username || "")));
  const [isProfileOpen, setIsProfileOpen] = useState(false); const [isTonModalOpen, setIsTonModalOpen] = useState(false); const [isShooterModalOpen, setIsShooterModalOpen] = useState(false); const [isRaceModalOpen, setIsRaceModalOpen] = useState(false); const [isRiderModalOpen, setIsRiderModalOpen] = useState(false); const [isTransactionsOpen, setIsTransactionsOpen] = useState(false); const [showNovelModal, setShowNovelModal] = useState(false); const [is3DGameActive, setIs3DGameActive] = useState(false); const [toastMessage, setToastMessage] = useState<string | null>(null); const [botAlert, setBotAlert] = useState<BotNotification | null>(null); const [isChromeHidden, setIsChromeHidden] = useState(false);
  const closeAllModals = () => { setIsProfileOpen(false); setIsTonModalOpen(false); setIsShooterModalOpen(false); setIsRaceModalOpen(false); setIsRiderModalOpen(false); setIsTransactionsOpen(false); setShowNovelModal(false); };
  
  useEffect(() => {
    setIsMounted(true);
    try { window?.Telegram?.WebApp?.ready?.(); window?.Telegram?.WebApp?.expand?.(); } catch {}
    initTelegramWebApp();
    
    // ✅ FIXED REFERRAL LOGIC - NO MORE "user doesn't exist" ERROR
    const wa: any = (window as any).Telegram?.WebApp;
    const telegramInitData = wa?.initData;
    const startParam = wa?.initDataUnsafe?.start_param as string | undefined;
    
    if (telegramInitData) {
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData: telegramInitData, 
          referralCode: startParam ? startParam.toUpperCase() : null 
        }),
        cache: 'no-store',
      }).then(r => r.json()).then(d => {
        console.log('Auth result:', d);
        if (d.referralApplied) {
          setTimeout(() => showToast(`🎉 Welcome bonus +5 SC applied! Invite ${startParam?.toUpperCase()}!`), 1000);
        }
      }).catch(() => {});
    }
    
    if (startParam) {
      console.log('Invite code detected:', startParam);
    }

    const t = setTimeout(() => setIsLoading(false), 600);
    const d = setInterval(() => tickGameState(), 10000);
    const h = (e: Event) => { const ce = e as CustomEvent<BotNotification>; if (ce.detail) { setBotAlert(ce.detail); playSuccessSound(); } };
    window.addEventListener('streetlife_bot_notification', h);
    return () => { clearTimeout(t); clearInterval(d); window.removeEventListener('streetlife_bot_notification', h); };
  }, []);

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2800); };
  const handleClaimDailyReward = (a: number, b?: string) => { playCoinSound(); saveDailyClaim(gameState.streetCoin + a, gameState.dailyStreak >= 7 ? 1 : gameState.dailyStreak + 1); showToast(`Claimed +${a} SC ${b ? `& ${b}` : ''}!`); };
  const handleSimulatePlayGame = () => { playCoinSound(); saveHasPlayedToday(true); showToast('Game completed! Daily Reward unlocked 🔓'); };
  const handleResetTestLock = () => { playClickSound(); resetDailyTestState(); showToast('Daily Reward locked again 🔒'); };
  const handleComingSoonGame = (t: string) => { playClickSound(); showToast(`${t} will arrive in future updates!`); };
  const handleApplyInvite = (c: string) => { const r = applyInviteCode(c); if (r.success) { playSuccessSound(); playCoinSound(); } else playClickSound(); showToast(r.message); };
  const handleSimulateReferral = () => { playCoinSound(); simulateReferralInvited(); showToast('🤝 Someone joined via your invite! +10 Coins earned.'); };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-between selection:bg-[#FFD700] selection:text-black overflow-y-auto">
      {toastMessage && (<div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#FFD700] text-black font-bold text-xs shadow-xl">{toastMessage}</div>)}
      {botAlert && (<div className="fixed top-16 left-4 right-4 z-[260] max-w-md mx-auto"><div className="rounded-2xl bg-[#0D1520]/95 border-2 border-cyan-400 p-3.5 flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center"><Bot className="w-5 h-5 text-cyan-400" /></div><div className="flex-1"><div className="flex justify-between"><span className="text-[10px] font-black text-cyan-400">Telegram Bot Notification</span><button onClick={() => setBotAlert(null)}><X className="w-3.5 h-3.5" /></button></div><h4 className="text-xs font-black mt-0.5">{botAlert.title}</h4><p className="text-[11px] text-gray-300">{botAlert.message}</p></div></div></div>)}
      <div className={`fixed top-0 left-0 right-0 z-40 ${isChromeHidden ? '-translate-y-full opacity-0' : ''}`}><TopBar telegramUser={activeTelegramUser} streetCoin={activeGameState.streetCoin} onOpenProfile={() => { closeAllModals(); setActiveTab('PROFILE'); }} onConnectWallet={() => setIsTonModalOpen(true)} onOpenTransactions={() => setIsTransactionsOpen(true)} /></div>
      <button onClick={() => setIsChromeHidden((p) => !p)} type="button" className={`fixed z-50 ${isChromeHidden ? 'top-3 right-3 bg-[#FFD700] text-black' : 'bottom-20 right-3 bg-black/80 text-[#FFD700] border border-[#FFD700]/40'} p-2.5 rounded-full`}>{isChromeHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
      <main className={`w-full max-w-md mx-auto ${isChromeHidden ? 'pt-3 pb-16' : 'pt-14 pb-28'} flex-1 flex flex-col min-h-screen overflow-y-auto`}>
        {activeTab === 'STUDIO' ? (<StudioScreen gameState={activeGameState} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab as NavTab); }} />) : activeTab === 'GAMES' || activeTab === 'CRIB' ? (<GamesScreen gameState={activeGameState} onToast={showToast} onGameActiveChange={setIs3DGameActive} />) : activeTab === 'SHOP' || activeTab === 'INVENTORY' ? (<InventoryScreen gameState={activeGameState} onToast={showToast} />) : activeTab === 'WAR' ? (<ToughWarScreen gameState={activeGameState} onToast={showToast} />) : activeTab === 'PROFILE' ? (<ProfileScreen gameState={activeGameState} telegramUser={activeTelegramUser} isAdmin={isAdmin} onOpenAdmin={() => { if (isAdmin) { closeAllModals(); setActiveTab('ADMIN'); } }} onOpenTransactions={() => setIsTransactionsOpen(true)} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} />) : activeTab === 'ADMIN' ? (isAdmin ? (<AdminPanelScreen gameState={activeGameState} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('PROFILE'); }} />) : (<div className="w-full flex-1 flex flex-col items-center justify-center p-10 text-center min-h-[60vh]"><Shield className="w-8 h-8 text-red-400" /><h2 className="text-lg font-black">ACCESS DENIED</h2><button onClick={() => setActiveTab('HOME')} className="mt-6 px-6 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs">Go Home</button></div>)) : activeTab === 'BANK' ? (<BankScreen gameState={activeGameState} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : activeTab === 'WATCH' ? (<WatchScreen gameState={activeGameState} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} onToast={showToast} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : activeTab === 'TASKS' ? (<TasksScreen gameState={activeGameState} onToast={showToast} onNavigateTab={(tab) => { closeAllModals(); setActiveTab(tab); }} onBack={() => { closeAllModals(); setActiveTab('HOME'); }} />) : (
          <div className="w-full flex-1 min-h-[calc(100dvh-5rem)] overflow-y-auto pb-40 pt-4 px-4 space-y-4">
            <CenterLogo />
            <HeroBalanceCard streetCoin={activeGameState.streetCoin} onOpenTransactions={() => setIsTransactionsOpen(true)} onOpenNovel={() => setShowNovelModal(true)} />
            <QuickHustleHub isAdmin={isAdmin} onNavigate={(tab) => { closeAllModals(); setActiveTab(tab); }} onToast={showToast} />
            <div id="daily-strip"><DailyRewardStrip hasPlayedToday={activeGameState.hasPlayedToday} dailyStreak={activeGameState.dailyStreak} lastClaimDate={activeGameState.lastClaimDate} onClaim={handleClaimDailyReward} onSimulatePlayGame={handleSimulatePlayGame} onResetTestLock={handleResetTestLock} /></div>
            <ReferralCard myReferralCode={activeGameState.myReferralCode} referralsCount={activeGameState.referralsCount} hasClaimedWelcomeBonus={activeGameState.hasClaimedWelcomeBonus} appliedReferralCode={activeGameState.appliedReferralCode} onApplyInviteCode={handleApplyInvite} onSimulateReferral={handleSimulateReferral} onToast={showToast} />
            <Leaderboard entries={leaderboard} userCoins={activeGameState.streetCoin} userName={activeTelegramUser?.first_name || 'You'} isLoading={isLoading} />
            <GameCards onPlayShooter={() => setIsShooterModalOpen(true)} onPlayRace={() => setIsRaceModalOpen(true)} onPlayRider={() => setIsRiderModalOpen(true)} onComingSoonGame={handleComingSoonGame} isLoading={isLoading} />
          </div>
        )}
      </main>
      {!is3DGameActive && (<div className="fixed bottom-0 left-0 right-0 z-40"><BottomNav activeTab={activeTab} onTabChange={(tab) => { playClickSound(); closeAllModals(); setActiveTab(tab); }} /></div>)}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} telegramUser={activeTelegramUser} myReferralCode={activeGameState.myReferralCode} deviceId={activeGameState.deviceId} streetCoin={activeGameState.streetCoin} dailyStreak={activeGameState.dailyStreak} onOpenTransactions={() => setIsTransactionsOpen(true)} />
      <TonModal isOpen={isTonModalOpen} onClose={() => setIsTonModalOpen(false)} streetCoin={activeGameState.streetCoin} onToast={showToast} />
      <StreetGalaxyShooterModal isOpen={isShooterModalOpen} onClose={() => setIsShooterModalOpen(false)} initialLevel={activeGameState.shooterLevel || 1} onToast={showToast} />
      <StreetRaceModal isOpen={isRaceModalOpen} onClose={() => setIsRaceModalOpen(false)} streetCoin={activeGameState.streetCoin} ownedCars={activeGameState.ownedCars || ['basic']} selectedCar={activeGameState.selectedCar || 'basic'} onToast={showToast} />
      <StreetRiderModal isOpen={isRiderModalOpen} onClose={() => setIsRiderModalOpen(false)} streetCoin={activeGameState.streetCoin} ownedBikes={activeGameState.ownedBikes || ['scooter']} selectedBike={activeGameState.selectedBike || 'scooter'} missionNumber={activeGameState.riderMission || 1} onToast={showToast} />
      <TransactionsModal isOpen={isTransactionsOpen} onClose={() => setIsTransactionsOpen(false)} transactions={activeGameState.transactions || []} currentBalance={activeGameState.streetCoin} />
      {showNovelModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowNovelModal(false)}><div className="relative w-full max-w-sm rounded-2xl bg-[#111] border-2 border-[#FFD700] p-6 text-center" onClick={(e) => e.stopPropagation()}><h3 className="text-lg font-bold text-[#FFD700] mb-3">📚 STREET NOVEL</h3><div className="text-2xl font-bold text-white">Coming Soon</div><button type="button" onClick={() => setShowNovelModal(false)} className="w-full mt-6 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold text-xs">Close</button></div></div>)}
    </div>
  );
}
