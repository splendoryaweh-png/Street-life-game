
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  X, ExternalLink, Clock, Upload, Video, Coins, Loader2,
} from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/sound';

type TaskStatus = 'pending' | 'approved' | 'rejected';

type TaskRow = {
  id: string;
  task_key: string;
  task_type: string;
  platform: string | null;
  proof_url: string | null;
  screenshot_urls: string[];
  reward: number;
  status: TaskStatus;
  denial_reason: string | null;
  submitted_at: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  currentCoins?: number;
};

type TaskDefinition = {
  key: string;
  title: string;
  url: string;
  reward: number;
  platform: string;
};

const SOCIAL_TASKS: TaskDefinition[] = [
  { key: 'task_follow_x', title: 'Follow X Account', url: 'https://x.com/streethustle0?s=11', reward: 50, platform: 'X' },
  { key: 'task_join_channel', title: 'Join Telegram Channel', url: 'https://t.me/Streethustlegame2', reward: 50, platform: 'Telegram' },
  { key: 'task_join_group', title: 'Join Group Chat', url: 'https://t.me/Streethustlechatroom', reward: 50, platform: 'Telegram' },
  { key: 'task_payment_proof', title: 'Join Payment Proof Channel', url: 'https://t.me/Streethustlepaymentproof', reward: 50, platform: 'Telegram' },
  { key: 'task_stars_group', title: 'Join Stars Group', url: 'https://t.me/Streetlifestars', reward: 50, platform: 'Telegram' },
  { key: 'task_sub_youtube', title: 'Subscribe YouTube Channel', url: 'https://youtube.com/@StreetLifeGame', reward: 50, platform: 'YouTube' },
];

const MAX_IMAGE_BYTES = 900 * 1024;

function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';
  return (window as any).Telegram?.WebApp?.initData || '';
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error('Choose a PNG, JPG or WEBP image.'));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Each screenshot must be 900 KB or smaller.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

