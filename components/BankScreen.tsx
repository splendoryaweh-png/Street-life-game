'use client';

import React, { useState } from 'react';
import { UserGameState, CryptoCurrency, WithdrawalRecord } from '@/types/game';
import {
  requestWithdrawal,
  convertStreetCoins,
  DEFAULT_WITHDRAWALS,
  recordWithdrawalClick,
} from '@/lib/storage';
import { playCoinSound, playClickSound, playSuccessSound } from '@/lib/sound';
import {
  Wallet,
  ArrowRightLeft,
  ArrowUpRight,
  History,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Coins,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Lock,
  ArrowLeft,
  Flame,
} from 'lucide-react';
import { BankRobberyScreen } from './BankRobberyScreen';

interface BankScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
  onBack?: () => void;
}

type BankSubTab = 'balance' | 'converter' | 'withdraw' | 'history' | 'heist';

interface CurrencyRateInfo {
  id: CryptoCurrency;
  name: string;
  symbol: string;
  networkName: string;
  coinsPerUnit: number; // e.g. 10000 coins = 1 TON
  unitValueUsd: number; // estimate
  iconBg: string;
  textColor: string;
  badge: string;
}

const CURRENCIES: Record<CryptoCurrency, CurrencyRateInfo> = {
  TON: {
    id: 'TON',
    name: 'Toncoin',
    symbol: 'TON',
    networkName: 'The Open Network (TON)',
    coinsPerUnit: 10000,
    unitValueUsd: 5.2,
    iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    textColor: 'text-sky-400',
    badge: 'Popular',
  },
  USDT: {
    id: 'USDT',
    name: 'Tether USD',
    symbol: 'USDT',
    networkName: 'TRC-20 / TON Tether',
    coinsPerUnit: 1000,
    unitValueUsd: 1.0,
    iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    textColor: 'text-emerald-400',
    badge: 'Stable',
  },
  STARS: {
    id: 'STARS',
    name: 'Telegram Stars',
    symbol: '⭐',
    networkName: 'Telegram App Balance',
    coinsPerUnit: 20, // 100 coins = 5 stars => 20 coins = 1 star
    unitValueUsd: 0.02,
    iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    textColor: 'text-amber-400',
    badge: 'Instant',
  },
  USD: {
    id: 'USD',
    name: 'Street Cash USD',
    symbol: '$',
    networkName: 'Direct Cash Account',
    coinsPerUnit: 1000,
    unitValueUsd: 1.0,
    iconBg: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30',
    textColor: 'text-[#FFD700]',
    badge: 'Syndicate',
  },
};

