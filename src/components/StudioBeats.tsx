
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Square, RotateCcw, RotateCw, SkipBack, SkipForward,
  Volume2, VolumeX, Volume1, Lock, Disc3, Clock, Coins, CheckCircle2,
  Info, Search, Award, Zap, X, Mic, Music2, Share2, Download, Camera,
} from 'lucide-react';
import {
  LongBeat, BeatSection, LONG_BEATS_CATALOG, STUDIO_LEVELS, isLongBeatUnlocked,
  getUnlockedBeatsCount, formatTimeMinutes, getBeatById, getSectionAtTime,
} from '../data/longBeatsData';
import { longBeatEngine } from '../audio/longBeatEngine';
import { UserGameState } from '@/types/game';
import { playClickSound, playCoinSound, playSuccessSound } from '@/lib/sound';
import { getHustlePlayerState, getPlayerStudioLevel } from '@/lib/hustleInventory';
import { startStudioRentFromNow } from '@/lib/storage';

function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function studioStorageKey(base: string, telegramUserId: string): string {
  const account = telegramUserId ? telegramUserId.replace(/[^0-9]/g, '') : 'unverified';
  return `${base}_${account || 'unverified'}`;
}

function getStoredDailyRecordCount(telegramUserId: string): number {
  if (typeof window === 'undefined' || !telegramUserId) return 0;
  try {
    const raw = localStorage.getItem(studioStorageKey('streetlife_record_count', telegramUserId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.date === getTodayDateString()) return parsed.count || 0;
    }
  } catch {}
  return 0;
}

function saveStoredDailyRecordCount(newCount: number, telegramUserId: string): void {
  if (typeof window === 'undefined' || !telegramUserId) return;
  try {
    localStorage.setItem(studioStorageKey('streetlife_record_count', telegramUserId), JSON.stringify({
      date: getTodayDateString(),
      count: newCount
    }));
  } catch {}
}

export interface SavedStudioRecording {
  id: string;
  date: string;
  duration: string;
  durationSec: number;
  beatName: string;
  downloadName: string;
  audioUrl?: string;
}

function getStoredRecentRecordings(telegramUserId: string): SavedStudioRecording[] {
  if (typeof window === 'undefined' || !telegramUserId) return [];
  try {
    const raw = localStorage.getItem(studioStorageKey('streetlife_recent_recordings', telegramUserId));
    if (raw) return JSON.parse(raw).slice(0,3);
  } catch {}
  return [];
}

function saveStoredRecentRecordings(recordings: SavedStudioRecording[], telegramUserId: string): void {
  if (typeof window === 'undefined' || !telegramUserId) return;
  try {
    const metaList = recordings.slice(0,3).map((r) => ({
      id: r.id,
      date: r.date,
      duration: r.duration,
      durationSec: r.durationSec,
      beatName: r.beatName,
      downloadName: r.downloadName
    }));
    localStorage.setItem(studioStorageKey('streetlife_recent_recordings', telegramUserId), JSON.stringify(metaList));
  } catch {}
}

function getBestMimeType(isVideo: boolean): string {
  if (isVideo) {
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
      if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
    }
    return '';
  } else {
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    }
    return '';
  }
}

interface StudioBeatsProps {
  gameState?: UserGameState;
  telegramUserId?: string;
  rentExpired?: boolean;
  onToast?: (msg: string) => void;
  onSelectForRecording?: (beat: LongBeat) => void;
  onUpgradeStudioLevel?: (newLevel: number) => void;
}

