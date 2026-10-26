'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet as WalletIcon,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  RefreshCw,
  Copy,
  Plus,
  Coins,
  ShieldCheck,
  Clock,
  ArrowRight,
  TrendingDown,
  Lock,
  Unlock,
  Building,
  Send,
  Sparkles,
  Info,
  Calendar,
  ChevronRight,
  Check,
  AlertCircle,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  UNLOCK_DATE,
  getAdminWallet,
  deductFromAdminWallet,
  getLockedWithdrawals,
  saveLockedWithdrawals,
  LockedWithdrawal,
} from '@/src/wallet/AdminWallet';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';

export interface PlayerWalletState {
  address: string;
  type: 'telegram' | 'tonkeeper';
  connected: boolean;
  tonBalance: number;
  usdtBalance?: number;
  connectedAt?: number;
}

const STORAGE_PLAYER_WALLET = 'streetlife_player_wallet';
const STORAGE_USDT_BALANCE = 'streetlife_usdt_balance';
const STORAGE_TON_BALANCE = 'streetlife_ton_balance';
const COINS_PER_TON = 100; // Conversion rate: 100 game coins = 1 TON for withdrawal
const SC_PER_USDT = 100000; // Fixed rate: 100,000 SC = 1 USDT = 1 USD

// ============================================================================
// STORAGE & UNLOCK HELPERS
// ============================================================================

export function getPlayerWallet(): PlayerWalletState {
  if (typeof window === 'undefined') {
    return {
      address: '',
      type: 'telegram',
      connected: false,
      tonBalance: 0,
      usdtBalance: 0,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_PLAYER_WALLET);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.connected === 'boolean') {
        const storedUsdt = localStorage.getItem(STORAGE_USDT_BALANCE);
        const storedTon = localStorage.getItem(STORAGE_TON_BALANCE);
        return {
          ...parsed,
          tonBalance: storedTon ? parseFloat(storedTon) || parsed.tonBalance || 0 : parsed.tonBalance || 0,
          usdtBalance: storedUsdt ? parseFloat(storedUsdt) || parsed.usdtBalance || 0 : parsed.usdtBalance || 0,
        };
      }
    }
  } catch (e) {
    console.error('Error reading player wallet:', e);
  }
  return {
    address: '',
    type: 'telegram',
    connected: false,
    tonBalance: 0,
    usdtBalance: 0,
  };
}

export function savePlayerWallet(wallet: PlayerWalletState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PLAYER_WALLET, JSON.stringify(wallet));
    if (typeof wallet.usdtBalance === 'number') {
      localStorage.setItem(STORAGE_USDT_BALANCE, wallet.usdtBalance.toString());
    }
    if (typeof wallet.tonBalance === 'number') {
      localStorage.setItem(STORAGE_TON_BALANCE, wallet.tonBalance.toString());
    }
    window.dispatchEvent(new CustomEvent('streetlife_player_wallet_changed', { detail: wallet }));
  } catch (e) {
    console.error('Error saving player wallet:', e);
  }
}

/**
 * Check unlocks on page load:
 * If Date.now() >= UNLOCK_DATE, unlock all locked withdrawals and credit to player's tonBalance.
 */
export function checkUnlocks(): { unlockedCount: number; creditedTON: number } {
  if (typeof window === 'undefined') return { unlockedCount: 0, creditedTON: 0 };
  const now = Date.now();
  if (now < UNLOCK_DATE) return { unlockedCount: 0, creditedTON: 0 };

  try {
    const allWithdrawals = getLockedWithdrawals();
    const playerWallet = getPlayerWallet();
    let unlockedCount = 0;
    let creditedTON = 0;

    const updatedList = allWithdrawals.map((item) => {
      if (item.status === 'locked' && now >= item.unlockDate) {
        unlockedCount++;
        creditedTON += item.amountTON;
        return {
          ...item,
          status: 'unlocked' as const,
        };
      }
      return item;
    });

    if (unlockedCount > 0) {
      saveLockedWithdrawals(updatedList);
      if (playerWallet.connected) {
        savePlayerWallet({
          ...playerWallet,
          tonBalance: Number((playerWallet.tonBalance + creditedTON).toFixed(4)),
        });
      }
    }

    return { unlockedCount, creditedTON };
  } catch (e) {
    console.error('Error executing checkUnlocks:', e);
    return { unlockedCount: 0, creditedTON: 0 };
  }
}

