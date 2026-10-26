'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Coins,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Sliders,
  X,
  FileSpreadsheet,
  Calendar,
  Clock,
  Building,
  Send,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  UNLOCK_DATE,
  getAdminWallet,
  saveAdminWallet,
  refundToAdminWallet,
  deductFromAdminWallet,
  getLockedWithdrawals,
  saveLockedWithdrawals,
  LockedWithdrawal,
  AdminWalletState,
} from './AdminWallet';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';

export interface AdminWithdrawalsPanelProps {
  onToast?: (msg: string) => void;
}

export function AdminWithdrawalsPanel({ onToast }: AdminWithdrawalsPanelProps) {
  const [withdrawals, setWithdrawals] = useState<LockedWithdrawal[]>(() => getLockedWithdrawals());
  const [adminWallet, setAdminWallet] = useState<AdminWalletState>(() => getAdminWallet());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'locked' | 'unlocked' | 'cancelled'>('all');

  // Modal for Adjust Amount
  const [adjustTarget, setAdjustTarget] = useState<LockedWithdrawal | null>(null);
  const [newAmountInput, setNewAmountInput] = useState<string>('');

  // Modal for Cancel Confirmation
  const [cancelTarget, setCancelTarget] = useState<LockedWithdrawal | null>(null);

  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else console.log(msg);
    },
    [onToast]
  );

  // Sync state with storage events
  useEffect(() => {
    const handleWithdrawalsChange = (e: Event) => {
      const customEvent = e as CustomEvent<LockedWithdrawal[]>;
      if (customEvent.detail) setWithdrawals(customEvent.detail);
      else setWithdrawals(getLockedWithdrawals());
    };

    const handleAdminWalletChange = (e: Event) => {
      const customEvent = e as CustomEvent<AdminWalletState>;
      if (customEvent.detail) setAdminWallet(customEvent.detail);
      else setAdminWallet(getAdminWallet());
    };

    window.addEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
    window.addEventListener('streetlife_admin_wallet_changed', handleAdminWalletChange);
    window.addEventListener('storage', handleWithdrawalsChange);

    return () => {
      window.removeEventListener('streetlife_locked_withdrawals_changed', handleWithdrawalsChange);
      window.removeEventListener('streetlife_admin_wallet_changed', handleAdminWalletChange);
      window.removeEventListener('storage', handleWithdrawalsChange);
    };
  }, []);

  // Compute Stats
  const stats = useMemo(() => {
    const totalPending = withdrawals.filter((w) => w.status === 'locked');
    const totalLockedTon = totalPending.reduce((sum, w) => sum + w.amountTON, 0);
    const uniquePlayers = new Set(totalPending.map((w) => w.playerAddress)).size;
    const totalUnlocked = withdrawals.filter((w) => w.status === 'unlocked');
    const totalUnlockedTon = totalUnlocked.reduce((sum, w) => sum + w.amountTON, 0);

    return {
      totalLockedTon: Number(totalLockedTon.toFixed(2)),
      totalPendingPlayers: uniquePlayers,
      totalPendingCount: totalPending.length,
      adminBalanceRemaining: adminWallet.balance,
      totalUnlockedTon: Number(totalUnlockedTon.toFixed(2)),
      totalUnlockedCount: totalUnlocked.length,
    };
  }, [withdrawals, adminWallet.balance]);

  // Filtered List
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAddr = item.playerAddress.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesType = item.type.toLowerCase().includes(q);
        if (!matchesAddr && !matchesId && !matchesType) return false;
      }
      return true;
    });
  }, [withdrawals, statusFilter, searchQuery]);

  // ACTION 1: Adjust Amount (Refund difference if reduced, deduct more if increased)
  const handleOpenAdjust = (item: LockedWithdrawal) => {
    playClickSound();
    setAdjustTarget(item);
    setNewAmountInput(String(item.amountTON));
  };

  const handleSaveAdjustAmount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;

    const newAmount = parseFloat(newAmountInput);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast('❌ Please enter a positive amount in TON');
      return;
    }

    const diff = newAmount - adjustTarget.amountTON;

    if (diff > 0) {
      // Need to deduct more from admin wallet
      if (adminWallet.balance < diff) {
        toast(`❌ Cannot increase by ${diff} TON! Admin wallet balance is only ${adminWallet.balance} TON.`);
        return;
      }
      deductFromAdminWallet(diff);
      toast(`ℹ️ Deducted additional ${diff} TON from Admin Treasury`);
    } else if (diff < 0) {
      // Refund difference to admin wallet
      const refundAmount = Math.abs(diff);
      refundToAdminWallet(refundAmount);
      toast(`ℹ️ Refunded ${refundAmount} TON to Admin Treasury`);
    }

    // Update list
    const updated = withdrawals.map((w) => {
      if (w.id === adjustTarget.id) {
        return {
          ...w,
          amountTON: newAmount,
        };
      }
      return w;
    });

    saveLockedWithdrawals(updated);
    setWithdrawals(updated);
    setAdminWallet(getAdminWallet());
    setAdjustTarget(null);
    playSuccessSound();
    toast(`✅ Withdrawal adjusted to ${newAmount} TON for ${adjustTarget.playerAddress.slice(0, 8)}...`);
  };

  // ACTION 2: Cancel Withdrawal (Refund TON to admin wallet + Refund game coins to player)
  const handleOpenCancel = (item: LockedWithdrawal) => {
    playClickSound();
    setCancelTarget(item);
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    playClickSound();

    // 1. Refund TON amount to Admin wallet
    refundToAdminWallet(cancelTarget.amountTON);

    // 2. Refund coins to player (100 coins = 1 TON)
    const refundCoins = cancelTarget.amountTON * 100;
    addGameCoins(refundCoins, `Refund from cancelled withdrawal (${cancelTarget.amountTON} TON)`, 'welcome_bonus');

    // 3. Mark status as cancelled
    const updated = withdrawals.map((w) => {
      if (w.id === cancelTarget.id) {
        return {
          ...w,
          status: 'cancelled' as const,
        };
      }
      return w;
    });

    saveLockedWithdrawals(updated);
    setWithdrawals(updated);
    setAdminWallet(getAdminWallet());
    setCancelTarget(null);
    playSuccessSound();
    toast(`🛑 Withdrawal cancelled! Refunded ${cancelTarget.amountTON} TON to Treasury & ${refundCoins.toLocaleString()} coins to player.`);
  };

  // ACTION 3: Approve Early / Unlock Now (Bypass Dec 20, 2026)
  const handleUnlockEarly = (item: LockedWithdrawal) => {
    playClickSound();
    playSuccessSound();

    const updated = withdrawals.map((w) => {
      if (w.id === item.id) {
        return {
          ...w,
          status: 'unlocked' as const,
          unlockDate: Date.now(), // unlocked immediately
        };
      }
      return w;
    });

    saveLockedWithdrawals(updated);
    setWithdrawals(updated);
    toast(`🔓 Bypassed Dec 20! ${item.amountTON} TON Unlocked immediately for ${item.playerAddress.slice(0, 8)}...`);
  };

  // ACTION 4: Delete Record
  const handleDeleteRecord = (id: string) => {
    playClickSound();
    const updated = withdrawals.filter((w) => w.id !== id);
    saveLockedWithdrawals(updated);
    setWithdrawals(updated);
    toast('🗑️ Withdrawal record removed from log');
  };

  // ACTION 5: Export CSV
  const handleExportCSV = () => {
    playClickSound();
    if (withdrawals.length === 0) {
      toast('⚠️ No withdrawal records to export');
      return;
    }

    const headers = ['ID', 'Player Address', 'Wallet Type', 'Amount TON', 'Equivalent Coins', 'Requested Date', 'Unlock Date', 'Status', 'TxHash'];
    const rows = withdrawals.map((w) => [
      w.id,
      w.playerAddress,
      w.type,
      w.amountTON,
      w.amountTON * 100,
      new Date(w.requestedAt).toISOString(),
      new Date(w.unlockDate).toISOString(),
      w.status,
      w.txHash || 'N/A',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `streetlife_withdrawals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('📊 Exported withdrawals CSV successfully');
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="w-full space-y-4 text-white select-none">
      {/* =========================================================================
          TOP STATS SUMMARY
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Total Locked TON */}
        <div className="p-4 rounded-3xl bg-[#15151e] border border-amber-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Total Locked TON</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {stats.totalLockedTon.toLocaleString()} TON
          </div>
          <p className="text-[11px] text-gray-500 font-mono">
            Locked until Dec 20, 2026
          </p>
        </div>

        {/* Total Players Pending */}
        <div className="p-4 rounded-3xl bg-[#15151e] border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Players Pending</span>
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.totalPendingPlayers}
          </div>
          <p className="text-[11px] text-gray-500 font-mono">
            {stats.totalPendingCount} pending transactions
          </p>
        </div>

        {/* Admin Treasury Balance Remaining */}
        <div className="p-4 rounded-3xl bg-[#15151e] border border-[#0098EA]/40 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Treasury Balance</span>
            <Building className="w-4 h-4 text-[#00c0f9]" />
          </div>
          <div className="text-2xl font-black text-[#00c0f9] font-mono">
            {stats.adminBalanceRemaining.toLocaleString()} TON
          </div>
          <p className="text-[11px] text-gray-500 font-mono">
            {adminWallet.connected ? `${adminWallet.type} active` : 'Wallet not connected'}
          </p>
        </div>

        {/* Total Unlocked / Bypassed */}
        <div className="p-4 rounded-3xl bg-[#15151e] border border-emerald-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Unlocked TON</span>
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {stats.totalUnlockedTon.toLocaleString()} TON
          </div>
          <p className="text-[11px] text-gray-500 font-mono">
            {stats.totalUnlockedCount} processed
          </p>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS STRIP: SEARCH, FILTER & EXPORT CSV
         ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#14141c] border border-white/10 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by player address or TxID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/60 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00c0f9]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'locked', 'unlocked', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                playClickSound();
                setStatusFilter(st);
              }}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-cyan-500 to-[#0098EA] text-black shadow-md'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            type="button"
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN TABLE: PENDING WITHDRAWALS (ADJUSTABLE)
         ========================================================================= */}
      <div className="rounded-3xl bg-[#14141c] border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Pending Withdrawals - Adjustable Log ({filteredWithdrawals.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Global Lock: Dec 20, 2026
          </span>
        </div>

        {filteredWithdrawals.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            No matching withdrawal requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/50 text-gray-400 font-mono text-[11px] uppercase border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Player Address</th>
                  <th className="py-3 px-4">Wallet Type</th>
                  <th className="py-3 px-4">Amount TON</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Unlock Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWithdrawals.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Player Address */}
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span title={item.playerAddress}>{truncateAddress(item.playerAddress)}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(item.playerAddress);
                            toast('📋 Player address copied');
                          }}
                          className="text-gray-500 hover:text-white"
                          title="Copy Full Address"
                        >
                          <Send className="w-3 h-3 -rotate-45" />
                        </button>
                      </div>
                    </td>

                    {/* Wallet Type */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 font-mono text-[10px] uppercase">
                        {item.type === 'telegram' ? 'Telegram @wallet' : 'Tonkeeper'}
                      </span>
                    </td>

                    {/* Amount in TON */}
                    <td className="py-3 px-4 font-mono font-black text-cyan-300">
                      {item.amountTON} TON
                      <span className="text-[10px] text-gray-500 block font-normal">
                        ({(item.amountTON * 100).toLocaleString()} coins)
                      </span>
                    </td>

                    {/* Requested Date */}
                    <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                      {new Date(item.requestedAt).toLocaleDateString()}{' '}
                      <span className="text-[10px] text-gray-500">
                        {new Date(item.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Unlock Date */}
                    <td className="py-3 px-4 font-mono text-[11px] text-amber-300">
                      Dec 20, 2026 UTC
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
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
                        ) : item.status === 'unlocked' ? (
                          <>
                            <Unlock className="w-2.5 h-2.5" />
                            <span>UNLOCKED</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            <span>CANCELLED</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Adjust Amount */}
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          disabled={item.status !== 'locked'}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Adjust Amount"
                        >
                          <Edit2 className="w-3 h-3 inline mr-1" />
                          <span>Adjust</span>
                        </button>

                        {/* Unlock Now (Bypass Dec 20) */}
                        <button
                          onClick={() => handleUnlockEarly(item)}
                          disabled={item.status !== 'locked'}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Unlock Now (Bypass Dec 20, 2026)"
                        >
                          <Unlock className="w-3 h-3 inline mr-1" />
                          <span>Bypass</span>
                        </button>

                        {/* Cancel & Refund */}
                        <button
                          onClick={() => handleOpenCancel(item)}
                          disabled={item.status !== 'locked'}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Cancel & Refund to Admin and Player"
                        >
                          <RotateCcw className="w-3 h-3 inline mr-1" />
                          <span>Cancel</span>
                        </button>

                        {/* Delete Record */}
                        <button
                          onClick={() => handleDeleteRecord(item.id)}
                          type="button"
                          className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: ADJUST AMOUNT
         ========================================================================= */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161620] border-2 border-cyan-400/80 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setAdjustTarget(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center mx-auto mb-3">
              <Sliders className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-wider text-center mb-1">
              Adjust Withdrawal Amount
            </h3>
            <p className="text-xs text-gray-400 text-center mb-4 font-mono truncate">
              Player: {truncateAddress(adjustTarget.playerAddress)}
            </p>

            <form onSubmit={handleSaveAdjustAmount} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono uppercase text-gray-300 block mb-1">
                  Current Amount: {adjustTarget.amountTON} TON
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={newAmountInput}
                    onChange={(e) => setNewAmountInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-2xl px-4 py-3 text-lg font-black text-white font-mono focus:outline-none focus:border-cyan-400"
                    placeholder="Enter new amount in TON"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-cyan-400 font-mono">
                    TON
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-white/5 text-[11px] font-mono text-gray-400 leading-normal">
                If reduced: difference refunds automatically to Admin Treasury.<br />
                If increased: additional TON is deducted from Admin Treasury.
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-[#0098EA] text-black text-xs font-black uppercase tracking-wider shadow-lg hover:brightness-110 cursor-pointer"
                >
                  Confirm &amp; Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CANCEL & REFUND CONFIRMATION
         ========================================================================= */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161620] border-2 border-red-500/80 rounded-3xl p-6 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setCancelTarget(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-wider mb-2">
              Cancel &amp; Refund Withdrawal?
            </h3>

            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              This will cancel the pending withdrawal of{' '}
              <strong className="text-white font-mono">{cancelTarget.amountTON} TON</strong> and return:{' '}
              <span className="text-cyan-300 font-bold block mt-1 font-mono">
                +{cancelTarget.amountTON} TON to Admin Treasury
              </span>
              <span className="text-[#FFD700] font-bold block font-mono">
                +{(cancelTarget.amountTON * 100).toLocaleString()} Coins to Player Wallet
              </span>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase cursor-pointer"
              >
                Keep Pending
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminWithdrawalsPanel;
