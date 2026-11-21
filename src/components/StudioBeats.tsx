
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLanguage } from '@/src/contexts/LanguageContext';
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
import { getTelegramInitData } from '@/lib/telegram';
import { savePostedSong, GROUP_TELEGRAM } from '@/lib/storage';

function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getStoredDailyRecordCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem('streetlife_record_count');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.date === getTodayDateString()) return parsed.count || 0;
    }
  } catch {}
  return 0;
}

function saveStoredDailyRecordCount(newCount: number): void {
  try {
    localStorage.setItem('streetlife_record_count', JSON.stringify({
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

function getStoredRecentRecordings(): SavedStudioRecording[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('streetlife_recent_recordings');
    if (raw) return JSON.parse(raw).slice(0,3);
  } catch {}
  return [];
}

function saveStoredRecentRecordings(recordings: SavedStudioRecording[]): void {
  try {
    const metaList = recordings.slice(0,3).map((r) => ({
      id: r.id,
      date: r.date,
      duration: r.duration,
      durationSec: r.durationSec,
      beatName: r.beatName,
      downloadName: r.downloadName
    }));
    localStorage.setItem('streetlife_recent_recordings', JSON.stringify(metaList));
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
  onToast?: (msg: string) => void;
  onSelectForRecording?: (beat: LongBeat) => void;
  onUpgradeStudioLevel?: (newLevel: number) => void;
}

export function StudioBeats({
  gameState,
  onToast,
  onSelectForRecording,
  onUpgradeStudioLevel
}: StudioBeatsProps) {
  const { t, language } = useLanguage();

  const [upgradedLevelOverride, setUpgradedLevelOverride] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const savedLevel = localStorage.getItem('streetlife_studio_level');
      if (savedLevel !== null) return parseInt(savedLevel, 10) || 0;
    }
    return null;
  });

  const [spentCoinsDelta, setSpentCoinsDelta] = useState(0);
  const studioLevel = upgradedLevelOverride !== null ? upgradedLevelOverride : gameState?.studioLevel ?? 0;
  const playerCoins = Math.max(0, (gameState?.streetCoin ?? 50000) - spentCoinsDelta);
  const dailyRecordLimit = 2 + Math.max(0, Math.min(4, studioLevel));
  const localizedBeatName = (beat: LongBeat) => language === 'ar' ? ({
    long_beat_1: 'قيادة ليلية في لاغوس',
    long_beat_2: 'إنجيل الحي',
    long_beat_3: 'كفاح سوق أوجا',
    long_beat_4: 'ملكة الدراجات',
    long_beat_5: 'مطاردة ٧ كيلومترات',
    long_beat_6: 'نشيد حرب المناطق',
    long_beat_7: 'بلوز مقامر النرد',
    long_beat_8: 'وضع الشبح'
  }[beat.id] || beat.name) : beat.name;
  const localizedBeatGenre = (beat: LongBeat) => language === 'ar' ? ({
    long_beat_1: 'أفرو فيوجن × دريل',
    long_beat_2: 'أفرو ستريت × تراب سول',
    long_beat_3: 'أمابيانو × الشارع',
    long_beat_4: 'لو-فاي × أفرو آر أند بي',
    long_beat_5: 'دريل سريع',
    long_beat_6: 'دريل الحرب × أوركسترا',
    long_beat_7: 'فانك الشارع',
    long_beat_8: 'تراب داكن × أجواء محيطية'
  }[beat.id] || beat.genre) : beat.genre;


  const [currentBeatId, setCurrentBeatId] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedBeat = localStorage.getItem('streetlife_current_long_beat');
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

  const [dailyRecordCount, setDailyRecordCount] = useState(() => getStoredDailyRecordCount());

  useEffect(() => {
    const refreshDailyCount = () => setDailyRecordCount(getStoredDailyRecordCount());
    window.addEventListener('streetlife:record-count-updated', refreshDailyCount);
    return () => window.removeEventListener('streetlife:record-count-updated', refreshDailyCount);
  }, []);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const [isVideoFreestyle, setIsVideoFreestyle] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [videoFilter, setVideoFilter] = useState<'none' | 'warm' | 'mono' | 'cool' | 'vintage'>('none');
  const cameraSwitchingRef = useRef(false);
  const videoFilterOptions = [
    { id: 'none' as const, label: 'Normal', style: 'none' },
    { id: 'warm' as const, label: 'Warm', style: 'sepia(0.22) saturate(1.25)' },
    { id: 'mono' as const, label: 'B&W', style: 'grayscale(1)' },
    { id: 'cool' as const, label: 'Cool', style: 'saturate(1.15) hue-rotate(12deg)' },
    { id: 'vintage' as const, label: 'Vintage', style: 'sepia(0.38) contrast(1.08) saturate(0.82)' },
  ];
  const activeVideoFilter = videoFilterOptions.find(filter => filter.id === videoFilter)?.style || 'none';
  const [cameraError, setCameraError] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoModalUrl, setActiveVideoModalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isVideoFreestyle || !videoPreviewRef.current || !streamRef.current) return;
    videoPreviewRef.current.srcObject = streamRef.current;
    videoPreviewRef.current.play().catch((error) => {
      console.warn('Camera preview playback failed:', error);
      setCameraError('Camera opened but preview could not start. Tap Enable Camera again.');
    });
  }, [isVideoFreestyle]);

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
    () => getStoredRecentRecordings()
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

    // Stop procedural backing tracks as well as external audio elements.
    longBeatEngine.pause();
    setIsPlaying(false);

    setIsRecording(false);
  }, []);

  const openCameraStream = async (facing: 'user' | 'environment') => {
    const base = {
      width: { ideal: 720, max: 1280 },
      height: { ideal: 1280, max: 1920 },
      frameRate: { ideal: 30, max: 30 },
      resizeMode: 'crop-and-scale' as const
    };
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true, video: { ...base, facingMode: { exact: facing } }
      });
    } catch {}
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true, video: { ...base, facingMode: { ideal: facing } }
      });
    } catch {}
    // iOS often hides camera labels until permission has been granted.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const matches = (device: MediaDeviceInfo) => {
        const label = device.label.toLowerCase();
        return facing === 'user'
          ? /front|user|facetime|selfie/.test(label)
          : /back|rear|environment|wide|ultra/.test(label);
      };
      const preferred = cameras.find(matches);
      if (preferred?.deviceId) {
        return await navigator.mediaDevices.getUserMedia({
          audio: true, video: { ...base, deviceId: { exact: preferred.deviceId } }
        });
      }
    } catch {}
    // Last resort for Telegram's iOS WebView: request its default camera.
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  };

  const handleEnableCamera = async () => {
    playClickSound();
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available here. Open Street Life in Telegram or Safari over HTTPS.');
      return;
    }
    try {
      const stream = await openCameraStream('user');
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = stream;
      setCameraFacing('user');
      setIsVideoFreestyle(true);
      try { window.Telegram?.WebApp?.expand?.(); } catch {}
    } catch (error) {
      console.warn('Front camera permission/access failed:', error);
      const name = error instanceof DOMException ? error.name : '';
      setCameraError(name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow Camera and Microphone for Telegram in iPhone Settings, then try again.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'The front camera could not be found. Check camera access and try again.'
          : 'Could not open the front camera. Check camera permission and try again.');
      setIsVideoFreestyle(false);
    }
  };

  const handleSwitchCamera = async () => {
    playClickSound();
    if (cameraSwitchingRef.current) return;
    cameraSwitchingRef.current = true;
    setCameraError('');
    const oldStream = streamRef.current;
    const previousFacing = cameraFacing;
    const nextFacing: 'user' | 'environment' = previousFacing === 'user' ? 'environment' : 'user';
    try {
      // iOS may refuse to open the second lens while the first is still active.
      oldStream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      const nextStream = await openCameraStream(nextFacing);
      if (!nextStream.getVideoTracks().length) {
        nextStream.getTracks().forEach(track => track.stop());
        throw new Error('No video track returned by the requested camera.');
      }
      streamRef.current = nextStream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = nextStream;
        await videoPreviewRef.current.play();
      }
      setCameraFacing(nextFacing);
    } catch (error) {
      console.warn('Switch camera failed:', error);
      try {
        const restoredStream = await openCameraStream(previousFacing);
        streamRef.current = restoredStream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = restoredStream;
          await videoPreviewRef.current.play();
        }
        setCameraFacing(previousFacing);
      } catch (restoreError) {
        console.warn('Could not restore previous camera:', restoreError);
        setCameraError('Camera switching is blocked by this iPhone or Telegram session. Check Telegram camera permission, or open the game in Safari and try again.');
      }
    } finally {
      cameraSwitchingRef.current = false;
    }
  };

  const handleDisableCamera = () => {
    if (isRecording) {
      toast('Stop recording before closing the camera.');
      return;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setIsVideoFreestyle(false);
    setCameraError('');
  };

  const handleRecordBeat = async (beat: LongBeat) => {
    playClickSound();

    if (isRecording && recordingBeatId === beat.id) {
      handleStopRecording();
      return;
    }

    // Enforce beat unlocks in the action handler too; the list-row lock
    // alone is not sufficient because the Record button stops propagation.
    if (!isLongBeatUnlocked(beat, studioLevel)) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      toast(`🔒 ${beat.name} unlocks at Studio Level ${beat.requiredStudioLevel}. Upgrade your Studio to use it.`);
      return;
    }

    if (isRecording) {
      toast('Stop your current recording before starting another beat.');
      return;
    }

    if (getStoredDailyRecordCount() >= dailyRecordLimit) {
      setShowDailyLimitModal(true);
      return;
    }

    try {
      await longBeatEngine.ensureRunning?.();
      longBeatEngine.pause();
      setIsPlaying(false);

      let micStream: MediaStream | null = null;

      try {
        const existingCameraStream = isVideoFreestyle ? streamRef.current : null;
        micStream = existingCameraStream?.active && existingCameraStream.getAudioTracks().some(track => track.readyState === 'live')
          ? existingCameraStream
          : await navigator.mediaDevices.getUserMedia(
              isVideoFreestyle
                ? { audio: true, video: { facingMode: { ideal: cameraFacing } } }
                : { audio: true }
            );
      } catch (e) {
        console.warn('mic/camera permission denied', e);
        setCameraError('Please allow camera and microphone access in your phone settings, then try again.');
      }

      if (!micStream) {
        toast('🎙️ Please allow microphone to record');
        return;
      }

      streamRef.current = micStream;

      if (isVideoFreestyle && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = micStream;
        videoPreviewRef.current.play().catch(()=>{});
      }

      setCurrentBeatId(beat.id);
      localStorage.setItem('streetlife_current_long_beat', beat.id);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      mixedAudioContextRef.current = audioCtx;
      await audioCtx.resume();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const dest = audioCtx.createMediaStreamDestination();

      // Voice gain follows the Voice Volume slider.
      const micGain = audioCtx.createGain();
      micGain.gain.value = voiceVolume / 100;
      micGainNodeRef.current = micGain;

      micSource.connect(micGain);
      micGain.connect(dest);

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

        try {
          await beatEl.play();
        } catch {}
      } else {
        // The long-beat engine synthesizes the backing track in its own
        // AudioContext. Route a copy of that output into this recording mix;
        // otherwise MediaRecorder captures only the microphone, not the beat.
        const engineDestination = longBeatEngine.getMediaStreamDestination?.();
        if (!engineDestination) {
          throw new Error('The Studio beat audio could not be connected to the recording mix. Please try again.');
        }
        const synthBeatSource = audioCtx.createMediaStreamSource(engineDestination.stream);
        const beatGain = audioCtx.createGain();
        beatGain.gain.value = beatVolume / 100;
        beatGainNodeRef.current = beatGain;
        synthBeatSource.connect(beatGain);
        beatGain.connect(dest);
        longBeatEngine.play(beat.id, 0);
        setIsPlaying(true);
      }

      let finalStream: MediaStream = dest.stream;

      if (isVideoFreestyle && micStream.getVideoTracks().length > 0) {
        finalStream = new MediaStream([
          ...dest.stream.getAudioTracks(),
          ...micStream.getVideoTracks()
        ]);
      }

      const mimeType = getBestMimeType(isVideoFreestyle);
      const recorder = new MediaRecorder(finalStream, mimeType ? { mimeType } : undefined);

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

        // Also stop the procedural beat when the recording ends by timer or
        // the browser's MediaRecorder lifecycle, not only on the Stop button.
        longBeatEngine.pause();
        setIsPlaying(false);

        if (!isVideoFreestyle) {
          streamRef.current?.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        }

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

        if (finalSecs < 60) {
          toast('⚠️ Need at least 1 minute - Not counted');
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

        const updated = getStoredDailyRecordCount() + 1;
        saveStoredDailyRecordCount(updated);
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
          saveStoredRecentRecordings(next);
          return next;
        });

        playSuccessSound();
        toast(`🎤 Mixed track ready on "${beat.name}"! Beat + Voice aligned - Tap Preview!`);

        setRecordingBeatId(null);
        setIsRecording(false);
      };

      recorder.start(100);
      setIsRecording(true);

      toast(`🔴 Recording "${beat.name}" - Beat and voice are being recorded!`);

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        const sec = recordingSecondsRef.current;
        setRecordingSeconds(sec);

        if (sec >= 180) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          toast('⏱️ Max 3:00 reached');
        }
      }, 1000);

    } catch (err) {
      console.warn(err);
      toast('🎙️ Recording error - check mic permission');
      setIsRecording(false);
    }
  };

  const handleRecordClick = async () => handleRecordBeat(currentBeat);

  const handlePreviewBeat = async (beat: LongBeat) => {
    playClickSound();

    if (!isLongBeatUnlocked(beat, studioLevel)) {
      setSelectedInspectBeat(beat);
      setIsUpgradeModalOpen(true);
      toast(`🔒 ${beat.name} unlocks at Studio Level ${beat.requiredStudioLevel}. Upgrade your Studio to use it.`);
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

    const initData = getTelegramInitData();
    if (!initData) {
      toast('Open STREET LIFE from Telegram before posting your recording.');
      return;
    }

    try {
      const fileResponse = await fetch(beatRec.url);
      if (!fileResponse.ok) throw new Error('Could not read your recording.');
      const blob = await fileResponse.blob();
      if (!blob.size) throw new Error('Your recording is empty.');
      const isVideo = beatRec.isVideo;
      const maxSize = isVideo ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
      if (blob.size > maxSize) throw new Error(`Recording is too large. Maximum size is ${isVideo ? '50' : '20'} MB.`);
      if (isVideo && !blob.type.startsWith('video/')) throw new Error('The video recording format is not supported on this device.');

      const extension = blob.type.includes('mp4') ? (isVideo ? 'mp4' : 'm4a') : blob.type.includes('wav') ? 'wav' : 'webm';
      const file = new File([blob], `street-life-${beat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.${extension}`, { type: blob.type || (isVideo ? 'video/webm' : 'audio/webm') });
      const form = new FormData();
      form.append(isVideo ? 'video' : 'audio', file);
      form.append('beatName', beat.name);
      form.append('producer', beat.producer || '');
      form.append('durationSeconds', String(beatRec.durationSec || 0));

      const response = await fetch('/api/studio/send-mix', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initData },
        body: form,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Telegram could not receive your recording. Please try again.');
      }

      const displayName = gameState?.telegramUser?.first_name
        ? `${gameState.telegramUser.first_name} ${gameState.telegramUser.last_name || ''}`.trim()
        : 'Street Hustler';
      savePostedSong({
        beatId: beat.id,
        beatName: beat.name,
        producer: beat.producer,
        userName: displayName,
        userId: String(gameState?.telegramUser?.id || 'telegram-player'),
        durationSeconds: beatRec.durationSec || 0,
      });

      playSuccessSound();
      toast('Your recording was successfully posted to Street Life Stars!');
      window.open(GROUP_TELEGRAM, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('STREET LIFE studio post failed:', error);
      toast(error instanceof Error ? error.message : 'Posting failed. Please try again.');
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
    const levelInfo = STUDIO_LEVELS[level];
    if (!levelInfo) return;

    if (playerCoins < levelInfo.upgradeCost) {
      toast(`❌ Need ${levelInfo.upgradeCost.toLocaleString()} Coins!`);
      return;
    }

    setSpentCoinsDelta(prev => prev + levelInfo.upgradeCost);
    setUpgradedLevelOverride(level);

    localStorage.setItem('streetlife_studio_level', String(level));
    onUpgradeStudioLevel?.(level);

    playSuccessSound();
    toast(`🎉 Upgraded to ${levelInfo.name}!`);
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
      localStorage.setItem('streetlife_current_long_beat', beat.id);
      longBeatEngine.play(beat.id,0);
    }
  };

  const handleSkipSeconds = (delta: number) => {
    const nt = Math.max(0, Math.min(currentTime+delta, currentBeat.duration-1));
    longBeatEngine.seek(nt);
    setCurrentTime(nt);
  };

  const handleNextBeat = () => {
    const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel));
    const idx = avail.findIndex(b=>b.id===currentBeatId);
    handleTogglePlay(avail[(idx+1)%avail.length]||avail[0]);
  };

  const handlePrevBeat = () => {
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
    <div className="w-full min-h-0 h-auto flex flex-col space-y-4 pb-8 text-white select-none overflow-visible">

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
            <h2 className="text-lg font-black text-white truncate">{localizedBeatName(currentBeat)}</h2>
            <p className="text-xs font-bold text-[#FFD700] truncate">{localizedBeatGenre(currentBeat)}</p>
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

            <div>
              <div className="flex justify-between items-center mb-2">
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
            Adjust each slider independently. Changes apply to the recording mix.
          </p>
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
              Daily: {dailyRecordCount}/{dailyRecordLimit}
            </span>
          </div>

          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={`font-bold ${recordingSeconds<60?'text-red-400':'text-emerald-400'}`}>
                Recording: {formatRecordingTimer(recordingSeconds)} / Min 1:00 / Max 3:00
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
                if (dailyRecordCount>=dailyRecordLimit && !isRecording) {
                  setShowDailyLimitModal(true);
                  return;
                }
                handleRecordClick();
              }}
              disabled={dailyRecordCount>=dailyRecordLimit && !isRecording}
              className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${dailyRecordCount>=dailyRecordLimit && !isRecording?'bg-neutral-800 text-neutral-500 opacity-60': isRecording?'bg-red-600 text-white animate-pulse':'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'}`}
            >
              {isRecording
                ? <><Square className="w-3.5 h-3.5 fill-white"/><span>{t('studio_stop', 'Stop')}</span></>
                : <><Mic className="w-3.5 h-3.5"/><span>{t('studio_record', 'Record')}</span></>
              }
            </button>

            <button
              onClick={handlePreview}
              disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]}
              className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              <Play className="w-3.5 h-3.5"/>
              <span>{t('studio_preview_mix', 'Preview Mix')}</span>
            </button>

            <button
              onClick={handlePost}
              disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]}
              className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black"
            >
              <Share2 className="w-3.5 h-3.5"/>
              <span>{t('studio_post_mix', 'Post Mix')}</span>
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
              <span className="text-xs font-black uppercase text-white">{t('studio_video_freestyle', 'VIDEO FREESTYLE')}</span>
              <p className="text-[10px] text-gray-400">
                {isVideoFreestyle ? t('studio_camera_recording', 'Camera records with mixed beat+voice') : t('studio_enable_camera_video', 'Enable camera for video')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={isVideoFreestyle ? handleDisableCamera : handleEnableCamera}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase pointer-events-auto active:scale-95 ${isVideoFreestyle?'bg-red-500 text-white':'bg-[#FFD700] text-black'}`}
          >
            {isVideoFreestyle ? t('studio_close_camera', 'Close Camera') : t('studio_enable_camera', 'Enable Camera')}
          </button>
        </div>

        {cameraError && <p role="alert" className="mt-2 text-xs font-semibold text-red-400">{cameraError}</p>}
        {isVideoFreestyle && (
          <div className="fixed inset-0 z-[100] w-screen h-[100dvh] min-h-0 overflow-hidden bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover" style={{ filter: activeVideoFilter, objectPosition: 'center center' }}
            />
            <div className="absolute inset-0 overflow-y-auto overscroll-y-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="relative flex min-h-[100dvh] flex-col">
                <div className="relative z-[101] flex justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none">
                  <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/90">{t('studio_live_camera', 'LIVE CAMERA')}</span>
                </div>
                {cameraError && <div role="alert" className="relative z-[102] mx-3 mt-2 rounded-lg bg-red-950/90 p-2 text-xs font-semibold text-white">{cameraError}</div>}
                <div className="min-h-[30vh] flex-1" aria-hidden="true" />
                <div className="relative z-[101] flex flex-col items-center gap-2 px-3 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/55 to-transparent">
                  <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={handleSwitchCamera} disabled={isRecording} className="pointer-events-auto rounded-full border border-white/35 bg-black/70 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40 active:scale-95">
                      <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5"/> {t('studio_flip', 'Flip')}</span>
                    </button>
                    <button type="button" onClick={() => handleRecordBeat(currentBeat)} disabled={dailyRecordCount >= dailyRecordLimit && !isRecording} className={"pointer-events-auto min-w-20 rounded-xl px-3 py-3 text-[11px] font-black uppercase shadow-xl active:scale-95 disabled:opacity-40 " + (isRecording ? 'bg-red-600 text-white' : 'bg-[#FFD700] text-black')} aria-label={isRecording ? 'Stop recording' : 'Start recording'}>
                      {isRecording ? 'Stop' : 'Record'}
                    </button>
                    <button type="button" onClick={handlePreview} disabled={isRecording || (!recordedBlob && !recordingsByBeat[currentBeat.id])} className="pointer-events-auto rounded-xl bg-blue-600 px-3 py-3 text-[11px] font-black uppercase text-white disabled:opacity-40 active:scale-95">
                      Preview
                    </button>
                    <button type="button" onClick={handlePost} disabled={isRecording || (!recordedBlob && !recordingsByBeat[currentBeat.id])} className="pointer-events-auto rounded-xl bg-emerald-500 px-3 py-3 text-[11px] font-black uppercase text-black disabled:opacity-40 active:scale-95">
                      Post
                    </button>
                    <button type="button" onClick={handleDisableCamera} disabled={isRecording} className="pointer-events-auto rounded-full border border-white/35 bg-black/70 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40 active:scale-95">
                      Close
                    </button>
                  </div>
                  <div className="w-full flex items-center justify-center gap-2 overflow-x-auto touch-pan-x pb-0.5">
                    {videoFilterOptions.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setVideoFilter(filter.id)}
                        className={"shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors " + (videoFilter === filter.id ? 'border-[#FFD700] bg-[#FFD700] text-black' : 'border-white/35 bg-black/65 text-white')}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredBeats.map((beat) => {
          const isSelected = currentBeatId === beat.id;
          const isCurrentPlaying = isSelected && isPlaying;
          const isUnlocked = isLongBeatUnlocked(beat, studioLevel);
          const beatRecording = recordingsByBeat[beat.id];
          const isBeatRecordingActive = isRecording && recordingBeatId===beat.id;

          return (
            <div
              key={beat.id}
              onClick={()=>handleTogglePlay(beat)}
              className={`p-3.5 rounded-3xl border cursor-pointer ${isSelected?'border-2 border-[#FFD700]':'border-white/10 bg-[#151518]'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${beat.coverGradient} p-1 flex items-center justify-center shrink-0`}>
                  <div className="w-full h-full rounded-xl bg-black/70 flex items-center justify-center text-xl">
                    <span>{beat.icon}</span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-white truncate">{localizedBeatName(beat)}</span>
                  <p className="text-[11px] font-bold text-[#FFD700] mt-0.5 truncate">{localizedBeatGenre(beat)}</p>
                </div>

                <div className="shrink-0">
                  {beat.isFree
                    ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">{t('free', 'FREE')}</span>
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
                  onClick={()=>handleRecordBeat(beat)}
                  className={`py-2 px-1 rounded-xl text-xs font-black uppercase ${isBeatRecordingActive?'bg-red-600 text-white animate-pulse':'bg-red-500/20 text-red-300'}`}
                >
                  {isBeatRecordingActive?`Stop (${formatRecordingTimer(recordingSeconds)})`:t('studio_record_mix', 'Record Mix')}
                </button>

                <button
                  onClick={()=>handlePostBeat(beat)}
                  className="py-2 px-1 rounded-xl text-xs font-black uppercase bg-emerald-500/20 text-emerald-300"
                >
                  Post Mix
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showDailyLimitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-red-500/70 rounded-3xl p-6 text-center">
            <h3 className="text-lg font-black text-white uppercase mb-2">{t('studio_daily_limit', 'Daily Limit Reached')}</h3>
            <p className="text-sm font-bold text-amber-300">{dailyRecordLimit} recordings per day</p>
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