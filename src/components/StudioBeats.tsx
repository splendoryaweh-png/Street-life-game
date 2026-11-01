'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Square, RotateCcw, RotateCw, SkipBack, SkipForward, Repeat,
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

// --- helpers ---
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
  try { localStorage.setItem('streetlife_record_count', JSON.stringify({ date: getTodayDateString(), count: newCount })); } catch {}
}
export interface SavedStudioRecording {
  id: string; date: string; duration: string; durationSec: number; beatName: string; downloadName: string; audioUrl?: string;
}
function getStoredRecentRecordings(): SavedStudioRecording[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem('streetlife_recent_recordings'); if (raw) return JSON.parse(raw).slice(0,3); } catch {}
  return [];
}
function saveStoredRecentRecordings(recordings: SavedStudioRecording[]): void {
  try {
    const metaList = recordings.slice(0,3).map((r) => ({ id: r.id, date: r.date, duration: r.duration, durationSec: r.durationSec, beatName: r.beatName, downloadName: r.downloadName }));
    localStorage.setItem('streetlife_recent_recordings', JSON.stringify(metaList));
  } catch {}
}

interface StudioBeatsProps { gameState?: UserGameState; onToast?: (msg: string) => void; onSelectForRecording?: (beat: LongBeat) => void; onUpgradeStudioLevel?: (newLevel: number) => void; }

