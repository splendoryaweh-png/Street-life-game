/**
 * Street Life Long Beat Engine - Web Audio API Procedural Synthesizer & Timeline Scheduler
 *
 * ABSOLUTELY NO FX (No car horns, gun sounds, dice shakes, bike revs).
 * ONLY pure musical instruments:
 * - Kick, Snare, Rimshot, Closed Hi-Hat, Open Hat, Shaker, Log Drum
 * - 808 Sub-Bass (Sliding & Punchy)
 * - Grand Piano & Rhodes Keys
 * - Lush Ambient Pads & Cathedral Choir
 * - Orchestral Violins & Cellos
 * - Melodic Saxophone & Royal Brass
 * - Synthesized Formant Vocal Chops
 *
 * Full song structure playback (2-4 minutes) with dynamic section arrangements:
 * [Intro] -> [Verse] -> [Hook] -> [Outro]
 * Supports real-time scrubbing (seek), speed control (0.5x, 1.0x, 1.5x), volume,
 * looping, and AnalyserNode audio visualization.
 */

import {
  LongBeat,
  BeatSection,
  LONG_BEATS_CATALOG,
  getBeatById,
  getSectionAtTime,
} from '../data/longBeatsData';

// Musical Note Frequency Map (Hz)
const NOTE_FREQS: Record<string, number> = {
  // Low Bass / 808 Notes (Octave 1-2)
  'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65,
  'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31,
  'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,

  // Mid Melodic Notes (Octave 3-4)
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61,
  'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23,
  'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,

  // High Lead Notes (Octave 5)
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46,
  'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
};

// Chord Note Dictionaries
const CHORD_NOTES: Record<string, number[]> = {
  'Am': [NOTE_FREQS['A3'], NOTE_FREQS['C4'], NOTE_FREQS['E4']],
  'F': [NOTE_FREQS['F3'], NOTE_FREQS['A3'], NOTE_FREQS['C4']],
  'C': [NOTE_FREQS['C3'], NOTE_FREQS['E3'], NOTE_FREQS['G3']],
  'G': [NOTE_FREQS['G3'], NOTE_FREQS['B3'], NOTE_FREQS['D4']],
  'G/B': [NOTE_FREQS['B2'], NOTE_FREQS['D3'], NOTE_FREQS['G3']],
  'Fm': [NOTE_FREQS['F3'], NOTE_FREQS['G#3'], NOTE_FREQS['C4']],
  'Db': [NOTE_FREQS['C#3'], NOTE_FREQS['F3'], NOTE_FREQS['G#3']],
  'Ab': [NOTE_FREQS['G#3'], NOTE_FREQS['C4'], NOTE_FREQS['D#4']],
  'Eb': [NOTE_FREQS['D#3'], NOTE_FREQS['G3'], NOTE_FREQS['A#3']],
  'Eb/G': [NOTE_FREQS['G2'], NOTE_FREQS['A#2'], NOTE_FREQS['D#3']],
  'Dm': [NOTE_FREQS['D3'], NOTE_FREQS['F3'], NOTE_FREQS['A3']],
  'Dm7': [NOTE_FREQS['D3'], NOTE_FREQS['F3'], NOTE_FREQS['A3'], NOTE_FREQS['C4']],
  'Gm': [NOTE_FREQS['G3'], NOTE_FREQS['A#3'], NOTE_FREQS['D4']],
  'Gm7': [NOTE_FREQS['G3'], NOTE_FREQS['A#3'], NOTE_FREQS['D4'], NOTE_FREQS['F4']],
  'Bbmaj7': [NOTE_FREQS['A#3'], NOTE_FREQS['D4'], NOTE_FREQS['F4'], NOTE_FREQS['A4']],
  'A7': [NOTE_FREQS['A3'], NOTE_FREQS['C#4'], NOTE_FREQS['E4'], NOTE_FREQS['G4']],
  'Cmaj7': [NOTE_FREQS['C3'], NOTE_FREQS['E3'], NOTE_FREQS['G3'], NOTE_FREQS['B3']],
  'Am7': [NOTE_FREQS['A3'], NOTE_FREQS['C4'], NOTE_FREQS['E4'], NOTE_FREQS['G4']],
  'G7': [NOTE_FREQS['G3'], NOTE_FREQS['B3'], NOTE_FREQS['D4'], NOTE_FREQS['F4']],
  'Em': [NOTE_FREQS['E3'], NOTE_FREQS['G3'], NOTE_FREQS['B3']],
  'B7': [NOTE_FREQS['B3'], NOTE_FREQS['D#4'], NOTE_FREQS['F#4'], NOTE_FREQS['A4']],
  'Eb7': [NOTE_FREQS['D#3'], NOTE_FREQS['G3'], NOTE_FREQS['A#3'], NOTE_FREQS['C#4']],
  'Cm': [NOTE_FREQS['C3'], NOTE_FREQS['D#3'], NOTE_FREQS['G3']],
  'D7': [NOTE_FREQS['D3'], NOTE_FREQS['F#3'], NOTE_FREQS['A3'], NOTE_FREQS['C4']],
  'Bm': [NOTE_FREQS['B3'], NOTE_FREQS['D4'], NOTE_FREQS['F#4']],
  'F#': [NOTE_FREQS['F#3'], NOTE_FREQS['A#3'], NOTE_FREQS['C#4']],
  'F#m': [NOTE_FREQS['F#3'], NOTE_FREQS['A3'], NOTE_FREQS['C#4']],
  'D': [NOTE_FREQS['D3'], NOTE_FREQS['F#3'], NOTE_FREQS['A3']],
  'A': [NOTE_FREQS['A3'], NOTE_FREQS['C#4'], NOTE_FREQS['E4']],
  'E': [NOTE_FREQS['E3'], NOTE_FREQS['G#3'], NOTE_FREQS['B3']],
  'E7': [NOTE_FREQS['E3'], NOTE_FREQS['G#3'], NOTE_FREQS['B3'], NOTE_FREQS['D4']],
  'Bbm': [NOTE_FREQS['A#3'], NOTE_FREQS['C#4'], NOTE_FREQS['F4']],
  'Gb': [NOTE_FREQS['F#3'], NOTE_FREQS['A#3'], NOTE_FREQS['C#4']],
  'Bb': [NOTE_FREQS['A#3'], NOTE_FREQS['D4'], NOTE_FREQS['F4']],
};

