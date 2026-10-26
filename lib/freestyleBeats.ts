/**
 * Beat Library and Procedural Web Audio Engine for Freestyle Booth (Prompt: Hustle Hub)
 * Generates authentic BPM rhythm loops (Afrobeat, Drill, Amapiano, Trap, Fuji Fusion, etc.)
 */

export interface BeatDefinition {
  id: string;
  name: string;
  producer: string;
  genre: string;
  bpm: number;
  title: string;
  requiredStudioLevel: number; // 0 = Free for 30 days, 1 = 100k for 30 days
  requiredCoins: number;
  description: string;
  badge?: string;
  icon: string;
  isFree: boolean;
  filePath: string;
  coverGradient: string;
}

export interface SelectedBeatMetadata {
  id: string;
  name: string;
  producer: string;
  bpm: number;
  filePath: string;
  title: string;
  genre: string;
  icon: string;
  requiredStudioLevel: number;
  coverGradient: string;
}

export function getBeatMetadata(beat: BeatDefinition): SelectedBeatMetadata {
  return {
    id: beat.id,
    name: beat.name,
    producer: beat.producer,
    bpm: beat.bpm,
    filePath: beat.filePath,
    title: beat.title,
    genre: beat.genre,
    icon: beat.icon,
    requiredStudioLevel: beat.requiredStudioLevel,
    coverGradient: beat.coverGradient,
  };
}

export const BEAT_LIBRARY: BeatDefinition[] = [
  // LEVEL 0 (4 Beats - FREE for 30 days)
  {
    id: 'beat_1',
    name: 'Street Stars Drill',
    producer: 'Prod. Augustine',
    genre: 'UK/NY Drill',
    bpm: 140,
    title: 'Street Stars Drill',
    requiredStudioLevel: 0,
    requiredCoins: 0,
    description: 'Dark sliding 808 sub-bass, rapid hi-hat rolls, and punchy street snare.',
    icon: '⚡',
    isFree: true,
    filePath: '/beats/beat1.mp3',
    coverGradient: 'from-amber-500/80 via-orange-600/80 to-red-800/90',
  },
  {
    id: 'beat_2',
    name: 'Lagos Night Heat',
    producer: 'Prod. Gammy',
    genre: 'Afrobeats',
    bpm: 98,
    title: 'Lagos Night Heat',
    requiredStudioLevel: 0,
    requiredCoins: 0,
    description: 'Bouncy syncopated log drums, warm electric keys, and rhythmic shakers.',
    icon: '🎷',
    isFree: true,
    filePath: '/beats/beat2.mp3',
    coverGradient: 'from-yellow-400/80 via-amber-600/80 to-stone-900/90',
  },
  {
    id: 'beat_3',
    name: 'Ghetto Star Amapiano',
    producer: 'Prod. Street Life',
    genre: 'South African Piano',
    bpm: 112,
    title: 'Ghetto Star Amapiano',
    requiredStudioLevel: 0,
    requiredCoins: 0,
    description: 'Deep resonant log drum chords, saxophone leads, and smooth vibe.',
    icon: '🎹',
    isFree: true,
    filePath: '/beats/beat3.mp3',
    coverGradient: 'from-emerald-500/80 via-teal-700/80 to-slate-900/90',
  },
  {
    id: 'beat_4',
    name: 'Downtown 808 Trap',
    producer: 'Prod. Augustine',
    genre: 'Atlanta Trap',
    bpm: 132,
    title: 'Downtown 808 Trap',
    requiredStudioLevel: 0,
    requiredCoins: 0,
    description: 'Booming 808 kick, rolling triple hats, and atmospheric minor chords.',
    icon: '🔥',
    isFree: true,
    filePath: '/beats/beat4.mp3',
    coverGradient: 'from-purple-600/80 via-pink-700/80 to-slate-950/90',
  },

  // LEVEL 1 (Duplicate first 3 to make 7 Beats total, 100,000 coins)
  {
    id: 'beat_5',
    name: 'Platinum Gang Banger',
    producer: 'Prod. Gammy',
    genre: 'Platinum Drill',
    bpm: 142,
    title: 'Platinum Gang Banger',
    requiredStudioLevel: 1,
    requiredCoins: 100000,
    description: 'Explosive heavy 808 drop, metallic hats, and aggressive syndicate energy.',
    icon: '👑',
    isFree: false,
    filePath: '/beats/beat1.mp3', // duplicated beat1
    coverGradient: 'from-cyan-500/80 via-blue-700/80 to-slate-950/90',
  },
  {
    id: 'beat_6',
    name: 'Downtown Cyber Flow',
    producer: 'Prod. Augustine',
    genre: 'Futuristic Afro',
    bpm: 105,
    title: 'Downtown Cyber Flow',
    requiredStudioLevel: 1,
    requiredCoins: 100000,
    description: 'Polished master acoustics, highlife guitar riffs, and heavy bassline.',
    icon: '🚀',
    isFree: false,
    filePath: '/beats/beat2.mp3', // duplicated beat2
    coverGradient: 'from-indigo-600/80 via-purple-700/80 to-zinc-950/90',
  },
  {
    id: 'beat_7',
    name: 'All Stars Legacy',
    producer: 'Prod. Street Stars',
    genre: 'Stadium Banger',
    bpm: 128,
    title: 'All Stars Legacy',
    requiredStudioLevel: 1,
    requiredCoins: 100000,
    description: 'Stadium synth brass, grand orchestral stabs, and worldwide platinum bounce.',
    icon: '⭐',
    isFree: false,
    filePath: '/beats/beat3.mp3', // duplicated beat3
    coverGradient: 'from-yellow-300/80 via-amber-500/80 to-neutral-950/90',
  },
];

