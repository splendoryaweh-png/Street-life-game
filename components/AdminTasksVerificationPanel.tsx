'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  Bell,
  Coins,
  Video,
  Send,
  Zap,
  Check,
  X,
  Clock,
  User,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  getPendingTasks,
  savePendingTasks,
  approveTask,
  denyTask,
  PendingTaskItem,
} from '@/lib/tasksSystem';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';

export function AdminTasksVerificationPanel() {
  const [tasks, setTasks] = useState<PendingTaskItem[]>(() => getPendingTasks());
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'denied'>('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [denyingTaskId, setDenyingTaskId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('Invalid or duplicate proof');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const handleTasksChange = () => setTasks(getPendingTasks());
    window.addEventListener('streetlife_pending_tasks_changed', handleTasksChange);
    return () => {
      window.removeEventListener('streetlife_pending_tasks_changed', handleTasksChange);
    };
  }, []);

  const pendingCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'pending').length;
  }, [tasks]);

  const approvedCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'approved').length;
  }, [tasks]);

  const deniedCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'denied').length;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  const handleApproveOne = (taskId: string) => {
    playClickSound();
    const res = approveTask(taskId);
    if (res.success) {
      playSuccessSound();
      playCoinSound();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      showToast(res.message);
      setTasks(getPendingTasks());
    } else {
      showToast(res.message);
    }
  };

  const handleDenyOne = () => {
    if (!denyingTaskId) return;
    playClickSound();
    const res = denyTask(denyingTaskId, denyReason);
    showToast(res.message);
    setDenyingTaskId(null);
    setDenyReason('Invalid or duplicate proof');
    setTasks(getPendingTasks());
  };

  const handleBulkApprove = () => {
    playClickSound();
    const pendingList = tasks.filter((t) => t.status === 'pending');
    if (pendingList.length === 0) {
      showToast('No pending tasks to approve.');
      return;
    }

    pendingList.forEach((t) => {
      approveTask(t.id);
    });

    playSuccessSound();
    playCoinSound();
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    showToast(`Bulk Approved ${pendingList.length} pending task(s)! Coins credited.`);
    setTasks(getPendingTasks());
  };

  return (
    <div className="w-full space-y-4 text-white select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#FFD700] text-black font-black text-xs shadow-xl animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}

      {/* Header with Notification Bell */}
      <div className="p-4 rounded-3xl bg-[#121212] border-2 border-[#FFD700] flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700]">
            <Bell className="w-6 h-6 animate-bounce" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
              <span>Admin Tasks Verification</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-bold">
                  {pendingCount} New Pending
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">
              Review proof, inspect video stats &amp; auto-credit rewards
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={handleBulkApprove}
            type="button"
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer hover:brightness-110 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 fill-black" />
            <span>Bulk Approve All ({pendingCount})</span>
          </button>
        )}
      </div>

      {/* 3 Tabs: Pending, Approved, Denied */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setActiveTab('pending');
          }}
          className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-[#FFD700] text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Pending</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            playClickSound();
            setActiveTab('approved');
          }}
          className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'approved'
              ? 'bg-emerald-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Approved</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
            {approvedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            playClickSound();
            setActiveTab('denied');
          }}
          className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'denied'
              ? 'bg-red-500 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Denied</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
            {deniedCount}
          </span>
        </button>
      </div>

      {/* Tasks Cards Feed */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#121212] border border-white/10 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
              No {activeTab} tasks found
            </p>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'pending'
                ? 'All player task submissions have been verified and processed!'
                : `Tasks marked as ${activeTab} will be listed here.`}
            </p>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-3xl bg-[#121212] border-2 border-white/10 hover:border-[#FFD700]/50 transition-all space-y-3 shadow-lg"
            >
              {/* Top Row: User & Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FFD700]">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block">
                      {t.playerUsername}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Player ID: {t.playerId} • {t.date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#FFD700] font-mono">
                    +{t.reward.toLocaleString()} SC
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                      t.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                        : t.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Task Type Banner */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between text-xs">
                <span className="font-bold text-gray-300 uppercase tracking-wide">
                  Type: {t.type.replace('_', ' ')} {t.subType ? `(${t.subType})` : ''}
                </span>
                {t.proofUrl && (
                  <a
                    href={t.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 truncate max-w-[200px]"
                  >
                    <span className="truncate">{t.proofUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>

              {/* Video Auto-Check Stats (if Video Task) */}
              {t.type === 'video' && t.stats && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-300">
                    <span>Auto-Check Stats:</span>
                    <span>QUALIFIED ✅</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-300 pt-1">
                    <div>Likes: {t.stats.likes}/100</div>
                    <div>Views: {t.stats.views}/1000</div>
                    <div>#StreetHustle: {t.stats.hasHashtag ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              )}

              {/* Screenshots Proof Gallery */}
              {(t.screenshot1 || t.screenshot2) && (
                <div className="flex items-center gap-2 pt-1">
                  {t.screenshot1 && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(t.screenshot1!)}
                      className="group relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 bg-black/50 hover:border-[#FFD700] transition-all cursor-pointer shrink-0"
                    >
                      <img
                        src={t.screenshot1}
                        alt="Proof 1"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  )}

                  {t.screenshot2 && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(t.screenshot2!)}
                      className="group relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 bg-black/50 hover:border-[#FFD700] transition-all cursor-pointer shrink-0"
                    >
                      <img
                        src={t.screenshot2}
                        alt="Proof 2"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  )}
                  <span className="text-[10px] text-gray-500 font-mono">
                    (Tap screenshot to view full resolution proof)
                  </span>
                </div>
              )}

              {/* Denial reason */}
              {t.status === 'denied' && t.denialReason && (
                <p className="text-xs text-red-400 font-mono">
                  Denial Reason: {t.denialReason}
                </p>
              )}

              {/* Action Buttons for Pending */}
              {t.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleApproveOne(t.id)}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-black" />
                    <span>Approve (+{t.reward} SC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDenyingTaskId(t.id)}
                    className="py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Deny</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Deny Modal */}
      {denyingTaskId && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-red-500/60 p-6 space-y-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Reject Task Submission
            </h3>
            <p className="text-xs text-gray-400">
              Select or type reason for rejecting this player&apos;s proof.
            </p>

            <select
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="Invalid or duplicate proof">Invalid or duplicate proof</option>
              <option value="Screenshot date does not match today">Screenshot date does not match today</option>
              <option value="View count / likes under minimum requirement">View count / likes under minimum requirement</option>
              <option value="Channel boost not found in telegram boosters list">Channel boost not found in telegram boosters list</option>
              <option value="Status post deleted early">Status post deleted early</option>
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDenyingTaskId(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDenyOne}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase shadow-lg"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-md w-full max-h-[85vh] rounded-3xl overflow-hidden border-2 border-[#FFD700] p-2 bg-black">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Full Resolution Proof"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTasksVerificationPanel;
