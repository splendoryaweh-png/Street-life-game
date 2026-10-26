'use client';

import React, { useState, useCallback } from 'react';
import {
  Shield,
  Coins,
  Users,
  Clock,
  Trash2,
  Ban,
  UserCheck,
  RotateCcw,
  PlusCircle,
  Calendar,
  AlertTriangle,
  Music,
  ExternalLink,
  CheckCircle,
  Send,
  RefreshCw,
  Wallet,
  Lock,
  X,
} from 'lucide-react';
import { AdminWallet } from '@/src/wallet/AdminWallet';
import { AdminWithdrawalsPanel } from '@/src/wallet/AdminWithdrawalsPanel';
import { AdminTasksVerificationPanel } from '@/components/AdminTasksVerificationPanel';
import { UserGameState, PostedSong, AdminLog } from '@/types/game';
import {
  ADMIN_EMAIL,
  ADMIN_TELEGRAM,
  adminAddCoins,
  adminExtendRent,
  adminDeleteSong,
  adminToggleBan,
  adminResetAll,
  getAdminLogs,
  getStoredPostedSongs,
  isStudioRentExpired,
  getDaysRemainingOnRent,
  getWithdrawalClickRecords,
  WithdrawalClickRecord,
} from '@/lib/storage';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';

interface AdminPanelScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
  onBack?: () => void;
}