// Lead Melody Scale notes per scale key
const SCALE_LEAD_NOTES: Record<string, number[]> = {
  'A Minor': [NOTE_FREQS['A4'], NOTE_FREQS['C5'], NOTE_FREQS['D5'], NOTE_FREQS['E5'], NOTE_FREQS['G5']],
  'F Minor': [NOTE_FREQS['F4'], NOTE_FREQS['G#4'], NOTE_FREQS['A#4'], NOTE_FREQS['C5'], NOTE_FREQS['D#5']],
  'D Minor': [NOTE_FREQS['D4'], NOTE_FREQS['F4'], NOTE_FREQS['G4'], NOTE_FREQS['A4'], NOTE_FREQS['C5']],
  'C Major': [NOTE_FREQS['C4'], NOTE_FREQS['E4'], NOTE_FREQS['G4'], NOTE_FREQS['A4'], NOTE_FREQS['C5']],
  'E Minor': [NOTE_FREQS['E4'], NOTE_FREQS['G4'], NOTE_FREQS['A4'], NOTE_FREQS['B4'], NOTE_FREQS['D5']],
  'G Minor': [NOTE_FREQS['G4'], NOTE_FREQS['A#4'], NOTE_FREQS['C5'], NOTE_FREQS['D5'], NOTE_FREQS['F5']],
  'A Blues Funk': [NOTE_FREQS['A4'], NOTE_FREQS['C5'], NOTE_FREQS['D5'], NOTE_FREQS['D#5'], NOTE_FREQS['E5'], NOTE_FREQS['G5']],
  'B Minor': [NOTE_FREQS['B4'], NOTE_FREQS['D5'], NOTE_FREQS['E5'], NOTE_FREQS['F#5'], NOTE_FREQS['A5']],
  'F# Minor': [NOTE_FREQS['F#4'], NOTE_FREQS['A4'], NOTE_FREQS['B4'], NOTE_FREQS['C#5'], NOTE_FREQS['E5']],
  'Bb Minor': [NOTE_FREQS['A#4'], NOTE_FREQS['C#5'], NOTE_FREQS['D#5'], NOTE_FREQS['F5'], NOTE_FREQS['G#5']],
  'Ab Major': [NOTE_FREQS['G#4'], NOTE_FREQS['C5'], NOTE_FREQS['D#5'], NOTE_FREQS['F5'], NOTE_FREQS['G#5']],
  'A Minor Multi-Phase': [NOTE_FREQS['A4'], NOTE_FREQS['C5'], NOTE_FREQS['D5'], NOTE_FREQS['E5'], NOTE_FREQS['G5']],
};