export function StudioBeats({
  gameState,
  telegramUserId = '',
  rentExpired = false,
  onToast,
  onSelectForRecording,
  onUpgradeStudioLevel
}: StudioBeatsProps) {

  const [upgradedLevelOverride, setUpgradedLevelOverride] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const savedLevel = telegramUserId ? localStorage.getItem(studioStorageKey('streetlife_studio_level', telegramUserId)) : null;
      if (savedLevel !== null) {
        const previousLevel = parseInt(savedLevel, 10) || 0;
        // Migrate players from the former five-tier scale without removing
        // their previously unlocked beat access.
        const migratedLevel = previousLevel >= 4 ? 10 : previousLevel === 3 ? 6 : previousLevel === 2 ? 3 : previousLevel === 1 ? 1 : 0;
        return migratedLevel;
      }
    }
    return null;
  });

  const [spentCoinsDelta, setSpentCoinsDelta] = useState(0);
  const [inventoryStudioLevel] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const player = getHustlePlayerState(gameState?.deviceId || 'player_anon');
    return getPlayerStudioLevel(player);
  });
  // Telegram players use only their own saved Studio level. The shared legacy
  // gameState field is intentionally ignored for authenticated accounts.
  const studioLevel = Math.max(
    inventoryStudioLevel,
    upgradedLevelOverride !== null ? upgradedLevelOverride : (telegramUserId ? 0 : gameState?.studioLevel ?? 0)
  );
  const playerCoins = Math.max(0, (gameState?.streetCoin ?? 50000) - spentCoinsDelta);

  const [currentBeatId, setCurrentBeatId] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedBeat = (telegramUserId ? localStorage.getItem(studioStorageKey('streetlife_current_long_beat', telegramUserId)) : null);
      if (savedBeat && getBeatById(savedBeat)) return savedBeat;
    }
    return LONG_BEATS_CATALOG[0].id;
  });

  const currentBeat = useMemo(
    () => getBeatById(currentBeatId) || LONG_BEATS_CATALOG[0],
    [currentBeatId]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSection, setCurrentSection] = useState<BeatSection>(currentBeat.sections[0]);

  // Independent volume controls. Both start at 50%.
  const [beatVolume, setBeatVolume] = useState(50);
  const [voiceVolume, setVoiceVolume] = useState(50);
  const [voiceEffect, setVoiceEffect] = useState<'clean' | 'warm' | 'bright' | 'radio' | 'deep' | 'echo' | 'reverb'>('clean');
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);

  const beatGainNodeRef = useRef<GainNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);

  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.85);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'locked' | 'level'>('all');
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedInspectBeat, setSelectedInspectBeat] = useState<LongBeat | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  const [dailyRecordCount, setDailyRecordCount] = useState(() => getStoredDailyRecordCount(telegramUserId));
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPostingMix, setIsPostingMix] = useState(false);

  const [isVideoFreestyle, setIsVideoFreestyle] = useState(false);  const [videoPreviewReady, setVideoPreviewReady] = useState(false);  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [videoFilter, setVideoFilter] = useState<'natural' | 'warm' | 'glow' | 'vintage' | 'mono' | 'cool'>('natural');
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoCaptureRef = useRef<HTMLDivElement | null>(null);
  const cameraPreviewStreamRef = useRef<MediaStream | null>(null);
  const filteredVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filteredVideoStreamRef = useRef<MediaStream | null>(null);
  const videoRenderFrameRef = useRef<number | null>(null);
  const videoFrameCallbackModeRef = useRef<'video' | 'animation' | null>(null);
  const [activeVideoModalUrl, setActiveVideoModalUrl] = useState<string | null>(null);

  const [recordingsByBeat, setRecordingsByBeat] = useState<Record<string, {
    blob: Blob;
    url: string;
    durationSec: number;
    isVideo: boolean;
    beatName: string
  }>>({});

  const [recordingBeatId, setRecordingBeatId] = useState<string | null>(null);
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);

  const [recentRecordings, setRecentRecordings] = useState<SavedStudioRecording[]>(
    () => getStoredRecentRecordings(telegramUserId)
  );

  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const recentAudioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mixedAudioContextRef = useRef<AudioContext | null>(null);
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const toast = useCallback((msg: string) => {
    if (onToast) onToast(msg);
  }, [onToast]);

  const formatRecordingTimer = (totalSec: number) =>
    `${String(Math.floor(totalSec/60)).padStart(2,'0')}:${String(totalSec%60).padStart(2,'0')}`;

  useEffect(() => {
    const video = videoPreviewRef.current;
    const stream = cameraPreviewStreamRef.current;
    if (isVideoFreestyle && video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [isVideoFreestyle, videoPreviewReady]);

  // Update the actual audio gain nodes whenever a slider changes.
  const handleBeatVolumeChange = (value: number) => {
    const safeValue = Math.max(0, Math.min(100, value));
    setBeatVolume(safeValue);

    if (beatGainNodeRef.current) {
      beatGainNodeRef.current.gain.setTargetAtTime(
        safeValue / 100,
        beatGainNodeRef.current.context.currentTime,
        0.015
      );
    }
  };

  const handleVoiceVolumeChange = (value: number) => {
    const safeValue = Math.max(0, Math.min(100, value));
    setVoiceVolume(safeValue);

    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.setTargetAtTime(
        safeValue / 100,
        micGainNodeRef.current.context.currentTime,
        0.015
      );
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();

      streamRef.current?.getTracks().forEach(t => t.stop());
      cameraPreviewStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraPreviewStreamRef.current = null;
      previewAudioRef.current?.pause();

      if (beatAudioRef.current) {
        beatAudioRef.current.pause();
        beatAudioRef.current.src = '';
      }

      if (mixedAudioContextRef.current) {
        try { mixedAudioContextRef.current.close(); } catch {}
      }

      if (recordedUrl) {
        try { URL.revokeObjectURL(recordedUrl); } catch {}
      }

      Object.values(recordingsByBeat).forEach(r => {
        try { URL.revokeObjectURL(r.url); } catch {}
      });
    };
  }, []);

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (beatAudioRef.current) {
      try { beatAudioRef.current.pause(); } catch {}
    }

    setIsRecording(false);
  }, []);

  // Prefer an explicitly selected physical camera. Some mobile WebViews ignore
  // facingMode: { ideal }, so verify the selected track and fall back to deviceId.
  const getVideoFreestyleStream = async (facing: 'user' | 'environment', excludeDeviceId?: string) => {
    const audio = { echoCancellation: true, noiseSuppression: noiseReductionEnabled, autoGainControl: true };
    const videoBase = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } };
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const cameras = devices.filter((device) => device.kind === 'videoinput' && device.deviceId);
    const facingPattern = facing === 'user' ? /front|user|facetime|前置/i : /back|rear|environment|后置/i;
    const preferred = cameras.find((device) => facingPattern.test(device.label) && device.deviceId !== excludeDeviceId);
    const alternate = cameras.find((device) => device.deviceId !== excludeDeviceId);
    const requestedDevice = preferred || (excludeDeviceId ? alternate : undefined);
    let stream: MediaStream;
    if (requestedDevice?.deviceId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video: { ...videoBase, deviceId: { exact: requestedDevice.deviceId } } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video: { ...videoBase, facingMode: { exact: facing } } });
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video: { ...videoBase, facingMode: { exact: facing } } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video: { ...videoBase, facingMode: { ideal: facing } } });
      }
    }
    const actualDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (excludeDeviceId && actualDeviceId === excludeDeviceId) {
      const other = cameras.find((device) => device.deviceId && device.deviceId !== excludeDeviceId);
      if (other?.deviceId) {
        try {
          const replacement = await navigator.mediaDevices.getUserMedia({ audio, video: { ...videoBase, deviceId: { exact: other.deviceId } } });
          stream.getTracks().forEach((track) => track.stop());
          stream = replacement;
        } catch {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('Telegram kept the current camera selected; the other camera could not be opened.');
        }
      } else {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('The other camera is not available in this Telegram browser.');
      }
    }
    const track = stream.getVideoTracks()[0];
    if (track) { try { await track.applyConstraints({ frameRate: { ideal: 30, max: 30 } }); } catch {} }
    return stream;
  };

  const handleRecordBeat = async (beat: LongBeat) => {
    playClickSound();

    if (rentExpired) {
      toast('🔒 Your 30-day Studio access has expired. Renew it in Vocal Booth & Rent before recording.');
      return;
    }

    // Enforce beat ownership at the recording action itself, not only in the catalog UI.
    // Level 1 (internal level 0) can record its three starter beats; locked beats
    // cannot open the microphone or create a recording until their level is owned.
    if (!(isLongBeatUnlocked(beat, studioLevel))) {      setSelectedInspectBeat(beat);
      toast(`🔒 Unlock Studio Level ${beat.requiredStudioLevel + 1} to record this beat.`);
      setIsUpgradeModalOpen(true);
      return;    }

    if (isRecording && recordingBeatId === beat.id) {
      handleStopRecording();
      return;
    }

    if (isRecording) handleStopRecording();

    if (getStoredDailyRecordCount(telegramUserId) >= 2) {
      setShowDailyLimitModal(true);
      return;
    }

    try {
      await longBeatEngine.ensureRunning?.();
      longBeatEngine.pause();
      setIsPlaying(false);

      let micStream: MediaStream | null = isVideoFreestyle ? cameraPreviewStreamRef.current : null;
      if (!micStream) {
        try {
          micStream = isVideoFreestyle
            ? await getVideoFreestyleStream(cameraFacing)
            : await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: noiseReductionEnabled, autoGainControl: true }
              });
        } catch (e) {
          console.warn('microphone/camera permission denied', e);
        }
      }
      if (!micStream || (isVideoFreestyle && micStream.getVideoTracks().length === 0)) {
        toast(isVideoFreestyle ? '📷 Please allow camera and microphone access, then try again.' : '🎙️ Please allow microphone access to record.');
        return;
      }

      streamRef.current = micStream;

      if (isVideoFreestyle && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = micStream;
        videoPreviewRef.current.play().catch(()=>{});
      }

      setCurrentBeatId(beat.id);
      if (telegramUserId) localStorage.setItem(studioStorageKey('streetlife_current_long_beat', telegramUserId), beat.id);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      mixedAudioContextRef.current = audioCtx;
      await audioCtx.resume();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const dest = audioCtx.createMediaStreamDestination();

      // Clean up handling: remove low-frequency handling noise and control
      // sudden vocal peaks before mixing the voice into the recording.
      const voiceHighPass = audioCtx.createBiquadFilter();
      voiceHighPass.type = 'highpass';
      voiceHighPass.frequency.setValueAtTime(85, audioCtx.currentTime);
      voiceHighPass.Q.setValueAtTime(0.707, audioCtx.currentTime);

      const voiceCompressor = audioCtx.createDynamicsCompressor();
      voiceCompressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
      voiceCompressor.knee.setValueAtTime(18, audioCtx.currentTime);
      voiceCompressor.ratio.setValueAtTime(3.5, audioCtx.currentTime);
      voiceCompressor.attack.setValueAtTime(0.008, audioCtx.currentTime);
      voiceCompressor.release.setValueAtTime(0.16, audioCtx.currentTime);

      // Voice gain follows the Voice Volume slider.
      const micGain = audioCtx.createGain();
      micGain.gain.value = voiceVolume / 100;
      micGainNodeRef.current = micGain;

      // Per-player voice tone presets. Every preset is processed in the
      // same recording chain, so it is applied consistently on every beat.
      const voiceTone = audioCtx.createBiquadFilter();
      if (voiceEffect === 'warm') {
        voiceTone.type = 'lowshelf';
        voiceTone.frequency.setValueAtTime(220, audioCtx.currentTime);
        voiceTone.gain.setValueAtTime(3, audioCtx.currentTime);
      } else if (voiceEffect === 'bright') {
        voiceTone.type = 'highshelf';
        voiceTone.frequency.setValueAtTime(3200, audioCtx.currentTime);
        voiceTone.gain.setValueAtTime(3, audioCtx.currentTime);
      } else if (voiceEffect === 'radio') {
        voiceTone.type = 'bandpass';
        voiceTone.frequency.setValueAtTime(1500, audioCtx.currentTime);
        voiceTone.Q.setValueAtTime(0.75, audioCtx.currentTime);
      } else if (voiceEffect === 'deep') {
        voiceTone.type = 'lowshelf';
        voiceTone.frequency.setValueAtTime(180, audioCtx.currentTime);
        voiceTone.gain.setValueAtTime(5, audioCtx.currentTime);
      } else {
        voiceTone.type = 'peaking';
        voiceTone.frequency.setValueAtTime(1200, audioCtx.currentTime);
        voiceTone.Q.setValueAtTime(0.7, audioCtx.currentTime);
        voiceTone.gain.setValueAtTime(0, audioCtx.currentTime);
      }

      micSource.connect(voiceHighPass);
      voiceHighPass.connect(voiceCompressor);
      voiceCompressor.connect(voiceTone);
      voiceTone.connect(micGain);
      micGain.connect(dest);

      // Optional creative voice effects are added after the tone filter.
      // The dry voice remains present so effects never make speech disappear.
      if (voiceEffect === 'echo') {
        const delay = audioCtx.createDelay(0.8);
        delay.delayTime.setValueAtTime(0.24, audioCtx.currentTime);
        const feedback = audioCtx.createGain();
        feedback.gain.setValueAtTime(0.22, audioCtx.currentTime);
        const wet = audioCtx.createGain();
        wet.gain.setValueAtTime(0.28, audioCtx.currentTime);
        micGain.connect(delay);
        delay.connect(wet);
        wet.connect(dest);
        delay.connect(feedback);
        feedback.connect(delay);
      } else if (voiceEffect === 'reverb') {
        const convolver = audioCtx.createConvolver();
        const impulseLength = Math.floor(audioCtx.sampleRate * 1.6);
        const impulse = audioCtx.createBuffer(2, impulseLength, audioCtx.sampleRate);
        for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
          const samples = impulse.getChannelData(channel);
          for (let i = 0; i < impulseLength; i++) {
            const decay = Math.pow(1 - i / impulseLength, 2.6);
            samples[i] = (Math.random() * 2 - 1) * decay;
          }
        }
        convolver.buffer = impulse;
        const wet = audioCtx.createGain();
        wet.gain.setValueAtTime(0.24, audioCtx.currentTime);
        micGain.connect(convolver);
        convolver.connect(wet);
        wet.connect(dest);
      }

      const beatUrl =
        (beat as any).fileUrl ||
        (beat as any).url ||
        (beat as any).audioUrl ||
        (beat as any).previewUrl;

      let beatEl: HTMLAudioElement | null = null;

      if (beatUrl) {
        beatEl = new Audio(beatUrl);
        beatEl.crossOrigin = 'anonymous';
        beatEl.loop = false;
        beatEl.preload = 'auto';
        beatAudioRef.current = beatEl;

        const beatSource = audioCtx.createMediaElementSource(beatEl);
        const beatGain = audioCtx.createGain();

        // Beat gain follows the Beat Volume slider.
        beatGain.gain.value = beatVolume / 100;
        beatGainNodeRef.current = beatGain;

        beatSource.connect(beatGain);
        beatGain.connect(dest);
        beatGain.connect(audioCtx.destination);

        // Start the beat only after MediaRecorder is running. Starting it
        // here cuts off the opening audio before recording begins.
      } else {
        // The procedural beat engine has its own AudioContext. Bridge its
        // output into this recording context so the beat is included in the mix.
        const engineDestination = longBeatEngine.getMediaStreamDestination();
        if (engineDestination?.stream) {
          const engineSource = audioCtx.createMediaStreamSource(engineDestination.stream);
          engineSource.connect(dest);
        }
      }

      let finalStream: MediaStream = dest.stream;

      if (isVideoFreestyle && micStream.getVideoTracks().length > 0) {
        const sourceVideo = videoPreviewRef.current;
        if (sourceVideo && typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext('2d', { alpha: false });
          if (context && typeof canvas.captureStream === 'function') {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            const filters: Record<typeof videoFilter, string> = {
              natural: 'none',
              warm: 'saturate(1.12) sepia(0.12) contrast(1.04)',
              glow: 'brightness(1.08) saturate(1.22) contrast(1.03)',
              vintage: 'sepia(0.32) contrast(0.92) saturate(0.82)',
              mono: 'grayscale(1) contrast(1.08)',
              cool: 'saturate(1.08) hue-rotate(12deg) contrast(1.04)'
            };
            const drawFilteredFrame = () => {
              if (sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && sourceVideo.videoWidth > 0) {
                context.save();
                context.filter = filters[videoFilter];
                if (cameraFacing === 'user') {
                  context.translate(canvas.width, 0);
                  context.scale(-1, 1);
                }
                context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
                context.restore();
              }
              const videoWithFrameCallback = sourceVideo as HTMLVideoElement & {
                requestVideoFrameCallback?: (callback: () => void) => number;
              };
              if (videoWithFrameCallback.requestVideoFrameCallback) {
                videoRenderFrameRef.current = videoWithFrameCallback.requestVideoFrameCallback(drawFilteredFrame);
                videoFrameCallbackModeRef.current = 'video';
              } else {
                videoRenderFrameRef.current = requestAnimationFrame(drawFilteredFrame);
                videoFrameCallbackModeRef.current = 'animation';
              }
            };
            const videoWithFrameCallback = sourceVideo as HTMLVideoElement & {
              requestVideoFrameCallback?: (callback: () => void) => number;
            };
            if (videoWithFrameCallback.requestVideoFrameCallback) {
              videoRenderFrameRef.current = videoWithFrameCallback.requestVideoFrameCallback(drawFilteredFrame);
              videoFrameCallbackModeRef.current = 'video';
            } else {
              videoRenderFrameRef.current = requestAnimationFrame(drawFilteredFrame);
              videoFrameCallbackModeRef.current = 'animation';
            }
            const filteredStream = canvas.captureStream(30);
            filteredVideoCanvasRef.current = canvas;
            filteredVideoStreamRef.current = filteredStream;
            const videoTrack = filteredStream.getVideoTracks()[0];
            if (videoTrack) {
              try { await videoTrack.applyConstraints({ frameRate: { ideal: 30, max: 30 } }); } catch {}
            }
            finalStream = new MediaStream([
              ...dest.stream.getAudioTracks(),
              ...filteredStream.getVideoTracks()
            ]);
          } else {
            finalStream = new MediaStream([...dest.stream.getAudioTracks(), ...micStream.getVideoTracks()]);
          }
        } else {
          finalStream = new MediaStream([...dest.stream.getAudioTracks(), ...micStream.getVideoTracks()]);
        }
      }

      const mimeType = getBestMimeType(isVideoFreestyle);
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 48_000,
        ...(mimeType ? { mimeType } : {}),
        ...(isVideoFreestyle ? { videoBitsPerSecond: 350_000 } : {}),
      };
      const recorder = new MediaRecorder(finalStream, recorderOptions);

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setRecordingBeatId(beat.id);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const finalSecs = recordingSecondsRef.current;
        const isVideo = isVideoFreestyle;

        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        cameraPreviewStreamRef.current = null;
        if (videoRenderFrameRef.current !== null) {
          const sourceVideo = videoPreviewRef.current as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
          if (videoFrameCallbackModeRef.current === 'video' && sourceVideo?.cancelVideoFrameCallback) {
            sourceVideo.cancelVideoFrameCallback(videoRenderFrameRef.current);
          } else {
            cancelAnimationFrame(videoRenderFrameRef.current);
          }
        }
        videoRenderFrameRef.current = null;
        videoFrameCallbackModeRef.current = null;
        filteredVideoStreamRef.current?.getTracks().forEach(track => track.stop());
        filteredVideoStreamRef.current = null;
        filteredVideoCanvasRef.current = null;
        setVideoPreviewReady(false);
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;

        if (beatAudioRef.current) {
          try {
            beatAudioRef.current.pause();
            beatAudioRef.current.src = '';
          } catch {}
          beatAudioRef.current = null;
        }

        beatGainNodeRef.current = null;
        micGainNodeRef.current = null;

        if (mixedAudioContextRef.current) {
          try {
            await mixedAudioContextRef.current.close();
          } catch {}
          mixedAudioContextRef.current = null;
        }

        const minimumSeconds = isVideo ? 5 : 60;
        if (finalSecs < minimumSeconds) {
          toast(isVideo ? '⚠️ Record at least 5 seconds before stopping.' : '⚠️ Need at least 1 minute - Not counted');
          setRecordingBeatId(null);
          setIsRecording(false);
          return;
        }

        const blobType = mimeType || (isVideo ? 'video/webm' : 'audio/webm');
        const blob = new Blob(recordedChunksRef.current, { type: blobType });

        if (recordedUrl) {
          try { URL.revokeObjectURL(recordedUrl); } catch {}
        }

        const old = recordingsByBeat[beat.id];
        if (old?.url) {
          try { URL.revokeObjectURL(old.url); } catch {}
        }

        const url = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedUrl(url);

        setRecordingsByBeat(prev => ({
          ...prev,
          [beat.id]: {
            blob,
            url,
            durationSec: finalSecs,
            isVideo,
            beatName: beat.name
          }
        }));

        const updated = getStoredDailyRecordCount(telegramUserId) + 1;
        saveStoredDailyRecordCount(updated, telegramUserId);
        setDailyRecordCount(updated);

        const now = new Date();

        const dateStr =
          `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ` +
          `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const durationStr =
          `${Math.floor(finalSecs/60)}:${String(finalSecs%60).padStart(2,'0')}`;

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

        const downloadName =
          `StreetLife-${beat.name.replace(/\s+/g,'_')}-${Date.now()}.${ext}`;

        const newRec: SavedStudioRecording = {
          id: `rec_${Date.now()}`,
          date: dateStr,
          duration: durationStr,
          durationSec: finalSecs,
          beatName: beat.name,
          downloadName,
          audioUrl: url
        };

        setRecentRecordings(prev => {
          const next = [newRec, ...prev].slice(0,3);
          saveStoredRecentRecordings(next, telegramUserId);
          return next;
        });

        playSuccessSound();
        toast(`🎤 Mixed track ready on "${beat.name}"! Beat + Voice aligned - Tap Preview!`);
        setRecordingBeatId(null);
        setIsRecording(false);
      };

      // Record one continuous MediaRecorder session. Short timesliced chunks can
      // carry uneven container timestamps on mobile WebViews; concatenating those
      // chunks may make the recorded preview drift even though live playback is in sync.
      // The three-minute cap and 48 kbps audio bitrate keep the single final Blob small.
      recorder.start();
      setIsRecording(true);

      // Begin playback after the recorder starts so the intro is not lost.
      if (beatAudioRef.current) {
        try { await beatAudioRef.current.play(); } catch (error) {
          console.warn('Beat playback could not start:', error);
          toast('⚠️ Tap again to allow beat playback');
        }
      } else {
        longBeatEngine.play(beat.id, 0);
        setIsPlaying(true);
      }

      toast(`🔴 Recording "${beat.name}" - Beat and voice are being recorded!`);

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        const sec = recordingSecondsRef.current;
        setRecordingSeconds(sec);

        const maxDuration = isVideoFreestyle ? 60 : 180;
        if (sec >= maxDuration) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          toast(isVideoFreestyle ? '⏱️ Max video length of 1:00 reached' : '⏱️ Max 3:00 reached');
        }
      }, 1000);

    } catch (err) {
      console.warn(err);
      toast('🎙️ Recording error - check mic permission');
      setIsRecording(false);
    }
  };

  const handleRecordClick = async () => handleRecordBeat(currentBeat);

  const handleSwitchCamera = async () => {
    if (isRecording) {
      toast('Stop recording before switching cameras.');
      return;
    }
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    const oldStream = cameraPreviewStreamRef.current;
    const oldDeviceId = oldStream?.getVideoTracks()[0]?.getSettings().deviceId;
    try {
      const stream = await getVideoFreestyleStream(nextFacing, oldDeviceId);
      const video = videoPreviewRef.current;
      if (video) { video.srcObject = stream; await video.play(); }
      cameraPreviewStreamRef.current = stream;
      streamRef.current = stream;
      setCameraFacing(nextFacing);
      setVideoPreviewReady(true);
      oldStream?.getTracks().forEach(track => track.stop());
      toast(nextFacing === 'user' ? 'Front camera selected.' : 'Back camera selected.');
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : '';
      toast(name === 'NotAllowedError'
        ? 'Camera permission is blocked. Allow camera access in your browser settings.'
        : message || 'Could not switch camera. The other camera may be unavailable in Telegram.');
    }
  };

  const handleToggleVideoFreestyle = async () => {
    playClickSound();
    if (isVideoFreestyle) {
      if (isRecording) handleStopRecording();
      else {
        cameraPreviewStreamRef.current?.getTracks().forEach(track => track.stop());
        cameraPreviewStreamRef.current = null;
        setVideoPreviewReady(false);
      }
      setIsVideoFreestyle(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Camera and microphone recording are not supported in this browser. Open STREET LIFE in an updated browser.');
      return;
    }
    setIsVideoFreestyle(true);
    try {
      const stream = await getVideoFreestyleStream(cameraFacing);
      cameraPreviewStreamRef.current = stream;
      setVideoPreviewReady(true);
      toast('📷 Camera and microphone are ready. Record your video freestyle.');
      requestAnimationFrame(() => {
        const capture = videoCaptureRef.current;
        if (capture?.requestFullscreen) void capture.requestFullscreen().catch(() => {});
      });
    } catch (error) {
      cameraPreviewStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraPreviewStreamRef.current = null;
      setVideoPreviewReady(false);
      setIsVideoFreestyle(false);
      const name = error instanceof Error ? error.name : '';
      toast(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Please allow camera and microphone access in your browser settings, then try again.'
        : 'Could not open the camera. Check camera permissions and try again.');
    }
  };

  const handlePreviewBeat = async (beat: LongBeat) => {
    playClickSound();

    if (rentExpired) {
      toast('🔒 Your 30-day Studio access has expired. Renew it in Vocal Booth & Rent before playing beats.');
      return;
    }

    if (!isLongBeatUnlocked(beat, studioLevel)) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      return;
    }

    const beatRec =
      recordingsByBeat[beat.id] ||
      (currentBeatId === beat.id && recordedBlob && recordedUrl
        ? {
            blob: recordedBlob,
            url: recordedUrl,
            durationSec: recordingSeconds,
            isVideo: isVideoFreestyle,
            beatName: beat.name
          }
        : null);

    if (beatRec) {
      if (beatRec.isVideo) {
        setActiveVideoModalUrl(beatRec.url);
        return;
      }

      longBeatEngine.pause();
      setIsPlaying(false);

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }

      try {
        const audio = new Audio(beatRec.url);
        previewAudioRef.current = audio;
        setPreviewingBeatId(beat.id);
        setIsPreviewPlaying(true);

        audio.onended = () => {
          setPreviewingBeatId(null);
          setIsPreviewPlaying(false);
        };

        await audio.play();
        toast(`▶️ Playing mixed track: ${beat.name} (${formatRecordingTimer(beatRec.durationSec)})`);

      } catch (e) {
        toast('⚠️ Tap again to allow audio');
        setPreviewingBeatId(null);
        setIsPreviewPlaying(false);
      }

      return;
    }

    if (currentBeatId === beat.id && isPlaying) {
      longBeatEngine.pause();
      setIsPlaying(false);
    } else {
      setCurrentBeatId(beat.id);
      longBeatEngine.play(beat.id, 0);
      setIsPlaying(true);
      setPreviewingBeatId(beat.id);
    }
  };

  const handlePreview = () => handlePreviewBeat(currentBeat);

  const handlePostBeat = async (beat: LongBeat) => {
    playClickSound();

    if (rentExpired) {
      toast('🔒 Your 30-day Studio access has expired. Renew it in Vocal Booth & Rent before posting.');
      return;
    }

    if (!isLongBeatUnlocked(beat, studioLevel)) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      return;
    }

    const beatRec =
      recordingsByBeat[beat.id] ||
      (currentBeatId === beat.id && recordedBlob && recordedUrl
        ? {
            blob: recordedBlob!,
            url: recordedUrl!,
            durationSec: recordingSeconds,
            isVideo: isVideoFreestyle,
            beatName: beat.name
          }
        : null);

    if (!beatRec) {
      toast(`🎤 Record on "${beat.name}" first!`);
      return;
    }
    if (beatRec.isVideo ? !beatRec.blob.type.startsWith('video/') : !beatRec.blob.type.startsWith('audio/')) {
      toast('This recording format is not supported. Please record again.');
      return;    }
    if (isPostingMix) return;

    const initData = (window as any).Telegram?.WebApp?.initData || '';
    if (!initData) {
      toast('Open STREET LIFE inside Telegram before posting your mix.');
      return;
    }

    setIsPostingMix(true);
    toast(beatRec.isVideo ? '⏳ Sending your video freestyle to the STREET LIFE group…' : '⏳ Sending your mix to the STREET LIFE group…');
    try {
      const form = new FormData();
      const extension = beatRec.blob.type.includes('mp4') ? (beatRec.isVideo ? 'mp4' : 'm4a') : 'webm';
      const filename = `StreetLife-${beat.name.replace(/[^a-z0-9_-]+/gi, '_')}.${extension}`;
      form.set(beatRec.isVideo ? 'video' : 'audio', beatRec.blob, filename);
      form.set('mediaType', beatRec.isVideo ? 'video' : 'audio');
      form.set('beatName', beat.name);
      form.set('producer', beat.producer || '');
      form.set('durationSeconds', String(beatRec.durationSec));

      const response = await fetch('/api/studio/send-mix', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initData },
        body: form
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Telegram could not post your mix.');
      }
      playSuccessSound();
      toast(beatRec.isVideo ? '✅ Your video freestyle has been posted to @Streetlifestars!' : '✅ Your mix has been posted to @Streetlifestars!');
    } catch (error) {
      console.error('Studio mix upload failed:', error);
      toast(error instanceof Error ? error.message : 'Unable to post your mix. Please try again.');
    } finally {
      setIsPostingMix(false);
    }
  };

  const handlePost = () => handlePostBeat(currentBeat);

  const handlePlayRecentRecording = async (rec: SavedStudioRecording) => {
    if (!rec.audioUrl) return;

    if (recentAudioRef.current && playingRecId === rec.id) {
      recentAudioRef.current.pause();
      setPlayingRecId(null);
      return;
    }

    recentAudioRef.current?.pause();

    const audio = new Audio(rec.audioUrl);
    recentAudioRef.current = audio;
    setPlayingRecId(rec.id);

    try {
      await audio.play();
    } catch {}

    audio.onended = () => setPlayingRecId(null);
  };

  const handleUpgradeToLevel = (level: number) => {
    const nextLevel = studioLevel + 1;
    if (level !== nextLevel) {
      toast(`🔒 Unlock Level ${nextLevel + 1} first.`);
      return;
    }
    const levelInfo = STUDIO_LEVELS[level];
    if (!levelInfo) return;
    if (playerCoins < levelInfo.upgradeCost) {
      toast(`❌ Need ${levelInfo.upgradeCost.toLocaleString()} Coins!`);
      return;
    }
    setSpentCoinsDelta(prev => prev + levelInfo.upgradeCost);
    setUpgradedLevelOverride(level);
    if (telegramUserId) localStorage.setItem(studioStorageKey('streetlife_studio_level', telegramUserId), String(level));
    onUpgradeStudioLevel?.(level);
    startStudioRentFromNow();
    playSuccessSound();
    toast(`🎉 Upgraded to ${levelInfo.name}! Your newly unlocked beats are ready to use.`);
    setIsUpgradeModalOpen(false);
  };

  useEffect(() => {
    const unbindTime = longBeatEngine.onTimeUpdate((time, sec) => {
      if (!isScrubbing) {
        setCurrentTime(time);
        setCurrentSection(sec);
      }
    });

    const unbindState = longBeatEngine.onStateChange(setIsPlaying);
    const unbindSection = longBeatEngine.onSectionChange(setCurrentSection);

    const unbindEnd = longBeatEngine.onEnd(() => {
      setIsPlaying(false);      setCurrentTime(0);
    });

    return () => {
      unbindTime();
      unbindState();
      unbindSection();
      unbindEnd();
    };
  }, [isScrubbing]);

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

      ctx.clearRect(0,0,width,height);

      const freqData = longBeatEngine.getFrequencyData();
      const numBars = 32;
      const barWidth = (width/numBars)-2;

      for (let i=0;i<numBars;i++) {
        const val = isPlaying
          ? (freqData[i*2]||0)
          : Math.sin(Date.now()*0.003+i*0.3)*12+16;

        const barHeight = Math.max(4,(val/255)*height*0.85);

        const grad = ctx.createLinearGradient(0,height,0,height-barHeight);
        grad.addColorStop(0,'#FFD700');
        grad.addColorStop(0.5,'#06B6D4');
        grad.addColorStop(1,'#A855F7');

        ctx.fillStyle=grad;

        const x = i*(barWidth+2);
        const y = height-barHeight;

        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(x,y,barWidth,barHeight,[3,3,0,0]);
          ctx.fill();
        } else {
          ctx.fillRect(x,y,barWidth,barHeight);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isSubscribed=false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const handleTogglePlay = (beat: LongBeat) => {
    playClickSound();

    if (rentExpired) {
      toast('🔒 Your 30-day Studio access has expired. Renew it in Vocal Booth & Rent before playing beats.');
      return;
    }

    if (!isLongBeatUnlocked(beat, studioLevel)) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      return;
    }

    if (currentBeatId === beat.id && isPlaying) {
      longBeatEngine.pause();
    } else if (currentBeatId === beat.id && !isPlaying) {
      longBeatEngine.resume();
    } else {
      setCurrentBeatId(beat.id);
      if (telegramUserId) localStorage.setItem(studioStorageKey('streetlife_current_long_beat', telegramUserId), beat.id);
      longBeatEngine.play(beat.id,0);
    }
  };

  useEffect(() => {
    if (!rentExpired) return;
    longBeatEngine.pause();
    setIsPlaying(false);
    previewAudioRef.current?.pause();
    setIsPreviewPlaying(false);
    setPreviewingBeatId(null);
  }, [rentExpired]);

  const handleSkipSeconds = (delta: number) => {
    const nt = Math.max(0, Math.min(currentTime+delta, currentBeat.duration-1));
    longBeatEngine.seek(nt);
    setCurrentTime(nt);
  };

  const handleNextBeat = () => {
    if (rentExpired) return;
    const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel));
    const idx = avail.findIndex(b=>b.id===currentBeatId);
    handleTogglePlay(avail[(idx+1)%avail.length]||avail[0]);
  };

  const handlePrevBeat = () => {
    if (rentExpired) return;
    const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel));
    const idx = avail.findIndex(b=>b.id===currentBeatId);
    handleTogglePlay(avail[(idx-1+avail.length)%avail.length]||avail[0]);
  };

  const filteredBeats = useMemo(() => LONG_BEATS_CATALOG.filter(beat => {
    if (activeTab==='free' && !beat.isFree) return false;
    if (activeTab==='locked' && beat.isFree) return false;

    if (searchQuery.trim()) {
      const q=searchQuery.toLowerCase();
      if (![beat.name,beat.genre,beat.producer].some(v=>v.toLowerCase().includes(q))) return false;
    }

    return true;
  }), [activeTab, searchQuery]);

  const currentLevelInfo = STUDIO_LEVELS[studioLevel] || STUDIO_LEVELS[0];
  const unlockedCount = getUnlockedBeatsCount(studioLevel);
  const unlockPercentage = Math.round((unlockedCount / LONG_BEATS_CATALOG.length) * 100);

  return (
    <div className="w-full flex flex-col space-y-4 pb-28 text-white select-none">

      <div className="p-4 rounded-3xl bg-gradient-to-b from-[#18181b] to-[#0f0f12] border-2 border-[#FFD700]/50">

        <div className="flex items-center gap-4 mb-3.5">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentBeat.coverGradient} p-1.5 relative shrink-0`}>
            <div className={`w-full h-full rounded-full bg-black/90 flex items-center justify-center border border-white/10 ${isPlaying?'animate-spin':''}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-[#FFD700] flex items-center justify-center text-xs text-black font-black">
                {currentBeat.icon}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white truncate">{currentBeat.name}</h2>
            <p className="text-xs font-bold text-[#FFD700] truncate">{currentBeat.genre}</p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{currentBeat.story}</p>
          </div>
        </div>

        <div className="w-full h-12 bg-black/70 rounded-2xl p-2 border border-white/10 mb-3 relative">
          <canvas ref={canvasRef} width={340} height={40} className="w-full h-full"/>
          <div className="absolute bottom-1 right-2 text-[9px] font-mono text-gray-500">
            {isPlaying?'LIVE STEREO • MIXED':'READY • BEAT+VOICE MIX'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 mb-3.5">
          <button onClick={()=>handleSkipSeconds(-10)} className="p-2.5 rounded-2xl bg-white/5">
            <RotateCcw className="w-4 h-4"/>
          </button>

          <button onClick={handlePrevBeat} className="p-2.5 rounded-2xl bg-white/5">
            <SkipBack className="w-4 h-4"/>
          </button>

          <button onClick={()=>handleTogglePlay(currentBeat)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-sm uppercase flex items-center gap-2">
            {isPlaying
              ? <><Pause className="w-5 h-5 fill-black"/><span>PAUSE</span></>
              : <><Play className="w-5 h-5 fill-black"/><span>PLAY BEAT</span></>
            }
          </button>

          <button onClick={handleNextBeat} className="p-2.5 rounded-2xl bg-white/5">
            <SkipForward className="w-4 h-4"/>
          </button>

          <button onClick={()=>handleSkipSeconds(10)} className="p-2.5 rounded-2xl bg-white/5">
            <RotateCw className="w-4 h-4"/>
          </button>
        </div>

        {/* INDEPENDENT BEAT AND VOICE VOLUME CONTROLS */}
        <div className="mb-3.5 bg-black/60 p-4 rounded-2xl border border-[#FFD700]/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase text-white">MIXER CONTROLS</span>
            <span className="text-[10px] text-emerald-400 font-bold">BEAT + VOICE</span>
          </div>

          <div className="space-y-4">

            <div>              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-[#FFD700]"/>
                  <span className="text-xs font-bold text-white">BEAT VOLUME</span>
                </div>
                <span className="text-xs font-black text-[#FFD700]">{beatVolume}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={beatVolume}
                onChange={(e) => handleBeatVolumeChange(Number(e.target.value))}
                disabled={false}
                aria-label="Beat volume"
                className="w-full h-2 rounded-full accent-yellow-400 cursor-pointer"
              />

              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>0% OFF</span>
                <span>50% BALANCED</span>
                <span>100% MAX</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="studio-voice-effect" className="text-xs font-bold text-white">VOICE FILTER</label>
                <span className="text-[9px] text-amber-300 font-bold">LEVEL UNLOCKS</span>
              </div>
              <select
                id="studio-voice-effect"
                value={voiceEffect}
                onChange={(e) => setVoiceEffect(e.target.value as typeof voiceEffect)}
                className="w-full rounded-xl bg-zinc-900 border border-cyan-400/30 p-3 text-xs text-white"
                aria-label="Voice filter"
              >
                <option value="clean">Clean Voice — Starter</option>
                <option value="warm" disabled={studioLevel < 1}>Warm Studio {studioLevel < 1 ? '🔒 Level 1' : '✓'}</option>
                <option value="bright" disabled={studioLevel < 3}>Bright Vocal {studioLevel < 3 ? '🔒 Level 3' : '✓'}</option>
                <option value="radio" disabled={studioLevel < 4}>Radio Effect {studioLevel < 4 ? '🔒 Level 4' : '✓'}</option>
                <option value="deep" disabled={studioLevel < 5}>Deep Vocal {studioLevel < 5 ? '🔒 Level 5' : '✓'}</option>
                <option value="echo" disabled={studioLevel < 7}>Studio Echo {studioLevel < 7 ? '🔒 Level 7' : '✓'}</option>
                <option value="reverb" disabled={studioLevel < 9}>Studio Reverb {studioLevel < 9 ? '🔒 Level 9' : '✓'}</option>
              </select>
            </div>

            <div className="border-t border-white/10 pt-3">
              <label className="flex items-center justify-between gap-3 text-xs font-bold text-white">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400"/>
                  NOISE REDUCTION
                </span>
                <input
                  type="checkbox"
                  checked={noiseReductionEnabled}
                  onChange={(e) => setNoiseReductionEnabled(e.target.checked)}
                  className="h-5 w-5 accent-emerald-400"
                  aria-label="Noise reduction"
                />
              </label>
              <p className="text-[10px] text-gray-500 mt-1">Reduces background noise picked up by supported phone microphones</p>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-cyan-400"/>
                  <span className="text-xs font-bold text-white">VOICE VOLUME</span>
                </div>
                <span className="text-xs font-black text-cyan-400">{voiceVolume}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={voiceVolume}
                onChange={(e) => handleVoiceVolumeChange(Number(e.target.value))}
                disabled={false}
                aria-label="Voice volume"
                className="w-full h-2 rounded-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>0% OFF</span>
                <span>50% BALANCED</span>
                <span>100% MAX</span>
              </div>
            </div>

          </div>

          <p className="text-[10px] text-gray-400 mt-3 text-center">
            Adjust each slider independently. Changes apply to the recording mix.          </p>
        </div>

        <div className="mb-3.5 bg-black/60 p-3 rounded-2xl border border-white/10">

          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording?'bg-red-500 animate-ping':'bg-[#FFD700]'}`}/>
              <span className="font-black text-white uppercase text-[11px]">
                {isRecording?'RECORDING MIXED TRACK':'VOCAL BOOTH - BEAT + VOICE'}
              </span>
            </div>

            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFD700] text-xs font-mono font-black border border-[#FFD700]/30">
              Daily: {dailyRecordCount}/2
            </span>
          </div>

          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={`font-bold ${recordingSeconds<60?'text-red-400':'text-emerald-400'}`}>
                Recording: {formatRecordingTimer(recordingSeconds)} / Min {isVideoFreestyle ? '0:05' : '1:00'} / Max {isVideoFreestyle ? '1:00' : '3:00'}
              </span>
            </div>

            <div className="w-full bg-black/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full ${recordingSeconds<60?'bg-red-500':'bg-emerald-500'}`}
                style={{width:`${Math.min(100,(recordingSeconds/180)*100)}%`}}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <button
              onClick={()=>{
                if (dailyRecordCount>=2 && !isRecording) {
                  setShowDailyLimitModal(true);
                  return;
                }
                handleRecordClick();
              }}
              disabled={dailyRecordCount>=2 && !isRecording}
              className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${dailyRecordCount>=2 && !isRecording?'bg-neutral-800 text-neutral-500 opacity-60': isRecording?'bg-red-600 text-white animate-pulse':'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'}`}
            >
              {isRecording
                ? <><Square className="w-3.5 h-3.5 fill-white"/><span>Stop</span></>
                : <><Mic className="w-3.5 h-3.5"/><span>Record</span></>
              }
            </button>

            <button
              onClick={handlePreview}
              disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]}
              className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              <Play className="w-3.5 h-3.5"/>
              <span>Preview Mix</span>
            </button>

            <button
              onClick={handlePost}
              disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]}
              className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black"
            >
              <Share2 className="w-3.5 h-3.5"/>
              <span>{(recordingsByBeat[currentBeat.id]?.isVideo || recordedBlob?.type.startsWith('video/')) ? 'Post Video' : 'Post Mix'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-3xl bg-gradient-to-r from-[#17171A] to-[#121214] border border-[#FFD700]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVideoFreestyle?'bg-red-500/20 text-red-400':'bg-[#FFD700]/20 text-[#FFD700]'}`}>
              <Camera className="w-5 h-5"/>
            </div>

            <div>
              <span className="text-xs font-black uppercase text-white">VIDEO FREESTYLE</span>
              <p className="text-[10px] text-gray-400">
                {isVideoFreestyle?'Camera records with mixed beat+voice':'Enable camera for video'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleVideoFreestyle}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase ${isVideoFreestyle?'bg-red-500 text-white':'bg-[#FFD700] text-black'}`}
          >
            {isVideoFreestyle?'Close Camera':'Enable Camera'}
          </button>
        </div>

      </div>

      {isVideoFreestyle && (
        <div ref={videoCaptureRef} className="fixed inset-0 z-[140] bg-black text-white flex flex-col p-3 sm:p-5" style={{ minHeight: '100dvh' }}>
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <p className="text-sm font-black uppercase text-[#FFD700]">STREET LIFE VIDEO FREESTYLE</p>
              <p className="text-xs text-gray-400">{isRecording ? 'Recording your freestyle with the beat' : 'Camera and microphone ready'}</p>
            </div>
            <button type="button" onClick={handleToggleVideoFreestyle} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black uppercase">Close</button>
          </div>
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-[#101014] border border-white/15">
            <video
              ref={videoPreviewRef}
              src={!isRecording && !videoPreviewReady && recordedBlob?.type.startsWith('video/') ? (recordedUrl || undefined) : undefined}
              autoPlay
              playsInline
              muted={isRecording || videoPreviewReady || !recordedBlob?.type.startsWith('video/')}
              controls={!isRecording && !videoPreviewReady && Boolean(recordedBlob?.type.startsWith('video/'))}
              className="w-full h-full object-cover bg-black"
              style={{
                filter: videoPreviewReady ? ({
                  natural: 'none',
                  warm: 'saturate(1.12) sepia(0.12) contrast(1.04)',
                  glow: 'brightness(1.08) saturate(1.22) contrast(1.03)',
                  vintage: 'sepia(0.32) contrast(0.92) saturate(0.82)',
                  mono: 'grayscale(1) contrast(1.08)',
                  cool: 'saturate(1.08) hue-rotate(12deg) contrast(1.04)'
                } as const)[videoFilter] : 'none',
                transform: videoPreviewReady && cameraFacing === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />
            {isRecording && <div className="absolute top-3 left-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black animate-pulse">● REC {formatRecordingTimer(recordingSeconds)}</div>}
            {!isRecording && !videoPreviewReady && !recordedBlob?.type.startsWith('video/') && (
              <div className="absolute inset-0 flex items-center justify-center text-center p-6 pointer-events-none">
                <p className="text-sm text-white/70">Your camera preview will appear here. Choose a beat and start recording.</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/70">Camera & look</span>
            <button
              type="button"
              onClick={handleSwitchCamera}
              disabled={isRecording || !videoPreviewReady}
              className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase disabled:opacity-40"
            >
              {cameraFacing === 'user' ? '↻ Switch to back' : '↻ Switch to front'}
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-2">
            {([
              ['natural', 'Natural'],
              ['warm', 'Warm'],
              ['glow', 'Glow'],
              ['vintage', 'Vintage'],
              ['mono', 'B&W'],
              ['cool', 'Cool']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setVideoFilter(value)}
                disabled={isRecording}
                aria-pressed={videoFilter === value}
                className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase border ${videoFilter === value ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/15 bg-white/5 text-white'} disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <button type="button" onClick={() => isRecording ? handleStopRecording() : handleRecordClick()} disabled={!isRecording && dailyRecordCount >= 2} className={`rounded-xl py-3 text-xs font-black uppercase ${isRecording ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-red-600 to-rose-500 text-white'}`}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <button type="button" onClick={() => handlePreviewBeat(currentBeat)} disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]} className="rounded-xl py-3 bg-blue-600 text-white text-xs font-black uppercase disabled:opacity-40">Preview</button>
            <button type="button" onClick={() => handlePostBeat(currentBeat)} disabled={isRecording || (!recordedBlob && !recordingsByBeat[currentBeat.id]) || isPostingMix} className="rounded-xl py-3 bg-emerald-500 text-black text-xs font-black uppercase disabled:opacity-40">{isPostingMix ? 'Posting…' : 'Post to Group'}</button>
            <button type="button" onClick={handleToggleVideoFreestyle} disabled={isRecording} className="rounded-xl py-3 bg-white/10 text-white text-xs font-black uppercase disabled:opacity-40">Exit Camera</button>
          </div>
          <p className="pt-2 text-center text-[10px] text-gray-500">Allow camera and microphone access when your browser asks. Keep this screen open while recording.</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredBeats.map((beat) => {
          const isSelected = currentBeatId === beat.id;
          const isCurrentPlaying = isSelected && isPlaying;
          const isUnlocked = !rentExpired && isLongBeatUnlocked(beat, studioLevel);
          const beatRecording = recordingsByBeat[beat.id];
          const isBeatRecordingActive = isRecording && recordingBeatId===beat.id;

          return (
            <div
              key={beat.id}
              onClick={()=>handleTogglePlay(beat)}
              className={`p-3.5 rounded-3xl border cursor-pointer ${!isUnlocked?'border-amber-500/30 bg-[#111113] opacity-90':isSelected?'border-2 border-[#FFD700]':'border-white/10 bg-[#151518]'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${beat.coverGradient} p-1 flex items-center justify-center shrink-0`}>
                  <div className="w-full h-full rounded-xl bg-black/70 flex items-center justify-center text-xl">
                    <span>{beat.icon}</span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-white truncate">{beat.name}</span>
                  <p className="text-[11px] font-bold text-[#FFD700] mt-0.5 truncate">{beat.genre}</p>
                </div>

                <div className="shrink-0">
                  {beat.isFree
                    ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">FREE</span>
                    : <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">LVL {beat.requiredStudioLevel}</span>
                  }
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2" onClick={e=>e.stopPropagation()}>
                <button
                  onClick={()=>handlePreviewBeat(beat)}
                  className="py-2 px-1 rounded-xl text-xs font-black uppercase bg-black/60 text-[#FFD700] border border-[#FFD700]/40"
                >
                  Preview
                </button>

                <button
                  onClick={()=> isUnlocked ? handleRecordBeat(beat) : (setSelectedInspectBeat(beat), setIsUpgradeModalOpen(true))}
                  aria-label={isUnlocked ? 'Record this beat' : `Unlock Level ${beat.requiredStudioLevel + 1} to record this beat`}
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 ${!isUnlocked?'bg-amber-500/15 text-amber-300 border border-amber-400/40':isBeatRecordingActive?'bg-red-600 text-white animate-pulse':'bg-red-500/20 text-red-300'}`}
                >
                  {!isUnlocked ? <><Lock className="w-3.5 h-3.5"/><span>Locked</span></> : isBeatRecordingActive ? `Stop (${formatRecordingTimer(recordingSeconds)})` : 'Record Mix'}
                </button>

                <button
                  onClick={()=> isUnlocked ? handlePostBeat(beat) : (setSelectedInspectBeat(beat), setIsUpgradeModalOpen(true))}
                  disabled={!isUnlocked}
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase ${isUnlocked?'bg-emerald-500/20 text-emerald-300':'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                >
                  {isUnlocked ? 'Post Mix' : '🔒 Locked'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isUpgradeModalOpen && (() => {
        const nextLevel = Math.min(studioLevel + 1, STUDIO_LEVELS.length - 1);
        const levelInfo = STUDIO_LEVELS[nextLevel];
        const canUnlock = Boolean(levelInfo) && (!selectedInspectBeat || studioLevel >= selectedInspectBeat.requiredStudioLevel - 1);
        return (
          <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsUpgradeModalOpen(false)}>
            <div className="w-full max-w-sm bg-[#17171b] border-2 border-amber-400/70 rounded-3xl p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-amber-400/15 flex items-center justify-center"><Lock className="w-7 h-7 text-amber-300"/></div>
              <h3 className="text-lg font-black text-white uppercase mb-2">Beat Locked</h3>
              <p className="text-sm text-gray-300 mb-2">
                {selectedInspectBeat ? <><span className="font-bold text-amber-300">{selectedInspectBeat.name}</span> requires Studio Level {selectedInspectBeat.requiredStudioLevel + 1}.</> : 'Upgrade your Studio to unlock more beats.'}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {canUnlock && levelInfo ? `Next step: ${levelInfo.name} — ${levelInfo.upgradeCost.toLocaleString()} SC. Levels must be unlocked in order.` : 'Unlock the previous Studio level first.'}
              </p>
              {canUnlock && levelInfo && (
                <button onClick={() => handleUpgradeToLevel(nextLevel)} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase">
                  Unlock {levelInfo.shortName} • {levelInfo.upgradeCost.toLocaleString()} SC
                </button>
              )}
              <button onClick={() => setIsUpgradeModalOpen(false)} className="w-full mt-2 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs uppercase">Not now</button>
            </div>
          </div>
        );
      })()}

      {showDailyLimitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-red-500/70 rounded-3xl p-6 text-center">
            <h3 className="text-lg font-black text-white uppercase mb-2">Daily Limit Reached</h3>
            <p className="text-sm font-bold text-amber-300">2 songs per day</p>
            <button
              onClick={()=>setShowDailyLimitModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {activeVideoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-[#FFD700] rounded-3xl p-4">
            <video
              src={activeVideoModalUrl}
              controls
              autoPlay
              playsInline
              className="w-full aspect-square rounded-2xl bg-black"
            />
            <button
              onClick={()=>setActiveVideoModalUrl(null)}
              className="w-full mt-3 py-2 rounded-xl bg-white/10 text-white font-bold text-xs uppercase"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default StudioBeats;