export const STUDIO_LEVEL_NAMES: Record<number, string> = {
  0: 'Ghetto Studio (Starter)',
  1: 'Street Studio (Level 1)',
  2: 'Pro Studio (Level 2)',
  3: 'Hitmaker Studio (Level 3)',
  4: 'Celebrity Studio (Level 4)',
};

export function isBeatUnlocked(beat: BeatDefinition, playerStudioLevel: number): boolean {
  if (beat.isFree || beat.requiredStudioLevel === 0) return true;
  return playerStudioLevel >= beat.requiredStudioLevel;
}

// ---------------------------------------------------------------------------
// PROCEDURAL AUDIO LOOP SYNTHESIZER
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let currentLoopTimer: number | null = null;
let isBeatLoopRunning = false;
let activeBeatId: string | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const unlockBeatsAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockBeatsAudio, { passive: true });
  window.addEventListener('click', unlockBeatsAudio, { passive: true });
  window.addEventListener('touchstart', unlockBeatsAudio, { passive: true });
}

function playKick(ctx: AudioContext, time: number, isLog = false) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = isLog ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(isLog ? 140 : 160, time);
  osc.frequency.exponentialRampToValueAtTime(isLog ? 65 : 45, time + 0.12);

  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + (isLog ? 0.22 : 0.18));

  osc.start(time);
  osc.stop(time + (isLog ? 0.25 : 0.2));
}

function playSnare(ctx: AudioContext, time: number, isRim = false) {
  // Noise buffer for snare/clap crackle
  const bufferSize = ctx.sampleRate * 0.1;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = isRim ? 'highpass' : 'bandpass';
  filter.frequency.value = isRim ? 1800 : 1000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + (isRim ? 0.08 : 0.14));

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(time);
  noise.stop(time + 0.15);
}

function playHiHat(ctx: AudioContext, time: number, isRoll = false) {
  const bufferSize = ctx.sampleRate * 0.04;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6500;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isRoll ? 0.22 : 0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.005, time + (isRoll ? 0.03 : 0.045));

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(time);
  noise.stop(time + 0.05);
}

function playBassNote(ctx: AudioContext, time: number, freq: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.9, time + duration);

  gain.gain.setValueAtTime(0.45, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

  osc.start(time);
  osc.stop(time + duration + 0.05);
}

export function startBeatAudioLoop(beatId: string) {
  if (typeof window === 'undefined') return;
  stopBeatAudioLoop();

  const def = BEAT_LIBRARY.find((b) => b.id === beatId) || BEAT_LIBRARY[0];
  const ctx = getAudioContext();
  isBeatLoopRunning = true;
  activeBeatId = beatId;

  const bpm = def.bpm;
  const beatDuration = 60 / bpm;
  const measureDuration = beatDuration * 4; // 4 beats per bar
  let step = 0;

  const intervalMs = (beatDuration / 4) * 1000; // 16th note steps

  currentLoopTimer = window.setInterval(() => {
    if (!isBeatLoopRunning) return;
    const now = ctx.currentTime;
    const current16th = step % 16;

    // Pattern for Afrobeat / Amapiano / Drill
    if (def.name.includes('Drill')) {
      // Drill: Kick on 1 and 3.5, sharp snare on 3, sliding bass
      if (current16th === 0 || current16th === 10) playKick(ctx, now);
      if (current16th === 8) playSnare(ctx, now);
      // Hi-hat roll pattern
      if (current16th % 2 === 0 || current16th === 7 || current16th === 15) {
        playHiHat(ctx, now, current16th === 7 || current16th === 15);
      }
      if (current16th === 0) playBassNote(ctx, now, 55, beatDuration * 2);
      if (current16th === 8) playBassNote(ctx, now, 48, beatDuration * 1.5);
    } else if (def.name.includes('Amapiano')) {
      // Amapiano: Bouncy kick, shakers on every 16th, signature log drum on offbeats
      if (current16th % 4 === 0) playKick(ctx, now);
      if (current16th === 4 || current16th === 12) playSnare(ctx, now, true);
      playHiHat(ctx, now, true);
      // Log drum hits
      if (current16th === 3 || current16th === 6 || current16th === 11 || current16th === 14) {
        playKick(ctx, now, true);
        playBassNote(ctx, now, 75, beatDuration * 0.7);
      }
    } else {
      // Afrobeat / Trap / Pop: Syncopated Afro groove
      if (current16th === 0 || current16th === 6 || current16th === 10) playKick(ctx, now);
      if (current16th === 4 || current16th === 12) playSnare(ctx, now);
      if (current16th % 2 === 0) playHiHat(ctx, now);
      if (current16th === 0) playBassNote(ctx, now, 65, beatDuration * 1.8);
      if (current16th === 8) playBassNote(ctx, now, 58, beatDuration * 1.5);
    }

    step++;
  }, intervalMs);
}

export function stopBeatAudioLoop() {
  if (currentLoopTimer !== null) {
    clearInterval(currentLoopTimer);
    currentLoopTimer = null;
  }
  isBeatLoopRunning = false;
  activeBeatId = null;
}

export function getActivePlayingBeatId(): string | null {
  return isBeatLoopRunning ? activeBeatId : null;
}