export class LongBeatAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active Playback State
  private currentBeat: LongBeat | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private playbackRate: number = 1.0; // 0.5, 1.0, 1.5
  private volume: number = 0.85;
  private isLooping: boolean = true;

  // Timeline tracking
  private playStartTime: number = 0; // Context time when current playback started
  private startOffsetSeconds: number = 0; // Seconds offset into the song
  private pauseElapsedSeconds: number = 0;
  private scheduledStep: number = 0;
  private scheduleTimer: number | null = null;
  private lastReportedSeconds: number = -1;

  // Active nodes cleanup tracker
  private activeVoices: { stop: () => void }[] = [];

  // Callbacks
  private onTimeUpdateCbs: Set<(currentTime: number, section: BeatSection) => void> = new Set();
  private onSectionChangeCbs: Set<(section: BeatSection) => void> = new Set();
  private onStateChangeCbs: Set<(isPlaying: boolean) => void> = new Set();
  private onEndCbs: Set<() => void> = new Set();

  private currentSectionCache: BeatSection | null = null;

  constructor() {
    // Lazy AudioContext initialization on user gesture
  }

  private initAudio() {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Analyser for UI visualizers
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Auto-resume if browser suspends context when mic or camera is accessed
      this.ctx.onstatechange = () => {
        if (this.isRunning && !this.isPaused && this.ctx?.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private streamDestination: MediaStreamAudioDestinationNode | null = null;

  public getMediaStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.initAudio();
    if (!this.ctx || !this.masterGain) return null;
    if (!this.streamDestination && typeof this.ctx.createMediaStreamDestination === 'function') {
      try {
        this.streamDestination = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.streamDestination);
      } catch (e) {
        console.warn('Stream destination fallback:', e);
      }
    }
    return this.streamDestination;
  }

  public async ensureRunning(): Promise<void> {
    this.initAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
  }

  // =========================================================================
  // INSTRUMENT SYNTHESIS METHODS (CLEAN - ZERO FX)
  // =========================================================================

  /**
   * Clean Kick Drum
   */
  private playKick(time: number, isDouble: boolean = false, isLog: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isLog ? 'triangle' : 'sine';
    const startFreq = isLog ? 180 : 160;
    const endFreq = isLog ? 60 : 42;
    const decay = isDouble ? 0.12 : isLog ? 0.22 : 0.24;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    gain.gain.setValueAtTime(isDouble ? 0.75 : 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + decay + 0.02);
  }

  /**
   * Deep 808 Sub-Bass with Slide capability
   */
  private play808(time: number, freq: number, duration: number, slideFreq?: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    if (slideFreq && slideFreq !== freq) {
      // Smooth pitch slide for drill & trap 808
      osc.frequency.exponentialRampToValueAtTime(slideFreq, time + duration * 0.4);
    }

    // Warm sub envelope
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /**
   * Clean Snare / Rimshot / Clap
   */
  private playSnare(time: number, isRim: boolean = false, isRoll: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Noise component
    const bufferSize = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = isRim ? 'highpass' : 'bandpass';
    filter.frequency.setValueAtTime(isRim ? 2200 : 1200, time);
    filter.Q.setValueAtTime(2.0, time);

    const gain = ctx.createGain();
    const vol = isRoll ? 0.3 : isRim ? 0.45 : 0.65;
    const decay = isRim ? 0.08 : isRoll ? 0.07 : 0.16;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + decay + 0.02);

    // Body tonal fundamental
    if (!isRim) {
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(180, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(90, time + 0.08);

      bodyGain.gain.setValueAtTime(0.35, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.005, time + 0.09);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);

      bodyOsc.start(time);
      bodyOsc.stop(time + 0.1);
    }
  }

  /**
   * Clean Hi-Hat (Closed / Open / Roll)
   */
  private playHiHat(time: number, isOpen: boolean = false, isRoll: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const bufferSize = Math.floor(ctx.sampleRate * (isOpen ? 0.28 : 0.05));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isOpen ? 5500 : 7500, time);

    const gain = ctx.createGain();
    const decay = isOpen ? 0.25 : isRoll ? 0.03 : 0.045;
    const vol = isOpen ? 0.35 : isRoll ? 0.22 : 0.28;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + decay + 0.01);
  }

  /**
   * Shaker / Percussion
   */
  private playShaker(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(8000, time);
    filter.Q.setValueAtTime(3.5, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + 0.035);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  /**
   * Grand Piano / Rhodes Keys Chords
   */
  private playPianoChord(time: number, chordName: string, duration: number, isRhodes: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const freqs = CHORD_NOTES[chordName] || [220, 261, 329];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isRhodes ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      // Acoustic piano attack and soft decay
      const attack = isRhodes ? 0.015 : 0.008;
      const vel = (0.28 / freqs.length) * (idx === 0 ? 1.2 : 0.9);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vel, time + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  /**
   * Warm Ambient Pad / Cathedral Choir Swell
   */
  private playPadSwell(time: number, chordName: string, duration: number, isChoir: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const freqs = CHORD_NOTES[chordName] || [220, 261, 329];

    freqs.forEach((freq) => {
      // Twin detuned oscillators for lush warmth
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = isChoir ? 'triangle' : 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.004, time); // detune chorus

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isChoir ? 950 : 750, time);
      filter.frequency.linearRampToValueAtTime(isChoir ? 1500 : 1100, time + duration * 0.5);

      // Gentle swell envelope
      const attackTime = duration * 0.3;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.12, time + attackTime);
      gain.gain.linearRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.1);
      osc2.stop(time + duration + 0.1);
    });
  }

  /**
   * Orchestral Strings Layer
   */
  private playStrings(time: number, chordName: string, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const freqs = CHORD_NOTES[chordName] || [220, 261, 329];

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 2, time); // Higher octave for violins

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.1, time + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  /**
   * Melodic Saxophone / Royal Brass Lead
   */
  private playBrassLead(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    // Brassy filter bite
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.linearRampToValueAtTime(2800, time + 0.08);
    filter.frequency.exponentialRampToValueAtTime(1400, time + duration);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /**
   * Synthesized Formant Vocal Chop Melody ('Aah'/'Ooh')
   */
  private playVocalChop(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const formantFilter1 = ctx.createBiquadFilter();
    const formantFilter2 = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    // Formant peaks for vocal vowel sensation (around 800Hz and 1300Hz)
    formantFilter1.type = 'bandpass';
    formantFilter1.frequency.setValueAtTime(800, time);
    formantFilter1.Q.setValueAtTime(5.0, time);

    formantFilter2.type = 'bandpass';
    formantFilter2.frequency.setValueAtTime(1300, time);
    formantFilter2.Q.setValueAtTime(4.0, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.25, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(formantFilter1);
    osc.connect(formantFilter2);
    formantFilter1.connect(gain);
    formantFilter2.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // =========================================================================
  // TIMELINE SCHEDULING & ARRANGER
  // =========================================================================

  /**
   * Schedules one 16th-note subdivision step based on current song position and section
   */
  private scheduleStepAt(timeInSong: number, audioTime: number) {
    if (!this.currentBeat) return;
    const beat = this.currentBeat;
    const section = getSectionAtTime(beat, timeInSong);

    // Dynamic BPM handling for multiphase beats (like Beat 10: 105 -> 160 -> 145 -> 88)
    let effectiveBpm = beat.bpm;
    if (beat.id === 'long_beat_10') {
      if (timeInSong < 60) effectiveBpm = 105;
      else if (timeInSong < 120) effectiveBpm = 160;
      else if (timeInSong < 180) effectiveBpm = 145;
      else effectiveBpm = 88;
    }

    const beatDuration = (60 / effectiveBpm) * (1 / this.playbackRate);
    const stepDuration = beatDuration / 4; // 16th note step
    const measureDuration = beatDuration * 4;

    const measureIndex = Math.floor(timeInSong / measureDuration);
    const stepInMeasure = Math.floor((timeInSong % measureDuration) / stepDuration);

    // Current chord progression cycle
    const chordIndex = measureIndex % beat.chords.length;
    const currentChord = beat.chords[chordIndex] || 'Am';
    const isDownbeat = stepInMeasure === 0;

    // SECTION INSTRUMENT ARRANGEMENT LOGIC
    const isIntro = section.type === 'intro';
    const isVerse = section.type === 'verse';
    const isHook = section.type === 'hook';
    const isBridge = section.type === 'bridge';
    const isOutro = section.type === 'outro';

    // 1. HARMONY (Pianokeys, Pad, Strings)
    if (isDownbeat) {
      if (isIntro || isVerse || isHook || isOutro || isBridge) {
        const isRhodes = beat.genre.includes('Lo-fi') || beat.genre.includes('Amapiano');
        this.playPianoChord(audioTime, currentChord, measureDuration * 0.95, isRhodes);
      }

      if (isIntro || isHook || isBridge) {
        const isChoir = beat.genre.includes('Gospel') || beat.mood.includes('Victory');
        this.playPadSwell(audioTime, currentChord, measureDuration * 0.98, isChoir);
      }

      if (isHook || beat.genre.includes('Orchestra') || beat.genre.includes('War')) {
        this.playStrings(audioTime, currentChord, measureDuration * 0.95);
      }
    }

    // 2. DRUMS & PERCUSSION (Different patterns per section!)
    if (!isIntro || (isIntro && timeInSong >= 15)) {
      if (!isOutro || timeInSong < beat.duration - 20) {
        // Kick Pattern
        if (beat.genre.includes('Drill') || beat.genre.includes('Fast')) {
          // Drill kick on 0 and 10 (or 0 and 11)
          if (stepInMeasure === 0 || stepInMeasure === 10) {
            this.playKick(audioTime, false);
          }
          if (isHook && (stepInMeasure === 6 || stepInMeasure === 14)) {
            // Double kick in hook
            this.playKick(audioTime, true);
          }
        } else if (beat.genre.includes('Amapiano')) {
          // Four on the floor kick
          if (stepInMeasure % 4 === 0) {
            this.playKick(audioTime, false);
          }
          // Log drum bounces on syncopated 16ths
          if (stepInMeasure === 3 || stepInMeasure === 6 || stepInMeasure === 11) {
            this.playKick(audioTime, false, true);
          }
        } else {
          // Standard Afro / HipHop Kick
          if (stepInMeasure === 0 || stepInMeasure === 6 || stepInMeasure === 10) {
            this.playKick(audioTime, false);
          }
          if (isHook && stepInMeasure === 14) {
            this.playKick(audioTime, true);
          }
        }

        // Snare / Rim Pattern
        if (beat.genre.includes('Drill')) {
          // Drill snare on 8
          if (stepInMeasure === 8) {
            this.playSnare(audioTime, false);
          }
          if (isHook && (stepInMeasure === 15)) {
            this.playSnare(audioTime, false, true); // roll
          }
        } else {
          // Regular snare on 4 and 12
          if (stepInMeasure === 4 || stepInMeasure === 12) {
            this.playSnare(audioTime, isVerse);
          }
        }

        // Hi-Hat Pattern
        if (beat.genre.includes('Drill')) {
          // Drill triplet & rolling hats
          if (stepInMeasure % 2 === 0 || stepInMeasure === 7 || stepInMeasure === 11 || stepInMeasure === 15) {
            const isRoll = stepInMeasure === 7 || stepInMeasure === 15;
            this.playHiHat(audioTime, false, isRoll);
          }
          if (isHook && stepInMeasure === 2) {
            this.playHiHat(audioTime, true); // Open hat
          }
        } else if (beat.genre.includes('Amapiano')) {
          // Shaker continuous pulse
          this.playShaker(audioTime);
          if (stepInMeasure % 2 === 0) {
            this.playHiHat(audioTime, false);
          }
        } else {
          // Standard groove
          if (stepInMeasure % 2 === 0) {
            this.playHiHat(audioTime, false);
          }
          if (isHook && stepInMeasure === 2) {
            this.playHiHat(audioTime, true);
          }
        }
      }
    }

    // 3. 808 SUB-BASS (Enters in Verse & explodes in Hook)
    if (isVerse || isHook || isBridge) {
      if (stepInMeasure === 0 || (isHook && stepInMeasure === 8)) {
        const rootFreq = NOTE_FREQS['A1'] || 55;
        const slideTarget = isHook ? (NOTE_FREQS['D2'] || 73) : undefined;
        this.play808(audioTime, rootFreq, beatDuration * 1.8, slideTarget);
      }
    }

    // 4. MELODIC LEAD / SAX / VOCAL CHOP (Prominent in Hook)
    if (isHook) {
      const scaleNotes = SCALE_LEAD_NOTES[beat.keyScale] || [440, 523, 587, 659];
      const leadNote = scaleNotes[stepInMeasure % scaleNotes.length];

      if (stepInMeasure === 0 || stepInMeasure === 4 || stepInMeasure === 8 || stepInMeasure === 10) {
        if (beat.genre.includes('Sax') || beat.tags.includes('Electric Sax') || beat.genre.includes('Afro Fusion')) {
          this.playBrassLead(audioTime, leadNote, stepDuration * 2);
        } else if (beat.genre.includes('Gospel') || beat.tags.includes('Vocal Chops')) {
          this.playVocalChop(audioTime, leadNote, stepDuration * 2.5);
        } else {
          this.playBrassLead(audioTime, leadNote, stepDuration * 2);
        }
      }
    }
  }

  // =========================================================================
  // MAIN PLAYBACK CONTROLLER
  // =========================================================================

  public async play(beatId: string, startFromSeconds: number = 0) {
    this.initAudio();
    if (!this.ctx) return;

    const beat = getBeatById(beatId) || LONG_BEATS_CATALOG[0];
    this.currentBeat = beat;

    // Stop any existing loop
    this.stopPlaybackTimer();

    this.isRunning = true;
    this.isPaused = false;
    this.startOffsetSeconds = Math.max(0, Math.min(startFromSeconds, beat.duration - 0.5));
    this.playStartTime = this.ctx.currentTime;
    this.lastReportedSeconds = -1;

    // Notify state
    this.notifyStateChange(true);

    // Setup timeline tick loop (runs every 35ms, scheduling notes ahead of time)
    const LOOKAHEAD_SEC = 0.12;
    let nextScheduleTime = this.ctx.currentTime;
    let internalSongSeconds = this.startOffsetSeconds;

    const tick = () => {
      if (!this.isRunning || !this.ctx || this.isPaused) return;

      const now = this.ctx.currentTime;
      const currentElapsed = (now - this.playStartTime) * this.playbackRate + this.startOffsetSeconds;

      // Check for song end or loop
      if (currentElapsed >= beat.duration) {
        if (this.isLooping) {
          // Loop song back to 0
          this.startOffsetSeconds = 0;
          this.playStartTime = this.ctx.currentTime;
          internalSongSeconds = 0;
        } else {
          this.stop();
          this.onEndCbs.forEach((cb) => cb());
          return;
        }
      }

      // Schedule notes that fall into lookahead window
      while (nextScheduleTime < now + LOOKAHEAD_SEC) {
        this.scheduleStepAt(internalSongSeconds, nextScheduleTime);

        // Advance 16th note step based on current BPM
        let bpm = beat.bpm;
        if (beat.id === 'long_beat_10') {
          if (internalSongSeconds < 60) bpm = 105;
          else if (internalSongSeconds < 120) bpm = 160;
          else if (internalSongSeconds < 180) bpm = 145;
          else bpm = 88;
        }

        const stepSec = (60 / bpm / 4) * (1 / this.playbackRate);
        nextScheduleTime += stepSec;
        internalSongSeconds += stepSec * this.playbackRate;
      }

      // Report UI time updates
      const roundedSeconds = Math.floor(currentElapsed);
      if (roundedSeconds !== this.lastReportedSeconds) {
        this.lastReportedSeconds = roundedSeconds;
        const currentSec = getSectionAtTime(beat, currentElapsed);

        if (!this.currentSectionCache || this.currentSectionCache.name !== currentSec.name) {
          this.currentSectionCache = currentSec;
          this.onSectionChangeCbs.forEach((cb) => cb(currentSec));
        }

        this.onTimeUpdateCbs.forEach((cb) => cb(currentElapsed, currentSec));
      }

      this.scheduleTimer = window.setTimeout(tick, 35);
    };

    tick();
  }

  public pause() {
    if (!this.isRunning || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    this.pauseElapsedSeconds = (this.ctx.currentTime - this.playStartTime) * this.playbackRate + this.startOffsetSeconds;
    this.stopPlaybackTimer();
    this.notifyStateChange(false);
  }

  public resume() {
    if (!this.isRunning || !this.isPaused || !this.currentBeat) return;
    this.play(this.currentBeat.id, this.pauseElapsedSeconds);
  }

  public stop() {
    this.stopPlaybackTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.startOffsetSeconds = 0;
    this.currentSectionCache = null;
    this.notifyStateChange(false);
  }

  public seek(seconds: number) {
    if (!this.currentBeat) return;
    const clamped = Math.max(0, Math.min(seconds, this.currentBeat.duration - 0.5));
    if (this.isRunning && !this.isPaused) {
      this.play(this.currentBeat.id, clamped);
    } else {
      this.startOffsetSeconds = clamped;
      this.pauseElapsedSeconds = clamped;
      const sec = getSectionAtTime(this.currentBeat, clamped);
      this.onTimeUpdateCbs.forEach((cb) => cb(clamped, sec));
    }
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(rate, 2.0));
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(vol, 1.0));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public toggleLoop(forced?: boolean): boolean {
    this.isLooping = forced !== undefined ? forced : !this.isLooping;
    return this.isLooping;
  }

  public getCurrentTime(): number {
    if (!this.isRunning || !this.ctx) return this.startOffsetSeconds;
    if (this.isPaused) return this.pauseElapsedSeconds;
    return (this.ctx.currentTime - this.playStartTime) * this.playbackRate + this.startOffsetSeconds;
  }

  public getDuration(): number {
    return this.currentBeat ? this.currentBeat.duration : 180;
  }

  public isPlaying(): boolean {
    return this.isRunning && !this.isPaused;
  }

  public getCurrentBeat(): LongBeat | null {
    return this.currentBeat;
  }

  public getCurrentSection(): BeatSection | null {
    return this.currentSectionCache;
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsLooping(): boolean {
    return this.isLooping;
  }

  // Visualizer Analyser Frequency / Waveform byte arrays
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  // Event Subscriptions
  public onTimeUpdate(cb: (currentTime: number, section: BeatSection) => void): () => void {
    this.onTimeUpdateCbs.add(cb);
    return () => this.onTimeUpdateCbs.delete(cb);
  }

  public onSectionChange(cb: (section: BeatSection) => void): () => void {
    this.onSectionChangeCbs.add(cb);
    return () => this.onSectionChangeCbs.delete(cb);
  }

  public onStateChange(cb: (isPlaying: boolean) => void): () => void {
    this.onStateChangeCbs.add(cb);
    return () => this.onStateChangeCbs.delete(cb);
  }

  public onEnd(cb: () => void): () => void {
    this.onEndCbs.add(cb);
    return () => this.onEndCbs.delete(cb);
  }

  private notifyStateChange(isPlaying: boolean) {
    this.onStateChangeCbs.forEach((cb) => cb(isPlaying));
  }

  private stopPlaybackTimer() {
    if (this.scheduleTimer !== null) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  public destroy() {
    this.stop();
    this.onTimeUpdateCbs.clear();
    this.onSectionChangeCbs.clear();
    this.onStateChangeCbs.clear();
    this.onEndCbs.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

// Global Singleton Instance for seamless studio playback
export const longBeatEngine = new LongBeatAudioEngine();
