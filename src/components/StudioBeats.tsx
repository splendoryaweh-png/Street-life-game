'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Volume1,
  Lock,
  Unlock,
  Sparkles,
  Flame,
  Radio,
  Disc3,
  Layers,
  Clock,
  Coins,
  CheckCircle2,
  ChevronRight,
  Info,
  Search,
  Sliders,
  Award,
  Zap,
  ArrowUpRight,
  X,
  Mic,
  Music2,
  Share2,
  Headphones,
  Download,
  Camera,
  Video,
  VideoOff,
} from 'lucide-react';
import {
  LongBeat,
  BeatSection,
  LONG_BEATS_CATALOG,
  STUDIO_LEVELS,
  isLongBeatUnlocked,
  getUnlockedBeatsCount,
  formatTimeMinutes,
  getBeatById,
  getSectionAtTime,
} from '../data/longBeatsData';
import { longBeatEngine } from '../audio/longBeatEngine';
import { UserGameState } from '@/types/game';
import { playClickSound, playCoinSound, playSuccessSound } from '@/lib/sound';
import { savePostedSong, GROUP_TELEGRAM } from '@/lib/storage';

// Daily record limits helper: localStorage 'streetlife_record_count' -> { date: YYYY-MM-DD, count }
function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStoredDailyRecordCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem('streetlife_record_count');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === getTodayDateString()) {
        return typeof parsed.count === 'number' ? parsed.count : 0;
      }
    }
  } catch {}
  return 0;
}

function getVirtualMicStream(): { stream: MediaStream | null; cleanup: () => void } {
  try {
    if (typeof window === 'undefined') return { stream: null, cleanup: () => {} };
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return { stream: null, cleanup: () => {} };

    const ctx = new AudioContextClass();
    if (typeof ctx.createMediaStreamDestination !== 'function') {
      return { stream: null, cleanup: () => { ctx.close().catch(() => {}); } };
    }

    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);

    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    return {
      stream: dest.stream,
      cleanup: () => {
        try {
          osc.stop();
          gain.disconnect();
          ctx.close().catch(() => {});
        } catch {}
      },
    };
  } catch {
    return { stream: null, cleanup: () => {} };
  }
}

function saveStoredDailyRecordCount(newCount: number): void {
  if (typeof window === 'undefined') return;
  try {
    const data = {
      date: getTodayDateString(),
      count: newCount,
    };
    localStorage.setItem('streetlife_record_count', JSON.stringify(data));
  } catch {}
}

// Local list of last 3 successful recordings
export interface SavedStudioRecording {
  id: string;
  date: string;
  duration: string;
  durationSec: number;
  beatName: string;
  downloadName: string;
  audioUrl?: string;
}

function getStoredRecentRecordings(): SavedStudioRecording[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('streetlife_recent_recordings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 3);
    }
  } catch {}
  return [];
}

function saveStoredRecentRecordings(recordings: SavedStudioRecording[]): void {
  if (typeof window === 'undefined') return;
  try {
    const metaList = recordings.slice(0, 3).map((r) => ({
      id: r.id,
      date: r.date,
      duration: r.duration,
      durationSec: r.durationSec,
      beatName: r.beatName,
      downloadName: r.downloadName,
    }));
    localStorage.setItem('streetlife_recent_recordings', JSON.stringify(metaList));
  } catch {}
}

interface StudioBeatsProps {
  gameState?: UserGameState;
  onToast?: (msg: string) => void;
  onSelectForRecording?: (beat: LongBeat) => void;
  onUpgradeStudioLevel?: (newLevel: number) => void;
}