export function TasksEarnCoinsModal({ isOpen, onClose, onToast }: Props) {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [proofs, setProofs] = useState<Record<string, string[]>>({});
  const [statusPlatform, setStatusPlatform] = useState<'WhatsApp' | 'Telegram'>('WhatsApp');
  const [statusLink, setStatusLink] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [boostProof, setBoostProof] = useState<string[]>([]);
  const [videoProof, setVideoProof] = useState<string[]>([]);
  const [statusProof, setStatusProof] = useState<string[]>([]);
  const [statusProof2, setStatusProof2] = useState<string[]>([]);

  const loadMyTasks = useCallback(async () => {
    const telegramData = getTelegramInitData();

    if (!telegramData) {
      onToast('Open STREET LIFE from the Telegram bot to view and submit tasks.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'GET',
        headers: { 'x-telegram-init-data': telegramData },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load task history.');
      }

      setRows(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Could not load task history.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (isOpen) void loadMyTasks();
  }, [isOpen, loadMyTasks]);

  if (!isOpen) return null;

  const addImage = async (
    key: string,
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (!file) return;

    try {
      const image = await readImage(file);
      setter((current) => [
        ...current,
        image,
      ].slice(0, key === 'status_post' && statusPlatform === 'WhatsApp' ? 2 : 1));

      playSuccessSound();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Image upload failed.');
    }
  };

  const alreadyApproved = (key: string) =>
    rows.some((row) => row.task_key === key && row.status === 'approved');

  const alreadyPending = (key: string) =>
    rows.some((row) => row.task_key === key && row.status === 'pending');

  const submit = async (input: {
    key: string;
    type: 'social' | 'status_post' | 'boost' | 'video';
    reward: number;
    platform?: string;
    proofUrl?: string;
    screenshots: string[];
  }) => {
    playClickSound();

    const telegramData = getTelegramInitData();

    if (!telegramData) {
      onToast('Telegram verification is missing. Open the game through @streetlifebot.');
      return;
    }

    if (alreadyApproved(input.key)) {
      onToast('This task has already been approved and rewarded.');
      return;
    }

    if (alreadyPending(input.key)) {
      onToast('This task is already waiting for admin review.');
      return;
    }

    setSubmitting(input.key);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: telegramData,
          ...input,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Task verification or submission failed.');
      }

      playSuccessSound();

      if (data.autoVerified === true || data.status === 'approved') {
        onToast(`Telegram task verified! +${input.reward} SC credited.`);
      } else {
        onToast('Proof submitted. Your reward will be credited after admin approval.');
      }

      await loadMyTasks();

      setProofs((current) => ({ ...current, [input.key]: [] }));

      if (input.type === 'status_post') {
        setStatusProof([]);
        setStatusProof2([]);
        setStatusLink('');
      }

      if (input.type === 'boost') setBoostProof([]);

      if (input.type === 'video') {
        setVideoProof([]);
        setVideoLink('');
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Task submission failed.');
    } finally {
      setSubmitting(null);
    }
  };

  const imagePicker = (
    label: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    max = 1
  ) => (
    <div className="space-y-1">
      <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/40 p-3 text-[11px] font-bold text-gray-300 cursor-pointer">
        <Upload className="h-4 w-4" /> {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={max > 1}
          className="hidden"
          onChange={async (event) => {
            const selected = Array.from(event.target.files || []).slice(0, max - values.length);

            for (const file of selected) {
              await addImage('proof', file, setter);
            }

            event.target.value = '';
          }}
          disabled={values.length >= max}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {values.map((src, index) => (
          <div key={index} className="relative">
            <img
              src={src}
              alt="Uploaded proof"
              className="h-16 w-16 rounded-lg border border-white/20 object-cover"
            />
            <button
              type="button"
              onClick={() => setter((old) => old.filter((_, i) => i !== index))}
              className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white"
              aria-label="Remove screenshot"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const taskButton = (
    key: string,
    title: string,
    reward: number,
    platform: string,
    url: string
  ) => {
    const done = alreadyApproved(key);
    const pending = alreadyPending(key);
    const isTelegramTask = platform === 'Telegram';

    return (
      <div key={key} className="rounded-xl border border-white/10 bg-[#181818] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">{title}</div>
            <div className="text-[10px] text-gray-400">
              Reward: +{reward} SC • {isTelegramTask ? 'Telegram API verification' : 'Admin verification'}
            </div>
          </div>

          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black ${
              done
                ? 'bg-emerald-500/20 text-emerald-300'
                : pending
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-white/10 text-gray-300'
            }`}
          >
            {done ? 'APPROVED' : pending ? 'PENDING' : 'NOT SUBMITTED'}
          </span>
        </div>

        {!done && !pending && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300"
            >
              Open task <ExternalLink className="h-3 w-3" />
            </a>

            {!isTelegramTask && (
              <>
                {imagePicker(
                  'Upload screenshot proof',
                  proofs[key] || [],
                  (value) => setProofs((old) => ({ ...old, [key]: value }))
                )}
              </>
            )}

            <button
              type="button"
              disabled={submitting === key || (!isTelegramTask && !(proofs[key]?.length))}
              onClick={() =>
                void submit({
                  key,
                  type: 'social',
                  reward,
                  platform,
                  proofUrl: url,
                  screenshots: isTelegramTask ? [] : (proofs[key] || []),
                })
              }
              className="w-full rounded-lg bg-[#FFD700] py-2 text-[10px] font-black uppercase text-black disabled:opacity-40"
            >
              {submitting === key
                ? 'Verifying…'
                : isTelegramTask
                  ? 'Verify membership & claim'
                  : 'Submit for admin review'}
            </button>
          </>
        )}
      </div>
    );
  };

  const statusCount = rows.filter(
    (row) =>
      row.task_type === 'status_post' &&
      Date.now() - new Date(row.submitted_at).getTime() < 86400000 &&
      row.status !== 'rejected'
  ).length;

  const boostCount = rows.filter(
    (row) =>
      row.task_type === 'boost' &&
      Date.now() - new Date(row.submitted_at).getTime() < 86400000 &&
      row.status !== 'rejected'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-[#FFD700] bg-[#121212] p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-[#FFD700]" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">Tasks — Earn Coins</h2>
              <p className="text-[10px] text-gray-400">
                Telegram tasks are checked automatically. Other tasks require admin approval.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="rounded-full bg-white/10 p-2 text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-3 flex-1 space-y-4 overflow-y-auto pr-1">
          <section className="space-y-2">
            <h3 className="text-xs font-black uppercase text-[#FFD700]">Social tasks • 50 SC each</h3>
            {SOCIAL_TASKS.map((task) =>
              taskButton(task.key, task.title, task.reward, task.platform, task.url)
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-[#FFD700]/40 bg-black/50 p-3">
            <h3 className="text-xs font-black uppercase text-[#FFD700]">
              Daily status post • 50 SC each • maximum 2 per 24 hours
            </h3>

            <p className="text-[10px] text-gray-400">
              Submitted proof is reviewed by an admin. Daily limits are checked on the server.
            </p>

            <div className="flex gap-2">
              {(['WhatsApp', 'Telegram'] as const).map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setStatusPlatform(platform)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                    statusPlatform === platform
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {platform} Status
                </button>
              ))}
            </div>

            {statusPlatform === 'Telegram' && (
              <input
                value={statusLink}
                onChange={(event) => setStatusLink(event.target.value)}
                placeholder="Paste your Telegram Status link"
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white"
              />
            )}

            {imagePicker(
              statusPlatform === 'WhatsApp'
                ? 'Upload status + handwritten date screenshot'
                : 'Upload Telegram status + date screenshot',
              statusProof,
              setStatusProof
            )}

            {statusPlatform === 'WhatsApp' &&
              imagePicker('Upload second screenshot showing views', statusProof2, setStatusProof2)}

            <div className="text-[10px] text-gray-400">{statusCount}/2 submissions in the last 24 hours</div>

            <button
              type="button"
              disabled={
                submitting === 'status_post' ||
                statusCount >= 2 ||
                !statusProof.length ||
                (statusPlatform === 'WhatsApp' && !statusProof2.length) ||
                (statusPlatform === 'Telegram' && !statusLink.trim())
              }
              onClick={() =>
                void submit({
                  key: `status_post_${Date.now()}`,
                  type: 'status_post',
                  reward: 50,
                  platform: statusPlatform,
                  proofUrl: statusLink.trim() || undefined,
                  screenshots: [...statusProof, ...statusProof2],
                })
              }
              className="w-full rounded-lg bg-[#FFD700] py-2 text-xs font-black uppercase text-black disabled:opacity-40"
            >
              {submitting === 'status_post' ? 'Submitting…' : 'Submit status post'}
            </button>
          </section>

          <section className="space-y-3 rounded-2xl border border-[#FFD700]/40 bg-black/50 p-3">
            <h3 className="text-xs font-black uppercase text-[#FFD700]">
              Telegram channel boost • 1,000 SC • maximum 3 per 24 hours
            </h3>

            <a
              href="https://t.me/Streethustlegame2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cyan-300"
            >
              Open channel <ExternalLink className="h-3 w-3" />
            </a>

            {imagePicker('Upload genuine boost confirmation screenshot', boostProof, setBoostProof)}

            <div className="text-[10px] text-gray-400">{boostCount}/3 submissions in the last 24 hours</div>

            <button
              type="button"
              disabled={submitting === 'boost' || boostCount >= 3 || !boostProof.length}
              onClick={() =>
                void submit({
                  key: `boost_${Date.now()}`,
                  type: 'boost',
                  reward: 1000,
                  platform: 'Telegram',
                  proofUrl: 'https://t.me/Streethustlegame2',
                  screenshots: boostProof,
                })
              }
              className="w-full rounded-lg bg-[#FFD700] py-2 text-xs font-black uppercase text-black disabled:opacity-40"
            >
              {submitting === 'boost' ? 'Submitting…' : 'Submit boost proof'}
            </button>
          </section>

          <section className="space-y-3 rounded-2xl border border-[#FFD700]/40 bg-black/50 p-3">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-[#FFD700]">
              <Video className="h-4 w-4" /> Video promo • 2,000 SC
            </h3>

            <p className="text-[10px] text-gray-300">
              Post a Street Hustle video on TikTok or YouTube. Minimum 100 likes and 1,000 views.
              The link and proof are reviewed by an admin.
            </p>

            <input
              value={videoLink}
              onChange={(event) => setVideoLink(event.target.value)}
              placeholder="Paste TikTok or YouTube video URL"
              className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white"
            />

            {imagePicker('Upload screenshot showing video views and likes', videoProof, setVideoProof)}

            <button
              type="button"
              disabled={submitting === 'video' || !videoLink.trim() || !videoProof.length}
              onClick={() =>
                void submit({
                  key: 'video_promo',
                  type: 'video',
                  reward: 2000,
                  platform:
                    videoLink.toLowerCase().includes('youtube') ||
                    videoLink.toLowerCase().includes('youtu.be')
                      ? 'YouTube'
                      : 'TikTok',
                  proofUrl: videoLink.trim(),
                  screenshots: videoProof,
                })
              }
              className="w-full rounded-lg bg-[#FFD700] py-2 text-xs font-black uppercase text-black disabled:opacity-40"
            >
              {submitting === 'video' ? 'Submitting…' : 'Submit video for review'}
            </button>
          </section>

          <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-amber-300">
              <Clock className="h-4 w-4" /> Watch 30 ads • 3,000 SC
            </h3>
            <p className="mt-1 text-[10px] text-gray-300">
              Ad rewards are disabled until genuine ad-network verification is connected.
            </p>
          </section>

          <section className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-gray-300">Your submissions</h3>
              <button
                type="button"
                onClick={() => void loadMyTasks()}
                className="text-[10px] font-bold text-cyan-300"
              >
                Refresh
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {!loading && rows.length === 0 && (
              <p className="text-[10px] text-gray-500">No task submissions yet.</p>
            )}

            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 p-2 text-[10px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">
                    {row.task_key.replaceAll('_', ' ')} • +{row.reward} SC
                  </div>
                  <div className="text-gray-500">
                    {new Date(row.submitted_at).toLocaleString()}
                  </div>
                  {row.denial_reason && (
                    <div className="text-red-300">{row.denial_reason}</div>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-md px-2 py-1 font-black uppercase ${
                    row.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : row.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </section>
        </div>

        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold uppercase text-white"
          >
            Close Tasks
          </button>
        </div>
      </div>
    </div>
  );
}

export default TasksEarnCoinsModal;