// Format countdown helper
function formatTimeLeft(targetMs: number) {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isUnlocked: diff <= 0,
    formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
  };
}

// ============================================================================
// WALLET COMPONENT WITH SWAP SECTION
// ============================================================================

export interface WalletProps {
  currentCoins?: number;
  onCoinsChange?: (newCoins: number) => void;
  onToast?: (msg: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function WalletComponent({
  currentCoins = 50000,
  onCoinsChange,
  onToast,
  isOpen = false,
  onClose,
}: WalletProps) {
  const [wallet, setWallet] = useState<PlayerWalletState>(() => getPlayerWallet());
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastWithdrawalInfo, setLastWithdrawalInfo] = useState<LockedWithdrawal | null>(null);

  // Live countdown timer state
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(UNLOCK_DATE));

  // Withdraw form inputs & validation
  const [withdrawAmountTON, setWithdrawAmountTON] = useState<string>('5');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // List of player's withdrawals
  const [allWithdrawals, setAllWithdrawals] = useState<LockedWithdrawal[]>(() => getLockedWithdrawals());

  // Player coins in reactive state
  const [coins, setCoins] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('streetlife_coins');
      if (stored) {
        const p = parseInt(stored, 10);
        if (!isNaN(p)) return p;
      }
    }
    return currentCoins;
  });

  // Crypto Balances (USDT & TON)
  const [usdtBalance, setUsdtBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_USDT_BALANCE);
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val)) return val;
      }
    }
    return wallet.usdtBalance || 0;
  });

  const [tonBalance, setTonBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_TON_BALANCE);
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val)) return val;
      }
    }
    return wallet.tonBalance || 0;
  });

  // ============================================================================
  // SWAP SECTION STATE
  // ============================================================================
  const [swapTarget, setSwapTarget] = useState<'USDT' | 'TON'>('USDT');
  const [scInput, setScInput] = useState<string>('');
  const [tonPrice, setTonPrice] = useState<number>(5.0); // Placeholder 5 USD/TON or live rate
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Fetch live TON price with 5.0 fallback
  useEffect(() => {
    let isMounted = true;
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.['the-open-network']?.usd) {
          const price = Number(data['the-open-network'].usd);
          if (price > 0) setTonPrice(price);
        }
      })
      .catch(() => {
        // Fallback default 5.0
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else console.log(msg);
    },
    [onToast]
  );

  // Sync state & check unlocks on mount
  useEffect(() => {
    // Run unlock verification
    const { unlockedCount, creditedTON } = checkUnlocks();
    if (unlockedCount > 0) {
      toast(`🎉 ${unlockedCount} Locked withdrawal(s) unlocked! +${creditedTON} TON received.`);
    }

    const handlePlayerWalletChange = (e: Event) => {
      const customEvent = e as CustomEvent<PlayerWalletState>;
      if (customEvent.detail) {
        setWallet(customEvent.detail);
        if (typeof customEvent.detail.usdtBalance === 'number') {
          setUsdtBalance(customEvent.detail.usdtBalance);
        }
        if (typeof customEvent.detail.tonBalance === 'number') {
          setTonBalance(customEvent.detail.tonBalance);
        }
      } else {
        const pw = getPlayerWallet();
        setWallet(pw);
        setUsdtBalance(pw.usdtBalance || 0);
        setTonBalance(pw.tonBalance || 0);
      }
    };

    const handleWithdrawalsChange = (e: Event) => {
      const customEvent = e as CustomEvent<LockedWithdrawal[]>;
      if (customEvent.detail) setAllWithdrawals(customEvent.detail);
      else setAllWithdrawals(getLockedWithdrawals());
    };

    window.addEventListener('streetlife_player_wallet_changed', handlePlayerWalletChange);
    window.addEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
    window.addEventListener('storage', handlePlayerWalletChange);

    // Countdown interval
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(UNLOCK_DATE));
    }, 1000);

    return () => {
      window.removeEventListener('streetlife_player_wallet_changed', handlePlayerWalletChange);
      window.removeEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
      window.removeEventListener('storage', handlePlayerWalletChange);
      clearInterval(interval);
    };
  }, [toast]);

  // Sync coins from external storage events
  useEffect(() => {
    const handleCoinsSync = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('streetlife_coins');
        if (stored) {
          const p = parseInt(stored, 10);
          if (!isNaN(p)) setCoins(p);
        }
      }
    };
    window.addEventListener('storage', handleCoinsSync);
    window.addEventListener('streetlife_coins_changed', handleCoinsSync);
    return () => {
      window.removeEventListener('storage', handleCoinsSync);
      window.removeEventListener('streetlife_coins_changed', handleCoinsSync);
    };
  }, []);

  // Player's personal withdrawals
  const playerWithdrawals = useMemo(() => {
    if (!wallet.connected || !wallet.address) return [];
    return allWithdrawals.filter((w) => w.playerAddress === wallet.address);
  }, [allWithdrawals, wallet.connected, wallet.address]);

  // Connect Simulation for Player: ONLY 2 OPTIONS (Telegram Wallet and Tonkeeper)
  const handleConnect = (walletType: 'telegram' | 'tonkeeper') => {
    playClickSound();
    playSuccessSound();

    // Generate clean simulated TON user address
    const prefix = walletType === 'telegram' ? 'UQ-tg-' : 'UQ-tonk-';
    const randomHex = Math.random().toString(16).substring(2, 8) + Math.random().toString(16).substring(2, 8);
    const simulatedAddress = `${prefix}${randomHex}`;

    const newPlayerWallet: PlayerWalletState = {
      address: simulatedAddress,
      type: walletType,
      connected: true,
      tonBalance: tonBalance,
      usdtBalance: usdtBalance,
      connectedAt: Date.now(),
    };

    savePlayerWallet(newPlayerWallet);
    setWallet(newPlayerWallet);
    setIsConnectModalOpen(false);
    toast(`💎 Connected to ${walletType === 'telegram' ? 'Telegram @wallet' : 'Tonkeeper'}!`);
  };

  const handleDisconnect = () => {
    playClickSound();
    const disconnected: PlayerWalletState = {
      address: '',
      type: 'telegram',
      connected: false,
      tonBalance: tonBalance,
      usdtBalance: usdtBalance,
    };
    savePlayerWallet(disconnected);
    setWallet(disconnected);
    toast('🔌 Wallet disconnected');
  };

  // ============================================================================
  // SWAP CALCULATIONS & HANDLERS
  // ============================================================================
  const scAmountNumber = useMemo(() => {
    const parsed = parseInt(scInput, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [scInput]);

  // Live preview calculations
  const usdtValue = useMemo(() => {
    if (scAmountNumber <= 0) return 0;
    return scAmountNumber / SC_PER_USDT;
  }, [scAmountNumber]);

  const tonAmount = useMemo(() => {
    if (usdtValue <= 0 || tonPrice <= 0) return 0;
    return usdtValue / tonPrice;
  }, [usdtValue, tonPrice]);

  const handleMaxSc = () => {
    playClickSound();
    setScInput(coins > 0 ? coins.toString() : '0');
  };

  const handleConfirmSwap = () => {
    playClickSound();
    if (scAmountNumber <= 0) {
      toast('⚠️ Please enter an amount of SC to swap');
      return;
    }
    if (scAmountNumber > coins) {
      toast(`⚠️ Insufficient SC balance! You have ${coins.toLocaleString()} SC.`);
      return;
    }

    setIsSwapping(true);
    playCoinSound();
    playSuccessSound();

    // 1. Deduct SC
    const updatedCoins = coins - scAmountNumber;
    setCoins(updatedCoins);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('streetlife_coins', String(updatedCoins));
      } catch {}
    }
    if (onCoinsChange) {
      onCoinsChange(updatedCoins);
    }
    addGameCoins(
      -scAmountNumber,
      `Swapped ${scAmountNumber.toLocaleString()} SC to ${
        swapTarget === 'USDT' ? `${usdtValue.toFixed(4)} USDT` : `${tonAmount.toFixed(4)} TON`
      }`,
      'conversion'
    );

    // 2. Add to USDT or TON balance
    let newUsdt = usdtBalance;
    let newTon = tonBalance;

    if (swapTarget === 'USDT') {
      newUsdt = Number((usdtBalance + usdtValue).toFixed(4));
      setUsdtBalance(newUsdt);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_USDT_BALANCE, newUsdt.toString());
      }
    } else {
      newTon = Number((tonBalance + tonAmount).toFixed(6));
      setTonBalance(newTon);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_TON_BALANCE, newTon.toString());
      }
    }

    // 3. Update player wallet object in localStorage & state
    const updatedWallet: PlayerWalletState = {
      ...wallet,
      usdtBalance: newUsdt,
      tonBalance: newTon,
    };
    savePlayerWallet(updatedWallet);
    setWallet(updatedWallet);

    // 4. Confetti & Success Toast
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    const receivedText =
      swapTarget === 'USDT'
        ? `${usdtValue.toFixed(4)} USDT`
        : `${tonAmount.toFixed(4)} TON`;
    toast(`🎉 Successfully swapped ${scAmountNumber.toLocaleString()} SC into ${receivedText}!`);

    // Reset input
    setScInput('');
    setIsSwapping(false);
  };

  // WITHDRAWAL SYSTEM VALIDATION & EXECUTION (UNTOUCHED)
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    const amount = parseFloat(withdrawAmountTON);

    // Validation 1: Minimum 1 TON
    if (isNaN(amount) || amount < 1) {
      setWithdrawError('Minimum withdrawal is 1 TON');
      playClickSound();
      return;
    }

    // Validation 2: Check game coins (100 coins = 1 TON)
    const requiredCoins = amount * COINS_PER_TON;
    if (coins < requiredCoins) {
      setWithdrawError(
        `Insufficient game coins! You need ${requiredCoins.toLocaleString()} coins for ${amount} TON (You have ${coins.toLocaleString()} coins).`
      );
      playClickSound();
      return;
    }

    // Validation 3: Check Admin Wallet Connection
    const adminWallet = getAdminWallet();
    if (!adminWallet.connected) {
      setWithdrawError('Withdrawal facility under maintenance - Admin wallet not connected yet. Please try later.');
      playClickSound();
      return;
    }

    // Validation 4: Check Admin Wallet Treasury Balance
    if (adminWallet.balance < amount) {
      setWithdrawError(
        `Treasury low - contact admin. Admin balance is currently ${adminWallet.balance} TON.`
      );
      playClickSound();
      return;
    }

    // EXECUTION OF VALID WITHDRAWAL
    playCoinSound();
    playSuccessSound();

    // 1. Deduct coins from player
    const updatedCoins = coins - requiredCoins;
    setCoins(updatedCoins);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('streetlife_coins', String(updatedCoins));
      } catch {}
    }
    if (onCoinsChange) {
      onCoinsChange(updatedCoins);
    }
    addGameCoins(-requiredCoins, `Withdrawal of ${amount} TON (100 coins/TON)`, 'withdrawal');

    // 2. Call deductFromAdminWallet(amount)
    const deductSuccess = deductFromAdminWallet(amount);
    if (!deductSuccess) {
      setWithdrawError('Failed to reserve funds from Admin Treasury.');
      return;
    }

    // 3. Create locked withdrawal object
    const newLockedItem: LockedWithdrawal = {
      id: `wth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerAddress: wallet.address,
      amountTON: amount,
      requestedAt: Date.now(),
      unlockDate: UNLOCK_DATE,
      status: 'locked',
      type: wallet.type,
      txHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
    };

    // 4. Save to localStorage key: streetlife_locked_withdrawals array
    const updatedAll = [newLockedItem, ...getLockedWithdrawals()];
    saveLockedWithdrawals(updatedAll);
    setAllWithdrawals(updatedAll);

    // 5. Show success modal with countdown
    setLastWithdrawalInfo(newLockedItem);
    setIsWithdrawModalOpen(false);
    setIsSuccessModalOpen(true);
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
    toast(`🔒 ${amount} TON successfully locked until Dec 20, 2026!`);
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (!wallet.address) return;
    playClickSound();
    navigator.clipboard?.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('📋 Address copied');
  };

  return (
    <>
      {/* =========================================================================
          EMBEDDED OR STANDALONE PLAYER WALLET VIEW
         ========================================================================= */}
      <div className="w-full space-y-4 select-none">
        {/* Top Player Connection Bar */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-[#111622] via-[#0d121c] to-[#0a0d14] border-2 border-[#0098EA]/40 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-cyan-400 p-0.5 shadow-md">
                <div className="w-full h-full rounded-[14px] bg-[#0c121d] flex items-center justify-center text-white">
                  <WalletIcon className="w-6 h-6 text-[#00c0f9]" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase text-white tracking-wider">
                    {wallet.connected ? 'TON WALLET' : 'WALLET UNCONNECTED'}
                  </span>
                  {wallet.connected && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{wallet.type === 'telegram' ? 'Telegram' : 'Tonkeeper'}</span>
                    </span>
                  )}
                </div>

                {wallet.connected ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-gray-300">
                      {truncateAddress(wallet.address)}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="text-gray-400 hover:text-white"
                      title="Copy Address"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Connect Telegram Wallet or Tonkeeper to withdraw yields
                  </p>
                )}
              </div>
            </div>

            {/* Top Right Connect / Disconnect Action (KEPT EXACTLY AS IS) */}
            <div>
              {wallet.connected ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      playClickSound();
                      setIsWithdrawModalOpen(true);
                    }}
                    type="button"
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer hover:brightness-110 flex items-center gap-1"
                  >
                    <Coins className="w-3.5 h-3.5 fill-black" />
                    <span>Withdraw</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    type="button"
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                    title="Disconnect Wallet"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    playClickSound();
                    setIsConnectModalOpen(true);
                  }}
                  type="button"
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#0098EA] to-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,152,234,0.4)] active:scale-95 hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <WalletIcon className="w-3.5 h-3.5 fill-black" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Existing Balance & Conversion Rate Card */}
        <div className="grid grid-cols-2 gap-3">
          {/* Game Coins */}
          <div className="p-3.5 rounded-2xl bg-[#14141c] border border-white/10 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">
              Available Street Coins
            </span>
            <div className="text-lg font-black text-[#FFD700] font-mono flex items-center gap-1">
              <span>{coins.toLocaleString()}</span>
              <span className="text-xs">SC</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono block">
              = {(coins / COINS_PER_TON).toFixed(2)} TON Potential
            </span>
          </div>

          {/* TON Yield Rate */}
          <div className="p-3.5 rounded-2xl bg-[#14141c] border border-white/10 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">
              Yield Exchange Rate
            </span>
            <div className="text-lg font-black text-cyan-300 font-mono">
              100 SC = 1 TON
            </div>
            <span className="text-[10px] text-emerald-400 font-mono block flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Dec 20, 2026 Vault</span>
            </span>
          </div>
        </div>

        {/* Crypto Balances Overview Strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-[#0e1626] border border-[#0098EA]/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-gray-400 block">
                TON Balance
              </span>
              <span className="text-sm font-black text-cyan-300 font-mono">
                {tonBalance.toFixed(4)} TON
              </span>
            </div>
            <div className="w-7 h-7 rounded-xl bg-[#0098EA]/20 flex items-center justify-center text-[#00c0f9] text-xs font-bold">
              TON
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#0e1d17] border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-gray-400 block">
                USDT Balance
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                ${usdtBalance.toFixed(2)} USDT
              </span>
            </div>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
              $
            </div>
          </div>
        </div>

        {/* =====================================================================
            NEW SWAP SECTION INSIDE WALLET (AFTER EXISTING BALANCES)
           ===================================================================== */}
        <div className="p-4 rounded-3xl bg-gradient-to-b from-[#161a26] to-[#0f121b] border-2 border-cyan-500/40 shadow-xl space-y-3.5">
          {/* 1. Swap Section Title & Rate Display */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-black shadow-md">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black uppercase text-white tracking-wider">
                Swap SC
              </h4>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold">
              Rate: 100,000 SC = 1 USDT
            </span>
          </div>

          {/* 2. Show SC balance */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium">Your SC:</span>
            <span className="font-mono font-bold text-[#FFD700] text-sm">
              {coins.toLocaleString()} SC
            </span>
          </div>

          {/* 5. Toggle: "To USDT" / "To TON" */}
          <div className="flex items-center gap-2 p-1 bg-black/60 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setSwapTarget('USDT');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                swapTarget === 'USDT'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>To USDT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                setSwapTarget('TON');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                swapTarget === 'TON'
                  ? 'bg-gradient-to-r from-[#0098EA] to-cyan-400 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>To TON</span>
            </button>
          </div>

          {/* 3. Input field: "Enter SC amount" with Max button */}
          <div className="space-y-1">
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={scInput}
                onChange={(e) => setScInput(e.target.value)}
                placeholder="Enter SC amount"
                className="w-full bg-black/70 border border-white/15 focus:border-cyan-400 rounded-2xl px-3.5 py-2.5 text-base font-black text-white font-mono placeholder:text-gray-600 focus:outline-none transition-colors pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMaxSc}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                >
                  Max
                </button>
              </div>
            </div>
          </div>

          {/* 4. Live preview calculation on typing:
             usdtValue = scAmount / 100000
             tonAmount = usdtValue / tonPrice
             Display: "{scAmount} SC = {usdtValue} USDT = {tonAmount} TON" */}
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">
              Live Preview Calculation:
            </span>
            <div className="text-xs font-mono font-bold text-white break-all flex flex-wrap items-center gap-1">
              <span className="text-[#FFD700]">{scAmountNumber.toLocaleString()} SC</span>
              <span className="text-gray-500">=</span>
              <span className="text-emerald-400">{usdtValue.toFixed(4)} USDT</span>
              <span className="text-gray-500">=</span>
              <span className="text-cyan-300">{tonAmount.toFixed(4)} TON</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1 border-t border-white/5">
              <span>Middle Step: 100k SC = 1 USDT</span>
              <span>1 TON ≈ ${tonPrice.toFixed(2)} USD</span>
            </div>
          </div>

          {/* 6. Confirm Swap button */}
          <button
            type="button"
            disabled={isSwapping || scAmountNumber <= 0 || scAmountNumber > coins}
            onClick={handleConfirmSwap}
            className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              scAmountNumber > 0 && scAmountNumber <= coins
                ? swapTarget === 'USDT'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-black hover:brightness-110 shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-[#0098EA] via-cyan-400 to-sky-400 text-black hover:brightness-110 shadow-cyan-500/30'
                : 'bg-white/10 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>
              {scAmountNumber > coins
                ? 'Insufficient SC Balance'
                : scAmountNumber <= 0
                ? 'Enter SC Amount'
                : `Confirm Swap to ${swapTarget}`}
            </span>
          </button>
        </div>

        {/* Global Locked Countdown Strip (KEPT AS IS) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-black/60 to-black/80 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                GLOBAL UNLOCK DATE: DEC 20, 2026
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {timeLeft.formatted}
              </span>
            </div>
          </div>

          <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase font-mono">
            {timeLeft.isUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </span>
        </div>

        {/* Player's Locked Withdrawals List (KEPT AS IS) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Locked Withdrawals ({playerWithdrawals.length})</span>
            </h4>

            {wallet.connected && (
              <button
                onClick={() => {
                  playClickSound();
                  setIsWithdrawModalOpen(true);
                }}
                type="button"
                className="text-xs font-black text-[#00c0f9] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>+ New Withdraw</span>
              </button>
            )}
          </div>

          {playerWithdrawals.length === 0 ? (
            <div className="p-6 rounded-3xl bg-black/40 border border-white/5 text-center space-y-2">
              <p className="text-xs text-gray-400">
                {wallet.connected
                  ? 'You have not submitted any withdrawals yet. Minimum 1 TON (100 coins).'
                  : 'Connect your wallet above to withdraw TON yields locked until Dec 20, 2026.'}
              </p>
              {wallet.connected && (
                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Start First Withdrawal
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {playerWithdrawals.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-[#14141d] border border-white/10 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white text-sm">
                        {item.amountTON} TON
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                        {item.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono block">
                      Requested: {new Date(item.requestedAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono block">
                      Unlock: Dec 20, 2026 UTC
                    </span>
                  </div>

                  <div className="text-right space-y-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                        item.status === 'locked'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : item.status === 'unlocked'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {item.status === 'locked' ? (
                        <>
                          <Lock className="w-2.5 h-2.5" />
                          <span>LOCKED</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-2.5 h-2.5" />
                          <span>UNLOCKED</span>
                        </>
                      )}
                    </span>
                    <p className="text-[9px] text-gray-500 font-mono">
                      {item.status === 'locked' ? 'Awaiting Dec 20' : 'Credited'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL: CONNECT PLAYER WALLET (ONLY 2 OPTIONS: TELEGRAM & TONKEEPER)
         ========================================================================= */}
      {(isConnectModalOpen || (isOpen && !wallet.connected)) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#15151e] border-2 border-[#0098EA]/60 rounded-3xl p-6 shadow-[0_0_35px_rgba(0,152,234,0.3)] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsConnectModalOpen(false);
                if (onClose) onClose();
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-cyan-400 p-0.5 flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-[#0098EA]/30">
              <div className="w-full h-full rounded-[14px] bg-[#0d1422] flex items-center justify-center text-white">
                <WalletIcon className="w-8 h-8 text-[#00c0f9]" />
              </div>
            </div>

            <h3 className="text-lg font-black text-white uppercase tracking-wider text-center mb-1">
              Connect TON Wallet
            </h3>
            <p className="text-xs text-gray-400 text-center mb-5">
              Choose your wallet for automated Dec 20, 2026 yield disbursements
            </p>

            {/* ONLY 2 OPTIONS REQUIRED */}
            <div className="space-y-3">
              {/* Option 1: Connect Telegram Wallet */}
              <button
                onClick={() => handleConnect('telegram')}
                type="button"
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0088cc]/20 to-[#0088cc]/10 hover:from-[#0088cc]/30 hover:to-[#0088cc]/20 border border-[#0088cc]/50 text-left transition-all active:scale-95 cursor-pointer flex items-center justify-between group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Send className="w-6 h-6 -rotate-45" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white uppercase tracking-wider block">
                      Connect Telegram Wallet
                    </span>
                    <span className="text-xs text-cyan-300 font-semibold">
                      Use @wallet in Telegram
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 2: Connect Tonkeeper */}
              <button
                onClick={() => handleConnect('tonkeeper')}
                type="button"
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0098EA]/20 to-[#0098EA]/10 hover:from-[#0098EA]/30 hover:to-[#0098EA]/20 border border-[#0098EA]/50 text-left transition-all active:scale-95 cursor-pointer flex items-center justify-between group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0098EA] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white uppercase tracking-wider block">
                      Connect Tonkeeper
                    </span>
                    <span className="text-xs text-[#00c0f9] font-semibold">
                      TON Wallet
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-5 p-3 rounded-2xl bg-black/50 border border-white/5 text-[11px] text-gray-400 text-center font-mono">
              Non-custodial connection • Street Life Dec 20, 2026 Protocol
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: WITHDRAWAL FORM (KEPT EXACTLY AS IS - MINIMUM WITHDRAWAL UNTOUCHED)
         ========================================================================= */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#15151e] border-2 border-emerald-500/70 rounded-3xl p-6 shadow-[0_0_35px_rgba(16,185,129,0.3)] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsWithdrawModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Coins className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-wider text-center mb-1">
              Request TON Withdrawal
            </h3>
            <p className="text-xs text-gray-400 text-center mb-4">
              Funds will be locked in the Street Life Treasury until Dec 20, 2026
            </p>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              {/* Amount input in TON */}
              <div>
                <label className="text-[11px] font-mono uppercase text-gray-300 block mb-1">
                  Amount in TON (Min 1 TON):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={withdrawAmountTON}
                    onChange={(e) => {
                      setWithdrawAmountTON(e.target.value);
                      setWithdrawError(null);
                    }}
                    className="w-full bg-black/60 border border-white/20 rounded-2xl px-4 py-3 text-lg font-black text-white font-mono focus:outline-none focus:border-emerald-400"
                    placeholder="e.g. 5"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-400 font-mono">
                    TON
                  </span>
                </div>
              </div>

              {/* Conversion Preview */}
              <div className="p-3 rounded-2xl bg-black/50 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Required Game Coins:</span>
                  <span className="text-white font-bold">
                    {((parseFloat(withdrawAmountTON) || 0) * COINS_PER_TON).toLocaleString()} SC
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Your Current Balance:</span>
                  <span className="text-[#FFD700] font-bold">
                    {coins.toLocaleString()} SC
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Receiving Address:</span>
                  <span className="text-cyan-300 font-bold truncate max-w-[130px]">
                    {truncateAddress(wallet.address)}
                  </span>
                </div>
              </div>

              {/* Error Warning */}
              {withdrawError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{withdrawError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer hover:brightness-110 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4 fill-black" />
                <span>Lock &amp; Confirm Withdrawal</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: WITHDRAWAL SUCCESS & COUNTDOWN
         ========================================================================= */}
      {isSuccessModalOpen && lastWithdrawalInfo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161622] border-2 border-[#FFD700] rounded-3xl p-6 shadow-[0_0_40px_rgba(255,215,0,0.35)] text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#FFD700] p-0.5 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#FFD700]/30">
              <div className="w-full h-full rounded-[14px] bg-[#1a1405] flex items-center justify-center text-black">
                <Lock className="w-8 h-8 text-[#FFD700]" />
              </div>
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-wider mb-2">
              Withdrawal Locked
            </h3>

            <p className="text-xs text-gray-300 leading-relaxed mb-3">
              Withdrawal of{' '}
              <strong className="text-cyan-300 font-mono text-sm">
                {lastWithdrawalInfo.amountTON} TON
              </strong>{' '}
              locked until December 20, 2026.
            </p>

            <div className="p-3 rounded-2xl bg-black/60 border border-white/10 mb-4 text-xs font-mono space-y-1 text-left">
              <div className="flex items-center justify-between text-gray-400">
                <span>Destination:</span>
                <span className="text-white font-bold">
                  {lastWithdrawalInfo.type === 'telegram' ? 'Telegram @wallet' : 'Tonkeeper'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Address:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[140px]">
                  {truncateAddress(lastWithdrawalInfo.playerAddress)}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Unlock Date:</span>
                <span className="text-[#FFD700] font-bold">Dec 20, 2026</span>
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="p-3 rounded-2xl bg-[#0098EA]/15 border border-[#0098EA]/40 mb-5">
              <span className="text-[10px] font-black uppercase text-[#00c0f9] tracking-wider block mb-1">
                Time Remaining Until Disbursal
              </span>
              <span className="text-base font-black text-white font-mono">
                {timeLeft.formatted}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 mb-4 leading-normal">
              Amount will be sent to your {lastWithdrawalInfo.type === 'telegram' ? 'Telegram' : 'Tonkeeper'} wallet on Dec 20, 2026.
            </p>

            <button
              onClick={() => setIsSuccessModalOpen(false)}
              type="button"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const Wallet = WalletComponent;
export const PlayerWallet = WalletComponent;
export default WalletComponent;