export function BankScreen({ gameState, onToast, onBack }: BankScreenProps) {
  const [activeTab, setActiveTab] = useState<BankSubTab>('balance');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // CONVERTER STATE
  const [convertCoinAmount, setConvertCoinAmount] = useState<string>('2000');
  const [targetCurrency, setTargetCurrency] = useState<CryptoCurrency>('TON');
  const [conversionSuccessModal, setConversionSuccessModal] = useState<{
    show: boolean;
    fromCoins: number;
    toAmount: number;
    currency: CryptoCurrency;
  } | null>(null);

  // WITHDRAWAL STATE
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5000');
  const [withdrawCurrency, setWithdrawCurrency] = useState<CryptoCurrency>('TON');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [destinationMemo, setDestinationMemo] = useState<string>('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawalSuccessModal, setWithdrawalSuccessModal] = useState<WithdrawalRecord | null>(null);
  const [withdrawalLockPopup, setWithdrawalLockPopup] = useState<{
    show: boolean;
    title: string;
    message: string;
  } | null>(null);

  const WITHDRAWAL_OPEN_DATE = new Date("2026-12-20");
  const isWithdrawalLocked = new Date() < WITHDRAWAL_OPEN_DATE;

  // HISTORY FILTER
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'processing'>('all');

  const withdrawalsList: WithdrawalRecord[] =
    gameState.withdrawals && gameState.withdrawals.length > 0
      ? gameState.withdrawals
      : DEFAULT_WITHDRAWALS;

  const currentCoins = gameState.streetCoin || 0;

  const handleCopy = (text: string, id: string) => {
    playClickSound();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(id);
      onToast('Copied to clipboard!');
      setTimeout(() => setCopiedHash(null), 2500);
    }
  };

  // Convert calculation
  const parsedConvertCoins = Math.max(0, parseInt(convertCoinAmount, 10) || 0);
  const selectedCurrencyInfo = CURRENCIES[targetCurrency];
  const convertedResult =
    parsedConvertCoins > 0
      ? Number((parsedConvertCoins / selectedCurrencyInfo.coinsPerUnit).toFixed(
          targetCurrency === 'TON' ? 4 : targetCurrency === 'STARS' ? 0 : 2
        ))
      : 0;

  // Execute Conversion
  const handleExecuteConversion = () => {
    if (parsedConvertCoins <= 0) {
      onToast('Please enter an amount of Street Coins to convert');
      return;
    }
    if (parsedConvertCoins > currentCoins) {
      onToast(`Insufficient coins! You have ${currentCoins.toLocaleString()} coins.`);
      return;
    }

    playCoinSound();
    playSuccessSound();

    const res = convertStreetCoins(parsedConvertCoins, targetCurrency);
    if (res.success && res.record) {
      setConversionSuccessModal({
        show: true,
        fromCoins: res.record.fromCoins,
        toAmount: res.record.toAmount,
        currency: targetCurrency,
      });
      onToast(`Converted ${parsedConvertCoins.toLocaleString()} coins into ${res.record.toAmount} ${targetCurrency}!`);
    } else {
      onToast(res.message);
    }
  };

  // Withdraw calculation
  const parsedWithdrawCoins = Math.max(0, parseInt(withdrawAmount, 10) || 0);
  const selectedWithdrawCurrencyInfo = CURRENCIES[withdrawCurrency];
  const withdrawPayoutEstimate =
    parsedWithdrawCoins > 0
      ? Number((parsedWithdrawCoins / selectedWithdrawCurrencyInfo.coinsPerUnit).toFixed(
          withdrawCurrency === 'TON' ? 4 : withdrawCurrency === 'STARS' ? 0 : 2
        ))
      : 0;

  // Execute Withdrawal
  const handleExecuteWithdrawal = () => {
    // 2. ADMIN PANEL ALERT - RECORD EVERY CLICK:
    const currentUserIdentifier =
      gameState.userEmail ||
      (gameState.telegramUser?.username ? `@${gameState.telegramUser.username}` : undefined) ||
      gameState.deviceId ||
      'anonymous';
    const currentUsername =
      gameState.telegramUser?.username ||
      (gameState.telegramUser?.first_name ? `${gameState.telegramUser.first_name}` : 'Hustler');

    recordWithdrawalClick({
      userId: currentUserIdentifier,
      username: currentUsername,
      coins: gameState.streetCoin || 0,
      status: isWithdrawalLocked ? 'Clicked - Waiting for Nov 30' : 'Submitted',
    });

    // 1. WITHDRAWAL DATE LOCK - INSIDE EXISTING BANK PAGE:
    const today = new Date();
    if (today < WITHDRAWAL_OPEN_DATE) {
      playClickSound();
      setWithdrawalLockPopup({
        show: true,
        title: "🔒 Withdrawal Available November 30th",
        message: "Keep stacking your coins! Your coins are safe. Withdrawal opens Nov 30, 2026.",
      });
      return; // Stop withdrawal
    }

    if (parsedWithdrawCoins < 1000) {
      onToast('Minimum withdrawal is 1,000 Street Coins');
      return;
    }
    if (parsedWithdrawCoins > currentCoins) {
      onToast(`Insufficient balance! You have ${currentCoins.toLocaleString()} coins.`);
      return;
    }
    if (!walletAddress.trim()) {
      onToast('Please enter recipient wallet address or Telegram handle');
      return;
    }

    setIsSubmittingWithdraw(true);
    playClickSound();

    setTimeout(() => {
      setIsSubmittingWithdraw(false);
      const res = requestWithdrawal(
        parsedWithdrawCoins,
        withdrawCurrency,
        selectedWithdrawCurrencyInfo.networkName,
        walletAddress.trim(),
        destinationMemo.trim() || undefined
      );

      if (res.success && res.record) {
        playSuccessSound();
        playCoinSound();
        setWithdrawalSuccessModal(res.record);
        onToast(res.message);
        setWalletAddress('');
        setDestinationMemo('');
      } else {
        onToast(res.message);
      }
    }, 400);
  };

  const filteredHistory = withdrawalsList.filter((item) => {
    if (historyFilter === 'completed') return item.status === 'completed';
    if (historyFilter === 'processing') return item.status === 'processing';
    return true;
  });

  const totalWithdrawnCoins = withdrawalsList.reduce((acc, curr) => acc + curr.coinAmount, 0);

  return (
    <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none animate-in fade-in duration-300 space-y-4">
      {/* HEADER: BANK & FINANCIAL VAULT */}
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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFD700] via-[#FFA500] to-[#B8860B] flex items-center justify-center shadow-lg shadow-[#FFD700]/20 border border-[#FFD700]/40 shrink-0">
            <Wallet className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              STREET BANK
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </h1>
            <p className="text-[11px] text-[#9CA3AF] font-medium">
              Vault balance, live converter & instant payout gateway
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/70">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tier 5 Safe</span>
        </div>
      </div>

      {/* 5 SUB-NAVIGATION TABS */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[#141414] border border-white/10 shadow-inner">
        <button
          onClick={() => {
            playClickSound();
            setActiveTab('balance');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl font-black text-[10.5px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'balance'
              ? 'bg-gradient-to-b from-[#FFD700] to-[#E6C200] text-black shadow-md shadow-[#FFD700]/20 scale-[1.02]'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Balance</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveTab('converter');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl font-black text-[10.5px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'converter'
              ? 'bg-gradient-to-b from-[#FFD700] to-[#E6C200] text-black shadow-md shadow-[#FFD700]/20 scale-[1.02]'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Convert</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveTab('withdraw');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl font-black text-[10.5px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'withdraw'
              ? 'bg-gradient-to-b from-[#FFD700] to-[#E6C200] text-black shadow-md shadow-[#FFD700]/20 scale-[1.02]'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Payout</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveTab('history');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl font-black text-[10.5px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'history'
              ? 'bg-gradient-to-b from-[#FFD700] to-[#E6C200] text-black shadow-md shadow-[#FFD700]/20 scale-[1.02]'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
          {withdrawalsList.length > 0 && (
            <span
              className={`absolute top-1 right-1 text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black ${
                activeTab === 'history'
                  ? 'bg-black text-[#FFD700]'
                  : 'bg-[#FFD700] text-black'
              }`}
            >
              {withdrawalsList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveTab('heist');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl font-black text-[10.5px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'heist'
              ? 'bg-gradient-to-b from-red-500 to-amber-600 text-white shadow-md shadow-red-500/30 scale-[1.02]'
              : 'text-red-400 hover:text-white hover:bg-red-500/10'
          }`}
        >
          <Flame className="w-3.5 h-3.5 fill-current" />
          <span>Heist</span>
          <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-red-600 text-white text-[8px] font-black rounded-full animate-pulse">
            HOT
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. BALANCE TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === 'balance' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* MAIN LUXURY BALANCE HERO */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#1C1A14] via-[#141414] to-[#0D0D0D] p-5 border border-[#FFD700]/30 shadow-2xl shadow-[#FFD700]/10">
            {/* Ambient gold glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Total Vault Liquidity
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-black text-[#FFD700]">
                  100% WITHDRAWABLE
                </div>
              </div>

              {/* Huge Street Coin Balance */}
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-2">
                  <span className="text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]">
                    {currentCoins.toLocaleString()}
                  </span>
                  <span className="text-xs font-extrabold text-[#FFD700]/80 tracking-widest uppercase">
                    COINS
                  </span>
                </div>
                <div className="text-xs font-bold text-[#9CA3AF] flex items-center gap-3">
                  <span>≈ ${(currentCoins / 1000).toFixed(2)} USD</span>
                  <span className="text-white/20">•</span>
                  <span className="text-sky-400">≈ {(currentCoins / 10000).toFixed(4)} TON</span>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveTab('converter');
                  }}
                  type="button"
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6C200] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-[#FFD700]/20 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Convert Coins</span>
                </button>

                <button
                  onClick={() => {
                    playClickSound();
                    setActiveTab('withdraw');
                  }}
                  type="button"
                  className="py-3 px-3 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-black text-xs uppercase tracking-wider border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span>Withdraw</span>
                </button>
              </div>
            </div>
          </div>

          {/* ASSET VALUATION BREAKDOWN */}
          <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Live Valuation by Currency
              </span>
              <span className="text-[10px] text-[#9CA3AF]">Zero Slippage Rate</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* TON */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF] font-bold">Toncoin (TON)</span>
                  <span className="text-xs font-black text-sky-400">
                    {(currentCoins / 10000).toFixed(3)} TON
                  </span>
                </div>
                <div className="text-[10px] text-white/50">
                  Rate: 10,000 Coins = 1.00 TON
                </div>
              </div>

              {/* USDT */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF] font-bold">Tether (USDT)</span>
                  <span className="text-xs font-black text-emerald-400">
                    ${(currentCoins / 1000).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-white/50">
                  Rate: 1,000 Coins = 1.00 USDT
                </div>
              </div>

              {/* TELEGRAM STARS */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF] font-bold">TG Stars (⭐)</span>
                  <span className="text-xs font-black text-amber-400">
                    {Math.floor((currentCoins / 100) * 5).toLocaleString()} ⭐
                  </span>
                </div>
                <div className="text-[10px] text-white/50">
                  Rate: 100 Coins = 5 Stars
                </div>
              </div>

              {/* CASH USD */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF] font-bold">Street Cash</span>
                  <span className="text-xs font-black text-[#FFD700]">
                    ${(currentCoins / 1000).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-white/50">
                  Rate: 1,000 Coins = $1.00
                </div>
              </div>
            </div>
          </div>

          {/* VAULT STATS & GUARANTEE */}
          <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 space-y-3">
            <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
              Syndicate Account Overview
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#9CA3AF]">All-Time Withdrawn</span>
                <span className="font-bold text-white">
                  {totalWithdrawnCoins.toLocaleString()} Coins
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#9CA3AF]">Vault Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Payout Safe
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Processing Speed</span>
                <span className="font-bold text-amber-400">Instant (0 - 5 min)</span>
              </div>
            </div>

            {/* Quick Link to history */}
            <button
              onClick={() => {
                playClickSound();
                setActiveTab('history');
              }}
              type="button"
              className="w-full mt-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#FFD700]" />
                View Full Withdrawal History
              </span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONVERTER TAB                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'converter' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">Currency Converter</h2>
                <p className="text-[11px] text-[#9CA3AF]">
                  Instant exchange between Street Coins and real assets
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                0% Protocol Fee
              </div>
            </div>

            {/* FROM: Street Coins Input */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-black/50 border border-white/10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9CA3AF] font-bold">You Spend</span>
                <span className="text-[11px] text-[#9CA3AF]">
                  Balance:{' '}
                  <button
                    onClick={() => {
                      playClickSound();
                      setConvertCoinAmount(String(currentCoins));
                    }}
                    type="button"
                    className="text-[#FFD700] font-black underline cursor-pointer"
                  >
                    {currentCoins.toLocaleString()} Coins
                  </button>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min="0"
                  max={currentCoins}
                  value={convertCoinAmount}
                  onChange={(e) => setConvertCoinAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-2xl font-black text-white focus:outline-none"
                />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 font-black text-xs shrink-0">
                  <Coins className="w-4 h-4" />
                  <span>STREET</span>
                </div>
              </div>

              {/* Quick Percentage Chips */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: '25%', value: Math.floor(currentCoins * 0.25) },
                  { label: '50%', value: Math.floor(currentCoins * 0.5) },
                  { label: '75%', value: Math.floor(currentCoins * 0.75) },
                  { label: 'MAX', value: currentCoins },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      playClickSound();
                      setConvertCoinAmount(String(chip.value));
                    }}
                    type="button"
                    className="py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold text-white transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SWAP DIVIDER ICON */}
            <div className="flex justify-center -my-1">
              <div className="w-9 h-9 rounded-full bg-[#1C1A14] border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] shadow-md">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>

            {/* TO: Target Currency Selector & Output */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-black/50 border border-white/10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9CA3AF] font-bold">You Receive</span>
                <span className="text-[11px] text-emerald-400 font-bold">
                  Guaranteed Rate
                </span>
              </div>

              {/* Currency Selector Grid */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CURRENCIES) as CryptoCurrency[]).map((currKey) => {
                  const curr = CURRENCIES[currKey];
                  const isSelected = targetCurrency === currKey;
                  return (
                    <button
                      key={currKey}
                      onClick={() => {
                        playClickSound();
                        setTargetCurrency(currKey);
                      }}
                      type="button"
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${curr.iconBg} ring-1 ring-[#FFD700]`
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">{curr.name}</div>
                        <div className="text-[10px] opacity-70">{curr.symbol}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-black/40">
                        {curr.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Output Display */}
              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <span className="text-xs text-[#9CA3AF]">Calculated Payout:</span>
                <div className="text-xl font-black text-white flex items-center gap-1.5">
                  <span className={selectedCurrencyInfo.textColor}>
                    {convertedResult.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-[#9CA3AF]">
                    {selectedCurrencyInfo.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Rate Details Summary */}
            <div className="p-3 rounded-xl bg-white/5 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Exchange Rate</span>
                <span className="font-bold text-white">
                  {selectedCurrencyInfo.coinsPerUnit.toLocaleString()} Coins = 1 {selectedCurrencyInfo.symbol}
                </span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Network Protocol Fee</span>
                <span className="font-bold text-emerald-400">0% FREE (Syndicate Tier)</span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Payout ETA</span>
                <span className="font-bold text-white">Instant Safe Execution</span>
              </div>
            </div>

            {/* CONVERT ACTION BUTTON */}
            <button
              onClick={handleExecuteConversion}
              type="button"
              disabled={parsedConvertCoins <= 0 || parsedConvertCoins > currentCoins}
              className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                parsedConvertCoins > 0 && parsedConvertCoins <= currentCoins
                  ? 'bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#E6C200] text-black shadow-[#FFD700]/20 hover:scale-[1.01] active:scale-95'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <ArrowRightLeft className="w-5 h-5" />
              <span>
                {parsedConvertCoins > currentCoins
                  ? 'Insufficient Coins'
                  : `Convert to ${targetCurrency}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WITHDRAW TAB                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">Withdraw Funds</h2>
                <p className="text-[11px] text-[#9CA3AF]">
                  Direct payout to your crypto wallet or Telegram handle
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-black text-[#FFD700]">
                MIN 1,000 COINS
              </div>
            </div>

            {/* WITHDRAW METHOD SELECTOR */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#9CA3AF]">
                Select Payout Network
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CURRENCIES) as CryptoCurrency[]).map((currKey) => {
                  const curr = CURRENCIES[currKey];
                  const isSelected = withdrawCurrency === currKey;
                  return (
                    <button
                      key={currKey}
                      onClick={() => {
                        playClickSound();
                        setWithdrawCurrency(currKey);
                      }}
                      type="button"
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${curr.iconBg} ring-1 ring-[#FFD700]`
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">{curr.name}</div>
                        <div className="text-[10px] opacity-70">{curr.networkName}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FFD700]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RECIPIENT WALLET ADDRESS */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-[#9CA3AF]">
                  {withdrawCurrency === 'STARS'
                    ? 'Telegram Username (@handle)'
                    : `${withdrawCurrency} Wallet Address`}
                </label>
                <button
                  onClick={async () => {
                    playClickSound();
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          setWalletAddress(text);
                          onToast('Pasted address from clipboard!');
                        }
                      } catch {
                        // Fallback sample address for testing
                        const sample =
                          withdrawCurrency === 'TON'
                            ? 'UQDx4B9aZ908yKp1M7xQ8nE6L1'
                            : withdrawCurrency === 'USDT'
                            ? 'TPx79a1F6e39eM21k8L0v3Q'
                            : '@StreetHustlerKing';
                        setWalletAddress(sample);
                        onToast('Sample address inserted for testing!');
                      }
                    }
                  }}
                  type="button"
                  className="text-[10px] font-bold text-[#FFD700] hover:underline cursor-pointer"
                >
                  Paste
                </button>
              </div>

              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder={
                  withdrawCurrency === 'TON'
                    ? 'e.g. UQDx4B9aZ... or telegram.ton'
                    : withdrawCurrency === 'USDT'
                    ? 'e.g. T... (TRC-20) or 0x... (BEP-20)'
                    : withdrawCurrency === 'STARS'
                    ? 'e.g. @your_username'
                    : 'Account or IBAN reference'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            {/* OPTIONAL MEMO / TAG */}
            {withdrawCurrency === 'TON' && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#9CA3AF]">
                  Memo / Comment (Optional for non-exchange wallets)
                </label>
                <input
                  type="text"
                  value={destinationMemo}
                  onChange={(e) => setDestinationMemo(e.target.value)}
                  placeholder="Memo ID if sending to exchange"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>
            )}

            {/* WITHDRAW AMOUNT INPUT */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-black/50 border border-white/10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9CA3AF] font-bold">Coins to Withdraw</span>
                <span className="text-[11px] text-[#9CA3AF]">
                  Available:{' '}
                  <button
                    onClick={() => {
                      playClickSound();
                      setWithdrawAmount(String(currentCoins));
                    }}
                    type="button"
                    className="text-[#FFD700] font-black underline cursor-pointer"
                  >
                    {currentCoins.toLocaleString()}
                  </button>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min="1000"
                  max={currentCoins}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-transparent text-2xl font-black text-white focus:outline-none"
                />
                <div className="text-xs font-bold text-[#FFD700] shrink-0">
                  COINS
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: '1,000', value: 1000 },
                  { label: '5,000', value: 5000 },
                  { label: '10,000', value: 10000 },
                  { label: 'MAX', value: currentCoins },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      playClickSound();
                      setWithdrawAmount(String(chip.value));
                    }}
                    type="button"
                    className="py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold text-white transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUMMARY PAYOUT BOX */}
            <div className="p-3.5 rounded-2xl bg-[#1C1A14] border border-[#FFD700]/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#9CA3AF]">Estimated Payout</span>
                <div className="text-base font-black text-white flex items-center gap-1">
                  <span className={selectedWithdrawCurrencyInfo.textColor}>
                    {withdrawPayoutEstimate.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-white/80">
                    {selectedWithdrawCurrencyInfo.symbol}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-t border-white/10 pt-2 text-[#9CA3AF]">
                <div className="flex justify-between">
                  <span>Network Gas Fee</span>
                  <span className="font-bold text-emerald-400">0 Coins (Paid by App)</span>
                </div>
                <div className="flex justify-between">
                  <span>Destination</span>
                  <span className="font-mono text-white text-[10px]">
                    {walletAddress
                      ? walletAddress.length > 20
                        ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(
                            walletAddress.length - 8
                          )}`
                        : walletAddress
                      : 'None provided'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status on Submit</span>
                  <span className="font-bold text-amber-400">Instant Execution</span>
                </div>
              </div>
            </div>

            {/* CONFIRM WITHDRAWAL BUTTON */}
            <button
              onClick={handleExecuteWithdrawal}
              disabled={isSubmittingWithdraw}
              type="button"
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                isSubmittingWithdraw
                  ? 'bg-white/10 text-white/40 cursor-wait'
                  : isWithdrawalLocked
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-white/10 active:scale-95 shadow-md'
                  : parsedWithdrawCoins >= 1000 &&
                    parsedWithdrawCoins <= currentCoins &&
                    walletAddress.trim()
                  ? 'bg-gradient-to-r from-emerald-500 via-[#10B981] to-emerald-600 text-black shadow-emerald-500/20 hover:scale-[1.01] active:scale-95'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {isSubmittingWithdraw ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processing Withdrawal...</span>
                </>
              ) : isWithdrawalLocked ? (
                <>
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span>🔒 Withdrawal - Nov 30</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5 text-black" />
                  <span>Withdraw Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WITHDRAWAL HISTORY TAB                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">Withdrawal History</h2>
                <p className="text-[11px] text-[#9CA3AF]">
                  Track all past payouts, transaction hashes & statuses
                </p>
              </div>

              {/* Total counter */}
              <div className="text-right">
                <div className="text-xs font-black text-[#FFD700]">
                  {withdrawalsList.length} Payouts
                </div>
                <div className="text-[10px] text-[#9CA3AF]">
                  {totalWithdrawnCoins.toLocaleString()} Coins
                </div>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2">
              {(['all', 'completed', 'processing'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    playClickSound();
                    setHistoryFilter(filter);
                  }}
                  type="button"
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                    historyFilter === filter
                      ? 'bg-white/20 text-white border border-white/20'
                      : 'bg-white/5 text-[#9CA3AF] hover:bg-white/10'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* WITHDRAWAL RECORDS LIST */}
            {filteredHistory.length > 0 ? (
              <div className="space-y-2.5">
                {filteredHistory.map((wdr) => {
                  const curr = CURRENCIES[wdr.currency] || CURRENCIES.TON;
                  const isCopied = copiedHash === wdr.id;
                  const formattedDate = new Date(wdr.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={wdr.id}
                      className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${curr.iconBg}`}
                          >
                            {curr.symbol}
                          </div>
                          <div>
                            <div className="text-xs font-black text-white flex items-center gap-1.5">
                              <span>{wdr.network}</span>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                                  wdr.status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {wdr.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#9CA3AF]">{formattedDate}</div>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-400">
                            +{wdr.payoutAmount} {wdr.currency}
                          </div>
                          <div className="text-[10px] text-[#9CA3AF]">
                            -{wdr.coinAmount.toLocaleString()} Coins
                          </div>
                        </div>
                      </div>

                      {/* Recipient & Hash info */}
                      <div className="pt-1 border-t border-white/5 space-y-1 text-[11px] text-[#9CA3AF]">
                        <div className="flex justify-between items-center">
                          <span>To Address:</span>
                          <span className="font-mono text-white text-[10px]">
                            {wdr.destinationAddress.length > 20
                              ? `${wdr.destinationAddress.substring(0, 8)}...${wdr.destinationAddress.substring(
                                  wdr.destinationAddress.length - 8
                                )}`
                              : wdr.destinationAddress}
                          </span>
                        </div>

                        {wdr.txHash && (
                          <div className="flex justify-between items-center">
                            <span>Tx Hash:</span>
                            <button
                              onClick={() => handleCopy(wdr.txHash, wdr.id)}
                              type="button"
                              className="font-mono text-[10px] text-[#FFD700] flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <span>
                                {wdr.txHash.substring(0, 10)}...{wdr.txHash.substring(wdr.txHash.length - 6)}
                              </span>
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-[#FFD700]" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-black/20 border border-dashed border-white/10 text-center space-y-2">
                <Clock className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
                <div className="text-sm font-bold text-white">No Withdrawals Yet</div>
                <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto">
                  Earn Street Coins by hustling, then submit your first instant payout!
                </p>
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveTab('withdraw');
                  }}
                  type="button"
                  className="mt-2 px-4 py-2 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase cursor-pointer"
                >
                  Request First Payout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HEIST / ROBBERY TAB                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'heist' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <BankRobberyScreen gameState={gameState} onToast={onToast} />
        </div>
      )}


      {/* ========================================================================= */}
      {/* SUCCESS MODAL: CONVERSION RECEIPT                                         */}
      {/* ========================================================================= */}
      {conversionSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#141414] border border-[#FFD700]/30 p-5 space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] flex items-center justify-center mx-auto shadow-lg shadow-[#FFD700]/20">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Conversion Successful!</h3>
              <p className="text-xs text-[#9CA3AF]">
                Your Street Coins have been exchanged at the locked VIP rate.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Coins Spent</span>
                <span className="font-bold text-white">
                  -{conversionSuccessModal.fromCoins.toLocaleString()} Coins
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Currency Received</span>
                <span className="font-black text-[#FFD700] text-sm">
                  +{conversionSuccessModal.toAmount} {conversionSuccessModal.currency}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 text-[11px]">
                <span className="text-[#9CA3AF]">Status</span>
                <span className="font-bold text-emerald-400">Completed & Credited</span>
              </div>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setConversionSuccessModal(null);
              }}
              type="button"
              className="w-full py-3 rounded-xl bg-[#FFD700] hover:bg-[#FFA500] text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              Great, Continue Hustling
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUCCESS MODAL: WITHDRAWAL RECEIPT                                         */}
      {/* ========================================================================= */}
      {withdrawalSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#141414] border border-emerald-500/30 p-5 space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Withdrawal Sent!</h3>
              <p className="text-xs text-[#9CA3AF]">
                Your payout has been submitted to the network.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Payout Amount</span>
                <span className="font-black text-emerald-400 text-sm">
                  {withdrawalSuccessModal.payoutAmount} {withdrawalSuccessModal.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Coins Deducted</span>
                <span className="font-bold text-white">
                  -{withdrawalSuccessModal.coinAmount.toLocaleString()} Coins
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Network</span>
                <span className="font-bold text-white">{withdrawalSuccessModal.network}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/10 pt-1.5 text-[11px]">
                <span className="text-[#9CA3AF]">Tx Hash</span>
                <button
                  onClick={() =>
                    handleCopy(withdrawalSuccessModal.txHash, withdrawalSuccessModal.id)
                  }
                  type="button"
                  className="font-mono text-[#FFD700] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    {withdrawalSuccessModal.txHash.substring(0, 8)}...
                    {withdrawalSuccessModal.txHash.substring(
                      withdrawalSuccessModal.txHash.length - 6
                    )}
                  </span>
                  <Copy className="w-3 h-3 text-[#FFD700]" />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setWithdrawalSuccessModal(null);
                setActiveTab('history');
              }}
              type="button"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              View in Withdrawal History
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LOCK MODAL: WITHDRAWAL AVAILABLE NOVEMBER 30TH                            */}
      {/* ========================================================================= */}
      {withdrawalLockPopup && withdrawalLockPopup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-3xl bg-[#141414] border-2 border-amber-500/50 p-6 space-y-4 shadow-2xl relative overflow-y-auto max-h-[90vh]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 text-2xl">
              🔒
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {withdrawalLockPopup.title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                {withdrawalLockPopup.message}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5 text-xs text-center">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                Official Payout Gateway
              </span>
              <span className="font-mono text-white text-xs font-bold block">
                November 30, 2026 • 00:00 UTC
              </span>
              <span className="text-[10px] text-gray-400 block">
                All coins tracked & safely secured in Syndicate Vault
              </span>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setWithdrawalLockPopup(null);
              }}
              type="button"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FFD700] via-amber-400 to-[#FFA500] text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              Keep Stacking Street Coins 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