export function StudioBeats({
  gameState,
  onToast,
  onSelectForRecording,
  onUpgradeStudioLevel,
}: StudioBeatsProps) {
  // Player's studio level & currency with local upgrade overrides
  const [upgradedLevelOverride, setUpgradedLevelOverride] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const savedLevel = localStorage.getItem('streetlife_studio_level');
      if (savedLevel !== null) return parseInt(savedLevel, 10) || 0;
    }
    return null;
  });
  const [spentCoinsDelta, setSpentCoinsDelta] = useState<number>(0);

  const studioLevel =
    upgradedLevelOverride !== null
      ? upgradedLevelOverride
      : gameState?.studioLevel !== undefined
      ? gameState.studioLevel
      : 0;

  const playerCoins = Math.max(0, (gameState?.streetCoin ?? 50000) - spentCoinsDelta);

  // Active Selected / Playing Beat
  const [currentBeatId, setCurrentBeatId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedBeat = localStorage.getItem('streetlife_current_long_beat');
      if (savedBeat && getBeatById(savedBeat)) return savedBeat;
    }
    return LONG_BEATS_CATALOG[0].id;
  });

  const currentBeat: LongBeat = useMemo(() => {
    return getBeatById(currentBeatId) || LONG_BEATS_CATALOG[0];
  }, [currentBeatId]);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentSection, setCurrentSection] = useState<BeatSection>(currentBeat.sections[0]);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.85);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);

  // Filter & Search Controls
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'locked' | 'level'>('all');
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [selectedInspectBeat, setSelectedInspectBeat] = useState<LongBeat | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState<boolean>(false);
  const [isRecordingPromptOpen, setIsRecordingPromptOpen] = useState<boolean>(false);

  // 3 Studio Buttons: Recording State, Video Freestyle Camera & Limit (Max 2 songs per day)
  const [dailyRecordCount, setDailyRecordCount] = useState<number>(() => getStoredDailyRecordCount());
  const [showDailyLimitModal, setShowDailyLimitModal] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  // Video Freestyle Camera State & Ref
  const [isVideoFreestyle, setIsVideoFreestyle] = useState<boolean>(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoModalUrl, setActiveVideoModalUrl] = useState<string | null>(null);

  // Per-beat recordings map (beatId -> recording)
  const [recordingsByBeat, setRecordingsByBeat] = useState<
    Record<string, { blob: Blob; url: string; durationSec: number; isVideo: boolean; beatName: string }>
  >({});
  const [recordingBeatId, setRecordingBeatId] = useState<string | null>(null);
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);
  const [isPreviewingRecordedSong, setIsPreviewingRecordedSong] = useState<boolean>(false);

  // Vault for last 3 successful recordings (date, duration, link/download)
  const [recentRecordings, setRecentRecordings] = useState<SavedStudioRecording[]>(() => getStoredRecentRecordings());
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const recentAudioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Visualizer Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Playhead update interval
  const playheadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Toast Helper
  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else console.log(msg);
    },
    [onToast]
  );

  const formatRecordingTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Clean up recording & audio preview on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  // Stop recording helper
  const handleStopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // PER-BEAT RECORD HANDLER (Directly records on this beat without taking player to vocal booth or rent side)
  const handleRecordBeat = async (beat: LongBeat) => {
    playClickSound();

    // If currently recording this beat -> stop
    if (isRecording && recordingBeatId === beat.id) {
      handleStopRecording();
      return;
    }

    // If recording another beat -> stop previous first
    if (isRecording) {
      handleStopRecording();
    }

    // Check daily limit: Max 2 songs per day
    const currentCount = getStoredDailyRecordCount();
    if (currentCount >= 2) {
      setShowDailyLimitModal(true);
      return;
    }

    try {
      // Ensure beat audio context is resumed and playing smoothly
      try {
        await longBeatEngine.ensureRunning();
      } catch {}

      let stream: MediaStream | null = null;
      let isVirtual = false;

      // Safely check device microphone/camera
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        try {
          if (isVideoFreestyle) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
            });
          } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        } catch (mediaErr) {
          console.warn('Microphone/camera permission unavailable or denied in this context:', mediaErr);
        }
      }

      // If physical mic is blocked or unavailable, fall back to studio virtual audio stream
      if (!stream) {
        isVirtual = true;
        const virtual = getVirtualMicStream();
        if (virtual.stream) {
          stream = virtual.stream;
        }
      }

      streamRef.current = stream;

      // Attach video stream to camera preview if video mode enabled and stream exists
      if (isVideoFreestyle && videoPreviewRef.current && stream) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      // Keep beat playing smoothly at volume 1.0
      setCurrentBeatId(beat.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('streetlife_current_long_beat', beat.id);
      }
      longBeatEngine.setVolume(1.0);
      setVolume(1.0);
      setIsMuted(false);
      longBeatEngine.play(beat.id, 0);
      setIsPlaying(true);

      let mimeType = isVideoFreestyle ? 'video/webm' : 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (isVideoFreestyle) {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            mimeType = 'video/webm;codecs=vp8,opus';
          } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
          } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
          }
        } else {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }
        }
      }

      let activeStream = stream;
      if (!activeStream) {
        const virtual = getVirtualMicStream();
        activeStream = virtual.stream;
      }

      if (!activeStream) {
        toast('🎙️ Recording with Studio Synthesizer.');
        activeStream = new MediaStream();
      }

      streamRef.current = activeStream;
      const recorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setRecordingBeatId(beat.id);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalSecs = recordingSecondsRef.current;
        const isVideo = isVideoFreestyle;
        const blob = new Blob(recordedChunksRef.current, {
          type: isVideo ? 'video/webm' : 'audio/webm',
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }

        // Check 1 minute minimum
        if (finalSecs < 60) {
          toast('⚠️ Need at least 1 minute - Not counted in daily stats');
        } else {
          const url = URL.createObjectURL(blob);
          setRecordedBlob(blob);
          setRecordedUrl(url);

          setRecordingsByBeat((prev) => ({
            ...prev,
            [beat.id]: {
              blob,
              url,
              durationSec: finalSecs,
              isVideo,
              beatName: beat.name,
            },
          }));

          const updated = getStoredDailyRecordCount() + 1;
          saveStoredDailyRecordCount(updated);
          setDailyRecordCount(updated);

          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const durationStr = `${Math.floor(finalSecs / 60)}:${String(finalSecs % 60).padStart(2, '0')}`;
          const downloadName = `StreetLife-${beat.name.replace(/\s+/g, '_')}-${Date.now()}.webm`;

          const newRecordingItem: SavedStudioRecording = {
            id: `rec_${Date.now()}`,
            date: dateStr,
            duration: durationStr,
            durationSec: finalSecs,
            beatName: beat.name,
            downloadName,
            audioUrl: url,
          };

          setRecentRecordings((prev) => {
            const nextList = [newRecordingItem, ...prev.filter((p) => p.id !== newRecordingItem.id)].slice(0, 3);
            saveStoredRecentRecordings(nextList);
            return nextList;
          });

          playSuccessSound();
          toast(`🎤 Song recorded on "${beat.name}"! Tap Preview to hear it or Post to share!`);
        }

        setRecordingBeatId(null);
        setIsRecording(false);
      };

      recorder.start(250);
      setIsRecording(true);
      toast(`🔴 Recording started on "${beat.name}"! ${isVideoFreestyle ? '📹 Camera is ON!' : '🎙️ Microphone active.'}`);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        const sec = recordingSecondsRef.current;
        setRecordingSeconds(sec);

        if (sec >= 180) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          toast('⏱️ Max recording duration reached (3:00)!');
        }
      }, 1000);
    } catch (err) {
      console.warn('Studio recording notice:', err);
      toast('🎙️ Recording started with Studio Synthesizer. Check browser permissions for physical mic.');
    }
  };

  // Legacy single top bar record click (for current selected beat)
  const handleRecordClick = async () => {
    await handleRecordBeat(currentBeat);
  };

  // PER-BEAT PREVIEW HANDLER (Plays player's recorded track or previews beat cleanly)
  const handlePreviewBeat = (beat: LongBeat) => {
    playClickSound();

    const beatRec = recordingsByBeat[beat.id];

    // If user has recorded on this beat
    if (beatRec) {
      if (beatRec.isVideo) {
        setActiveVideoModalUrl(beatRec.url);
        return;
      }

      if (previewAudioRef.current && previewingBeatId === beat.id && isPreviewingRecordedSong) {
        previewAudioRef.current.pause();
        setPreviewingBeatId(null);
        setIsPreviewingRecordedSong(false);
        setIsPreviewPlaying(false);
        return;
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      longBeatEngine.pause();
      setIsPlaying(false);

      const audio = new Audio(beatRec.url);
      previewAudioRef.current = audio;
      setPreviewingBeatId(beat.id);
      setIsPreviewingRecordedSong(true);
      setIsPreviewPlaying(true);
      audio.play().catch(console.error);

      audio.onended = () => {
        setPreviewingBeatId(null);
        setIsPreviewingRecordedSong(false);
        setIsPreviewPlaying(false);
      };
      audio.onpause = () => {
        setPreviewingBeatId(null);
        setIsPreviewingRecordedSong(false);
        setIsPreviewPlaying(false);
      };
      toast(`▶️ Previewing your recorded track on "${beat.name}"`);
      return;
    }

    // No recording yet on this beat: Preview the beat instrumental cleanly
    if (currentBeatId === beat.id && isPlaying) {
      longBeatEngine.pause();
      setIsPlaying(false);
      setPreviewingBeatId(null);
      toast(`⏸️ Paused "${beat.name}"`);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setCurrentBeatId(beat.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('streetlife_current_long_beat', beat.id);
      }
      longBeatEngine.play(beat.id, 0);
      setIsPlaying(true);
      setPreviewingBeatId(beat.id);
      setIsPreviewingRecordedSong(false);
      toast(`▶️ Previewing beat: "${beat.name}" (${beat.genre} • ${beat.bpm} BPM)`);
    }
  };

  // Legacy preview handler
  const handlePreview = () => {
    handlePreviewBeat(currentBeat);
  };

  // PER-BEAT POST HANDLER (Downloads recording and opens Telegram group to post)
  const handlePostBeat = (beat: LongBeat) => {
    playClickSound();
    const beatRec = recordingsByBeat[beat.id];

    if (!beatRec) {
      if (recordedBlob && recordedUrl) {
        playSuccessSound();
        toast(`🚀 Downloading recording & launching Telegram...`);
        const a = document.createElement('a');
        a.href = recordedUrl;
        a.download = `StreetLife-${beat.name.replace(/\s+/g, '_')}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          window.open('https://t.me/Streetlifestars', '_blank');
        }, 1000);
        return;
      }

      toast(`🎤 Record your song on "${beat.name}" first, then tap Post!`);
      return;
    }

    playSuccessSound();
    toast(`🚀 Downloading "${beat.name}" recording & launching Telegram...`);

    const a = document.createElement('a');
    a.href = beatRec.url;
    a.download = `StreetLife-${beat.name.replace(/\s+/g, '_')}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      window.open('https://t.me/Streetlifestars', '_blank');
    }, 1000);
  };

  // Legacy post handler
  const handlePost = () => {
    handlePostBeat(currentBeat);
  };

  // Recent recordings helper actions
  const handlePlayRecentRecording = (rec: SavedStudioRecording) => {
    playClickSound();
    if (!rec.audioUrl) return;

    if (recentAudioRef.current && playingRecId === rec.id) {
      recentAudioRef.current.pause();
      setPlayingRecId(null);
      return;
    }

    if (recentAudioRef.current) {
      recentAudioRef.current.pause();
    }

    const audio = new Audio(rec.audioUrl);
    recentAudioRef.current = audio;
    setPlayingRecId(rec.id);
    audio.play().catch(console.error);

    audio.onended = () => {
      setPlayingRecId(null);
    };
    audio.onpause = () => {
      setPlayingRecId((curr) => (curr === rec.id ? null : curr));
    };
  };

  const handleDownloadRecentRecording = (rec: SavedStudioRecording) => {
    playClickSound();
    if (!rec.audioUrl) return;
    const a = document.createElement('a');
    a.href = rec.audioUrl;
    a.download = rec.downloadName || `StreetLife-${rec.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`⬇️ Downloading ${rec.downloadName || 'recording'}...`);
  };

  const handlePostRecentRecording = (rec: SavedStudioRecording) => {
    playClickSound();
    handleDownloadRecentRecording(rec);
    setTimeout(() => {
      window.open('https://t.me/Streetlifestars', '_blank');
    }, 1000);
  };

  // Sync studio level persistence
  const handleUpgradeToLevel = (level: number) => {
    const levelInfo = STUDIO_LEVELS[level];
    if (!levelInfo) return;

    if (playerCoins < levelInfo.upgradeCost) {
      toast(`❌ Need ${levelInfo.upgradeCost.toLocaleString()} Street Coins! (You have ${playerCoins.toLocaleString()})`);
      return;
    }

    const newCoins = playerCoins - levelInfo.upgradeCost;
    setSpentCoinsDelta((prev) => prev + levelInfo.upgradeCost);
    setUpgradedLevelOverride(level);

    if (typeof window !== 'undefined') {
      localStorage.setItem('streetlife_studio_level', String(level));
      try {
        const rawSave = localStorage.getItem('streetLife_save_v2');
        if (rawSave) {
          const parsed = JSON.parse(rawSave);
          parsed.studioLevel = level;
          parsed.streetCoin = newCoins;
          localStorage.setItem('streetLife_save_v2', JSON.stringify(parsed));
        }
      } catch {}
    }

    if (onUpgradeStudioLevel) {
      onUpgradeStudioLevel(level);
    }

    playSuccessSound();
    playCoinSound();
    toast(`🎉 Upgraded to ${levelInfo.name}! Unlocked ${levelInfo.unlockedCount} long beats!`);
    setIsUpgradeModalOpen(false);
  };

  // Subscribe to Audio Engine Events
  useEffect(() => {
    const unbindTime = longBeatEngine.onTimeUpdate((time, sec) => {
      if (!isScrubbing) {
        setCurrentTime(time);
        setCurrentSection(sec);
      }
    });

    const unbindState = longBeatEngine.onStateChange((playing) => {
      setIsPlaying(playing);
    });

    const unbindSection = longBeatEngine.onSectionChange((sec) => {
      setCurrentSection(sec);
    });

    const unbindEnd = longBeatEngine.onEnd(() => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      unbindTime();
      unbindState();
      unbindSection();
      unbindEnd();
    };
  }, [isScrubbing]);

  // Real-time Canvas Audio Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    const render = () => {
      if (!isSubscribed) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const freqData = longBeatEngine.getFrequencyData();
      const numBars = 32;
      const barWidth = (width / numBars) - 2;

      // Draw reflective frequency bars
      for (let i = 0; i < numBars; i++) {
        const val = isPlaying ? (freqData[i * 2] || 0) : Math.sin(Date.now() * 0.003 + i * 0.3) * 12 + 16;
        const normalized = val / 255;
        const barHeight = Math.max(4, normalized * height * 0.85);

        // Gradient from gold to cyan to neon purple
        const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        grad.addColorStop(0, '#FFD700');
        grad.addColorStop(0.5, '#06B6D4');
        grad.addColorStop(1, '#A855F7');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();

        // Top glow dot
        if (isPlaying && barHeight > 15) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(i * (barWidth + 2) + barWidth / 2, height - barHeight - 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isSubscribed = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Master Playback Controls
  const handleTogglePlay = (beat: LongBeat) => {
    playClickSound();

    // Check if beat is locked
    const isUnlocked = isLongBeatUnlocked(beat, studioLevel);
    if (!isUnlocked) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      toast(`🔒 Beat #${beat.number} is locked! Requires ${STUDIO_LEVELS[beat.requiredStudioLevel]?.shortName || 'higher level'}.`);
      return;
    }

    if (currentBeatId === beat.id && isPlaying) {
      longBeatEngine.pause();
    } else if (currentBeatId === beat.id && !isPlaying) {
      longBeatEngine.resume();
    } else {
      setCurrentBeatId(beat.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('streetlife_current_long_beat', beat.id);
      }
      longBeatEngine.play(beat.id, 0);
      toast(`▶️ Playing: "${beat.name}" (${beat.genre} • ${beat.bpm} BPM)`);
    }
  };

  const handleStop = () => {
    playClickSound();
    longBeatEngine.stop();
    setCurrentTime(0);
    toast('⏹️ Beat playback stopped');
  };

  const handleSeek = (newSeconds: number) => {
    longBeatEngine.seek(newSeconds);
    setCurrentTime(newSeconds);
    const sec = getSectionAtTime(currentBeat, newSeconds);
    setCurrentSection(sec);
  };

  const handleSkipSeconds = (deltaSeconds: number) => {
    playClickSound();
    const newTime = Math.max(0, Math.min(currentTime + deltaSeconds, currentBeat.duration - 1));
    handleSeek(newTime);
    toast(`${deltaSeconds > 0 ? '+10s' : '-10s'} seeked`);
  };

  const handleNextBeat = () => {
    playClickSound();
    const available = LONG_BEATS_CATALOG.filter((b) => isLongBeatUnlocked(b, studioLevel));
    const currentIndex = available.findIndex((b) => b.id === currentBeatId);
    const nextIndex = (currentIndex + 1) % available.length;
    const nextBeat = available[nextIndex] || available[0];
    handleTogglePlay(nextBeat);
  };

  const handlePrevBeat = () => {
    playClickSound();
    const available = LONG_BEATS_CATALOG.filter((b) => isLongBeatUnlocked(b, studioLevel));
    const currentIndex = available.findIndex((b) => b.id === currentBeatId);
    const prevIndex = (currentIndex - 1 + available.length) % available.length;
    const prevBeat = available[prevIndex] || available[0];
    handleTogglePlay(prevBeat);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    longBeatEngine.setVolume(newVol);
  };

  const handleToggleMute = () => {
    playClickSound();
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 0.85);
      longBeatEngine.setVolume(prevVolume || 0.85);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
      longBeatEngine.setVolume(0);
    }
  };

  const handleSpeedToggle = (speed: number) => {
    playClickSound();
    setPlaybackSpeed(speed);
    longBeatEngine.setPlaybackRate(speed);
    toast(`⚡ Playback Speed: ${speed}x`);
  };

  const handleToggleLoop = () => {
    playClickSound();
    const newLoop = longBeatEngine.toggleLoop();
    setIsLooping(newLoop);
    toast(newLoop ? '🔁 Loop Enabled' : '➡️ Play Once (No Loop)');
  };

  // Set Beat for Studio Freestyle Recording Booth
  const handleSelectAsRecordingBeat = (beat: LongBeat) => {
    playClickSound();
    const isUnlocked = isLongBeatUnlocked(beat, studioLevel);
    if (!isUnlocked) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      toast(`🔒 Upgrade studio level to record over "${beat.name}"!`);
      return;
    }

    const metadata = {
      id: beat.id,
      name: beat.name,
      bpm: beat.bpm,
      producer: beat.producer,
      genre: beat.genre,
      title: beat.name,
      coverGradient: beat.coverGradient,
      requiredStudioLevel: beat.requiredStudioLevel,
      duration: beat.duration,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('selected_freestyle_beat', JSON.stringify(metadata));
        localStorage.setItem('streetlife_current_long_beat', beat.id);
      } catch {}
    }

    if (onSelectForRecording) {
      onSelectForRecording(beat);
    }

    playSuccessSound();
    toast(`🎤 Selected "${beat.name}" as your active Studio Recording Beat!`);
  };

  // Inspect Beat Details Modal
  const handleOpenInspect = (beat: LongBeat, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playClickSound();
    setSelectedInspectBeat(beat);
    setIsInspectModalOpen(true);
  };

  // Filtered Beats List
  const filteredBeats = useMemo(() => {
    return LONG_BEATS_CATALOG.filter((beat) => {
      // Tab filter
      if (activeTab === 'free' && !beat.isFree) return false;
      if (activeTab === 'locked' && beat.isFree) return false;
      if (activeTab === 'level' && filterLevel !== null && beat.requiredStudioLevel !== filterLevel) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = beat.name.toLowerCase().includes(q);
        const matchesGenre = beat.genre.toLowerCase().includes(q);
        const matchesProd = beat.producer.toLowerCase().includes(q);
        const matchesMood = beat.mood.toLowerCase().includes(q);
        const matchesTag = beat.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesGenre && !matchesProd && !matchesMood && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }, [activeTab, filterLevel, searchQuery]);

  const currentLevelInfo = STUDIO_LEVELS[studioLevel] || STUDIO_LEVELS[0];
  const unlockedCount = getUnlockedBeatsCount(studioLevel);
  const totalBeats = LONG_BEATS_CATALOG.length;
  const unlockPercentage = Math.round((unlockedCount / totalBeats) * 100);

  return (
    <div className="w-full flex flex-col space-y-4 pb-28 text-white select-none">
      {/* =========================================================================
          TOP STUDIO LEVEL & PROGRESSION CARD
         ========================================================================= */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1c1810] via-[#141414] to-[#0d0d0d] border border-[#FFD700]/30 shadow-[0_4px_24px_rgba(255,215,0,0.15)] relative overflow-hidden">
        {/* Glow ambient background accent */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#FFD700] text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  LONG BEATS STUDIO
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] text-[10px] font-black border border-[#FFD700]/40">
                  {currentLevelInfo.badge}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                14 Structured Long Beats • Clean Instrumentals (No FX)
              </p>
            </div>
          </div>

          {/* Level Upgrade Action Button */}
          {studioLevel < 4 && (
            <button
              onClick={() => {
                playClickSound();
                setIsUpgradeModalOpen(true);
              }}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-[0_0_12px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>Level Up</span>
            </button>
          )}
        </div>

        {/* Level Progression Progress Bar */}
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-gray-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>{currentLevelInfo.name}</span>
            </span>
            <span className="text-[#FFD700] font-mono">
              {unlockedCount} / {totalBeats} Beats Unlocked ({unlockPercentage}%)
            </span>
          </div>

          <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-amber-500 via-[#FFD700] to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_#FFD700]"
              style={{ width: `${unlockPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          HERO MASTER PLAYER CARD (Vinyl, Visualizer, Segmented Bar, Controls)
         ========================================================================= */}
      <div className="p-4 rounded-3xl bg-gradient-to-b from-[#18181b] to-[#0f0f12] border-2 border-[#FFD700]/50 shadow-[0_8px_32px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Vinyl disk and beat info header */}
        <div className="flex items-center gap-4 mb-3.5">
          {/* Animated Vinyl Graphic */}
          <div
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentBeat.coverGradient} p-1.5 relative shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-white/20`}
          >
            <div
              className={`w-full h-full rounded-full bg-black/90 flex items-center justify-center border border-white/10 relative overflow-hidden ${
                isPlaying ? 'animate-spin' : ''
              }`}
              style={{
                animationDuration: `${(60 / currentBeat.bpm) * 4 * (1 / playbackSpeed)}s`,
              }}
            >
              {/* Vinyl Grooves */}
              <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-4 rounded-full border border-white/10 pointer-events-none" />
              <div className="absolute inset-6 rounded-full border border-white/15 pointer-events-none" />

              {/* Center hole label */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-[#FFD700] flex items-center justify-center text-xs shadow-inner text-black font-black">
                {currentBeat.icon}
              </div>
            </div>

            {/* Glowing active indicator dot */}
            {isPlaying && (
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-ping" />
            )}
          </div>

          {/* Current Beat Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-[#FFD700] border border-amber-500/30">
                BEAT #{currentBeat.number} {currentBeat.isFree ? '• FREE' : `• LVL ${currentBeat.requiredStudioLevel}`}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                {currentBeat.bpm} BPM
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                {formatTimeMinutes(currentBeat.duration)}
              </span>
            </div>

            <h2 className="text-lg font-black text-white truncate tracking-tight">
              {currentBeat.name}
            </h2>
            <p className="text-xs font-bold text-[#FFD700] truncate">{currentBeat.genre}</p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{currentBeat.story}</p>
          </div>
        </div>

        {/* Real-time Frequency Visualizer Canvas */}
        <div className="w-full h-12 bg-black/70 rounded-2xl p-2 border border-white/10 mb-3 flex items-center justify-center relative overflow-hidden">
          <canvas ref={canvasRef} width={340} height={40} className="w-full h-full" />
          <div className="absolute bottom-1 right-2 text-[9px] font-mono text-gray-500 pointer-events-none">
            {isPlaying ? 'LIVE STEREO 44.1kHz • ZERO FX' : 'READY • HIGH FIDELITY'}
          </div>
        </div>

        {/* Current Section Banner Badge */}
        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                currentSection.type === 'hook'
                  ? 'bg-amber-400 animate-ping'
                  : currentSection.type === 'verse'
                  ? 'bg-blue-400'
                  : currentSection.type === 'intro'
                  ? 'bg-indigo-400'
                  : 'bg-purple-400'
              }`}
            />
            <span className="font-black uppercase tracking-wider text-white truncate">
              {currentSection.name}
            </span>
          </div>

          <span className="text-[10px] font-mono text-[#FFD700] uppercase font-bold shrink-0 ml-2">
            [{currentSection.type.toUpperCase()}]
          </span>
        </div>

        {/* Multi-Segment Timeline Progress Bar */}
        <div className="space-y-1.5 mb-3">
          <div
            className="w-full h-3.5 bg-black/80 rounded-xl overflow-hidden relative cursor-pointer flex border border-white/10 p-0.5"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              handleSeek(ratio * currentBeat.duration);
            }}
          >
            {/* Color Segments for Intro / Verse / Hook / Outro */}
            {currentBeat.sections.map((sec, idx) => {
              const secDuration = sec.endTime - sec.startTime;
              const secWidthPercent = (secDuration / currentBeat.duration) * 100;
              return (
                <div
                  key={idx}
                  className={`h-full ${sec.color} opacity-40 hover:opacity-75 transition-opacity relative border-r border-black/40`}
                  style={{ width: `${secWidthPercent}%` }}
                  title={`${sec.name} (${formatTimeMinutes(sec.startTime)} - ${formatTimeMinutes(sec.endTime)})`}
                />
              );
            })}

            {/* Live Playhead Indicator */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] pointer-events-none transition-all duration-75"
              style={{
                left: `calc(${(currentTime / currentBeat.duration) * 100}% - 3px)`,
              }}
            />
          </div>

          {/* Timestamp Indicators */}
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 px-0.5">
            <span className="text-white font-bold">{formatTimeMinutes(currentTime)}</span>
            <span className="text-[10px] text-gray-500">
              {currentSection.instruments.slice(0, 3).join(', ')}
            </span>
            <span>{formatTimeMinutes(currentBeat.duration)}</span>
          </div>
        </div>

        {/* Master Transport Playback Controls */}
        <div className="flex items-center justify-between gap-1 mb-3.5">
          {/* Skip Back 10s */}
          <button
            onClick={() => handleSkipSeconds(-10)}
            type="button"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Prev Beat */}
          <button
            onClick={handlePrevBeat}
            type="button"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="Previous Beat"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Large Main Play / Pause Button */}
          <button
            onClick={() => handleTogglePlay(currentBeat)}
            type="button"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-black" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-black" />
                <span>PLAY BEAT</span>
              </>
            )}
          </button>

          {/* Next Beat */}
          <button
            onClick={handleNextBeat}
            type="button"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="Next Beat"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Skip Forward 10s */}
          <button
            onClick={() => handleSkipSeconds(10)}
            type="button"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="Forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            NEW ROW BELOW EXISTING PLAY BEAT BUTTON: RECORD, PREVIEW, POST
            PLUS DAILY COUNT (Daily: X/2) AND TIMER BAR (Min 1:00 / Max 3:00)
           ========================================================================= */}
        <div className="mb-3.5 bg-black/60 p-3 rounded-2xl border border-white/10 shadow-inner">
          {/* Header with Daily Count */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-[#FFD700]'}`} />
              <span className="font-black text-white uppercase tracking-wider text-[11px]">
                {isRecording ? 'RECORDING VOCALS' : 'VOCAL RECORDING BOOTH'}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFD700] text-xs font-mono font-black border border-[#FFD700]/30 shadow-sm">
              Daily: {dailyRecordCount}/2
            </span>
          </div>

          {/* Timer UI: Show "Recording: 0:15 / Min 1:00 / Max 3:00" - Red progress if <60 sec, green if >=60 sec */}
          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={`font-bold ${recordingSeconds < 60 ? 'text-red-400' : 'text-emerald-400'}`}>
                Recording: {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} / Min 1:00 / Max 3:00
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                recordingSeconds < 60
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {recordingSeconds < 60 ? 'Min 1:00' : 'Ready'}
              </span>
            </div>

            {/* Timer Progress Bar: Red if <60 sec, green if >=60 sec */}
            <div className="w-full bg-black/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  recordingSeconds < 60
                    ? 'bg-red-500 shadow-[0_0_8px_#EF4444]'
                    : 'bg-emerald-500 shadow-[0_0_8px_#10B981]'
                }`}
                style={{ width: `${Math.min(100, (recordingSeconds / 180) * 100)}%` }}
              />
            </div>
          </div>

          {/* 3 NEW BUTTONS: Record, Preview, Post */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {/* NEW BUTTON 1: "Record" */}
            <button
              onClick={() => {
                if (dailyRecordCount >= 2 && !isRecording) {
                  setShowDailyLimitModal(true);
                  return;
                }
                handleRecordClick();
              }}
              disabled={dailyRecordCount >= 2 && !isRecording}
              type="button"
              className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md ${
                dailyRecordCount >= 2 && !isRecording
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                  : isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse border border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.7)] cursor-pointer'
                  : 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] cursor-pointer active:scale-95'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record</span>
                </>
              )}
            </button>

            {/* NEW BUTTON 2: "Preview" */}
            <button
              onClick={handlePreview}
              disabled={!recordedBlob || recordingSeconds < 60}
              type="button"
              className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md ${
                !recordedBlob || recordingSeconds < 60
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                  : isPreviewPlaying
                  ? 'bg-amber-400 text-black border border-amber-300 animate-pulse cursor-pointer'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] cursor-pointer active:scale-95'
              }`}
            >
              {isPreviewPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-black" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Preview</span>
                </>
              )}
            </button>

            {/* NEW BUTTON 3: "Post" */}
            <button
              onClick={handlePost}
              disabled={!recordedBlob || recordingSeconds < 60}
              type="button"
              className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md ${
                !recordedBlob || recordingSeconds < 60
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 text-black cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>

          {/* =========================================================================
              LAST 3 SUCCESSFUL RECORDINGS VAULT
             ========================================================================= */}
          {recentRecordings.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black text-gray-400">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-amber-300">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>Recent Recordings ({recentRecordings.length}/3)</span>
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  Saved locally
                </span>
              </div>

              <div className="space-y-1.5">
                {recentRecordings.map((rec) => {
                  const isCurrentPlayingRec = playingRecId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {rec.beatName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-[#FFD700] border border-amber-500/30">
                            {rec.duration}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {rec.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Play / Pause button */}
                        {rec.audioUrl && (
                          <button
                            onClick={() => handlePlayRecentRecording(rec)}
                            type="button"
                            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              isCurrentPlayingRec
                                ? 'bg-amber-400 text-black border border-white'
                                : 'bg-white/10 hover:bg-white/20 text-[#FFD700]'
                            }`}
                            title={isCurrentPlayingRec ? 'Pause' : 'Play recording'}
                          >
                            {isCurrentPlayingRec ? (
                              <Pause className="w-3.5 h-3.5 fill-black" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-[#FFD700]" />
                            )}
                          </button>
                        )}

                        {/* Download button */}
                        {rec.audioUrl && (
                          <button
                            onClick={() => handleDownloadRecentRecording(rec)}
                            type="button"
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer"
                            title="Download audio"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Post to Telegram button */}
                        {rec.audioUrl && (
                          <button
                            onClick={() => handlePostRecentRecording(rec)}
                            type="button"
                            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                            title="Post to Telegram"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Second Row Controls: Speed, Loop, Volume, Record CTA */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
          {/* Speed & Loop Toggles */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            {/* Speed Buttons */}
            {[0.5, 1.0, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedToggle(speed)}
                type="button"
                className={`flex-1 py-1 px-1.5 rounded-xl text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-[#FFD700] text-black shadow-[0_0_8px_#FFD700]'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
              >
                {speed}x
              </button>
            ))}

            {/* Loop Toggle */}
            <button
              onClick={handleToggleLoop}
              type="button"
              className={`p-1.5 rounded-xl text-xs transition-all cursor-pointer shrink-0 ${
                isLooping
                  ? 'bg-amber-500/20 text-[#FFD700] border border-[#FFD700]/40'
                  : 'text-gray-500 hover:text-gray-300 bg-white/5'
              }`}
              title={isLooping ? 'Looping enabled' : 'Looping off'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-2xl border border-white/5">
            <button
              onClick={handleToggleMute}
              type="button"
              className="text-gray-400 hover:text-white cursor-pointer shrink-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4 text-[#FFD700]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#FFD700]" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-[#FFD700] h-1.5 bg-white/20 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Action Button: Set As Studio Recording Beat */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleSelectAsRecordingBeat(currentBeat)}
            type="button"
            className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>RECORD VOCALS OVER THIS BEAT</span>
          </button>

          <button
            onClick={() => handleOpenInspect(currentBeat)}
            type="button"
            className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-[#FFD700] font-black text-xs uppercase border border-[#FFD700]/30 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="Inspect Song Structure"
          >
            <Info className="w-4 h-4" />
            <span>STRUCTURE</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FILTER TABS & SEARCH BAR
         ========================================================================= */}
      <div className="space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search 14 beats by title, genre, mood..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/60 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]"
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('all');
              setFilterLevel(null);
            }}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'all' && filterLevel === null
                ? 'bg-[#FFD700] text-black shadow-[0_0_10px_#FFD700]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            All Beats (14)
          </button>

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('free');
              setFilterLevel(null);
            }}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'free'
                ? 'bg-emerald-500 text-black shadow-[0_0_10px_#10B981]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Free Starter (4)
          </button>

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('locked');
              setFilterLevel(null);
            }}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'locked'
                ? 'bg-red-500 text-white shadow-[0_0_10px_#EF4444]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Locked (10)
          </button>

          {/* Level Filter Pills */}
          {[0, 1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                playClickSound();
                setActiveTab('level');
                setFilterLevel(lvl);
              }}
              type="button"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'level' && filterLevel === lvl
                  ? 'bg-indigo-500 text-white shadow-[0_0_10px_#6366F1]'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Lvl {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          VIDEO FREESTYLE CAMERA CONTROLS & VIEWFINDER
         ========================================================================= */}
      <div className="p-3.5 rounded-3xl bg-gradient-to-r from-[#17171A] to-[#121214] border border-[#FFD700]/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isVideoFreestyle ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40'
            }`}>
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wide">
                  VIDEO FREESTYLE MODE
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  isVideoFreestyle ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {isVideoFreestyle ? 'CAMERA ACTIVE' : 'AUDIO ONLY'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isVideoFreestyle ? 'Front camera will record with the beat instrumentals' : 'Turn on camera to capture live video while dropping your verse'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsVideoFreestyle(!isVideoFreestyle);
              toast(!isVideoFreestyle ? '📹 Camera access enabled for Video Freestyle!' : '🎙️ Switched to Audio-only recording');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
              isVideoFreestyle
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-[#FFD700] text-black shadow-[0_0_10px_rgba(255,215,0,0.3)]'
            }`}
          >
            {isVideoFreestyle ? 'Camera ON' : 'Enable Camera'}
          </button>
        </div>

        {/* Live Camera Viewfinder when recording with video */}
        {isRecording && isVideoFreestyle && (
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-red-500 aspect-video shadow-[0_0_25px_rgba(239,68,68,0.4)]">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Viewfinder Overlays */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-red-500/50">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] font-mono font-black text-white">
                REC {formatRecordingTimer(recordingSeconds)} / 03:00
              </span>
            </div>
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 text-[10px] text-[#FFD700] font-black">
              🎵 {currentBeat.name} • {currentBeat.bpm} BPM
            </div>
            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
              LIVE FREESTYLE
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          CATALOG LIST: ALL 14 BEATS
         ========================================================================= */}
      <div className="space-y-3">
        {filteredBeats.map((beat) => {
          const isSelected = currentBeatId === beat.id;
          const isCurrentPlaying = isSelected && isPlaying;
          const isUnlocked = isLongBeatUnlocked(beat, studioLevel);
          const beatRecording = recordingsByBeat[beat.id];
          const isBeatRecordingActive = isRecording && recordingBeatId === beat.id;
          const isBeatPreviewPlaying = previewingBeatId === beat.id;

          return (
            <div
              key={beat.id}
              onClick={() => handleTogglePlay(beat)}
              className={`p-3.5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-br from-[#221c08] via-[#141414] to-[#0c0c0e] border-2 border-[#FFD700] ring-2 ring-[#FFD700]/30 shadow-[0_0_24px_rgba(255,215,0,0.25)]'
                  : 'bg-[#151518] border-white/10 hover:border-white/20'
              }`}
            >
              {/* Card Header Info */}
              <div className="flex items-center gap-3">
                {/* Styled Vinyl Icon Box */}
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${beat.coverGradient} p-1 flex items-center justify-center shrink-0 shadow-lg relative`}
                >
                  <div
                    className={`w-full h-full rounded-xl bg-black/70 flex items-center justify-center text-xl ${
                      isCurrentPlaying ? 'animate-spin' : ''
                    }`}
                    style={{ animationDuration: '3s' }}
                  >
                    <span>{beat.icon}</span>
                  </div>

                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center backdrop-blur-xs">
                      <Lock className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-white truncate">{beat.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                      {beat.bpm} BPM
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                      {formatTimeMinutes(beat.duration)}
                    </span>
                  </div>

                  <p className="text-[11px] font-bold text-[#FFD700] mt-0.5 truncate">
                    {beat.genre} • <span className="text-gray-400">{beat.producer}</span>
                  </p>

                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {beat.story}
                  </p>
                </div>

                {/* Unlock Status Badge */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {beat.isFree ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                      FREE
                    </span>
                  ) : isUnlocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                      UNLOCKED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>LVL {beat.requiredStudioLevel}</span>
                    </span>
                  )}

                  {/* Play State Pill */}
                  {isCurrentPlaying && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-[#FFD700] animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-[#FFD700]" />
                      PLAYING
                    </span>
                  )}
                </div>
              </div>

              {/* Mini Section Breakdown Map */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-1 overflow-x-auto scrollbar-none">
                {beat.sections.map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    className={`px-2 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap flex items-center gap-1 ${
                      isSelected && currentSection.name === sec.name
                        ? `${sec.color} text-white shadow-sm ring-1 ring-white/50`
                        : 'bg-black/50 text-gray-400 border border-white/5'
                    }`}
                  >
                    <span>{sec.name.split(':')[0]}</span>
                    <span className="text-[8px] opacity-70">
                      {sec.endTime - sec.startTime}s
                    </span>
                  </div>
                ))}
              </div>

              {/* Recording Status & Saved Recording Pills */}
              {isBeatRecordingActive && (
                <div className="mt-2.5 p-2 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] font-black uppercase text-red-300">
                      {isVideoFreestyle ? '📹 VIDEO RECORDING...' : '🎙️ AUDIO RECORDING...'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-white bg-red-600 px-2 py-0.5 rounded-md">
                    {formatRecordingTimer(recordingSeconds)} / 03:00
                  </span>
                </div>
              )}

              {beatRecording && !isBeatRecordingActive && (
                <div className="mt-2.5 p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-300 font-bold">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verse Recorded ({Math.floor(beatRecording.durationSec / 60)}:{String(beatRecording.durationSec % 60).padStart(2, '0')}{beatRecording.isVideo ? ' • 📹 Video' : ''})</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-200">Ready to Post</span>
                </div>
              )}

              {/* 3 BEAT BUTTONS: PREVIEW, RECORD, POST */}
              <div
                className="mt-3 grid grid-cols-3 gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* BUTTON 1: PREVIEW */}
                <button
                  onClick={() => handlePreviewBeat(beat)}
                  type="button"
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    isBeatPreviewPlaying
                      ? 'bg-amber-400 text-black border-white shadow-[0_0_12px_#F59E0B]'
                      : beatRecording
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                      : 'bg-black/60 hover:bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40'
                  }`}
                >
                  {isBeatPreviewPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-black" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{beatRecording ? 'Preview Song' : 'Preview'}</span>
                    </>
                  )}
                </button>

                {/* BUTTON 2: RECORD */}
                <button
                  onClick={() => handleRecordBeat(beat)}
                  type="button"
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    isBeatRecordingActive
                      ? 'bg-red-600 text-white border-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40'
                  }`}
                >
                  <Mic className={`w-3.5 h-3.5 ${isBeatRecordingActive ? 'animate-bounce text-white' : 'text-red-400'}`} />
                  <span>{isBeatRecordingActive ? `Stop (${formatRecordingTimer(recordingSeconds)})` : 'Record'}</span>
                </button>

                {/* BUTTON 3: POST */}
                <button
                  onClick={() => handlePostBeat(beat)}
                  type="button"
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    beatRecording
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-black font-black border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] active:scale-95'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/10'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </div>

              {/* Extra Details toggle link */}
              <div className="mt-2 pt-1 border-t border-white/5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => handleOpenInspect(beat, e)}
                  type="button"
                  className="text-[10px] text-gray-400 hover:text-[#FFD700] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Info className="w-3 h-3" />
                  <span>Beat Details & Structure</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          STUDIO LEVEL UPGRADE MODAL
         ========================================================================= */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16161a] border-2 border-[#FFD700] rounded-3xl p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FFD700]" />
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  UPGRADE STUDIO LEVEL
                </h3>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Balance */}
            <div className="mb-4 p-3 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400">Your Street Coins</span>
              <span className="text-sm font-black text-[#FFD700] flex items-center gap-1">
                <Coins className="w-4 h-4" />
                <span>{playerCoins.toLocaleString()}</span>
              </span>
            </div>

            {/* Level Tier Cards */}
            <div className="space-y-3">
              {STUDIO_LEVELS.map((tier) => {
                const isCurrent = studioLevel === tier.level;
                const isPast = studioLevel > tier.level;
                const canAfford = playerCoins >= tier.upgradeCost;

                return (
                  <div
                    key={tier.level}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                        : isPast
                        ? 'bg-white/5 border-emerald-500/40 opacity-70'
                        : 'bg-black/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{tier.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] font-bold">
                          {tier.unlockedCount} Beats
                        </span>
                      </div>

                      {isCurrent ? (
                        <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>CURRENT</span>
                        </span>
                      ) : isPast ? (
                        <span className="text-[10px] font-bold text-gray-400">UNLOCKED</span>
                      ) : (
                        <span className="text-xs font-black text-[#FFD700] font-mono">
                          {tier.upgradeCost.toLocaleString()} Coins
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-400 mb-2.5">{tier.description}</p>

                    {!isCurrent && !isPast && (
                      <button
                        onClick={() => handleUpgradeToLevel(tier.level)}
                        disabled={!canAfford}
                        type="button"
                        className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          canAfford
                            ? 'bg-gradient-to-r from-amber-400 to-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.4)] active:scale-95'
                            : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{canAfford ? `Upgrade to Level ${tier.level}` : 'Insufficient Coins'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BEAT STRUCTURE & MUSICAL DETAILS MODAL
         ========================================================================= */}
      {isInspectModalOpen && selectedInspectBeat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16161a] border-2 border-white/20 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedInspectBeat.icon}</span>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    {selectedInspectBeat.name}
                  </h3>
                  <p className="text-[10px] text-[#FFD700] font-mono">
                    {selectedInspectBeat.genre} • {selectedInspectBeat.bpm} BPM • {formatTimeMinutes(selectedInspectBeat.duration)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Story & Background */}
            <div className="mb-4 p-3 rounded-2xl bg-black/50 border border-white/10">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                Story & Inspiration
              </span>
              <p className="text-xs text-gray-200 leading-relaxed">
                {selectedInspectBeat.story}
              </p>
            </div>

            {/* Musical Key & Chord Progression */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Scale / Key</span>
                <span className="text-xs font-black text-[#FFD700]">{selectedInspectBeat.keyScale}</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Chords Loop</span>
                <span className="text-xs font-black text-white font-mono">
                  {selectedInspectBeat.chords.join(' → ')}
                </span>
              </div>
            </div>

            {/* Detailed Section Timeline Breakdown */}
            <div className="space-y-2 mb-4">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                Song Structure (No Loop - Full Progression)
              </span>

              {selectedInspectBeat.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">{sec.name}</span>
                    <span className="text-[10px] font-mono text-[#FFD700] font-bold">
                      {formatTimeMinutes(sec.startTime)} - {formatTimeMinutes(sec.endTime)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">{sec.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {sec.instruments.map((inst, iIdx) => (
                      <span
                        key={iIdx}
                        className="px-2 py-0.5 rounded-md bg-white/10 text-gray-300 text-[9px] font-mono"
                      >
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Play or Record Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsInspectModalOpen(false);
                  handleTogglePlay(selectedInspectBeat);
                }}
                type="button"
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(255,215,0,0.4)] cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play Now</span>
              </button>

              <button
                onClick={() => {
                  setIsInspectModalOpen(false);
                  handleSelectAsRecordingBeat(selectedInspectBeat);
                }}
                type="button"
                className="py-2.5 px-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.4)] cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DAILY LIMIT REACHED MODAL (2 songs per day - Come back tomorrow)
         ========================================================================= */}
      {showDailyLimitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-red-500/70 rounded-3xl p-6 shadow-[0_0_35px_rgba(239,68,68,0.35)] text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowDailyLimitModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-3.5">
              <Clock className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">
              Daily Limit Reached
            </h3>

            <p className="text-sm font-bold text-amber-300 mb-1">
              2 songs per day
            </p>
            <p className="text-xs text-gray-300 mb-5">
              Come back tomorrow
            </p>

            <button
              onClick={() => setShowDailyLimitModal(false)}
              type="button"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIDEO FREESTYLE PREVIEW MODAL
         ========================================================================= */}
      {activeVideoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-[#FFD700] rounded-3xl p-4 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#FFD700]" />
                <h3 className="text-xs font-black uppercase text-white">Video Freestyle Preview</h3>
              </div>
              <button
                onClick={() => setActiveVideoModalUrl(null)}
                className="w-7 h-7 rounded-full bg-white/10 text-gray-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="aspect-square rounded-2xl overflow-hidden bg-black border border-white/10 mb-3">
              <video
                src={activeVideoModalUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <button
              onClick={() => setActiveVideoModalUrl(null)}
              type="button"
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-all"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudioBeats;
