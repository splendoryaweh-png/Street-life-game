'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
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
  Sliders,
  Check,
  Send,
  Info,
} from 'lucide-react';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';

export const UNLOCK_DATE = new Date('2026-12-20T00:00:00Z').getTime();

export interface AdminWalletState {
  address: string;
  type: 'telegram' | 'tonkeeper';
  connected: boolean;
  balance: number;
  connectedAt?: number;
}

export interface LockedWithdrawal {
  id: string;
  playerAddress: string;
  amountTON: number;
  requestedAt: number;
  unlockDate: number;
  status: 'locked' | 'unlocked' | 'cancelled';
  type: 'telegram' | 'tonkeeper';
  txHash?: string;
}

const STORAGE_ADMIN_WALLET = 'streetlife_admin_wallet';
const STORAGE_LOCKED_WITHDRAWALS = 'streetlife_locked_withdrawals';

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

export function getAdminWallet(): AdminWalletState {
  if (typeof window === 'undefined') {
    return {
      address: '',
      type: 'telegram',
      connected: false,
      balance: 0,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_ADMIN_WALLET);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.connected === 'boolean') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading admin wallet:', e);
  }
  return {
    address: '',
    type: 'telegram',
    connected: false,
    balance: 0,
  };
}

export function saveAdminWallet(wallet: AdminWalletState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ADMIN_WALLET, JSON.stringify(wallet));
    window.dispatchEvent(new CustomEvent('streetlife_admin_wallet_changed', { detail: wallet }));
  } catch (e) {
    console.error('Error saving admin wallet:', e);
  }
}

/**
 * Deduct amount from Admin Funding Wallet.
 * Returns true if balance >= amountTON and deduction succeeded.
 */
export function deductFromAdminWallet(amountTON: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getAdminWallet();
    if (!current.connected) return false;
    if (current.balance < amountTON) return false;

    const updated: AdminWalletState = {
      ...current,
      balance: Math.max(0, Number((current.balance - amountTON).toFixed(4))),
    };
    saveAdminWallet(updated);
    return true;
  } catch (e) {
    console.error('Error deducting from admin wallet:', e);
    return false;
  }
}

/**
 * Refund amount back to Admin Funding Wallet (e.g. cancelled withdrawal or adjusted down)
 */
export function refundToAdminWallet(amountTON: number): void {
  if (typeof window === 'undefined' || amountTON <= 0) return;
  try {
    const current = getAdminWallet();
    const updated: AdminWalletState = {
      ...current,
      balance: Number((current.balance + amountTON).toFixed(4)),
    };
    saveAdminWallet(updated);
  } catch (e) {
    console.error('Error refunding to admin wallet:', e);
  }
}

export function getLockedWithdrawals(): LockedWithdrawal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_LOCKED_WITHDRAWALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading locked withdrawals:', e);
  }
  return [];
}

export function saveLockedWithdrawals(list: LockedWithdrawal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_LOCKED_WITHDRAWALS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('streetlife_locked_withdrawals_changed', { detail: list }));
  } catch (e) {
    console.error('Error saving locked withdrawals:', e);
  }
}

// ============================================================================
// ADMIN WALLET COMPONENT (400+ lines full code)
// ============================================================================

interface AdminWalletProps {
  onToast?: (msg: string) => void;
}

