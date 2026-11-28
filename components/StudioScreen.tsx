'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/src/contexts/LanguageContext';
import {
  Mic,
  Play,
  Square,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Radio,
  Tv,
  Coins,
  Clock,
  Sparkles,
  Share2,
  Download,
  AlertCircle,
  CheckCircle2,
  Headphones,
  Music,
  Disc3,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  BEAT_LIBRARY,
  BeatDefinition,
  isBeatUnlocked,
  startBeatAudioLoop,
  stopBeatAudioLoop,
} from '@/lib/freestyleBeats';
import {
  UserGameState,
  PostedSong,
} from '@/types/game';
import {
  isStudioRentExpired,
  getDaysRemainingOnRent,
  getRentExpiry,
  renewStudioRent,
  watchStudioAd,
  canPostSong,
  savePostedSong,
  GROUP_TELEGRAM,
} from '@/lib/storage';
import { playClickSound, playCoinSound, playSuccessSound } from '@/lib/sound';
import { StudioBeats } from '@/src/components/StudioBeats';
import { LongBeat } from '@/src/data/longBeatsData';
import { showAdsgramRewardedAd } from '@/lib/adsgram';
import { getTelegramInitData } from '@/lib/telegram';

const DAILY_STUDIO_RECORD_KEY = 'streetlife_record_count';

