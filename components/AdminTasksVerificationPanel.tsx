
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  Bell,
  User,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  loadPendingTasksFromServer,
  approveTask,
  denyTask,
  type PendingTaskItem,
} from '@/lib/tasksSystem';
import {
  playClickSound,
  playSuccessSound,
  playCoinSound,
} from '@/lib/sound';

export function AdminTasksVerificationPanel() {
  const [tasks, setTasks] = useState<PendingTaskItem[]>([]);
  const [activeTab, setActiveTab] =
    useState<'pending' | 'approved' | 'denied'>('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [denyingTaskId, setDenyingTaskId] = useState<string | null>(null);
  const [denyReason, setDenyReason] =
    useState('Invalid or duplicate proof');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const refreshTasks = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);

    setLoadError(null);

    try {
      const records = await loadPendingTasksFromServer(true);
      setTasks(records);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load task submissions.';

      setLoadError(message);
      if (initial) setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks(true);
  }, [refreshTasks]);

  const pendingCount = useMemo(
    () => tasks.filter((task) => task.status === 'pending').length,
    [tasks]
  );

  const approvedCount = useMemo(
    () => tasks.filter((task) => task.status === 'approved').length,
    [tasks]
  );

  const deniedCount = useMemo(
    () => tasks.filter((task) => task.status === 'denied').length,
    [tasks]
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => task.status === activeTab),
    [tasks, activeTab]
  );

  const handleApproveOne = async (taskId: string) => {
    if (busyTaskId || bulkBusy) return;

    playClickSound();
    setBusyTaskId(taskId);

    try {
      const result = await approveTask(taskId);

      if (!result.success) {
        showToast(result.message);
        return;
      }

      playSuccessSound();
      playCoinSound();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      showToast(
        result.message ||
        `${result.reward.toLocaleString()} SC credited to player.`
      );

      await refreshTasks();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDenyOne = async () => {
    if (!denyingTaskId || busyTaskId || bulkBusy) return;

    playClickSound();
    const taskId = denyingTaskId;
    setBusyTaskId(taskId);

    try {
      const result = await denyTask(taskId, denyReason);

      if (!result.success) {
        showToast(result.message);
        return;
      }

      showToast(result.message);
      setDenyingTaskId(null);
      setDenyReason('Invalid or duplicate proof');
      await refreshTasks();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (bulkBusy || busyTaskId) return;

    const pendingList = tasks.filter(
      (task) => task.status === 'pending'
    );

    if (pendingList.length === 0) {
      showToast('No pending tasks to approve.');
      return;
    }

    const confirmed = window.confirm(
      `Approve ${pendingList.length} pending task(s)? Each submission will be sent to the server for verification.`
    );

    if (!confirmed) return;

    playClickSound();
    setBulkBusy(true);

    let successful = 0;
    let failed = 0;
    let totalCredited = 0;

    try {
      for (const task of pendingList) {
        const result = await approveTask(task.id);

        if (result.success) {
          successful += 1;
          totalCredited += result.reward;
        } else {
          failed += 1;
        }
      }

      if (successful > 0) {
        playSuccessSound();
        playCoinSound();
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      }

      showToast(
        `Approved: ${successful}. Failed: ${failed}. Credited: ${totalCredited.toLocaleString()} SC.`
      );

      await refreshTasks();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="w-full space-y-4 text-white select-none">

      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-full bg-[#FFD700] text-black font-black text-xs shadow-xl">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="p-4 rounded-3xl bg-[#121212] border-2 border-[#FFD700] flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700]">
            <Bell className="w-6 h-6" />

            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-white tracking-wider">
              Admin Tasks Verification
            </h3>
            <p className="text-xs text-gray-400">
              Review player proof and approve verified rewards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => {
              playClickSound();
              void refreshTasks();
            }}
            className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy || loading}
              onClick={handleBulkApprove}
              className="px-3 py-2 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Approve All ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Loading and errors */}
      {loading && (
        <div className="p-8 rounded-3xl bg-[#121212] border border-white/10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFD700] mx-auto mb-2" />
          <p className="text-xs text-gray-400">
            Loading submissions from server...
          </p>
        </div>
      )}

      {!loading && loadError && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40">
          <p className="text-sm font-bold text-red-300">
            Could not load submissions
          </p>
          <p className="text-xs text-red-200 mt-1">{loadError}</p>
          <p className="text-xs text-gray-400 mt-2">
            The server must recognize your Telegram account as an admin.
          </p>
          <button
            type="button"
            onClick={() => void refreshTasks()}
            className="mt-3 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Tabs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10">
          {(
            [
              ['pending', 'Pending', pendingCount],
              ['approved', 'Approved', approvedCount],
              ['denied', 'Denied', deniedCount],
            ] as const
          ).map(([tab, label, count]) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                playClickSound();
                setActiveTab(tab);
              }}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider ${
                activeTab === tab
                  ? tab === 'pending'
                    ? 'bg-[#FFD700] text-black'
                    : tab === 'approved'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-500 text-white'
                  : 'text-gray-400'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Submission cards */}
      {!loading && !loadError && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#121212] border border-white/10 text-center">
              <CheckCircle2 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-bold uppercase">
                No {activeTab} submissions found
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-3xl bg-[#121212] border-2 border-white/10 space-y-3 shadow-lg"
              >
                {/* Player information */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FFD700]">
                      <User className="w-4 h-4" />
                    </div>

                    <div>
                      <span className="text-xs font-black block">
                        {task.playerUsername}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Player ID: {task.playerId} • {task.date}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#FFD700]">
                      +{task.reward.toLocaleString()} SC
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        task.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : task.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>

                {/* Task information */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                  <p className="text-xs font-bold text-gray-300 uppercase">
                    Task: {task.taskKey || task.type}
                    {task.subType ? ` (${task.subType})` : ''}
                  </p>

                  {task.platform && (
                    <p className="text-[11px] text-gray-400">
                      Platform: {task.platform}
                    </p>
                  )}

                  {task.proofUrl && (
                    <a
                      href={task.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 text-xs font-bold flex items-center gap-1 break-all"
                    >
                      View submitted proof
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}
                </div>

                {/* Screenshots */}
                {(task.screenshot1 || task.screenshot2) && (
                  <div className="flex items-center gap-2">
                    {task.screenshot1 && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(task.screenshot1!)}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-white/20"
                      >
                        <img
                          src={task.screenshot1}
                          alt="First proof screenshot"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}

                    {task.screenshot2 && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(task.screenshot2!)}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-white/20"
                      >
                        <img
                          src={task.screenshot2}
                          alt="Second proof screenshot"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}

                    <span className="text-[10px] text-gray-500">
                      Tap image to inspect proof
                    </span>
                  </div>
                )}

                {/* Rejection reason */}
                {task.status === 'denied' && task.denialReason && (
                  <p className="text-xs text-red-400">
                    Rejection reason: {task.denialReason}
                  </p>
                )}

                {/* Actions */}
                {task.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      disabled={!!busyTaskId || bulkBusy}
                      onClick={() => void handleApproveOne(task.id)}
                      className="py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {busyTaskId === task.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve (+{task.reward} SC)
                    </button>

                    <button
                      type="button"
                      disabled={!!busyTaskId || bulkBusy}
                      onClick={() => setDenyingTaskId(task.id)}
                      className="py-2.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-xs uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Reject modal */}
      {denyingTaskId && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-red-500/60 p-6 space-y-4">
            <h3 className="text-base font-black uppercase">
              Reject Task Submission
            </h3>

            <p className="text-xs text-gray-400">
              Select the reason for rejecting this player's proof.
            </p>

            <select
              value={denyReason}
              onChange={(event) => setDenyReason(event.target.value)}
              className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-3 text-xs text-white"
            >
              <option value="Invalid or duplicate proof">
                Invalid or duplicate proof
              </option>
              <option value="Screenshot date does not match today">
                Screenshot date does not match today
              </option>
              <option value="View count / likes under minimum requirement">
                View count / likes under minimum requirement
              </option>
              <option value="Channel boost not found in Telegram boosters list">
                Channel boost not found in Telegram boosters list
              </option>
              <option value="Status post deleted early">
                Status post deleted early
              </option>
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!!busyTaskId}
                onClick={() => setDenyingTaskId(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!!busyTaskId}
                onClick={() => void handleDenyOne()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busyTaskId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
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
              alt="Full resolution proof"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTasksVerificationPanel;