export function AdminWallet({ onToast }: AdminWalletProps) {
  const [wallet, setWallet] = useState<AdminWalletState>(() => getAdminWallet());
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [withdrawals, setWithdrawals] = useState<LockedWithdrawal[]>(() => getLockedWithdrawals());
  const [customBalanceInput, setCustomBalanceInput] = useState<string>('');
  const [isEditingBalance, setIsEditingBalance] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState<boolean>(false);

  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else console.log(msg);
    },
    [onToast]
  );

  // Sync with storage events
  useEffect(() => {
    const handleWalletChange = (e: Event) => {
      const customEvent = e as CustomEvent<AdminWalletState>;
      if (customEvent.detail) {
        setWallet(customEvent.detail);
      } else {
        setWallet(getAdminWallet());
      }
    };

    const handleWithdrawalsChange = (e: Event) => {
      const customEvent = e as CustomEvent<LockedWithdrawal[]>;
      if (customEvent.detail) {
        setWithdrawals(customEvent.detail);
      } else {
        setWithdrawals(getLockedWithdrawals());
      }
    };

    window.addEventListener('streetlife_admin_wallet_changed', handleWalletChange);
    window.addEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
    window.addEventListener('storage', handleWalletChange);

    return () => {
      window.removeEventListener('streetlife_admin_wallet_changed', handleWalletChange);
      window.removeEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
      window.removeEventListener('storage', handleWalletChange);
    };
  }, []);

  // Compute Stats
  const stats = useMemo(() => {
    const pendingLocked = withdrawals.filter((w) => w.status === 'locked');
    const totalTonLocked = pendingLocked.reduce((sum, w) => sum + w.amountTON, 0);
    const unlockedAfterDate = withdrawals.filter((w) => w.status === 'unlocked');
    const totalWithdrawnAfterDec20 = unlockedAfterDate.reduce((sum, w) => sum + w.amountTON, 0);

    return {
      pendingCount: pendingLocked.length,
      totalTonLocked: Number(totalTonLocked.toFixed(2)),
      unlockedCount: unlockedAfterDate.length,
      totalWithdrawnAfterDec20: Number(totalWithdrawnAfterDec20.toFixed(2)),
    };
  }, [withdrawals]);

  // Connect Simulation (interface for future @tonconnect/sdk)
  const handleConnectSimulate = (walletType: 'telegram' | 'tonkeeper') => {
    playClickSound();
    playSuccessSound();

    // TODO: Replace with real @tonconnect/sdk when ready
    // e.g. const connector = new TonConnect(); await connector.connectWallet(...)
    const prefix = walletType === 'telegram' ? 'EQD-tg-admin-' : 'EQB-tonk-admin-';
    const randomHex = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
    const simulatedAddress = `${prefix}${randomHex}`;

    const newWalletState: AdminWalletState = {
      address: simulatedAddress,
      type: walletType,
      connected: true,
      balance: wallet.balance > 0 ? wallet.balance : 1000, // Default 1,000 TON treasury
      connectedAt: Date.now(),
    };

    saveAdminWallet(newWalletState);
    setWallet(newWalletState);
    setIsConnectModalOpen(false);
    toast(`✅ Admin Funding Wallet Connected (${walletType === 'telegram' ? 'Telegram @wallet' : 'Tonkeeper'})`);
  };

  const handleDisconnect = () => {
    playClickSound();
    const disconnectedState: AdminWalletState = {
      address: '',
      type: 'telegram',
      connected: false,
      balance: wallet.balance, // retain treasury balance in storage
    };
    saveAdminWallet(disconnectedState);
    setWallet(disconnectedState);
    toast('🔌 Admin Funding Wallet Disconnected');
  };

  const handleAddFunds = (amount: number = 100) => {
    playCoinSound();
    const updated: AdminWalletState = {
      ...wallet,
      balance: Number((wallet.balance + amount).toFixed(2)),
    };
    saveAdminWallet(updated);
    setWallet(updated);
    toast(`💰 Added +${amount} TON to Admin Treasury! New Balance: ${updated.balance} TON`);
  };

  const handleSaveCustomBalance = () => {
    playClickSound();
    const num = parseFloat(customBalanceInput);
    if (isNaN(num) || num < 0) {
      toast('❌ Please enter a valid non-negative number');
      return;
    }
    const updated: AdminWalletState = {
      ...wallet,
      balance: Number(num.toFixed(4)),
    };
    saveAdminWallet(updated);
    setWallet(updated);
    setIsEditingBalance(false);
    setCustomBalanceInput('');
    toast(`✅ Admin Treasury Balance updated to ${updated.balance} TON`);
  };

  const copyAddress = () => {
    if (!wallet.address) return;
    playClickSound();
    navigator.clipboard?.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('📋 Address copied to clipboard');
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="w-full space-y-4 text-white select-none">
      {/* =========================================================================
          HEADER
         ========================================================================= */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-gradient-to-r from-[#171720] via-[#121217] to-[#0d0d12] border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0098EA] via-[#00c0f9] to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-[#0098EA]/30">
            <div className="w-full h-full rounded-[14px] bg-[#0c121d] flex items-center justify-center">
              <Building className="w-6 h-6 text-[#00c0f9]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                Admin Funding Wallet
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase font-mono">
                Street Life Treasury
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Player locked withdrawals are deducted from this central reserve
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            playClickSound();
            setWallet(getAdminWallet());
            setWithdrawals(getLockedWithdrawals());
            toast('🔄 Treasury Data Refreshed');
          }}
          type="button"
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 active:scale-95 transition-all cursor-pointer"
          title="Refresh Treasury Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* =========================================================================
          CARD 1: WALLET CONNECTION STATUS
         ========================================================================= */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#16161e] to-[#0f0f14] border-2 border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow ambient accent */}
        <div
          className={`absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl pointer-events-none ${
            wallet.connected ? 'bg-emerald-500/15' : 'bg-red-500/15'
          }`}
        />

        {!wallet.connected ? (
          /* NOT CONNECTED STATE */
          <div className="flex flex-col items-center text-center py-4 space-y-3 relative z-10">
            <div className="relative">
              <div className="w-18 h-18 rounded-3xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.2)]">
                <Wallet className="w-9 h-9 text-red-400" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-black animate-ping" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-black" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Admin Wallet Not Connected Yet
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Facility is ready. You can connect your wallet when ready. All player withdrawals will be deducted from this wallet.
              </p>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setIsConnectModalOpen(true);
              }}
              type="button"
              className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,215,0,0.4)] active:scale-95 hover:brightness-110 transition-all cursor-pointer flex items-center gap-2"
            >
              <Wallet className="w-4 h-4 fill-black" />
              <span>Connect Admin Wallet (Coming Soon - Click to Prepare)</span>
            </button>
          </div>
        ) : (
          /* CONNECTED STATE */
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black shadow-[0_0_10px_#10B981] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  CONNECTED • FUNDING ACTIVE
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-bold text-gray-300 font-mono">
                  {wallet.type === 'telegram' ? 'Telegram @wallet' : 'Tonkeeper Wallet'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTransactionsModal(true)}
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  View Transactions
                </button>
                <button
                  onClick={handleDisconnect}
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Address & Type */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-gray-400">
                  Funding Wallet Address
                </span>
                <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                  <span>{truncateAddress(wallet.address)}</span>
                  <span className="text-xs text-gray-500 font-normal">({wallet.type})</span>
                </div>
              </div>

              <button
                onClick={copyAddress}
                type="button"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-xs"
                title="Copy Address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="text-[11px] font-bold">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Treasury Balance + Controls */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0098EA]/15 via-black/60 to-black/80 border border-[#0098EA]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-[#00c0f9] flex items-center gap-1 font-bold">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Admin Treasury Balance</span>
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-white font-mono tracking-tight">
                    {wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-sm font-black text-[#00c0f9]">TON</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddFunds(100)}
                  type="button"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="Simulate adding +100 TON to treasury"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add +100 TON</span>
                </button>

                <button
                  onClick={() => {
                    setIsEditingBalance(!isEditingBalance);
                    setCustomBalanceInput(String(wallet.balance));
                  }}
                  type="button"
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  title="Manually override balance for testing"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>

            {/* Balance Edit Row */}
            {isEditingBalance && (
              <div className="p-3 rounded-2xl bg-black/80 border border-white/20 flex items-center gap-2 animate-in fade-in duration-150">
                <span className="text-xs text-gray-400 font-mono shrink-0">Set TON:</span>
                <input
                  type="number"
                  step="any"
                  value={customBalanceInput}
                  onChange={(e) => setCustomBalanceInput(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#00c0f9]"
                  placeholder="e.g. 5000"
                />
                <button
                  onClick={handleSaveCustomBalance}
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingBalance(false)}
                  type="button"
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          CARD 2: WITHDRAWAL FUNDING LOGIC INFO
         ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#14141a] border border-white/10 shadow-lg space-y-2.5">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#00c0f9]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-white">
            Withdrawal Funding Logic & Protocol
          </h4>
        </div>

        <div className="p-3 rounded-2xl bg-black/50 border border-white/5 text-xs font-mono text-gray-300 leading-relaxed space-y-2">
          <p className="text-gray-200 font-semibold">
            &ldquo;How it works: Player withdraws 5 TON -&gt; System checks Admin Wallet balance -&gt; If enough, deduct 5 TON from Admin Wallet -&gt; Lock until Dec 20, 2026 -&gt; On Dec 20, 2026, send to player wallet&rdquo;
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[#00c0f9] font-bold block mb-0.5">1. Conversion</span>
              <span>100 Street Coins = 1 TON yield</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-amber-400 font-bold block mb-0.5">2. Treasury Check</span>
              <span>Checks Admin balance before accepting</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-yellow-400 font-bold block mb-0.5">3. Locked Vault</span>
              <span>Locked until Dec 20, 2026 UTC</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-emerald-400 font-bold block mb-0.5">4. Auto Payout</span>
              <span>Transfers to player on unlock date</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: TREASURY STATS
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Pending Locked Withdrawals */}
        <div className="p-4 rounded-3xl bg-[#15151c] border border-amber-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Pending Locked</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {stats.pendingCount}
          </div>
          <p className="text-[11px] text-gray-400">Total requests waiting for Dec 20, 2026</p>
        </div>

        {/* Total TON Locked */}
        <div className="p-4 rounded-3xl bg-[#15151c] border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Total TON Locked</span>
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">
            {stats.totalTonLocked.toLocaleString()} TON
          </div>
          <p className="text-[11px] text-gray-400">Deducted from treasury &amp; reserved</p>
        </div>

        {/* Total Withdrawn After Dec 20 */}
        <div className="p-4 rounded-3xl bg-[#15151c] border border-emerald-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Unlocked / Disbursed</span>
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {stats.totalWithdrawnAfterDec20.toLocaleString()} TON
          </div>
          <p className="text-[11px] text-gray-400">{stats.unlockedCount} completed payouts</p>
        </div>
      </div>

      {/* =========================================================================
          CONNECT ADMIN WALLET MODAL
         ========================================================================= */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161f] border-2 border-cyan-500/70 rounded-3xl p-6 shadow-[0_0_35px_rgba(0,152,234,0.35)] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsConnectModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-wider text-center mb-1">
              Connect Admin Funding Wallet
            </h3>
            <p className="text-xs text-gray-400 text-center mb-5">
              Select your administrative funding wallet to back player withdrawals
            </p>

            <div className="space-y-3">
              {/* Option 1: Telegram Wallet */}
              <button
                onClick={() => handleConnectSimulate('telegram')}
                type="button"
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0088cc]/20 to-[#0088cc]/10 hover:from-[#0088cc]/30 hover:to-[#0088cc]/20 border border-[#0088cc]/50 text-left transition-all active:scale-95 cursor-pointer flex items-center justify-between group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Send className="w-5 h-5 -rotate-45" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      Connect Telegram Wallet (Admin)
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Use @wallet on Telegram
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 2: Tonkeeper */}
              <button
                onClick={() => handleConnectSimulate('tonkeeper')}
                type="button"
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0098EA]/20 to-[#0098EA]/10 hover:from-[#0098EA]/30 hover:to-[#0098EA]/20 border border-[#0098EA]/50 text-left transition-all active:scale-95 cursor-pointer flex items-center justify-between group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0098EA] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      Connect Tonkeeper (Admin)
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Non-custodial TON Wallet
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <p className="text-[10px] text-gray-500 text-center font-mono mt-4">
              Simulated environment ready for TON Connect SDK integration
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          TREASURY RECENT TRANSACTIONS MODAL
         ========================================================================= */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#16161f] border-2 border-white/20 rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#00c0f9]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Admin Treasury Withdrawals Feed
                </h3>
              </div>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No player withdrawals recorded in the treasury yet.
              </div>
            ) : (
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">
                          {truncateAddress(w.playerAddress)}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                          {w.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                        {new Date(w.requestedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-cyan-300">
                        -{w.amountTON} TON
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase block mt-0.5 ${
                          w.status === 'locked'
                            ? 'text-amber-400'
                            : w.status === 'unlocked'
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        [{w.status.toUpperCase()}]
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminWallet;