function getDailyStudioRecordCount(): number {
  try {
    const raw = localStorage.getItem(DAILY_STUDIO_RECORD_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return saved?.date === date && Number.isFinite(saved.count) ? saved.count : 0;
  } catch {
    return 0;
  }
}

function addDailyStudioRecord(): number {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const count = getDailyStudioRecordCount() + 1;
  try {
    localStorage.setItem(DAILY_STUDIO_RECORD_KEY, JSON.stringify({ date, count }));
    window.dispatchEvent(new Event('streetlife:record-count-updated'));
  } catch {}
  return count;
}

// Pure JavaScript PCM 16-bit WAV vocal synthesizer
function writeWavString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createSyntheticVocalWavBlob(durationSeconds: number = 3): Blob {
  const sampleRate = 44100;
  const numChannels = 1;
  const numSamples = Math.max(sampleRate, Math.floor(sampleRate * Math.max(1, durationSeconds)));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeWavString(view, 8, 'WAVE');

  // fmt chunk
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data chunk
  writeWavString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write synthesized freestyle vocal audio harmonics
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const baseFreq = 180 + 35 * Math.sin(2 * Math.PI * 1.8 * t);
    const harmonic1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.45;
    const harmonic2 = Math.sin(2 * Math.PI * (baseFreq * 2) * t) * 0.2;
    const breath = (Math.random() * 2 - 1) * 0.04;
    const envelope = Math.min(1, Math.max(0.15, Math.sin((Math.PI * (t % 0.8)) / 0.8)));
    const sample = (harmonic1 + harmonic2 + breath) * envelope * 0.7;

    const clamped = Math.max(-1, Math.min(1, sample));
    const s16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(44 + i * 2, s16, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getVirtualMicStream(): { stream: MediaStream | null; cleanup: () => void } {
  try {
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
    osc.frequency.setValueAtTime(200, ctx.currentTime);
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

interface StudioScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function StudioScreen({ gameState, onToast }: StudioScreenProps) {
  const { t } = useLanguage();
  const [rentExpired, setRentExpired] = useState<boolean>(() => isStudioRentExpired());
  const [daysRemaining, setDaysRemaining] = useState<number>(() => getDaysRemainingOnRent());
  const [activeTestBeatId, setActiveTestBeatId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selected_freestyle_beat');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
    }
    return BEAT_LIBRARY[0].id;
  });
  const [selectedBeatMetadata, setSelectedBeatMetadata] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selected_freestyle_beat');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) return parsed;
        }
      } catch {}
    }
    return {
      id: BEAT_LIBRARY[0].id,
      name: BEAT_LIBRARY[0].name,
      bpm: BEAT_LIBRARY[0].bpm,
      filePath: BEAT_LIBRARY[0].filePath,
      producer: BEAT_LIBRARY[0].producer,
      genre: BEAT_LIBRARY[0].genre,
      title: BEAT_LIBRARY[0].title,
      coverGradient: BEAT_LIBRARY[0].coverGradient,
    };
  });
  const [recordingBeatId, setRecordingBeatId] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBeatId, setRecordedBeatId] = useState<string | null>(null);
  const [hasPreviewed, setHasPreviewed] = useState<boolean>(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [visibleBeatsCount, setVisibleBeatsCount] = useState<number>(2); // Lazy load 2 at a time
  const [isAdWatching, setIsAdWatching] = useState<boolean>(false);
  const [currentAdIndex, setCurrentAdIndex] = useState<number>(() => {
    return ((gameState.studioAdsWatched || 0) % 33) + 1;
  });
  const [postCooldownSeconds, setPostCooldownSeconds] = useState<number>(0);
  const [studioViewMode, setStudioViewMode] = useState<'long_beats' | 'booth'>('long_beats');

  const handleSelectLongBeatForRecording = (beat: LongBeat) => {
    setSelectedBeatId(beat.id);
    setSelectedBeatMetadata({
      id: beat.id,
      name: beat.name,
      bpm: beat.bpm,
      filePath: '/beats/beat1.mp3',
      producer: beat.producer,
      genre: beat.genre,
      title: beat.name,
      coverGradient: beat.coverGradient,
      requiredStudioLevel: beat.requiredStudioLevel,
    });
    // Stay directly on 14 Long Beats - allow record, preview, and post directly on the beat card!
    onToast(`🎙️ "${beat.name}" ready! Use Preview, Record, or Post directly.`);
  };

  // Audio & Mic Recording Refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const previewBeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Capture the microphone and backing beat together on one audio clock.
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingInputStreamRef = useRef<MediaStream | null>(null);
  const recordingBeatSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordSecondsRef = useRef<number>(0);
  const virtualMicCleanupRef = useRef<(() => void) | null>(null);
  const [isVirtualMic, setIsVirtualMic] = useState<boolean>(false);
  const [audioUnlockNotice, setAudioUnlockNotice] = useState<{
    message: string;
    action: () => void;
  } | null>(null);

  // Handle beat selection with visual gold border & metadata persistence
  const handleSelectBeat = (beat: BeatDefinition) => {
    if (rentExpired) {
      onToast('🔒 Studio rent expired! Renew rent to unlock studio beats.');
      return;
    }
    playClickSound();
    setSelectedBeatId(beat.id);
    const metadata = {
      id: beat.id,
      name: beat.name,
      bpm: beat.bpm,
      filePath: beat.filePath,
      producer: beat.producer,
      genre: beat.genre,
      title: beat.title,
      coverGradient: beat.coverGradient,
      requiredStudioLevel: beat.requiredStudioLevel,
    };
    setSelectedBeatMetadata(metadata);
    try {
      localStorage.setItem('selected_freestyle_beat', JSON.stringify(metadata));
    } catch {}
    onToast(`Selected beat: "${beat.name}" (${beat.bpm} BPM)`);
  };

  // Update rent expiry and post cooldown periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRentExpired(isStudioRentExpired());
      setDaysRemaining(getDaysRemainingOnRent());

      const postCheck = canPostSong();
      setPostCooldownSeconds(postCheck.remainingSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Filter beats according to studio level (Level 0 = 4 beats, Level 1 = 7 beats)
  const playerStudioLevel = gameState.studioLevel || 0;
  const availableBeats = useMemo(() => {
    return BEAT_LIBRARY.filter((beat) => isBeatUnlocked(beat, playerStudioLevel));
  }, [playerStudioLevel]);

  // Lazy loaded visible subset
  const displayedBeats = useMemo(() => {
    return availableBeats.slice(0, visibleBeatsCount);
  }, [availableBeats, visibleBeatsCount]);

  // Load more beats (2 at a time)
  const handleLoadMore = () => {
    playClickSound();
    setVisibleBeatsCount((prev) => Math.min(prev + 2, availableBeats.length));
  };

  // TEST BEAT HANDLER (Play/Pause Beat audio only)
  const handleTestBeat = (beat: BeatDefinition) => {
    if (rentExpired) {
      onToast('🔒 Studio rent expired! Renew rent to test or record beats.');
      return;
    }

    playClickSound();

    // If currently testing this beat, stop it
    if (activeTestBeatId === beat.id) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }
      stopBeatAudioLoop();
      setActiveTestBeatId(null);
      return;
    }

    // Stop any previous audio
    stopAllAudio();

    const audio = new Audio(beat.filePath);
    audio.loop = true;
    audio.volume = 1.0;
    audioElementRef.current = audio;
    setActiveTestBeatId(beat.id);

    // Force browser to allow sound
    audio.play().catch((e) => {
      // Ask user to tap screen first to allow sound
      setAudioUnlockNotice({
        message: `Tap screen to allow sound for "${beat.name}"! 🔊`,
        action: () => {
          audio.play().catch(() => {
            startBeatAudioLoop(beat.id);
          });
          setAudioUnlockNotice(null);
        },
      });
      startBeatAudioLoop(beat.id);
    });

    onToast(`Playing "${beat.name}" (${beat.bpm} BPM) 🎵`);
  };

  // Stop all playing audio helper
  const stopAllAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (previewBeatAudioRef.current) {
      previewBeatAudioRef.current.pause();
      previewBeatAudioRef.current.currentTime = 0;
    }
    if (previewVoiceAudioRef.current) {
      previewVoiceAudioRef.current.pause();
      previewVoiceAudioRef.current.currentTime = 0;
    }
    stopBeatAudioLoop();
    if (virtualMicCleanupRef.current) {
      virtualMicCleanupRef.current();
      virtualMicCleanupRef.current = null;
    }
    setActiveTestBeatId(null);
    setIsPreviewPlaying(false);
  };

  // START MIC RECORDING OVER BEAT
  const handleStartRecord = async (beat: BeatDefinition) => {
    const dailyLimit = 2 + Math.max(0, Math.min(4, playerStudioLevel));
    if (getDailyStudioRecordCount() >= dailyLimit) {
      onToast(`Daily studio recording limit reached (${dailyLimit}/${dailyLimit}). Upgrade your Studio to increase the daily limit.`);
      return;
    }
    if (rentExpired) {
      onToast('🔒 Studio rent expired! Renew rent to test or record.');
      return;
    }

    stopAllAudio();
    playClickSound();

    recordedChunksRef.current = [];
    recordSecondsRef.current = 0;
    setRecordSeconds(0);

    let inputStream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not available in this browser.');
      }
      inputStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (micErr) {
      console.warn('Studio microphone permission/access failed:', micErr);
      onToast('🎙️ Microphone permission is required. Allow microphone access and try again.');
      setIsVirtualMic(false);
      return;
    }

    const finalizeRecording = () => {
      if (!recordedChunksRef.current.length) {
        onToast('No audio was captured. Please check your microphone and try again.');
        return;
      }
      const actualType = recordedChunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type: actualType });
      addDailyStudioRecord();
      const url = URL.createObjectURL(blob);
      setRecordedBlobUrl(url);
      setRecordedBeatId(beat.id);
      setHasPreviewed(false);
      setIsPreviewPlaying(false);
      onToast('🎤 Your voice and the beat have been recorded together. Preview the original mix.');
    };

    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass || typeof MediaRecorder === 'undefined') {
      inputStream.getTracks().forEach(track => track.stop());
      onToast('This device does not support Studio audio recording. Please update Telegram or use Safari.');
      return;
    }

    let audioContext: AudioContext | null = null;
    let beatAudio: HTMLAudioElement | null = null;
    let beatPlaybackStarted = false;
    try {
      audioContext = new AudioContextClass();
      await audioContext.resume();

      const mixDestination = audioContext.createMediaStreamDestination();
      const microphoneSource = audioContext.createMediaStreamSource(inputStream);
      const microphoneGain = audioContext.createGain();
      microphoneGain.gain.value = 1;
      microphoneSource.connect(microphoneGain);
      microphoneGain.connect(mixDestination);

      // The audible beat and the recorded beat are now the same audio source.
      beatAudio = new Audio();
      beatAudio.crossOrigin = 'anonymous';
      beatAudio.preload = 'auto';
      beatAudio.loop = true;
      beatAudio.volume = 1;
      beatAudio.playbackRate = 1;
      beatAudio.defaultPlaybackRate = 1;
      beatAudio.src = beat.filePath;
      // Wait until the selected backing track is ready before showing the
      // recording as started, so the player never sings over a silent delay.
      await new Promise<void>((resolve, reject) => {
        if (beatAudio && beatAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          resolve();
          return;
        }
        const media = beatAudio!;
        const cleanup = () => {
          window.clearTimeout(timeoutId);
          media.removeEventListener('canplay', onReady);
          media.removeEventListener('error', onError);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('The selected beat could not be loaded.')); };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error('The selected beat took too long to load.'));
        }, 12000);
        media.addEventListener('canplay', onReady, { once: true });
        media.addEventListener('error', onError, { once: true });
        media.load();
      });

      const beatSource = audioContext.createMediaElementSource(beatAudio);
      const beatGain = audioContext.createGain();
      beatGain.gain.value = 0.85;
      beatSource.connect(beatGain);
      beatGain.connect(mixDestination);
      beatGain.connect(audioContext.destination);

      const supportedTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const mimeType = supportedTypes.find(type =>
        typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(
        mixDestination.stream,
        mimeType ? { mimeType } : undefined
      );

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        console.error('Studio mixed recorder error:', event);
        onToast('Recording encountered an audio error. Please try again.');
      };
      recorder.onstop = () => {
        try { inputStream.getTracks().forEach(track => track.stop()); } catch {}
        try { beatAudio?.pause(); } catch {}
        if (audioElementRef.current === beatAudio) audioElementRef.current = null;
        recordingInputStreamRef.current = null;
        recordingBeatSourceRef.current = null;
        const activeContext = recordingAudioContextRef.current;
        recordingAudioContextRef.current = null;
        if (activeContext && activeContext.state !== 'closed') {
          activeContext.close().catch(() => {});
        }
        if (!beatPlaybackStarted) {
          onToast('The beat did not start, so this recording was not saved. Please try again.');
          return;
        }
        finalizeRecording();
      };

      recordingAudioContextRef.current = audioContext;
      recordingInputStreamRef.current = inputStream;
      recordingBeatSourceRef.current = beatSource;
      audioElementRef.current = beatAudio;
      mediaRecorderRef.current = recorder;

      setRecordingBeatId(beat.id);
      setIsVirtualMic(false);
      recorder.start(250);
      // Start beat after recording begins, avoiding a beat lead-in being lost.
      await beatAudio.play();
      beatPlaybackStarted = true;
      onToast('🎙️ Recording your voice and beat together. Preview will replay this exact mix.');
    } catch (recordingError) {
      console.error('Could not start mixed Studio recording:', recordingError);
      try { mediaRecorderRef.current?.stop(); } catch {}
      try { inputStream.getTracks().forEach(track => track.stop()); } catch {}
      try { beatAudio?.pause(); } catch {}
      if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
      recordingAudioContextRef.current = null;
      recordingInputStreamRef.current = null;
      recordingBeatSourceRef.current = null;
      mediaRecorderRef.current = null;
      audioElementRef.current = null;
      setRecordingBeatId(null);
      setIsVirtualMic(false);
      onToast('Could not start the beat and voice recording. Please check microphone permission and try again.');
      return;
    }

    // Timer (max 60 seconds)
    recordTimerRef.current = setInterval(() => {
      recordSecondsRef.current += 1;
      setRecordSeconds(recordSecondsRef.current);
      if (recordSecondsRef.current >= 60) {
        handleStopRecord();
      }
    }, 1000);
  };

  // STOP RECORDING
  const handleStopRecord = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping media recorder:', e);
      }
    } else {
      onToast('No active recording was found. Please start recording again.');
    }

    if (audioElementRef.current) {
      try { audioElementRef.current.pause(); } catch {}
      audioElementRef.current.currentTime = 0;
    }
    stopBeatAudioLoop();
    setRecordingBeatId(null);
    setIsVirtualMic(false);
  };

  // PREVIEW MIXED (MANDATORY BEFORE POST)
  const handlePreviewMixed = (beat: BeatDefinition) => {
    if (!recordedBlobUrl || recordedBeatId !== beat.id) {
      onToast('🎙️ Record your vocal over this beat first!');
      return;
    }

    if (isPreviewPlaying) {
      stopAllAudio();
      setIsPreviewPlaying(false);
      return;
    }

    stopAllAudio();
    playClickSound();

    // The captured file already contains both beat and voice. Replay that
    // exact mixed file instead of restarting two separate players.
    const mixedAudio = new Audio(recordedBlobUrl);
    mixedAudio.volume = 1;
    mixedAudio.currentTime = 0;
    previewVoiceAudioRef.current = mixedAudio;
    previewBeatAudioRef.current = null;

    mixedAudio.onended = () => {
      setIsPreviewPlaying(false);
      previewVoiceAudioRef.current = null;
    };
    mixedAudio.onerror = () => {
      setIsPreviewPlaying(false);
      onToast('Could not play the recorded mix. Please record again.');
    };

    mixedAudio.play().then(() => {
      setIsPreviewPlaying(true);
      setHasPreviewed(true);
      onToast('🎧 Playing your original recorded mix. Post is now available.');
    }).catch(() => {
      setIsPreviewPlaying(false);
      setAudioUnlockNotice({
        message: 'Tap to play your recorded mix.',
        action: () => {
          mixedAudio.play().then(() => {
            setIsPreviewPlaying(true);
            setHasPreviewed(true);
          }).catch(() => onToast('Could not play the recorded mix. Please record again.'));
          setAudioUnlockNotice(null);
        },
      });
    });
  };

  // POST FINAL SONG: upload the actual recorded audio to the official Telegram group.
  const handlePostSong = async (beat: BeatDefinition) => {
    if (!hasPreviewed) {
      onToast(`⚠️ ${t('studio_listen_first_short', 'Listen first before posting! Click PREVIEW to verify your mix.')}`);
      return;
    }
    if (!recordedBlobUrl || recordedBeatId !== beat.id) {
      onToast('⚠️ Your recording is not available. Please record again.');
      return;
    }
    const check = canPostSong();
    if (!check.allowed) {
      onToast(`⏳ Post cooldown active. Please wait ${check.remainingSeconds}s before posting again.`);
      return;
    }

    const initData = getTelegramInitData();
    if (!initData) {
      onToast('Open STREET LIFE from Telegram before sending your mix.');
      return;
    }

    try {
      playClickSound();
      const audioResponse = await fetch(recordedBlobUrl);
      if (!audioResponse.ok) throw new Error('Could not read your recording.');
      const audioBlob = await audioResponse.blob();
      if (!audioBlob.size) throw new Error('The recording is empty.');
      if (audioBlob.size > 20 * 1024 * 1024) {
        throw new Error('Recording is too large. Please record a shorter mix (maximum 20 MB).');
      }

      const safeName = beat.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const extension = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
      const form = new FormData();
      form.append('audio', audioBlob, `street-life-${safeName}-${Date.now()}.${extension}`);
      form.append('beatName', beat.name);
      form.append('producer', beat.producer || '');
      form.append('durationSeconds', String(recordSeconds || 30));

      const response = await fetch('/api/studio/send-mix', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initData },
        body: form,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Telegram could not receive your mix. Please try again.');
      }

      const displayName = gameState.telegramUser?.first_name
        ? `${gameState.telegramUser.first_name} ${gameState.telegramUser.last_name || ''}`.trim()
        : 'Street Hustler';
      savePostedSong({
        beatId: beat.id,
        beatName: beat.name,
        producer: beat.producer,
        userName: displayName,
        userId: String(gameState.telegramUser?.id || 'telegram-player'),
        durationSeconds: recordSeconds || 30,
      });

      playSuccessSound();
      onToast('✅ Your mix was successfully sent to the STREET LIFE group!');
      window.open(GROUP_TELEGRAM, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('STREET LIFE mix upload failed:', error);
      onToast(error instanceof Error ? error.message : 'Mix upload failed. Please try again.');
    }
  };

  // RENEW OR UPGRADE STUDIO RENT
  const handleRenewRent = (isLevel1Upgrade = false) => {
    playClickSound();
    const result = renewStudioRent(isLevel1Upgrade);
    onToast(result.message);
    if (result.success) {
      playCoinSound();
      setRentExpired(false);
      setDaysRemaining(30);
    }
  };

  // Credit the studio reward only after a real Adsgram view is completed.
  const handleWatchStudioAd = async () => {
    if (isAdWatching) return;
    playClickSound();
    setIsAdWatching(true);
    try {
      await showAdsgramRewardedAd();
      const res = watchStudioAd(currentAdIndex);
      onToast(res.message);
      if (res.success) {
        playCoinSound();
        setCurrentAdIndex(res.nextAdIndex);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ad not completed. No coins were added.');
    } finally {
      setIsAdWatching(false);
    }
  };

  // Tap screen listener when browser audio is blocked
  useEffect(() => {
    if (!audioUnlockNotice) return;
    const handleTapToAllow = () => {
      audioUnlockNotice.action();
    };
    window.addEventListener('pointerdown', handleTapToAllow, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleTapToAllow);
    };
  }, [audioUnlockNotice]);

  return (
    <div
      className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TAP SCREEN TO ALLOW SOUND BANNER (When browser blocks autoplay) */}
      {audioUnlockNotice && (
        <div
          onClick={() => {
            audioUnlockNotice.action();
          }}
          className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-[#FFD700] to-yellow-400 text-black font-black text-xs uppercase flex items-center justify-between shadow-[0_0_25px_rgba(255,215,0,0.6)] cursor-pointer active:scale-98 animate-bounce border-2 border-white"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 shrink-0 animate-pulse text-black" />
            <span>{audioUnlockNotice.message}</span>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-black text-[#FFD700] text-[10px] font-black shrink-0">
            TAP SCREEN
          </span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-[#FFD700] drop-shadow-[0_0_8px_#FFD700]" />
            <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">
              {t('studio_heading', 'FREESTYLE STUDIO')}
            </h1>
          </div>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            {t('studio_level_desc', 'Level {level} Studio').replace('{level}', String(playerStudioLevel))} • {playerStudioLevel === 0 ? `4 Beats (${t('studio_free_30_days', 'Free for 30 days')})` : '7 Beats (Level 1 Pro)'}
          </p>
        </div>

        {/* Level Badge */}
        <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-[#FFD700]/30 text-right">
          <span className="text-[10px] text-gray-400 uppercase font-mono block">{t('studio_tier', 'Studio Tier')}</span>
          <span className="text-xs font-black text-[#FFD700]">
            {playerStudioLevel === 0 ? t('studio_level_0', 'LEVEL 0 • FREE') : t('studio_level_1', 'LEVEL 1 • PRO')}
          </span>
        </div>
      </div>

      {/* STUDIO MODE SWITCHER */}
      <div className="mb-4 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/60 border border-white/10">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setStudioViewMode('long_beats');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            studioViewMode === 'long_beats'
              ? 'bg-gradient-to-r from-amber-400 to-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.4)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Disc3 className="w-4 h-4" />
          <span>{t('studio_long_beats', '14 Long Beats')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playClickSound();
            setStudioViewMode('booth');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            studioViewMode === 'booth'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>{t('studio_vocal_booth', 'Vocal Booth & Rent')}</span>
        </button>
      </div>

      {studioViewMode === 'long_beats' ? (
        <StudioBeats
          gameState={gameState}
          onToast={onToast}
          onSelectForRecording={handleSelectLongBeatForRecording}
        />
      ) : (
        <>
          {/* RENT STATUS & COUNTDOWN CARD */}
      <div
        className={`mb-4 p-4 rounded-2xl border transition-all ${
          rentExpired
            ? 'bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            : 'bg-gradient-to-r from-[#171717] to-[#111111] border-[#FFD700]/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                rentExpired
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50'
              }`}
            >
              {rentExpired ? <Lock className="w-6 h-6 animate-bounce" /> : <Clock className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-white">
                  {rentExpired ? t('studio_rent_status_expired', 'STUDIO RENT EXPIRED') : t('studio_rent_status_active', 'STUDIO RENT ACTIVE')}
                </span>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                    playerStudioLevel === 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30'
                  }`}
                >
                  {playerStudioLevel === 0 ? t('studio_free_30_days', 'Free for 30 days') : t('studio_rent_30_days', '30 Days Rent')}
                </span>
              </div>

              <p className="text-xs font-mono font-bold mt-1 text-gray-300">
                {rentExpired ? (
                  <span className="text-red-400">{t('studio_all_locked', 'All studios locked. Renew to record.')}</span>
                ) : (
                  <span>
                    {t('studio_rent_expires_in', 'Rent expires in ')}<span className="text-[#FFD700] font-black">{daysRemaining} days</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Renew / Upgrade Button */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {rentExpired ? (
              <button
                onClick={() => handleRenewRent(false)}
                type="button"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-black font-black text-xs uppercase shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                {t('studio_renew_rent', 'Renew Rent 🔓')}
              </button>
            ) : (
              playerStudioLevel === 0 && (
                <button
                  onClick={() => handleRenewRent(true)}
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-[11px] uppercase shadow-[0_0_12px_rgba(255,215,0,0.4)] active:scale-95 transition-all cursor-pointer"
                >
                  {t('studio_unlock_level_1', 'Unlock Lvl 1 (100k)')}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* WATCH AD UNDER STUDIO (10 COINS ONLY, 33 ADS TOTAL) */}
      <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-[#1A1A1A] to-[#121212] border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <Tv className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wide">
                  {t('studio_watch_ad', 'Watch Ad Under Studio')}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  {t('studio_ad_count', 'Ad {count}/33 - 10 coins').replace('{count}', String(currentAdIndex))}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {t('studio_ad_earn_help', 'Earn +10 Street Coins per ad (Max 5/day per ad • 33 ads available)')}
              </p>
            </div>
          </div>

          <button
            onClick={handleWatchStudioAd}
            disabled={isAdWatching}
            type="button"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.4)] active:scale-95 transition-all cursor-pointer shrink-0"
          >
            {isAdWatching ? t('studio_opening_ad', 'Opening Adsgram...') : t('studio_ten_coins', '+10 Coins')}
          </button>
        </div>

        {isAdWatching && (
          <div className="mt-2.5 w-full bg-black/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-1000 shadow-[0_0_8px_#06b6d4]"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* CURRENTLY SELECTED BEAT SUMMARY CARD FOR AUDIO/VIDEO RECORDING FLOW */}
      {selectedBeatMetadata && (
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-[#201A08] to-[#121212] border-2 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.2)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-xl shrink-0">
              🎵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFD700] text-black">
                  {t('studio_ready_recording', 'READY FOR RECORDING')}
                </span>
                <span className="text-xs font-black text-white">{selectedBeatMetadata.name}</span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5 font-mono">
                {selectedBeatMetadata.bpm} BPM • {selectedBeatMetadata.producer} • <span className="text-[#FFD700]">{selectedBeatMetadata.filePath}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const b = availableBeats.find((item) => item.id === selectedBeatMetadata.id) || availableBeats[0];
              handleTestBeat(b);
            }}
            type="button"
            className="px-3 py-1.5 rounded-xl bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] text-xs font-black uppercase hover:bg-[#FFD700]/30 transition-all shrink-0 cursor-pointer"
          >
            {activeTestBeatId === selectedBeatMetadata.id ? 'Stop' : 'Play'}
          </button>
        </div>
      )}

      {/* BEATS CATALOG HEADER */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <Disc3 className="w-4 h-4 text-[#FFD700] animate-spin" style={{ animationDuration: '6s' }} />
          <span>{t('studio_available_beats', 'Available Beats')} ({displayedBeats.length}/{availableBeats.length})</span>
        </h2>
        <span className="text-[11px] font-mono text-gray-400">
          {t('studio_click_beat_select', 'Click beat to select')}
        </span>
      </div>

      {/* BEAT CARDS LIST (LAZY LOADED 2 AT A TIME) */}
      <div className="space-y-4">
        {displayedBeats.map((beat) => {
          const isSelected = selectedBeatId === beat.id;
          const isTesting = activeTestBeatId === beat.id;
          const isRecording = recordingBeatId === beat.id;
          const hasRecording = recordedBeatId === beat.id && !!recordedBlobUrl;

          return (
            <div
              key={beat.id}
              onClick={() => handleSelectBeat(beat)}
              className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                rentExpired
                  ? 'bg-[#121212]/80 border-white/5 opacity-70 cursor-not-allowed'
                  : isSelected
                  ? 'bg-gradient-to-br from-[#1F1905] to-[#121212] border-2 border-[#FFD700] ring-2 ring-[#FFD700]/30 shadow-[0_0_24px_rgba(255,215,0,0.25)]'
                  : 'bg-[#151515] border-white/10 hover:border-[#FFD700]/40 shadow-xl'
              }`}
            >
              {/* Selected Beat Pill */}
              {isSelected && (
                <div className="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 text-[#FFD700] text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-[#FFD700]" />
                  <span>{t('studio_selected_beat', 'SELECTED BEAT FOR RECORDING')}</span>
                </div>
              )}

              {/* Beat Info & Cover Header */}
              <div className="flex items-center gap-3.5 mb-3.5">
                {/* Styled Vinyl Cover Art */}
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${beat.coverGradient} flex items-center justify-center relative overflow-hidden border border-white/20 shrink-0 shadow-lg`}
                >
                  <div
                    className={`w-12 h-12 rounded-full border border-black/40 bg-black/70 flex items-center justify-center shadow-inner ${
                      isTesting || isPreviewPlaying ? 'animate-spin' : ''
                    }`}
                    style={{ animationDuration: '3s' }}
                  >
                    <span className="text-xl">{beat.icon}</span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-white truncate">{beat.name}</h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                      {beat.bpm} BPM
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#FFD700] mt-0.5 truncate">{beat.producer}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{beat.description}</p>
                </div>

                {/* Level Lock Status or Selected Checkmark */}
                {rentExpired ? (
                  <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-red-400" />
                  </div>
                ) : isSelected ? (
                  <div className="w-8 h-8 rounded-full bg-[#FFD700] text-black flex items-center justify-center shrink-0 font-black shadow-[0_0_12px_#FFD700]">
                    <CheckCircle2 className="w-5 h-5 fill-black text-[#FFD700]" />
                  </div>
                ) : null}
              </div>

              {/* RECORDING LIVE STATUS INDICATOR */}
              {isRecording && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-red-950/50 border border-red-500/60 flex items-center justify-between text-xs font-bold text-red-300 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span>{isVirtualMic ? t('studio_recording_virtual_label', 'RECORDING VIRTUAL VOCAL OVER BEAT...') : t('studio_recording_live_label', 'RECORDING LIVE MIC OVER BEAT...')}</span>
                  </div>
                  <span className="font-mono text-white text-sm">{recordSeconds}s / 60s</span>
                </div>
              )}

              {/* 4 BUTTONS IN EXACT SPECIFIED ORDER: TEST | RECORD | PREVIEW | POST */}
              <div className="grid grid-cols-4 gap-2" onClick={(e) => e.stopPropagation()}>
                {/* 1. TEST BUTTON */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestBeat(beat);
                  }}
                  disabled={rentExpired || isRecording}
                  type="button"
                  className={`py-2.5 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                    isTesting
                      ? 'bg-amber-400 text-black border-2 border-white shadow-[0_0_12px_#F59E0B]'
                      : rentExpired
                      ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      : 'bg-black/60 hover:bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 active:scale-95'
                  }`}
                >
                  {isTesting ? <Square className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-[#FFD700]" />}
                  <span>{isTesting ? t('studio_stop', 'STOP') : t('studio_test', 'TEST')}</span>
                </button>

                {/* 2. RECORD BUTTON */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isRecording ? handleStopRecord() : handleStartRecord(beat);
                  }}
                  disabled={rentExpired}
                  type="button"
                  className={`py-2.5 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse border-2 border-white shadow-[0_0_15px_#EF4444]'
                      : rentExpired
                      ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      : 'bg-black/60 hover:bg-red-500/15 text-red-400 border border-red-500/40 active:scale-95'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{isRecording ? t('studio_stop', 'STOP') : t('studio_record', 'RECORD')}</span>
                </button>

                {/* 3. PREVIEW BUTTON (MANDATORY BEFORE POST) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewMixed(beat);
                  }}
                  disabled={!hasRecording || isRecording}
                  type="button"
                  className={`py-2.5 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                    isPreviewPlaying
                      ? 'bg-cyan-400 text-black border-2 border-white shadow-[0_0_15px_#06b6d4]'
                      : !hasRecording
                      ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                      : hasPreviewed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-500/30 animate-pulse'
                  }`}
                >
                  <Headphones className="w-4 h-4" />
                  <span>{t('studio_preview', 'PREVIEW')}</span>
                </button>

                {/* 4. POST BUTTON (Download song + open Telegram group) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePostSong(beat);
                  }}
                  disabled={!hasRecording || !hasPreviewed || isRecording || postCooldownSeconds > 0}
                  type="button"
                  className={`py-2.5 px-1 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                    hasRecording && hasPreviewed && postCooldownSeconds === 0
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-[0_0_15px_rgba(250,204,21,0.6)] active:scale-95 hover:brightness-110 cursor-pointer'
                      : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                  <span>
                    {postCooldownSeconds > 0 ? `${postCooldownSeconds}s` : t('studio_post', 'POST')}
                  </span>
                </button>
              </div>

              {/* POST GUIDANCE TEXT */}
              {hasRecording && !hasPreviewed && (
                <div className="mt-2 text-[11px] font-bold text-amber-300/90 flex items-center justify-center gap-1.5 bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{t('studio_listen_first', 'Listen first before posting (Click PREVIEW to enable POST button)')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LAZY LOAD MORE BEATS BUTTON */}
      {visibleBeatsCount < availableBeats.length && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleLoadMore}
            type="button"
            className="w-full py-3.5 rounded-2xl bg-[#171717] hover:bg-[#202020] text-xs font-black text-[#FFD700] border border-[#FFD700]/30 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
          >
            <ChevronDown className="w-4 h-4" />
            <span>{t('studio_load_more', 'Load More Beats (+2)')}</span>
          </button>
        </div>
      )}
        </>
      )}

      {/* FOOTER INFO */}
      <div className="mt-8 text-center text-gray-500 text-[10px] space-y-1">
        <p>{t('studio_telegram_community', 'Telegram Community')}: {GROUP_TELEGRAM}</p>
        <p>{t('studio_admin_contact', 'Admin Contact')}: https://t.me/Gammyadmin • v1.0 Launch - Sunday</p>
      </div>
    </div>
  );
}
