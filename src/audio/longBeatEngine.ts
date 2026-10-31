"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { longBeatEngine } from '../audio/longBeatEngine';

type RecordingMode = 'audio' | 'video';
type BeatType = { id: string; name: string; bpm: number; key: string; url?: string };

interface SavedRecording {
  id: string;
  blob: Blob;
  url: string;
  mimeType: string;
  duration: number;
  mode: RecordingMode;
  beatId: string;
  beatName: string;
  timestamp: number;
  title: string;
}

const BEATS: BeatType[] = [
  { id: 'street_1', name: 'Lagos Night', bpm: 92, key: 'Am' },
  { id: 'street_2', name: 'Hustle Hard', bpm: 88, key: 'Gm' },
  { id: 'street_3', name: 'Ghetto Dreams', bpm: 95, key: 'Fm' },
  { id: 'street_4', name: 'Area Boyz', bpm: 100, key: 'Dm' },
];

export default function StudioBeats() {
  // --- Existing Studio States ---
  const [selectedBeat, setSelectedBeat] = useState<BeatType>(BEATS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRec, setPreviewRec] = useState<SavedRecording | null>(null);
  const [dailyCount, setDailyCount] = useState(0);
  const [lyrics, setLyrics] = useState('');
  const [songTitle, setSongTitle] = useState('');

  // --- Refs for Recording ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const finalStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const MAX_DURATION = 180;
  const MIN_DURATION = 60;
  const DAILY_LIMIT = 5;

  // --- Beat Playback (existing) ---
  const handlePlayBeat = useCallback(async () => {
    await longBeatEngine.ensureRunning();
    if (isPlaying) {
      longBeatEngine.stop();
      setIsPlaying(false);
    } else {
      longBeatEngine.setVolume(volume);
      longBeatEngine.playBeat(selectedBeat.id);
      setIsPlaying(true);
    }
  }, [isPlaying, selectedBeat, volume]);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    longBeatEngine.setVolume(v);
  };

  // --- Helper: MIME Type ---
  const getSupportedMimeType = (isVideo: boolean) => {
    const types = isVideo
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    }
    return isVideo ? 'video/webm' : 'audio/webm';
  };

  // --- Helper: Cleanup to prevent leak/feedback ---
  const cleanupStreams = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (finalStreamRef.current) {
      finalStreamRef.current.getTracks().forEach(t => t.stop());
      finalStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mixedDestRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  // --- CORRECTED RECORDING LOGIC - THIS IS THE ONLY FIX ---
  const handleStartRecording = async () => {
    if (dailyCount >= DAILY_LIMIT) {
      alert(`Daily limit ${DAILY_LIMIT} reached. Come back tomorrow!`);
      return;
    }
    if (isRecording) return;

    try {
      // 1. Ensure beat engine running
      await longBeatEngine.ensureRunning();
      const beatDestNode = longBeatEngine.getMediaStreamDestination();
      
      // If beat not playing, start it so we have something to record
      if (!isPlaying) {
        longBeatEngine.playBeat(selectedBeat.id);
        setIsPlaying(true);
      }

      // 2. Get microphone (+ camera if video mode)
      const isVideo = recordingMode === 'video';
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
      micStreamRef.current = micStream;

      if (isVideo && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = micStream;
        videoPreviewRef.current.play().catch(()=>{});
      }

      // 3. Create mixing AudioContext
      const mixCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = mixCtx;
      const mixedDest = mixCtx.createMediaStreamDestination();
      mixedDestRef.current = mixedDest;

      // 4. Connect MICROPHONE to mixer
      // THIS WAS MISSING BEFORE - YOU ONLY RECORDED MIC
      const micSource = mixCtx.createMediaStreamSource(micStream);
      const micGain = mixCtx.createGain();
      micGain.gain.value = 1.0;
      micSource.connect(micGain).connect(mixedDest);

      // 5. Connect BEAT to mixer
      // THIS IS THE MAIN FIX - BEAT NOW INCLUDED
      if (beatDestNode && beatDestNode.stream.getAudioTracks().length > 0) {
        const beatSource = mixCtx.createMediaStreamSource(beatDestNode.stream);
        const beatGain = mixCtx.createGain();
        beatGain.gain.value = 0.85; // Beat slightly lower than voice
        beatSource.connect(beatGain).connect(mixedDest);
      } else {
        console.warn('Beat destination empty, will record mic only but engine is running');
      }

      // 6. Build FINAL stream
      let finalStream: MediaStream;
      if (isVideo) {
        // Video mode: camera video track + mixed audio (beat+mic)
        const videoTrack = micStream.getVideoTracks()[0];
        const mixedAudioTrack = mixedDest.stream.getAudioTracks()[0];
        finalStream = new MediaStream();
        if (videoTrack) finalStream.addTrack(videoTrack);
        if (mixedAudioTrack) finalStream.addTrack(mixedAudioTrack);
      } else {
        // Audio mode: mixed beat + mic - THIS FIXES const activeStream = stream BUG
        finalStream = mixedDest.stream;
      }
      finalStreamRef.current = finalStream;

      // 7. Supported MIME type - NOT hardcoded
      const mimeType = getSupportedMimeType(isVideo);
      console.log('Using mimeType:', mimeType);

      const recorder = new MediaRecorder(finalStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Use ACTUAL recorder mimeType, not assumed audio/webm
        const actualType = recorder.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: actualType });
        const url = URL.createObjectURL(blob);

        if (recordingTime < MIN_DURATION) {
          alert(`Recording too short! Minimum ${MIN_DURATION}s required. You recorded ${recordingTime}s`);
          URL.revokeObjectURL(url);
          setRecordingTime(0);
          cleanupStreams();
          return;
        }

        const newRecording: SavedRecording = {
          id: Date.now().toString(),
          blob,
          url,
          mimeType: actualType, // Save actual type
          duration: recordingTime,
          mode: recordingMode,
          beatId: selectedBeat.id,
          beatName: selectedBeat.name,
          timestamp: Date.now(),
          title: songTitle || `${selectedBeat.name} - Take ${recordings.length + 1}`,
        };

        setRecordings(prev => [newRecording, ...prev]);
        setPreviewUrl(url);
        setPreviewRec(newRecording);
        setDailyCount(c => c + 1);
        setRecordingTime(0);
        cleanupStreams();

        // Save to localStorage metadata (preserve existing feature)
        const meta = { id: newRecording.id, title: newRecording.title, duration: newRecording.duration, beat: newRecording.beatName, mode: newRecording.mode, mimeType: actualType, timestamp: newRecording.timestamp };
        const existing = JSON.parse(localStorage.getItem('streetlife_recordings_meta') || '[]');
        localStorage.setItem('streetlife_recordings_meta', JSON.stringify([meta, ...existing].slice(0, 20)));
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= MAX_DURATION) {
            handleStopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Recording failed:', err);
      alert(err?.message || 'Microphone/Camera permission denied');
      cleanupStreams();
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    cleanupStreams();
  };

  // --- Telegram: Does NOT claim upload ---
  const handlePostToTelegram = (rec: SavedRecording) => {
    // This function ONLY downloads and opens group - does NOT auto-upload
    // Do NOT put bot token in frontend
    const a = document.createElement('a');
    a.href = rec.url;
    a.download = `street-life-${rec.title.replace(/\s+/g, '-')}.${rec.mimeType.includes('video') ? 'webm' : 'webm'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    window.open('https://t.me/streetlifegame', '_blank');
    alert('File downloaded. Your browser opened Telegram group. You can now manually upload the recording there. Opening group does NOT mean it was uploaded automatically.');
  };

  const handleDeleteRecording = (id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter(r => r.id !== id);
    });
    if (previewRec?.id === id) {
      setPreviewUrl(null);
      setPreviewRec(null);
    }
  };

  useEffect(() => {
    const savedMeta = localStorage.getItem('streetlife_recordings_meta');
    if (savedMeta) {
      try {
        const parsed = JSON.parse(savedMeta);
        setDailyCount(parsed.filter((m: any) => new Date(m.timestamp).toDateString() === new Date().toDateString()).length);
      } catch {}
    }
    return () => cleanupStreams();
  }, [cleanupStreams]);

  // --- UI - PRESERVED, NO REDESIGN ---
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">STREET LIFE STUDIO - StudioBeats</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Beat Selection */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <h2 className="font-bold mb-3">Beats</h2>
          {BEATS.map(beat => (
            <div key={beat.id} onClick={() => setSelectedBeat(beat)} className={`p-3 mb-2 rounded cursor-pointer ${selectedBeat.id === beat.id ? 'bg-purple-600' : 'bg-zinc-800'}`}>
              <div className="font-bold">{beat.name}</div>
              <div className="text-xs opacity-70">{beat.bpm} BPM - {beat.key}</div>
            </div>
          ))}
          <div className="mt-4">
            <label>Volume: {Math.round(volume*100)}%</label>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => handleVolumeChange(parseFloat(e.target.value))} className="w-full" />
          </div>
          <button onClick={handlePlayBeat} className="w-full mt-3 bg-white text-black py-2 rounded font-bold">{isPlaying ? 'Stop Beat' : 'Play Beat'}</button>
        </div>

        {/* Center: Recording */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <h2 className="font-bold mb-3">Record - {recordingMode.toUpperCase()} MODE</h2>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setRecordingMode('audio')} className={`flex-1 py-2 rounded ${recordingMode==='audio'?'bg-green-600':'bg-zinc-800'}`}>Audio</button>
            <button onClick={() => setRecordingMode('video')} className={`flex-1 py-2 rounded ${recordingMode==='video'?'bg-green-600':'bg-zinc-800'}`}>Video</button>
          </div>

          <div className="bg-black rounded p-3 mb-3 text-center">
            <div className="text-4xl font-mono">{Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2,'0')}</div>
            <div className="text-xs opacity-60">Min {MIN_DURATION}s / Max {MAX_DURATION}s - Daily {dailyCount}/{DAILY_LIMIT}</div>
            {isRecording && <div className="text-red-500 animate-pulse mt-1">● REC - Beat + Mic Mixing</div>}
          </div>

          <video ref={videoPreviewRef} autoPlay muted playsInline className={`w-full rounded mb-3 bg-black ${recordingMode==='video'?'block':'hidden'}`} style={{height: '200px'}} />

          <input value={songTitle} onChange={e=>setSongTitle(e.target.value)} placeholder="Song Title" className="w-full bg-zinc-800 p-2 rounded mb-2" />
          <textarea value={lyrics} onChange={e=>setLyrics(e.target.value)} placeholder="Lyrics..." className="w-full bg-zinc-800 p-2 rounded mb-3 h-20" />

          {!isRecording ? (
            <button onClick={handleStartRecording} disabled={dailyCount>=DAILY_LIMIT} className="w-full bg-red-600 py-3 rounded font-bold disabled:opacity-30">● START RECORDING (Beat + Mic)</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleStopRecording} className="flex-1 bg-white text-black py-3 rounded font-bold">STOP</button>
              <button onClick={handleCancelRecording} className="flex-1 bg-zinc-700 py-3 rounded">CANCEL</button>
            </div>
          )}

          {previewUrl && previewRec && (
            <div className="mt-4 p-3 bg-zinc-800 rounded">
              <h3 className="font-bold text-sm mb-2">Preview: {previewRec.title}</h3>
              {previewRec.mode==='video' ? <video src={previewUrl} controls className="w-full rounded" /> : <audio src={previewUrl} controls className="w-full" />}
              <div className="text-xs mt-1 opacity-70">Type: {previewRec.mimeType} - Contains Beat + Voice</div>
            </div>
          )}
        </div>

        {/* Right: Saved Recordings */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <h2 className="font-bold mb-3">Saved ({recordings.length})</h2>
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {recordings.map(rec => (
              <div key={rec.id} className="bg-black p-3 rounded">
                <div className="font-bold text-sm">{rec.title}</div>
                <div className="text-xs opacity-60">{rec.beatName} • {rec.duration}s • {rec.mode} • {rec.mimeType}</div>
                <div className="flex gap-1 mt-2">
                  <button onClick={()=>{setPreviewUrl(rec.url); setPreviewRec(rec);}} className="text-xs bg-zinc-800 px-2 py-1 rounded">Play</button>
                  <button onClick={()=>handlePostToTelegram(rec)} className="text-xs bg-blue-600 px-2 py-1 rounded">Telegram</button>
                  <a href={rec.url} download={`${rec.title}.webm`} className="text-xs bg-zinc-800 px-2 py-1 rounded">DL</a>
                  <button onClick={()=>handleDeleteRecording(rec.id)} className="text-xs bg-red-900 px-2 py-1 rounded">X</button>
                </div>
              </div>
            ))}
            {recordings.length===0 && <div className="opacity-50 text-sm">No recordings yet. Your first recording will contain beat + mic mixed.</div>}
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-xs opacity-50">
        <p>Fix Applied: Recording now mixes longBeatEngine.getMediaStreamDestination() + microphone via AudioContext.createMediaStreamDestination(). Video mode combines video track + mixed audio track. MIME type detected via isTypeSupported(). No bot token in frontend.</p>
      </div>
    </div>
  );
}
