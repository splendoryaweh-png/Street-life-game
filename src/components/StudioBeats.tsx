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
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
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
      if (beatAudioRef.current) { beatAudioRef.current.pause(); beatAudioRef.current.src = ''; }
      if (mixedAudioContextRef.current) { try { mixedAudioContextRef.current.close(); } catch {} }
      if (recordedUrl) { try { URL.revokeObjectURL(recordedUrl); } catch {} }
      Object.values(recordingsByBeat).forEach(r => { try { URL.revokeObjectURL(r.url); } catch {} });
    };
  }, []);

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (beatAudioRef.current) { try { beatAudioRef.current.pause(); } catch {} }
    setIsRecording(false);
  }, []);

  const handleRecordBeat = async (beat: LongBeat) => {
    playClickSound();
    if (isRecording && recordingBeatId === beat.id) { handleStopRecording(); return; }
    if (isRecording) handleStopRecording();
    if (getStoredDailyRecordCount() >= 2) { setShowDailyLimitModal(true); return; }

    try {
      await longBeatEngine.ensureRunning?.();
      longBeatEngine.pause();
      setIsPlaying(false);
      
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia(
          isVideoFreestyle ? { audio: true, video: { facingMode: 'user' } } : { audio: true }
        );
      } catch (e) { console.warn('mic denied', e); }

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
      
      const micGain = audioCtx.createGain();
      micGain.gain.value = 1.3;
      micSource.connect(micGain);
      micGain.connect(dest);

      const beatUrl = (beat as any).fileUrl || (beat as any).url || (beat as any).audioUrl || (beat as any).previewUrl;
      let beatEl: HTMLAudioElement | null = null;
      if (beatUrl) {
        beatEl = new Audio(beatUrl);
        beatEl.crossOrigin = 'anonymous';
        beatEl.loop = false;
        beatEl.preload = 'auto';
        beatAudioRef.current = beatEl;
        const beatSource = audioCtx.createMediaElementSource(beatEl);
        const beatGain = audioCtx.createGain();
        beatGain.gain.value = 0.85;
        beatSource.connect(beatGain);
        beatGain.connect(dest);
        beatGain.connect(audioCtx.destination);
        try { await beatEl.play(); } catch {}
      } else {
        longBeatEngine.play(beat.id, 0);
        setIsPlaying(true);
      }

      let finalStream: MediaStream = dest.stream;
      if (isVideoFreestyle && micStream.getVideoTracks().length > 0) {
        finalStream = new MediaStream([...dest.stream.getAudioTracks(), ...micStream.getVideoTracks()]);
      }

      const mimeType = getBestMimeType(isVideoFreestyle);
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
        
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        if (beatAudioRef.current) { try { beatAudioRef.current.pause(); beatAudioRef.current.src = ''; } catch {} beatAudioRef.current = null; }
        if (mixedAudioContextRef.current) { try { await mixedAudioContextRef.current.close(); } catch {} mixedAudioContextRef.current = null; }

        if (finalSecs < 60) {
          toast('⚠️ Need at least 1 minute - Not counted');
          setRecordingBeatId(null);
          setIsRecording(false);
          return;
        }

        const blobType = mimeType || (isVideo ? 'video/webm' : 'audio/webm');
        const blob = new Blob(recordedChunksRef.current, { type: blobType });

        if (recordedUrl) { try { URL.revokeObjectURL(recordedUrl); } catch {} }
        const old = recordingsByBeat[beat.id];
        if (old?.url) { try { URL.revokeObjectURL(old.url); } catch {} }

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
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const downloadName = `StreetLife-${beat.name.replace(/\s+/g,'_')}-${Date.now()}.${ext}`;
        const newRec: SavedStudioRecording = { id: `rec_${Date.now()}`, date: dateStr, duration: durationStr, durationSec: finalSecs, beatName: beat.name, downloadName, audioUrl: url };
        setRecentRecordings(prev => { const next = [newRec, ...prev].slice(0,3); saveStoredRecentRecordings(next); return next; });

        playSuccessSound();
        toast(`🎤 Mixed track ready on "${beat.name}"! Beat + Voice aligned - Tap Preview!`);
        setRecordingBeatId(null);
        setIsRecording(false);
      };

      recorder.start(100);
      setIsRecording(true);
      toast(`🔴 Recording "${beat.name}" - You hear BEAT only, Voice is recording!`);

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
        previewAudioRef.current = audio;
        setPreviewingBeatId(beat.id); setIsPreviewPlaying(true);
        audio.onended = () => { setPreviewingBeatId(null); setIsPreviewPlaying(false); };
        await audio.play();
        toast(`▶️ Playing mixed track: ${beat.name} (${formatRecordingTimer(beatRec.durationSec)})`);
      } catch (e) {
        toast('⚠️ Tap again to allow audio');
        setPreviewingBeatId(null); setIsPreviewPlaying(false);
      }
      return;
    }
    if (currentBeatId === beat.id && isPlaying) { longBeatEngine.pause(); setIsPlaying(false); }
    else { setCurrentBeatId(beat.id); longBeatEngine.play(beat.id, 0); setIsPlaying(true); setPreviewingBeatId(beat.id); }
  };
  const handlePreview = () => handlePreviewBeat(currentBeat);
  const handlePostBeat = (beat: LongBeat) => {
    playClickSound();
    const beatRec = recordingsByBeat[beat.id] || (currentBeatId === beat.id && recordedBlob && recordedUrl ? { blob: recordedBlob!, url: recordedUrl!, durationSec: recordingSeconds, isVideo: false, beatName: beat.name } : null);
    if (!beatRec) { toast(`🎤 Record on "${beat.name}" first!`); return; }
    try {
      const a = document.createElement('a');
      a.href = beatRec.url;
      a.download = `StreetLife-MIXED-${beat.name.replace(/\s+/g,'_')}-${Date.now()}.${beatRec.url.includes('mp4') ? 'mp4' : 'webm'}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 1000);
    } catch (e) { window.open(beatRec.url, '_blank'); }
    setTimeout(() => { window.open('https://t.me/Streetlifestars', '_blank'); }, 1500);
    playSuccessSound();
  };
  const handlePost = () => handlePostBeat(currentBeat);
  const handlePlayRecentRecording = async (rec: SavedStudioRecording) => {
    if (!rec.audioUrl) return;
    if (recentAudioRef.current && playingRecId === rec.id) { recentAudioRef.current.pause(); setPlayingRecId(null); return; }
    recentAudioRef.current?.pause();
    const audio = new Audio(rec.audioUrl); recentAudioRef.current = audio; setPlayingRecId(rec.id);
    try { await audio.play(); } catch {}
    audio.onended = () => setPlayingRecId(null);
  };
  const handleUpgradeToLevel = (level: number) => {
    const levelInfo = STUDIO_LEVELS[level]; if (!levelInfo) return;
    if (playerCoins < levelInfo.upgradeCost) { toast(`❌ Need ${levelInfo.upgradeCost.toLocaleString()} Coins!`); return; }
    setSpentCoinsDelta(prev => prev + levelInfo.upgradeCost); setUpgradedLevelOverride(level);
    localStorage.setItem('streetlife_studio_level', String(level));
    onUpgradeStudioLevel?.(level); playSuccessSound(); toast(`🎉 Upgraded to ${levelInfo.name}!`); setIsUpgradeModalOpen(false);
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
      for (let i=0;i<numBars;i++) { 
        const val = isPlaying ? (freqData[i*2]||0) : Math.sin(Date.now()*0.003+i*0.3)*12+16; 
        const barHeight = Math.max(4,(val/255)*height*0.85); 
        const grad = ctx.createLinearGradient(0,height,0,height-barHeight); 
        grad.addColorStop(0,'#FFD700'); grad.addColorStop(0.5,'#06B6D4'); grad.addColorStop(1,'#A855F7'); 
        ctx.fillStyle=grad; 
        const x = i*(barWidth+2); const y = height-barHeight;
        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath(); (ctx as any).roundRect(x,y,barWidth,barHeight,[3,3,0,0]); ctx.fill();
        } else { ctx.fillRect(x,y,barWidth,barHeight); }
      }
      animFrameRef.current = requestAnimationFrame(render);
    }; render(); return () => { isSubscribed=false; if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying]);

  const handleTogglePlay = (beat: LongBeat) => {
    playClickSound(); if (!isLongBeatUnlocked(beat, studioLevel)) { setSelectedInspectBeat(beat); setIsUpgradeModalOpen(true); return; }
    if (currentBeatId === beat.id && isPlaying) longBeatEngine.pause(); else if (currentBeatId === beat.id && !isPlaying) longBeatEngine.resume();
    else { setCurrentBeatId(beat.id); localStorage.setItem('streetlife_current_long_beat', beat.id); longBeatEngine.play(beat.id,0); }
  };
  const handleSkipSeconds = (delta: number) => { const nt = Math.max(0, Math.min(currentTime+delta, currentBeat.duration-1)); longBeatEngine.seek(nt); setCurrentTime(nt); };
  const handleNextBeat = () => { const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel)); const idx = avail.findIndex(b=>b.id===currentBeatId); handleTogglePlay(avail[(idx+1)%avail.length]||avail[0]); };
  const handlePrevBeat = () => { const avail = LONG_BEATS_CATALOG.filter(b=>isLongBeatUnlocked(b,studioLevel)); const idx = avail.findIndex(b=>b.id===currentBeatId); handleTogglePlay(avail[(idx-1+avail.length)%avail.length]||avail[0]); };
  const filteredBeats = useMemo(() => LONG_BEATS_CATALOG.filter(beat => {
    if (activeTab==='free' && !beat.isFree) return false; if (activeTab==='locked' && beat.isFree) return false; 
    if (searchQuery.trim()) { const q=searchQuery.toLowerCase(); if (![beat.name,beat.genre,beat.producer].some(v=>v.toLowerCase().includes(q))) return false; }
    return true;
  }), [activeTab, searchQuery]);
  const currentLevelInfo = STUDIO_LEVELS[studioLevel] || STUDIO_LEVELS[0];
  const unlockedCount = getUnlockedBeatsCount(studioLevel);
  const unlockPercentage = Math.round((unlockedCount / LONG_BEATS_CATALOG.length) * 100);

  return (
    <div className="w-full flex flex-col space-y-4 pb-28 text-white select-none">
      <div className="p-4 rounded-3xl bg-gradient-to-b from-[#18181b] to-[#0f0f12] border-2 border-[#FFD700]/50">
        <div className="flex items-center gap-4 mb-3.5">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentBeat.coverGradient} p-1.5 relative shrink-0`}><div className={`w-full h-full rounded-full bg-black/90 flex items-center justify-center border border-white/10 ${isPlaying?'animate-spin':''}`}><div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-[#FFD700] flex items-center justify-center text-xs text-black font-black">{currentBeat.icon}</div></div></div>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-black text-white truncate">{currentBeat.name}</h2><p className="text-xs font-bold text-[#FFD700] truncate">{currentBeat.genre}</p><p className="text-[11px] text-gray-400 truncate mt-0.5">{currentBeat.story}</p></div>
        </div>
        <div className="w-full h-12 bg-black/70 rounded-2xl p-2 border border-white/10 mb-3 relative"><canvas ref={canvasRef} width={340} height={40} className="w-full h-full"/><div className="absolute bottom-1 right-2 text-[9px] font-mono text-gray-500">{isPlaying?'LIVE STEREO • MIXED':'READY • BEAT+VOICE MIX'}</div></div>
        <div className="flex items-center justify-between gap-1 mb-3.5">
          <button onClick={()=>handleSkipSeconds(-10)} className="p-2.5 rounded-2xl bg-white/5"><RotateCcw className="w-4 h-4"/></button>
          <button onClick={handlePrevBeat} className="p-2.5 rounded-2xl bg-white/5"><SkipBack className="w-4 h-4"/></button>
          <button onClick={()=>handleTogglePlay(currentBeat)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#FFD700] to-yellow-500 text-black font-black text-sm uppercase flex items-center gap-2">{isPlaying ? <><Pause className="w-5 h-5 fill-black"/><span>PAUSE</span></> : <><Play className="w-5 h-5 fill-black"/><span>PLAY BEAT</span></>}</button>
          <button onClick={handleNextBeat} className="p-2.5 rounded-2xl bg-white/5"><SkipForward className="w-4 h-4"/></button>
          <button onClick={()=>handleSkipSeconds(10)} className="p-2.5 rounded-2xl bg-white/5"><RotateCw className="w-4 h-4"/></button>
        </div>
        <div className="mb-3.5 bg-black/60 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs mb-2"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${isRecording?'bg-red-500 animate-ping':'bg-[#FFD700]'}`}/><span className="font-black text-white uppercase text-[11px]">{isRecording?'RECORDING MIXED TRACK':'VOCAL BOOTH - BEAT + VOICE'}</span></div><span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFD700] text-xs font-mono font-black border border-[#FFD700]/30">Daily: {dailyRecordCount}/2</span></div>
          <div className="space-y-1.5 mb-2.5"><div className="flex items-center justify-between text-[11px] font-mono"><span className={`font-bold ${recordingSeconds<60?'text-red-400':'text-emerald-400'}`}>Recording: {formatRecordingTimer(recordingSeconds)} / Min 1:00 / Max 3:00</span></div><div className="w-full bg-black/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10"><div className={`h-full rounded-full ${recordingSeconds<60?'bg-red-500':'bg-emerald-500'}`} style={{width:`${Math.min(100,(recordingSeconds/180)*100)}%`}}/></div></div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={()=>{ if (dailyRecordCount>=2 && !isRecording) { setShowDailyLimitModal(true); return; } handleRecordClick(); }} disabled={dailyRecordCount>=2 && !isRecording} className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 ${dailyRecordCount>=2 && !isRecording?'bg-neutral-800 text-neutral-500 opacity-60': isRecording?'bg-red-600 text-white animate-pulse':'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'}`}><>{isRecording ? <><Square className="w-3.5 h-3.5 fill-white"/><span>Stop</span></> : <><Mic className="w-3.5 h-3.5"/><span>Record</span></>}</></button>
            <button onClick={handlePreview} disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]} className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"><><Play className="w-3.5 h-3.5"/><span>Preview Mix</span></></button>
            <button onClick={handlePost} disabled={!recordedBlob && !recordingsByBeat[currentBeat.id]} className="py-2.5 px-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black"><Share2 className="w-3.5 h-3.5"/><span>Post Mix</span></button>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-3xl bg-gradient-to-r from-[#17171A] to-[#121214] border border-[#FFD700]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVideoFreestyle?'bg-red-500/20 text-red-400':'bg-[#FFD700]/20 text-[#FFD700]'}`}><Camera className="w-5 h-5"/></div>
            <div><span className="text-xs font-black uppercase text-white">VIDEO FREESTYLE</span><p className="text-[10px] text-gray-400">{isVideoFreestyle?'Camera records with mixed beat+voice':'Enable camera for video'}</p></div>
          </div>
          <button onClick={()=>setIsVideoFreestyle(!isVideoFreestyle)} className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase ${isVideoFreestyle?'bg-red-500 text-white':'bg-[#FFD700] text-black'}`}>{isVideoFreestyle?'Camera ON':'Enable Camera'}</button>
        </div>
        {isRecording && isVideoFreestyle && (
          <div className="mt-3 relative rounded-2xl overflow-hidden bg-black border-2 border-red-500 aspect-video">
            <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]"/>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredBeats.map((beat) => {
          const isSelected = currentBeatId === beat.id; const isCurrentPlaying = isSelected && isPlaying; const isUnlocked = isLongBeatUnlocked(beat, studioLevel); const beatRecording = recordingsByBeat[beat.id]; const isBeatRecordingActive = isRecording && recordingBeatId===beat.id;
          return (
            <div key={beat.id} onClick={()=>handleTogglePlay(beat)} className={`p-3.5 rounded-3xl border cursor-pointer ${isSelected?'border-2 border-[#FFD700]':'border-white/10 bg-[#151518]'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${beat.coverGradient} p-1 flex items-center justify-center shrink-0`}><div className="w-full h-full rounded-xl bg-black/70 flex items-center justify-center text-xl"><span>{beat.icon}</span></div></div>
                <div className="min-w-0 flex-1"><span className="text-xs font-black text-white truncate">{beat.name}</span><p className="text-[11px] font-bold text-[#FFD700] mt-0.5 truncate">{beat.genre}</p></div>
                <div className="shrink-0">{beat.isFree ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">FREE</span> : <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">LVL {beat.requiredStudioLevel}</span>}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" onClick={e=>e.stopPropagation()}>
                <button onClick={()=>handlePreviewBeat(beat)} className="py-2 px-1 rounded-xl text-xs font-black uppercase bg-black/60 text-[#FFD700] border border-[#FFD700]/40">Preview</button>
                <button onClick={()=>handleRecordBeat(beat)} className={`py-2 px-1 rounded-xl text-xs font-black uppercase ${isBeatRecordingActive?'bg-red-600 text-white animate-pulse':'bg-red-500/20 text-red-300'}`}>{isBeatRecordingActive?`Stop (${formatRecordingTimer(recordingSeconds)})`:'Record Mix'}</button>
                <button onClick={()=>handlePostBeat(beat)} className="py-2 px-1 rounded-xl text-xs font-black uppercase bg-emerald-500/20 text-emerald-300">Post Mix</button>
              </div>
            </div>
          );
        })}
      </div>

      {showDailyLimitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-red-500/70 rounded-3xl p-6 text-center">
            <h3 className="text-lg font-black text-white uppercase mb-2">Daily Limit Reached</h3>
            <p className="text-sm font-bold text-amber-300">2 songs per day</p>
            <button onClick={()=>setShowDailyLimitModal(false)} className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-xs uppercase">OK</button>
          </div>
        </div>
      )}
      {activeVideoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16161a] border-2 border-[#FFD700] rounded-3xl p-4">
            <video src={activeVideoModalUrl} controls autoPlay playsInline className="w-full aspect-square rounded-2xl bg-black"/>
            <button onClick={()=>setActiveVideoModalUrl(null)} className="w-full mt-3 py-2 rounded-xl bg-white/10 text-white font-bold text-xs uppercase">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default StudioBeats;