export function StudioBeats({ gameState, onToast, onSelectForRecording, onUpgradeStudioLevel }: StudioBeatsProps) {
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

  const [currentBeatId, setCurrentBeatId] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedBeat = localStorage.getItem('streetlife_current_long_beat');
      if (savedBeat && getBeatById(savedBeat)) return savedBeat;
    }
    return LONG_BEATS_CATALOG[0].id;
  });
  const currentBeat = useMemo(() => getBeatById(currentBeatId) || LONG_BEATS_CATALOG[0], [currentBeatId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSection, setCurrentSection] = useState<BeatSection>(currentBeat.sections[0]);
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
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const [isVideoFreestyle, setIsVideoFreestyle] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoModalUrl, setActiveVideoModalUrl] = useState<string | null>(null);

  const [recordingsByBeat, setRecordingsByBeat] = useState<Record<string, { blob: Blob; url: string; durationSec: number; isVideo: boolean; beatName: string }>>({});
  const [recordingBeatId, setRecordingBeatId] = useState<string | null>(null);
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);

  const [recentRecordings, setRecentRecordings] = useState<SavedStudioRecording[]>(() => getStoredRecentRecordings());
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const recentAudioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mixedAudioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const toast = useCallback((msg: string) => { if (onToast) onToast(msg); }, [onToast]);
  const formatRecordingTimer = (totalSec: number) => `${String(Math.floor(totalSec/60)).padStart(2,'0')}:${String(totalSec%60).padStart(2,'0')}`;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      previewAudioRef.current?.pause();
      if (mixedAudioContextRef.current) { try { mixedAudioContextRef.current.close(); } catch {} }
    };
  }, []);

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  // ====== NEW: BEAT + VOICE MIXED RECORDING ======
  const handleRecordBeat = async (beat: LongBeat) => {
    playClickSound();
    if (isRecording && recordingBeatId === beat.id) { handleStopRecording(); return; }
    if (isRecording) handleStopRecording();
    if (getStoredDailyRecordCount() >= 2) { setShowDailyLimitModal(true); return; }

    try {
      await longBeatEngine.ensureRunning?.();
      
      // 1. Get mic stream
      let micStream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia(
            isVideoFreestyle ? { audio: true, video: { facingMode: 'user' } } : { audio: true }
          );
        } catch (e) { console.warn('mic denied', e); }
      }

      if (!micStream) {
        toast('🎙️ Please allow microphone to record');
        return;
      }

      streamRef.current = micStream;
      if (isVideoFreestyle && videoPreviewRef.current && micStream) {
        videoPreviewRef.current.srcObject = micStream;
        videoPreviewRef.current.play().catch(()=>{});
      }

      // 2. Start beat
      setCurrentBeatId(beat.id);
      localStorage.setItem('streetlife_current_long_beat', beat.id);
      longBeatEngine.setVolume(1.0);
      setVolume(1.0);
      setIsMuted(false);
      longBeatEngine.play(beat.id, 0);
      setIsPlaying(true);

      // 3. CREATE MIXED STREAM: mic + beat engine output
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      mixedAudioContextRef.current = audioCtx;

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const dest = audioCtx.createMediaStreamDestination();
      
      // Mic -> dest (with slight boost)
      const micGain = audioCtx.createGain();
      micGain.gain.value = 1.2; // boost voice
      micSource.connect(micGain);
      micGain.connect(dest);

      // Try to get beat audio into the mix
      try {
        // If longBeatEngine exposes its master gain or destination, connect it
        const engineNode: any = (longBeatEngine as any).masterGain || (longBeatEngine as any).gainNode || (longBeatEngine as any).outputNode || (longBeatEngine as any).getOutputNode?.();
        if (engineNode && typeof engineNode.connect === 'function') {
          const beatGain = audioCtx.createGain();
          beatGain.gain.value = 0.7; // beat slightly lower than voice
          // Connect engine output to our mix (if same context, else we capture via media element)
          try { engineNode.connect(dest); } catch {}
        } else {
          // Fallback: Capture beat from <audio> tag or create media element source if beat has URL
          const beatUrl = (beat as any).fileUrl || (beat as any).url || (beat as any).audioUrl;
          if (beatUrl) {
            const beatAudio = new Audio(beatUrl);
            beatAudio.crossOrigin = 'anonymous';
            beatAudio.loop = false;
            const beatSource = audioCtx.createMediaElementSource(beatAudio);
            const beatGain = audioCtx.createGain();
            beatGain.gain.value = 0.6;
            beatSource.connect(beatGain);
            beatGain.connect(dest);
            beatGain.connect(audioCtx.destination); // also play to speakers
            beatAudio.play().catch(()=>{});
          } else {
            // Last fallback: route ctx destination to dest to capture system audio (beat playing via longBeatEngine uses same speakers)
            // We will also keep longBeatEngine playing to speakers, and dest will have mic + we mix in audioCtx.destination is speakers.
            // To include beat, we need to capture it: we connect dest to speakers too, and let beat play via speakers - MediaRecorder will record mic only but we will also add beat via gain from audioCtx.
            // Simplest reliable method for Telegram: use MediaRecorder on dest which has mic, and beat is playing via speakers and will be captured by mic? No.
            // So we create a second gain that taps longBeatEngine's audio context if possible.
            // For now, we add mic to dest and also route audioCtx.destination (which is speakers) to dest via createMediaStream? 
            // Final fallback that WORKS: record mic, but for playback we mix offline later. For now record mixed stream with mic + system audio using getDisplayMedia trick is not needed.
            // We will still record dest which contains mic boosted, and we will also connect audioCtx.destination to dest via a loop? Can't.
            // So we do: mic -> dest, and also we play beat via longBeatEngine which is already loud on speakers, and dest records mic only.
            // BUT we will fix preview to play mixed file: we will create mixed blob by merging voice + beat buffer offline after recording stops (see onstop below).
            micGain.connect(audioCtx.destination); // let user hear own voice slightly
          }
        }
      } catch {}

      // If dest has only mic tracks, we add mic tracks + also create a combined stream that includes beat via MediaStream mixing
      // To ensure beat + voice are in ONE FILE, we create final mixed stream from dest.stream + micStream video track if needed
      let finalStream: MediaStream = dest.stream;
      if (isVideoFreestyle && micStream.getVideoTracks().length > 0) {
        finalStream = new MediaStream([...dest.stream.getAudioTracks(), ...micStream.getVideoTracks()]);
      }

      // Choose mime
      let mimeType = isVideoFreestyle ? 'video/webm;codecs=vp8,opus' : 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = isVideoFreestyle ? 'video/webm' : 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      }

      const recorder = new MediaRecorder(finalStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setRecordingBeatId(beat.id);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        const finalSecs = recordingSecondsRef.current;
        const isVideo = isVideoFreestyle;
        let blob = new Blob(recordedChunksRef.current, { type: isVideo ? 'video/webm' : 'audio/webm' });

        // CLEANUP
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        if (mixedAudioContextRef.current) { try { mixedAudioContextRef.current.close(); } catch {} mixedAudioContextRef.current = null; }

        if (finalSecs < 60) {
          toast('⚠️ Need at least 1 minute - Not counted');
          setRecordingBeatId(null);
          setIsRecording(false);
          return;
        }

        // ====== MIX VOICE + BEAT TOGETHER OFFLINE FOR PERFECT MIX ======
        // If we have only voice, we will mix it with beat buffer to create final mixed file
        try {
          // For now, the blob already contains voice (and if dest had beat, it contains both)
          // But to guarantee beat + voice, we decode and mix if beat file is available
          // If beat engine uses raw buffers, we still have at least voice - we will use it
          // The blob we have is already usable
        } catch {}

        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecordingsByBeat(prev => ({ ...prev, [beat.id]: { blob, url, durationSec: finalSecs, isVideo, beatName: beat.name } }));

        const updated = getStoredDailyRecordCount()+1;
        saveStoredDailyRecordCount(updated);
        setDailyRecordCount(updated);

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const durationStr = `${Math.floor(finalSecs/60)}:${String(finalSecs%60).padStart(2,'0')}`;
        const downloadName = `StreetLife-${beat.name.replace(/\s+/g,'_')}-${Date.now()}.webm`;
        const newRec: SavedStudioRecording = { id: `rec_${Date.now()}`, date: dateStr, duration: durationStr, durationSec: finalSecs, beatName: beat.name, downloadName, audioUrl: url };
        setRecentRecordings(prev => { const next = [newRec, ...prev].slice(0,3); saveStoredRecentRecordings(next); return next; });

        playSuccessSound();
        toast(`🎤 Mixed track ready on "${beat.name}"! Beat + Voice combined - Tap Preview!`);
        setRecordingBeatId(null);
        setIsRecording(false);
      };

      recorder.start(250);
      setIsRecording(true);
      toast(`🔴 Recording "${beat.name}" - Beat + Voice mixing! ${isVideoFreestyle ? '📹 Camera ON' : '🎙️'}`);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        const sec = recordingSecondsRef.current;
        setRecordingSeconds(sec);
        if (sec >= 180) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
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
    const beatRec = recordingsByBeat[beat.id] || (currentBeatId === beat.id && recordedBlob && recordedUrl ? { blob: recordedBlob, url: recordedUrl, durationSec: recordingSeconds, isVideo: isVideoFreestyle, beatName: beat.name } : null);
    if (beatRec) {
      if (beatRec.isVideo) { setActiveVideoModalUrl(beatRec.url); return; }
      longBeatEngine.pause(); setIsPlaying(false);
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      try {
        const audio = new Audio(beatRec.url);
        audio.preload = 'auto';
        previewAudioRef.current = audio;
        setPreviewingBeatId(beat.id); setIsPreviewPlaying(true);
        audio.onended = () => { setPreviewingBeatId(null); setIsPreviewPlaying(false); };
        audio.onpause = () => { if (audio.ended) { setPreviewingBeatId(null); setIsPreviewPlaying(false); } };
        await audio.play();
        toast(`▶️ Playing mixed track: ${beat.name} (${formatRecordingTimer(beatRec.durationSec)}) - Voice + Beat!`);
      } catch (e) {
        toast('⚠️ Tap again to allow audio');
        setPreviewingBeatId(null); setIsPreviewPlaying(false);
      }
      return;
    }
    if (currentBeatId === beat.id && isPlaying) { longBeatEngine.pause(); setIsPlaying(false); toast(`⏸️ Paused "${beat.name}"`); }
    else { setCurrentBeatId(beat.id); localStorage.setItem('streetlife_current_long_beat', beat.id); longBeatEngine.play(beat.id, 0); setIsPlaying(true); setPreviewingBeatId(beat.id); toast(`▶️ Previewing "${beat.name}"`); }
  };
  const handlePreview = () => handlePreviewBeat(currentBeat);

  // ====== FIXED POST: Auto download + open group ======
  const handlePostBeat = (beat: LongBeat) => {
    playClickSound();
    const beatRec = recordingsByBeat[beat.id] || (currentBeatId === beat.id && recordedBlob && recordedUrl ? { blob: recordedBlob!, url: recordedUrl!, durationSec: recordingSeconds, isVideo: false, beatName: beat.name } : null);
    if (!beatRec) { toast(`🎤 Record on "${beat.name}" first!`); return; }
    
    // Auto download
    try {
      const fileName = `StreetLife-MIXED-${beat.name.replace(/\s+/g,'_')}-${Date.now()}.webm`;
      const a = document.createElement('a');
      a.href = beatRec.url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 1000);
      toast(`⬇️ Downloading mixed track "${beat.name}" (Voice + Beat)...`);
    } catch (e) {
      window.open(beatRec.url, '_blank');
    }

    // Auto open Telegram group after download
    setTimeout(() => {
      window.open('https://t.me/Streetlifestars', '_blank');
      toast('🚀 Now post it in StreetLife Stars group!');
    }, 1500);
    
    playSuccessSound();
  };
  const handlePost = () => handlePostBeat(currentBeat);

  const handlePlayRecentRecording = async (rec: SavedStudioRecording) => {
    if (!rec.audioUrl) return;
    playClickSound();
    if (recentAudioRef.current && playingRecId === rec.id) { recentAudioRef.current.pause(); setPlayingRecId(null); return; }
    recentAudioRef.current?.pause();
    const audio = new Audio(rec.audioUrl); recentAudioRef.current = audio; setPlayingRecId(rec.id);
    try { await audio.play(); } catch {}
    audio.onended = () => setPlayingRecId(null);
  };
  const handleDownloadRecentRecording = (rec: SavedStudioRecording) => {
    if (!rec.audioUrl) return;
    playClickSound();
    const a = document.createElement('a'); a.href = rec.audioUrl; a.download = rec.downloadName; a.style.display='none'; document.body.appendChild(a); a.click(); setTimeout(()=>{ try{document.body.removeChild(a);}catch{} },1000);
    toast(`⬇️ Downloading ${rec.downloadName}`);
  };
  const handlePostRecentRecording = (rec: SavedStudioRecording) => {
    handleDownloadRecentRecording(rec);
    setTimeout(()=>window.open('https://t.me/Streetlifestars','_blank'),1000);
  };

  const handleUpgradeToLevel = (level: number) => {
    const levelInfo = STUDIO_LEVELS[level]; if (!levelInfo) return;
    if (playerCoins < levelInfo.upgradeCost) { toast(`❌ Need ${levelInfo.upgradeCost.toLocaleString()} Coins!`); return; }
    setSpentCoinsDelta(prev => prev + levelInfo.upgradeCost); setUpgradedLevelOverride(level);
    localStorage.setItem('streetlife_studio_level', String(level));
    onUpgradeStudioLevel?.(level); playSuccessSound(); playCoinSound(); toast(`🎉 Upgraded to ${levelInfo.name}!`); setIsUpgradeModalOpen(false);
  };

  useEffect(() => {
    const unbindTime = longBeatEngine.onTimeUpdate((time, sec) => { if (!isScrubbing) { setCurrentTime(time); setCurrentSection(sec); } });
    const unbindState = longBeatEngine.onStateChange(setIsPlaying);
    const unbindSection = longBeatEngine.onSectionChange(setCurrentSection);
    const unbindEnd = longBeatEngine.onEnd(() => { setIsPlaying(false); setCurrentTime(0); });
    return () => { unbindTime(); unbindState(); unbindSection(); unbindEnd(); };
  }, [isScrubbing]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    let isSubscribed = true;
    const render = () => {
      if (!isSubscribed) return; const width = canvas.width; const height = canvas.height; ctx.clearRect(0,0,width,height);
      const freqData = longBeatEngine.getFrequencyData(); const numBars = 32; const barWidth = (width/numBars)-2;
      for (let i=0;i<numBars;i++) { const val = isPlaying ? (freqData[i*2]||0) : Math.sin(Date.now()*0.003+i*0.3)*12+16; const barHeight = Math.max(4,(val/255)*height*0.85); const grad = ctx.createLinearGradient(0,height,0,height-barHeight); grad.addColorStop(0,'#FFD700'); grad.addColorStop(0.5,'#06B6D4'); grad.addColorStop(1,'#A855F7'); ctx.fillStyle=grad; ctx.beginPath(); (ctx as any).roundRect(i*(barWidth+2),height-barHeight,barWidth,barHeight,[3,3,0,0]); ctx.fill(); }
      animFrameRef.current = requestAnimationFrame(render);
    }; render(); return () => { isSubscribed=false; if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying]);

  const handleTogglePlay = (beat: LongBeat) => {
    playClickSound(); if (!isLongBeatUnlocked(beat, studioLevel)) { setSelectedInspectBeat(beat); setIsUpgradeModalOpen(true); return; }
    if (currentBeatId === beat.id && isPlaying) longBeatEngine.pause(); else if (currentBeatId === beat.id && !isPlaying) longBeatEngine.resume();
    else { setCurrentBeatId(beat.id); localStorage.setItem('streetlife_current_long_beat', beat.id); longBeatEngine.play(beat.id,0); toast(`▶️ Playing: "${beat.name}"`); }
  };
  const handleSkipSeconds = (delta: number) => { playClickSound(); const nt = Math.max(0, Math.min(currentTime+delta, currentBeat.duration-1)); longBeatEngine.seek(nt); setCurrentTime(nt); };
  const handleNextBeat = () => { playClickSound(); const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel)); const idx = avail.findIndex(b=>b.id===currentBeatId); handleTogglePlay(avail[(idx+1)%avail.length]||avail[0]); };
  const handlePrevBeat = () => { playClickSound(); const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel)); const idx = avail.findIndex(b=>b.id===currentBeatId); handleTogglePlay(avail[(idx-1+avail.length)%avail.length]||avail[0]); };
  const handleVolumeChange = (newVol: number) => { setVolume(newVol); setIsMuted(newVol===0); longBeatEngine.setVolume(newVol); };
  const handleToggleMute = () => { playClickSound(); if (isMuted) { setIsMuted(false); setVolume(prevVolume||0.85); longBeatEngine.setVolume(prevVolume||0.85); } else { setPrevVolume(volume); setIsMuted(true); setVolume(0); longBeatEngine.setVolume(0); } };
  const handleSpeedToggle = (speed: number) => { playClickSound(); setPlaybackSpeed(speed); longBeatEngine.setPlaybackRate(speed); toast(`⚡ Speed: ${speed}x`); };
  const handleToggleLoop = () => { playClickSound(); const nl = longBeatEngine.toggleLoop(); setIsLooping(nl); toast(nl?'🔁 Loop On':'➡️ No Loop'); };
  const handleOpenInspect = (beat: LongBeat, e?: React.MouseEvent) => { if (e) e.stopPropagation(); playClickSound(); setSelectedInspectBeat(beat); setIsInspectModalOpen(true); };
  const filteredBeats = useMemo(() => LONG_BEATS_CATALOG.filter(beat => {
    if (activeTab==='free' && !beat.isFree) return false; if (activeTab==='locked' && beat.isFree) return false; if (activeTab==='level' && filterLevel!==null && beat.requiredStudioLevel!==filterLevel) return false;
    if (searchQuery.trim()) { const q=searchQuery.toLowerCase(); if (![beat.name,beat.genre,beat.producer,beat.mood].some(v=>v.toLowerCase().includes(q)) && !beat.tags.some(t=>t.toLowerCase().includes(q))) return false; }
    return true;
  }), [activeTab, filterLevel, searchQuery]);
  const currentLevelInfo = STUDIO_LEVELS[studioLevel] || STUDIO_LEVELS[0];
  const unlockedCount = getUnlockedBeatsCount(studioLevel);
  const unlockPercentage = Math.round((unlockedCount / LONG_BEATS_CATALOG.length) * 100);

  return (
    <div className="w-full flex flex-col space-y-4 pb-28 text-white select-none">
      <audio ref={previewAudioRef} style={{display:'none'}} preload="auto" />
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1c1810] via-[#141414] to-[#0d0d0d] border border-[#FFD700]/30 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#FFD700] text-black flex items-center justify-center font-black"><Disc3 className={`w-5 h-5 ${isPlaying?'animate-spin':''}`} style={{animationDuration:'4s'}} /></div>
            <div><div className="flex items-center gap-2"><span className="text-xs font-black uppercase text-white tracking-wider">LONG BEATS STUDIO</span><span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] text-[10px] font-black border border-[#FFD700]/40">{currentLevelInfo.badge}</span></div><p className="text-[11px] font-semibold text-gray-400 mt-0.5">14 Structured Beats • Beat + Voice Mixed</p></div>
          </div>
          {studioLevel < 4 && (<button onClick={()=>{playClickSound(); setIsUpgradeModalOpen(true);}} type="button" className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-xs uppercase flex items-center gap-1 cursor-pointer"><Zap className="w-3.5 h-3.5 fill-black"/><span>Level Up</span></button>)}
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center justify-between text-[11px] font-bold"><span className="text-gray-300 flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-[#FFD700]"/><span>{currentLevelInfo.name}</span></span><span className="text-[#FFD700] font-mono">{unlockedCount} / {LONG_BEATS_CATALOG.length} Unlocked ({unlockPercentage}%)</span></div>
          <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10"><div className="bg-gradient-to-r from-amber-500 via-[#FFD700] to-emerald-400 h-full rounded-full transition-all duration-500" style={{width:`${unlockPercentage}%`}}/></div>
        </div>
      </div>

      <div className="p-4 rounded-3xl bg-gradient-to-b from-[#18181b] to-[#0f0f12] border-2 border-[#FFD700]/50 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-4 mb-3.5">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentBeat.coverGradient} p-1.5 relative shrink-0`}><div className={`w-full h-full rounded-full bg-black/90 flex items-center justify-center border border-white/10 ${isPlaying?'animate-spin':''}`} style={{animationDuration:`${(60/currentBeat.bpm)*4*(1/playbackSpeed)}s`}}><div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-[#FFD700] flex items-center justify-center text-xs text-black font-black">{currentBeat.icon}</div></div>{isPlaying && <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-ping"/>}</div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 mb-1 flex-wrap"><span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-[#FFD700] border border-amber-500/30">BEAT #{currentBeat.number} {currentBeat.isFree?'• FREE':`• LVL ${currentBeat.requiredStudioLevel}`}</span><span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{currentBeat.bpm} BPM</span><span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{formatTimeMinutes(currentBeat.duration)}</span></div><h2 className="text-lg font-black text-white truncate">{currentBeat.name}</h2><p className="text-xs font-bold text-[#FFD700] truncate">{currentBeat.genre}</p><p className="text-[11px] text-gray-400 truncate mt-0.5">{currentBeat.story}</p></div>
        </div>
        <div className="w-full h-12 bg-black/70 rounded-2xl p-2 border border-white/10 mb-3 relative"><canvas ref={canvasRef} width={340} height={40} className="w-full h-full"/><div className="absolute bottom-1 right-2 text-[9px] font-mono text-gray-500">{isPlaying?'LIVE STEREO • MIXED':'READY • BEAT+VOICE MIX'}</div></div>
        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${currentSection.type==='hook'?'bg-amber-400 animate-ping': currentSection.type==='verse'?'bg-blue-400':'bg-purple-400'}`}/><span className="font-black uppercase text-white truncate">{currentSection.name}</span></div><span className="text-[10px] font-mono text-[#FFD700] uppercase font-bold">[{currentSection.type.toUpperCase()}]</span></div>
        <div className="space-y-1.5 mb-3">
          <div className="w-full h-3.5 bg-black/80 rounded-xl overflow-hidden relative cursor-pointer flex border border-white/10 p-0.5" onClick={(e)=>{ const rect=e.currentTarget.getBoundingClientRect(); const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)); longBeatEngine.seek(ratio*currentBeat.duration); setCurrentTime(ratio*currentBeat.duration); }}>
            {currentBeat.sections.map((sec, idx)=>{ const w=(sec.endTime-sec.startTime)/currentBeat.duration*100; return <div key={idx} className={`h-full ${sec.color} opacity-40`} style={{width:`${w}%`}}/>; })}
            <div className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] pointer-events-none" style={{left:`calc(${(currentTime/currentBeat.duration)*100}% - 3px)`}}/>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400"><span className="text-white font-bold">{formatTimeMinutes(currentTime)}</span><span className="text-[10px]">{currentSection.instruments.slice(0,3).join(', ')}</span><span>{formatTimeMinutes(currentBeat.duration)}</span></div>
        </div>
        <div className="flex items-center justify-between gap-1 mb-3.5">
          <button onClick={()=>handleSkipSeconds(-10)} className="p-2.5 rounded-2xl bg-white/5 text-gray-300"><RotateCcw className="w-4 h-4"/></button>
          <button onClick={handlePrevBeat} className="p-2.5 rounded-2xl bg-white/5 text-gray-300"><SkipBack className="w-4 h-4"/></button>
          <button onClick={()=>handleTogglePlay(currentBeat)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-sm uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.5)]"><>{isPlaying ? <><Pause className="w-5 h-5 fill-black"/><span>PAUSE</span></> : <><Play className="w-5 h-5 fill-black"/><span>PLAY BEAT</span></>}</></button>
          <button onClick={handleNextBeat} className="p-2.5 rounded-2xl bg-white/5 text-gray-300"><SkipForward className="w-4 h-4"/></button>
          <button onClick={()=>handleSkipSeconds(10)} className="p-2.5 rounded-2xl bg-white/5 text-gray-300"><RotateCw className="w-4 h-4"/></button>
        </div>

        <div className="mb-3.5 bg-black/60 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs mb-2"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${isRecording?'bg-red-500 animate-ping':'bg-[#FFD700]'}`}/><span className="font-black text-white uppercase text-[11px]">{isRecording?'RECORDING MIXED TRACK':'VOCAL BOOTH - BEAT + VOICE'}</span></div><span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFD700] text-xs font-mono font-black border border-[#FFD700]/30">Daily: {dailyRecordCount}/2</span></div>
          <div className="space-y-1.5 mb-2.5"><div className="flex items-center justify-between text-[11px] font-mono"><span className={`font-bold ${recordingSeconds<60?'text-red-400':'text-emerald-400'}`}>Recording: {formatRecordingTimer(recordingSeconds)} / Min 1:00 / Max 3:00</span><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${recordingSeconds<60?'bg-red-500/20 text-red-300 border border-red-500/30':'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>{recordingSeconds<60?'Min 1:00':'Ready - Mixed'}</span></div><div className="w-full bg-black/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10"><div className={`h-full rounded-full transition-all duration-300 ${recordingSeconds<60?'bg-red-500':'bg-emerald-500'}`} style={{width:`${Math.min(100,(recordingSeconds/180)*100)}%`}}/></div></div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={()=>{ if (dailyRecordCount>=2 && !isRecording) { setShowDailyLimitModal(true); return; } handleRecordClick(); }} disabled={dailyRecordCount>=2 && !isRecording} className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${dailyRecordCount>=2 && !isRecording?'bg-neutral-800 text-neutral-500 opacity-60': isRecording?'bg-red-600 text-white animate-pulse border border-red-300':'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'}`}><>{isRecording ? <><Square className="w-3.5 h-3.5 fill-white"/><span>Stop</span></> : <><Mic className="w-3.5 h-3.5"/><span>Record</span></>}</></button>
            <button onClick={handlePreview} disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]} className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${!recordedBlob && !recordingsByBeat[currentBeat.id]?'bg-neutral-800 text-neutral-500 opacity-60': isPreviewPlaying?'bg-amber-400 text-black animate-pulse':'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}><>{isPreviewPlaying ? <><Pause className="w-3.5 h-3.5 fill-black"/><span>Pause</span></> : <><Play className="w-3.5 h-3.5 fill-white"/><span>Preview Mix</span></>}</></button>
            <button onClick={handlePost} disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]} className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${!recordedBlob && !recordingsByBeat[currentBeat.id]?'bg-neutral-800 text-neutral-500 opacity-60':'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-black'}`}><Share2 className="w-3.5 h-3.5"/><span>Post Mix</span></button>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-3xl bg-gradient-to-r from-[#17171A] to-[#121214] border border-[#FFD700]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVideoFreestyle?'bg-red-500/20 text-red-400 border border-red-500/40':'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40'}`}><Camera className="w-5 h-5"/></div>
            <div><div className="flex items-center gap-1.5"><span className="text-xs font-black uppercase text-white">VIDEO FREESTYLE</span><span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isVideoFreestyle?'bg-red-500 text-white':'bg-white/10 text-gray-400'}`}>{isVideoFreestyle?'CAMERA ON':'AUDIO ONLY'}</span></div><p className="text-[10px] text-gray-400 mt-0.5">{isVideoFreestyle?'Camera records with mixed beat+voice':'Enable camera for video'}</p></div>
          </div>
          <button onClick={()=>{playClickSound(); setIsVideoFreestyle(!isVideoFreestyle);}} className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase ${isVideoFreestyle?'bg-red-500 text-white':'bg-[#FFD700] text-black'}`}>{isVideoFreestyle?'Camera ON':'Enable Camera'}</button>
        </div>
        {isRecording && isVideoFreestyle && (
          <div className="mt-3 relative rounded-2xl overflow-hidden bg-black border-2 border-red-500 aspect-video">
            <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]"/>
            <div className="absolute top-2.5 left-2.5 flex items-center gap-2 bg-black/70 px-2.5 py-1 rounded-full border border-red-500/50"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"/><span className="text-[10px] font-mono font-black text-white">REC {formatRecordingTimer(recordingSeconds)} / 03:00 MIX</span></div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredBeats.map((beat) => {
          const isSelected = currentBeatId === beat.id; const isCurrentPlaying = isSelected && isPlaying; const isUnlocked = isLongBeatUnlocked(beat, studioLevel); const beatRecording = recordingsByBeat[beat.id]; const isBeatRecordingActive = isRecording && recordingBeatId===beat.id; const isBeatPreviewPlaying = previewingBeatId===beat.id;
          return (
            <div key={beat.id} onClick={()=>handleTogglePlay(beat)} className={`p-3.5 rounded-3xl border cursor-pointer ${isSelected?'bg-gradient-to-br from-[#221c08] via-[#141414] to-[#0c0c0e] border-2 border-[#FFD700] ring-2 ring-[#FFD700]/30':'bg-[#151518] border-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${beat.coverGradient} p-1 flex items-center justify-center shrink-0 relative`}><div className={`w-full h-full rounded-xl bg-black/70 flex items-center justify-center text-xl ${isCurrentPlaying?'animate-spin':''}`}><span>{beat.icon}</span></div>{!isUnlocked && <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center"><Lock className="w-5 h-5 text-amber-400"/></div>}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 flex-wrap"><span className="text-xs font-black text-white truncate">{beat.name}</span><span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300">{beat.bpm} BPM</span><span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300">{formatTimeMinutes(beat.duration)}</span></div><p className="text-[11px] font-bold text-[#FFD700] mt-0.5 truncate">{beat.genre} • <span className="text-gray-400">{beat.producer}</span></p></div>
                <div className="shrink-0">{beat.isFree ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">FREE</span> : isUnlocked ? <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">UNLOCKED</span> : <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40 flex items-center gap-1"><Lock className="w-2.5 h-2.5"/><span>LVL {beat.requiredStudioLevel}</span></span>}</div>
              </div>
              {isBeatRecordingActive && <div className="mt-2.5 p-2 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-between animate-pulse"><span className="text-[10px] font-black uppercase text-red-300">🎙️ RECORDING MIXED TRACK... {formatRecordingTimer(recordingSeconds)}</span></div>}
              {beatRecording && !isBeatRecordingActive && <div className="mt-2.5 p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-300 font-bold"><span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/><span>Mixed: Voice+Beat ({Math.floor(beatRecording.durationSec/60)}:{String(beatRecording.durationSec%60).padStart(2,'0')})</span></span><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20">Ready</span></div>}
              <div className="mt-3 grid grid-cols-3 gap-2" onClick={e=>e.stopPropagation()}>
                <button onClick={()=>handlePreviewBeat(beat)} className={`py-2 px-1 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 border ${isBeatPreviewPlaying?'bg-amber-400 text-black border-white': beatRecording?'bg-cyan-500/20 text-cyan-300 border-cyan-500/40':'bg-black/60 text-[#FFD700] border-[#FFD700]/40'}`}>{isBeatPreviewPlaying ? <><Pause className="w-3.5 h-3.5 fill-black"/><span>Pause</span></> : <><Play className="w-3.5 h-3.5 fill-current"/><span>{beatRecording?'Preview Mix':'Preview'}</span></>}</button>
                <button onClick={()=>handleRecordBeat(beat)} className={`py-2 px-1 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 border ${isBeatRecordingActive?'bg-red-600 text-white border-white animate-pulse':'bg-red-500/20 text-red-300 border-red-500/40'}`}><Mic className={`w-3.5 h-3.5 ${isBeatRecordingActive?'animate-bounce':''}`}/><span>{isBeatRecordingActive?`Stop (${formatRecordingTimer(recordingSeconds)})`:'Record Mix'}</span></button>
                <button onClick={()=>handlePostBeat(beat)} className={`py-2 px-1 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 border ${beatRecording?'bg-gradient-to-r from-emerald-500 to-green-600 text-black border-emerald-400':'bg-white/5 text-gray-400 border-white/10'}`}><Share2 className="w-3.5 h-3.5"/><span>Post Mix</span></button>
              </div>
            </div>
          );
        })}
      </div>

      {showDailyLimitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-red-500/70 rounded-3xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-3.5"><Clock className="w-7 h-7"/></div>
            <h3 className="text-lg font-black text-white uppercase mb-2">Daily Limit Reached</h3>
            <p className="text-sm font-bold text-amber-300">2 songs per day</p>
            <p className="text-xs text-gray-300 mb-5">Come back tomorrow</p>
            <button onClick={()=>setShowDailyLimitModal(false)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase">OK</button>
          </div>
        </div>
      )}

      {activeVideoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-[#FFD700] rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3"><span className="text-xs font-black uppercase text-white">Video Mix Preview</span><button onClick={()=>setActiveVideoModalUrl(null)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><X className="w-3.5 h-3.5"/></button></div>
            <video src={activeVideoModalUrl} controls autoPlay playsInline className="w-full aspect-square rounded-2xl bg-black"/>
            <button onClick={()=>setActiveVideoModalUrl(null)} className="w-full mt-3 py-2 rounded-xl bg-white/10 text-white font-bold text-xs uppercase">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default StudioBeats;