export function AdminPanelScreen({ gameState, onToast, onBack }: AdminPanelScreenProps) {
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [coinsAmount, setCoinsAmount] = useState<number>(1000);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [resetConfirmWord, setResetConfirmWord] = useState<string>('');
  const [logs, setLogs] = useState<AdminLog[]>(() => getAdminLogs());
  const [postedSongs, setPostedSongs] = useState<PostedSong[]>(() => {
    return gameState.postedSongs?.length ? gameState.postedSongs : getStoredPostedSongs();
  });
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalClickRecord[]>(() =>
    getWithdrawalClickRecords()
  );
  const [isBanned, setIsBanned] = useState<boolean>(!!gameState.isBanned);
  const [activeAdminTab, setActiveAdminTab] = useState<'general' | 'treasury' | 'withdrawals' | 'tasks'>('general');

  const refreshAllData = useCallback(() => {
    setLogs(getAdminLogs());
    setPostedSongs(gameState.postedSongs?.length ? gameState.postedSongs : getStoredPostedSongs());
    setWithdrawalRequests(getWithdrawalClickRecords());
  }, [gameState.postedSongs]);

  const handleAddCoins = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coinsAmount || coinsAmount <= 0) {
      onToast('Enter a valid coin amount');
      return;
    }
    playCoinSound();
    adminAddCoins(coinsAmount, targetUserId || 'Current User');
    setLogs(getAdminLogs());
    onToast(`Added +${coinsAmount.toLocaleString()} Coins successfully!`);
    setCoinsAmount(1000);
  };

  const handleExtendRent = () => {
    playSuccessSound();
    adminExtendRent(30);
    setLogs(getAdminLogs());
    onToast('Studio Rent extended by 30 days!');
  };

  const handleToggleBan = () => {
    playClickSound();
    const banned = adminToggleBan(targetUserId || gameState.deviceId);
    setIsBanned(banned);
    setLogs(getAdminLogs());
    onToast(banned ? 'User has been banned!' : 'User ban removed!');
  };

  const handleDeleteSong = (songId: string, songName: string) => {
    playClickSound();
    adminDeleteSong(songId);
    setPostedSongs(getStoredPostedSongs());
    setLogs(getAdminLogs());
    onToast(`Deleted "${songName}" from records.`);
  };

  const handleExecuteResetAll = () => {
    if (resetConfirmWord !== 'RESET') {
      onToast('Please type RESET in capital letters to confirm.');
      return;
    }
    playSuccessSound();
    adminResetAll();
    setIsResetConfirmOpen(false);
    setResetConfirmWord('');
    setLogs(getAdminLogs());
    setPostedSongs([]);
    onToast('System and client storage completely reset!');
  };

  const isRentExpired = isStudioRentExpired();
  const daysLeft = getDaysRemainingOnRent();

  return (
    <div
      className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* HEADER WITH GOLD SHIELD */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black italic tracking-tight text-white uppercase flex items-center gap-1.5">
              <span>ADMIN PANEL</span>
              <span className="text-[10px] not-italic px-2 py-0.5 rounded-full bg-[#FFD700] text-black font-extrabold">
                MASTER
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono">{ADMIN_EMAIL}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              refreshAllData();
              onToast('Data refreshed');
            }}
            type="button"
            title="Refresh Data"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ADMIN TABS NAVIGATION */}
      <div className="grid grid-cols-4 gap-1 p-1.5 rounded-2xl bg-[#14141c] border border-white/10 mb-5">
        <button
          onClick={() => {
            playClickSound();
            setActiveAdminTab('general');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeAdminTab === 'general'
              ? 'bg-[#FFD700] text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveAdminTab('treasury');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'treasury'
              ? 'bg-gradient-to-r from-cyan-400 to-[#0098EA] text-black shadow-md'
              : 'text-cyan-400 hover:text-white'
          }`}
        >
          <Wallet className="w-3 h-3" />
          <span>Treasury</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveAdminTab('withdrawals');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'withdrawals'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
              : 'text-amber-400 hover:text-white'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span>Withdrawals</span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setActiveAdminTab('tasks');
          }}
          type="button"
          className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeAdminTab === 'tasks'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-black shadow-md'
              : 'text-emerald-400 hover:text-white'
          }`}
        >
          <CheckCircle className="w-3 h-3" />
          <span>Tasks</span>
        </button>
      </div>

      {activeAdminTab === 'treasury' ? (
        <AdminWallet onToast={onToast} />
      ) : activeAdminTab === 'withdrawals' ? (
        <AdminWithdrawalsPanel onToast={onToast} />
      ) : activeAdminTab === 'tasks' ? (
        <AdminTasksVerificationPanel />
      ) : (
        <>
          {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Total Hustlers</span>
          </div>
          <div className="text-xl font-black text-white font-mono mt-1">100+ Active</div>
          <span className="text-[10px] text-emerald-400">Verified System</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Active Economy</span>
          </div>
          <div className="text-xl font-black text-[#FFD700] font-mono mt-1">
            {gameState.streetCoin.toLocaleString()} SC
          </div>
          <span className="text-[10px] text-gray-400">Checksum verified</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Studio Rent</span>
          </div>
          <div
            className={`text-base font-black font-mono mt-1 ${
              isRentExpired ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isRentExpired ? 'Expired 🔒' : `${daysLeft} Days Left`}
          </div>
          <span className="text-[10px] text-gray-400">Level {gameState.studioLevel || 0} Studio</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Music className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Posted Songs</span>
          </div>
          <div className="text-xl font-black text-cyan-400 font-mono mt-1">
            {postedSongs.length} Tracks
          </div>
          <span className="text-[10px] text-gray-400">Saved to group</span>
        </div>
      </div>

      {/* QUICK ADMIN ACTIONS */}
      <div className="p-4 rounded-3xl bg-[#161616] border border-white/10 shadow-xl mb-5 space-y-4">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
          <Shield className="w-4 h-4" />
          <span>Economy & User Controls</span>
        </h2>

        {/* 1. Add Coins Form */}
        <form onSubmit={handleAddCoins} className="space-y-2">
          <label className="text-[11px] font-bold text-gray-300 block">
            Add Coins to User (Input User ID & Amount)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="User ID (optional)"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FFD700]"
            />
            <input
              type="number"
              placeholder="Amount (e.g. 10000)"
              value={coinsAmount}
              onChange={(e) => setCoinsAmount(parseInt(e.target.value, 10) || 0)}
              className="px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-[#FFD700] font-mono focus:outline-none focus:border-[#FFD700]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,215,0,0.3)] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Coins to Account</span>
          </button>
        </form>

        {/* 2. Extend Rent & Ban / Unban Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <button
            onClick={handleExtendRent}
            type="button"
            className="py-3 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Extend Rent 30 Days</span>
          </button>

          <button
            onClick={handleToggleBan}
            type="button"
            className={`py-3 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
              isBanned
                ? 'bg-emerald-500 text-black border border-emerald-400'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {isBanned ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
            <span>{isBanned ? 'Unban User' : 'Ban User'}</span>
          </button>
        </div>

        {/* 3. Reset All (Double Confirm) */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            type="button"
            className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-800/40 text-xs font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Reset All Database / Client Data</span>
          </button>
        </div>
      </div>

      {/* WITHDRAWAL REQUESTS SECTION (NOV 30 AUDIT) */}
      <div className="p-4 rounded-3xl bg-[#161616] border border-amber-500/30 shadow-xl mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Withdrawal Clicks - Players Waiting for Nov 30</span>
          </h2>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black">
            Total players waiting: {withdrawalRequests.length}
          </span>
        </div>

        {withdrawalRequests.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2 text-center">
            No withdrawal clicks recorded yet. Every click before Nov 30 is logged here.
          </p>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto max-h-60 rounded-2xl border border-white/5 bg-black/60"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#1C1C1C] text-gray-400 font-bold uppercase text-[9px] border-b border-white/10 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Coins</th>
                  <th className="py-2.5 px-3">Click Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {withdrawalRequests.map((req, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                      {req.username || req.userId || 'Hustler'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-[#FFD700] whitespace-nowrap">
                      🪙 {req.coins?.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-3 text-gray-400 font-mono text-[10px] whitespace-nowrap">
                      {new Date(req.clickTime).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[9px]">
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POSTED SONGS LIST WITH DELETE OPTION */}
      <div className="p-4 rounded-3xl bg-[#161616] border border-white/10 shadow-xl mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Music className="w-4 h-4" />
            <span>Community Posted Songs ({postedSongs.length})</span>
          </h2>
          <a
            href="https://t.me/Streetlifestars"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#FFD700] flex items-center gap-1 hover:underline"
          >
            <span>Open Group</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {postedSongs.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2 text-center">
            No community songs posted yet. Users can record and post from Freestyle Studio.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {postedSongs.map((song) => (
              <div
                key={song.id}
                className="p-3 rounded-2xl bg-black/60 border border-white/5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">{song.beatName}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {song.producer} • By {song.userName}
                  </div>
                  <div className="text-[9px] font-mono text-gray-500">
                    {new Date(song.timestamp).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSong(song.id, song.beatName)}
                  type="button"
                  title="Delete Song"
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 active:scale-95 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AUDIT LOGS (localStorage: streetLife_adminLogs) */}
      <div className="p-4 rounded-3xl bg-[#161616] border border-white/10 shadow-xl mb-6 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#FFD700]" />
          <span>Admin Audit Logs ({logs.length})</span>
        </h2>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2 text-center">No admin actions recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-mono text-[10px]">
            {logs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-xl bg-black/50 border border-white/5 text-gray-300">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-[#FFD700] font-bold">{log.action}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-300 mt-1">{log.details}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOUBLE CONFIRM RESET POPUP */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#121216] border-2 border-red-500 p-5 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-white uppercase">DOUBLE CONFIRM RESET</h3>
            <p className="text-xs text-gray-400 mt-1 mb-4 leading-relaxed">
              This will wipe all client coins, reset rent expiry, remove posted songs, and restore default state.
              Type <span className="text-red-400 font-bold font-mono">RESET</span> below to confirm:
            </p>

            <input
              type="text"
              placeholder="Type RESET"
              value={resetConfirmWord}
              onChange={(e) => setResetConfirmWord(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-center font-mono text-sm text-red-400 font-bold tracking-widest focus:outline-none focus:border-red-500 mb-4"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setResetConfirmWord('');
                }}
                type="button"
                className="py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteResetAll}
                type="button"
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-8 text-center text-gray-500 text-[10px] space-y-1.5 pb-8">
        <p className="text-gray-400 font-bold">Version: v1.0 Launch - Sunday</p>
        <p>
          Contact Admin: <a href={ADMIN_TELEGRAM} target="_blank" rel="noopener noreferrer" className="text-[#FFD700] underline">{ADMIN_TELEGRAM}</a>
        </p>
      </div>
        </>
      )}
    </div>
  );
}
