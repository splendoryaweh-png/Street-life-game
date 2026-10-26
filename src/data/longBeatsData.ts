/**
 * Street Life Long Beats Data
 * Complete catalog of 14 Long Beats (2-4 minutes each) with structured musical sections:
 * [Intro] -> [Verse] -> [Hook] -> [Outro]
 *
 * UNLOCK SYSTEM:
 * - Level 0: 4 Free Beats (Beats 1 to 4)
 * - Level 1: 5 Beats (4 Free + 1 Locked: Beat 5)
 * - Level 2: 7 Beats (4 Free + 3 Locked: Beats 5, 6, 7)
 * - Level 3: 8 Beats (4 Free + 4 Locked: Beats 5, 6, 7, 8; or 10 total)
 * - Level 4: 14 Beats (All 14 Beats Unlocked - Complete MAX)
 *
 * STRICT REQUIREMENT: NO FX (No car horn, no gun sound, no dice shake, no bike rev).
 * Only clean musical instruments: Drums, 808, Sub-Bass, Piano, Pad, Strings, Sax/Brass, Vocal Chops.
 */

export type BeatSectionType = 'intro' | 'verse' | 'hook' | 'bridge' | 'outro';

export interface BeatSection {
  type: BeatSectionType;
  name: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  instruments: string[]; // e.g. ['piano', 'pad', '808', 'kick', 'snare', 'hihat']
  description: string;
  color: string; // Tailwind color class for progress segments
}

export interface LongBeat {
  id: string;
  number: number;
  name: string;
  duration: number; // in seconds
  bpm: number;
  genre: string;
  mood: string;
  story: string;
  producer: string;
  isFree: boolean;
  requiredStudioLevel: number;
  coverGradient: string;
  accentColor: string;
  icon: string;
  chords: string[];
  keyScale: string;
  sections: BeatSection[];
  tags: string[];
}

export const STUDIO_LEVELS = [
  {
    level: 0,
    name: 'Ghetto Studio (Starter)',
    shortName: 'Level 0 - Starter',
    unlockedCount: 4,
    description: '4 Free long beats unlocked from start. Perfect for kicking off your hustle.',
    upgradeCost: 0,
    badge: 'STARTER',
    color: 'from-amber-500 to-yellow-600',
  },
  {
    level: 1,
    name: 'Street Studio Pro',
    shortName: 'Level 1 - Pro',
    unlockedCount: 5,
    description: 'Unlocks Beat 5: 7KM Chase (160 BPM High Tension Drill).',
    upgradeCost: 25000,
    badge: 'STREET PRO',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    level: 2,
    name: 'Underground Syndicate Studio',
    shortName: 'Level 2 - Syndicate',
    unlockedCount: 7,
    description: 'Unlocks Beats 6, 7 & 8: Turf War Anthem, Dice Hustler Blues & Ghost Mode.',
    upgradeCost: 60000,
    badge: 'SYNDICATE',
    color: 'from-purple-500 to-violet-700',
  },
  {
    level: 3,
    name: 'Hitmaker Mansion Studio',
    shortName: 'Level 3 - Hitmaker',
    unlockedCount: 8,
    description: 'Unlocks Beats 9 & 10: From Trenches To Mansion & 4-Min Mega Mix Finale.',
    upgradeCost: 120000,
    badge: 'HITMAKER',
    color: 'from-rose-500 to-pink-700',
  },
  {
    level: 4,
    name: 'Celebrity Platinum Empire Studio',
    shortName: 'Level 4 - Celebrity MAX',
    unlockedCount: 14,
    description: 'ALL 14 Long Beats unlocked. Supreme acoustic polish and unlimited playback.',
    upgradeCost: 250000,
    badge: 'PLATINUM MAX',
    color: 'from-amber-400 via-[#FFD700] to-yellow-300',
  },
];

export const LONG_BEATS_CATALOG: LongBeat[] = [
  // =========================================================================
  // FREE 4 BEATS (Level 0 - Starter)
  // =========================================================================
  {
    id: 'long_beat_1',
    number: 1,
    name: 'Lagos Night Drive',
    duration: 180, // 3:00
    bpm: 130,
    genre: 'Afro Fusion x Drill',
    mood: 'Chill Gangster',
    story: 'Night cruise on Third Mainland Bridge with ambient city neon reflections.',
    producer: 'Prod. Augustine & Gammy',
    isFree: true,
    requiredStudioLevel: 0,
    coverGradient: 'from-purple-900 via-indigo-800 to-orange-500',
    accentColor: '#A855F7',
    icon: '🌃',
    chords: ['Am', 'F', 'C', 'G'],
    keyScale: 'A Minor',
    tags: ['Night Drive', 'Drill 808', 'Electric Sax', 'Chill Vibe'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Night Ambience',
        startTime: 0,
        endTime: 20,
        instruments: ['soft piano', 'warm ambient pad'],
        description: 'Atmospheric piano arpeggio with soft background pad setting nocturnal mood.',
        color: 'bg-indigo-600',
      },
      {
        type: 'verse',
        name: 'Verse 1: Lagos Streets',
        startTime: 20,
        endTime: 70,
        instruments: ['808 bass', 'tight kick', 'trap hi-hat', 'piano chords'],
        description: 'Deep sliding 808 bassline and syncopated trap hi-hats enter for rap flow.',
        color: 'bg-blue-600',
      },
      {
        type: 'hook',
        name: 'Main Hook: Skyline Sax Drop',
        startTime: 70,
        endTime: 140,
        instruments: ['full drums', 'rolling 808', 'melodic sax', 'open hats', 'piano'],
        description: 'Full energy drop featuring soaring synthetic saxophone lead and double kicks.',
        color: 'bg-amber-500',
      },
      {
        type: 'outro',
        name: 'Outro: Midnight Fade',
        startTime: 140,
        endTime: 180,
        instruments: ['soft piano', 'lo-fi pad', 'sub bass fade'],
        description: 'Smooth harmonic decay leaving gentle acoustic piano chords into the night.',
        color: 'bg-purple-700',
      },
    ],
  },
  {
    id: 'long_beat_2',
    number: 2,
    name: 'Ghetto Gospel',
    duration: 165, // 2:45
    bpm: 115,
    genre: 'Afro Street x Trap Soul',
    mood: 'Emotional Hustle',
    story: 'Struggles from the hood turned into heartfelt praise, triumph, and brotherhood.',
    producer: 'Prod. Street Life Stars',
    isFree: true,
    requiredStudioLevel: 0,
    coverGradient: 'from-amber-950 via-yellow-900 to-amber-600',
    accentColor: '#F59E0B',
    icon: '🕊️',
    chords: ['Fm', 'Db', 'Ab', 'Eb'],
    keyScale: 'F Minor',
    tags: ['Gospel Pad', 'Vocal Chops', 'Soul Trap', 'Tears & Glory'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Choir Awakening',
        startTime: 0,
        endTime: 15,
        instruments: ['choir pad', 'rhodes piano'],
        description: 'Reverberant organ-pad layers and emotional rhodes chords.',
        color: 'bg-amber-700',
      },
      {
        type: 'verse',
        name: 'Verse 1: Hustle Diary',
        startTime: 15,
        endTime: 60,
        instruments: ['storytelling flow drums', 'sub-bass', 'soft hi-hats', 'rhodes keys'],
        description: 'Clean acoustic rimshot, deep sub pulse, and steady rhythm for lyrical storytelling.',
        color: 'bg-yellow-600',
      },
      {
        type: 'hook',
        name: 'Hook: Vocal Anthem',
        startTime: 60,
        endTime: 120,
        instruments: ['vocal chop melody', 'full 808', 'trap snare', 'choir wash', 'bells'],
        description: 'Uplifting vocal chop melody with booming 808s and emotional choir backing.',
        color: 'bg-emerald-500',
      },
      {
        type: 'outro',
        name: 'Outro: Quiet Prayer',
        startTime: 120,
        endTime: 165,
        instruments: ['choir pad', 'soft keys', 'harmonic swell'],
        description: 'Gentle pad chords slowly fading out as acoustic bells ring softly.',
        color: 'bg-stone-700',
      },
    ],
  },
  {
    id: 'long_beat_3',
    number: 3,
    name: 'Oja Market Hustle',
    duration: 155, // 2:35
    bpm: 115,
    genre: 'Amapiano x Street',
    mood: 'Bouncy Market',
    story: 'High-energy commerce, street vendors shouting prices, unstoppable festive rhythm.',
    producer: 'Prod. Gammy & Augustine',
    isFree: true,
    requiredStudioLevel: 0,
    coverGradient: 'from-emerald-950 via-teal-900 to-emerald-500',
    accentColor: '#10B981',
    icon: '🥁',
    chords: ['Dm7', 'Gm7', 'Bbmaj7', 'A7'],
    keyScale: 'D Minor',
    tags: ['Amapiano', 'Log Drums', 'Market Groove', 'Percussion'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Morning Market',
        startTime: 0,
        endTime: 15,
        instruments: ['soft electric keys', 'shaker groove'],
        description: 'Syncopated shaker pattern and bright Rhodes keys preparing the bounce.',
        color: 'bg-teal-700',
      },
      {
        type: 'verse',
        name: 'Verse 1: Log Drum Entry',
        startTime: 15,
        endTime: 60,
        instruments: ['resonant log drums', 'four-on-floor kick', 'wood rim', 'shakers'],
        description: 'Signature South African log drums start bouncing with heavy low-end groove.',
        color: 'bg-emerald-600',
      },
      {
        type: 'hook',
        name: 'Hook: Festive Market Climax',
        startTime: 60,
        endTime: 120,
        instruments: ['double log drums', 'snare rolls', 'brass stabs', 'fast shaker bounce'],
        description: 'Faster polyrhythmic Amapiano bounce with harmonic brass stabs.',
        color: 'bg-lime-500',
      },
      {
        type: 'outro',
        name: 'Outro: Market Closing',
        startTime: 120,
        endTime: 155,
        instruments: ['log drum solo', 'ambient keys', 'fadeout'],
        description: 'Minimal log drum groove winding down gracefully to silence.',
        color: 'bg-emerald-900',
      },
    ],
  },
  {
    id: 'long_beat_4',
    number: 4,
    name: 'Rider Queen',
    duration: 170, // 2:50
    bpm: 88,
    genre: 'Lo-fi x Afro R&B',
    mood: 'Chill Ride',
    story: 'Late night motorbike glide with your favorite girl holding tight through warm rain.',
    producer: 'Prod. Augustine',
    isFree: true,
    requiredStudioLevel: 0,
    coverGradient: 'from-rose-950 via-pink-900 to-pink-600',
    accentColor: '#EC4899',
    icon: '🏍️',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
    keyScale: 'C Major',
    tags: ['Lo-fi Beats', 'Smooth R&B', 'Rain Pad', 'Relaxed Flow'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Warm Raindrops',
        startTime: 0,
        endTime: 20,
        instruments: ['lo-fi rain pad', 'electric piano chords'],
        description: 'Vintage warm tape-filtered electric piano chords with soft rain ambience.',
        color: 'bg-rose-800',
      },
      {
        type: 'verse',
        name: 'Verse 1: Smooth Cruise',
        startTime: 20,
        endTime: 70,
        instruments: ['soft kick', 'warm sub bass', 'laid-back snap', 'guitar riff'],
        description: 'Gentle boom-bap acoustic groove with warm melodic sub-bass.',
        color: 'bg-pink-700',
      },
      {
        type: 'hook',
        name: 'Hook: Female Hum Melody',
        startTime: 70,
        endTime: 130,
        instruments: ['synthesized vocal hum melody', 'strings layer', 'full soft drums', 'rhodes'],
        description: 'Sensual vocal hum synth melody over lush strings and bouncing kick.',
        color: 'bg-fuchsia-500',
      },
      {
        type: 'outro',
        name: 'Outro: Horizon Sunset',
        startTime: 130,
        endTime: 170,
        instruments: ['guitar solo notes', 'rain pad fade'],
        description: 'Plucked melodic notes trailing off into tape saturation silence.',
        color: 'bg-pink-950',
      },
    ],
  },

  // =========================================================================
  // LOCKED 10 BEATS (Studio Level 1 to 4)
  // =========================================================================
  {
    id: 'long_beat_5',
    number: 5,
    name: '7KM Chase',
    duration: 150, // 2:30
    bpm: 160,
    genre: 'Fast Drill',
    mood: 'Racing Tension',
    story: 'High speed police pursuit across the 7-kilometer highway under flashing blue lights.',
    producer: 'Prod. Gammy Speedworks',
    isFree: false,
    requiredStudioLevel: 1,
    coverGradient: 'from-red-950 via-red-900 to-orange-600',
    accentColor: '#EF4444',
    icon: '🏎️',
    chords: ['Em', 'C', 'Am', 'B7'],
    keyScale: 'E Minor',
    tags: ['160 BPM', 'High Speed', 'Fast Drill', 'Sliding 808'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Engine Rev Build',
        startTime: 0,
        endTime: 10,
        instruments: ['synth pulse', 'snare build roll'],
        description: 'Urgent ascending synth pulse signaling imminent high-speed chase.',
        color: 'bg-red-800',
      },
      {
        type: 'verse',
        name: 'Verse 1: 160 BPM Drill Fire',
        startTime: 10,
        endTime: 60,
        instruments: ['160 BPM drill drums', 'sliding 808 bass', 'rapid hi-hat triplets'],
        description: 'Blistering fast UK/NY drill beat with sliding low notes and sharp rimshots.',
        color: 'bg-orange-600',
      },
      {
        type: 'hook',
        name: 'Hook: Full Energy Double Kick',
        startTime: 60,
        endTime: 120,
        instruments: ['double kick rush', 'piercing lead synth', 'heavy 808', 'crash cymbals'],
        description: 'Maximum racing adrenaline with ferocious double-time drums.',
        color: 'bg-red-600',
      },
      {
        type: 'outro',
        name: 'Outro: Escape Deceleration',
        startTime: 120,
        endTime: 150,
        instruments: ['tempo deceleration', 'sub bass tail', 'fading synth'],
        description: 'Gradual slow down as player evades police radar into the night.',
        color: 'bg-amber-950',
      },
    ],
  },
  {
    id: 'long_beat_6',
    number: 6,
    name: 'Turf War Anthem',
    duration: 160, // 2:40
    bpm: 145,
    genre: 'War Drill x Orchestra',
    mood: 'Aggressive War',
    story: 'Gang block battle for territory dominance, heavy bass thundering through alleys.',
    producer: 'Prod. Augustine & Gang Syndi',
    isFree: false,
    requiredStudioLevel: 2,
    coverGradient: 'from-zinc-950 via-stone-900 to-red-700',
    accentColor: '#DC2626',
    icon: '⚔️',
    chords: ['Gm', 'Eb', 'Cm', 'D7'],
    keyScale: 'G Minor',
    tags: ['War March', 'Epic Strings', 'Aggressive 808', 'Turf Battle'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: War Drums Marching',
        startTime: 0,
        endTime: 15,
        instruments: ['marching snares', 'low timpani pulse'],
        description: 'Military style drumline marching cadence echoing down city blocks.',
        color: 'bg-zinc-800',
      },
      {
        type: 'verse',
        name: 'Verse 1: Epic Strings & 808',
        startTime: 15,
        endTime: 65,
        instruments: ['cinematic staccato strings', 'crushing 808', 'drill hats'],
        description: 'Menacing orchestral violin staccato intertwined with heavy sub-bass.',
        color: 'bg-stone-700',
      },
      {
        type: 'hook',
        name: 'Hook: Total Block Domination',
        startTime: 65,
        endTime: 125,
        instruments: ['full orchestra brass', 'war horns', 'distorted 808', 'hard snares'],
        description: 'Violent musical clash with symphonic brass stabs and unrelenting drums.',
        color: 'bg-red-700',
      },
      {
        type: 'outro',
        name: 'Outro: Territory Secured',
        startTime: 125,
        endTime: 160,
        instruments: ['strings decay', 'marching snare outro'],
        description: 'Solemn string chords resonating over conquered street corner.',
        color: 'bg-neutral-900',
      },
    ],
  },
  {
    id: 'long_beat_7',
    number: 7,
    name: 'Dice Hustler Blues',
    duration: 140, // 2:20
    bpm: 105,
    genre: 'Street Funk',
    mood: 'Hustle Bounce',
    story: 'Rolling high stakes on the sidewalk cardboard box, funky bassline guiding the rolls.',
    producer: 'Prod. Gammy Groove',
    isFree: false,
    requiredStudioLevel: 2,
    coverGradient: 'from-blue-950 via-slate-900 to-cyan-600',
    accentColor: '#06B6D4',
    icon: '🎲',
    chords: ['A7', 'D7', 'E7', 'A7'],
    keyScale: 'A Blues Funk',
    tags: ['Funk Bass', 'Slap Groove', 'Dice Roll Vibe', 'Old School'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Funky Slap Bassline',
        startTime: 0,
        endTime: 10,
        instruments: ['funky slap bass solo', 'hi-hat pedal'],
        description: 'Infectious live-sounding funky slap bass lick introducing the groove.',
        color: 'bg-blue-900',
      },
      {
        type: 'verse',
        name: 'Verse 1: Bouncy Cardboard Groove',
        startTime: 10,
        endTime: 60,
        instruments: ['funky drums', 'clavinet chops', 'slap bass', 'cowbell syncopation'],
        description: 'Tight 70s-style street funk rhythm with bouncy syncopated drums.',
        color: 'bg-cyan-700',
      },
      {
        type: 'hook',
        name: 'Hook: High Roller Jackpot',
        startTime: 60,
        endTime: 110,
        instruments: ['full brass section', 'wah clavinet', 'dynamic kick', 'shakers'],
        description: 'Euphoric horns and funky guitar chops celebrating big street wins.',
        color: 'bg-teal-500',
      },
      {
        type: 'outro',
        name: 'Outro: Stash The Cash',
        startTime: 110,
        endTime: 140,
        instruments: ['bass solo riff', 'fading hi-hat'],
        description: 'Smooth walking bassline trailing off with classy funk flair.',
        color: 'bg-slate-950',
      },
    ],
  },
  {
    id: 'long_beat_8',
    number: 8,
    name: 'Ghost Mode',
    duration: 190, // 3:10
    bpm: 130,
    genre: 'Dark Trap x Ambient',
    mood: 'Dark Silent',
    story: 'Operating completely off the grid, undetected by cameras, moving like shadows in the fog.',
    producer: 'Prod. Augustine Shadows',
    isFree: false,
    requiredStudioLevel: 2,
    coverGradient: 'from-purple-950 via-slate-950 to-indigo-900',
    accentColor: '#8B5CF6',
    icon: '👻',
    chords: ['Bm', 'G', 'Em', 'F#'],
    keyScale: 'B Minor',
    tags: ['Ambient Trap', 'Silent Pulse', 'Drill Drop', 'Shadow Walk'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Sub Heartbeat Pulse',
        startTime: 0,
        endTime: 20,
        instruments: ['heartbeat sub pulse', 'glass pad ambience'],
        description: 'Tense low-frequency heartbeat rhythm inside foggy ambient drone.',
        color: 'bg-purple-950',
      },
      {
        type: 'verse',
        name: 'Verse 1: Low-End Creep',
        startTime: 20,
        endTime: 70,
        instruments: ['deep 808 pulse', 'sparse rimshot', 'ghostly bell lead'],
        description: 'Sparse, cold trap percussion creating immense suspense and focus.',
        color: 'bg-indigo-900',
      },
      {
        type: 'hook',
        name: 'Hook 1: Sudden Drill Drop',
        startTime: 70,
        endTime: 130,
        instruments: ['explosive drill drums', 'sliding 808', 'screeching synth', 'open hats'],
        description: 'Shockwave drill explosion breaking the silence with massive power.',
        color: 'bg-violet-600',
      },
      {
        type: 'verse',
        name: 'Verse 2: Silence & Tension',
        startTime: 130,
        endTime: 160,
        instruments: ['minimal heartbeat', 'sparse hats', 'filter sweep'],
        description: 'Drums cut out suddenly, holding listener in absolute thriller suspense.',
        color: 'bg-slate-800',
      },
      {
        type: 'hook',
        name: 'Final Climax: Ghost Drop',
        startTime: 160,
        endTime: 190,
        instruments: ['full energy drums', '808 glide', 'anthem bells', 'sub fade'],
        description: 'Final devastating drop before vanishing silently into thin air.',
        color: 'bg-purple-600',
      },
    ],
  },
  {
    id: 'long_beat_9',
    number: 9,
    name: 'From Trenches To Mansion',
    duration: 180, // 3:00
    bpm: 125,
    genre: 'Inspirational Street x Orchestra',
    mood: 'Victory',
    story: 'From sleeping on a cracked mattress to overlooking the Atlantic ocean from a Lekki penthouse.',
    producer: 'Prod. Street Stars Empire',
    isFree: false,
    requiredStudioLevel: 3,
    coverGradient: 'from-amber-950 via-yellow-900 to-amber-500',
    accentColor: '#F59E0B',
    icon: '🏰',
    chords: ['C', 'G/B', 'Am', 'F'],
    keyScale: 'C Major',
    tags: ['Triumphant', 'Royal Trumpet', 'Grand Piano', 'Mansion Lifestyle'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Melancholy Trenches Piano',
        startTime: 0,
        endTime: 20,
        instruments: ['sad grand piano', 'cellos'],
        description: 'Touching classical piano chords evoking memories of poverty and hunger.',
        color: 'bg-amber-950',
      },
      {
        type: 'verse',
        name: 'Verse 1: Build With Relentless Drums',
        startTime: 20,
        endTime: 70,
        instruments: ['acoustic kick', '808 rumble', 'rolling snare', 'piano arpeggios'],
        description: 'Steadily escalating rhythm illustrating the grinding climb up the ladder.',
        color: 'bg-amber-800',
      },
      {
        type: 'hook',
        name: 'Hook: Victorious Trumpet Fanfare',
        startTime: 70,
        endTime: 140,
        instruments: ['royal brass fanfare', 'crushing 808', 'choir roar', 'shimmer bells'],
        description: 'Triumphant royal brass horns and booming 808s celebrating absolute success.',
        color: 'bg-yellow-500',
      },
      {
        type: 'outro',
        name: 'Outro: Champagne On The Balcony',
        startTime: 140,
        endTime: 180,
        instruments: ['grand piano chords', 'soft violin swell', 'warm fadeout'],
        description: 'Peaceful acoustic resolution reflecting on the long completed journey.',
        color: 'bg-amber-700',
      },
    ],
  },
  {
    id: 'long_beat_10',
    number: 10,
    name: 'Street Life Finale',
    duration: 240, // 4:00 (Longest Epic Mega Mix)
    bpm: 130, // 105 -> 160 -> 145 -> 88 BPM changing multi-phase
    genre: 'Epic Mega Mix',
    mood: 'Journey',
    story: 'The definitive 4-minute master symphony traversing all 4 games: Dice, Race, Turf War, and Rider.',
    producer: 'Prod. Augustine & Gammy All-Stars',
    isFree: false,
    requiredStudioLevel: 3,
    coverGradient: 'from-indigo-950 via-purple-900 to-amber-600',
    accentColor: '#818CF8',
    icon: '🌟',
    chords: ['Am', 'Dm', 'F', 'E7'],
    keyScale: 'A Minor Multi-Phase',
    tags: ['4 Minutes Long', 'Multi-Tempo', 'Mega Mix', 'All 4 Games'],
    sections: [
      {
        type: 'intro',
        name: 'Phase 1: Dice Hustle (105 BPM)',
        startTime: 0,
        endTime: 60,
        instruments: ['funky clavinet', 'slap bass', 'sidewalk bounce drums'],
        description: 'Smooth street funk section reflecting sidewalk dice games and lucky rolls.',
        color: 'bg-blue-600',
      },
      {
        type: 'verse',
        name: 'Phase 2: Highway Race (160 BPM)',
        startTime: 60,
        endTime: 120,
        instruments: ['160 BPM speed drill', 'sliding 808', 'rush cymbals'],
        description: 'Sudden acceleration into hyper-fast 160 BPM racing drill tension.',
        color: 'bg-red-600',
      },
      {
        type: 'hook',
        name: 'Phase 3: Turf War Clash (145 BPM)',
        startTime: 120,
        endTime: 180,
        instruments: ['orchestral brass', 'heavy war drums', 'anthem strings', 'stabs'],
        description: 'Heavy war march rhythm with symphonic horns commanding the neighborhood.',
        color: 'bg-purple-600',
      },
      {
        type: 'outro',
        name: 'Phase 4: Rider Queen Chill (88 BPM)',
        startTime: 180,
        endTime: 240,
        instruments: ['lo-fi rain pad', 'vocal hum', 'soft rhodes', 'peaceful outro'],
        description: 'Slow 88 BPM cruise into the horizon under starry skies to conclude.',
        color: 'bg-pink-700',
      },
    ],
  },
  {
    id: 'long_beat_11',
    number: 11,
    name: 'Ajah To Lekki',
    duration: 175, // 2:55
    bpm: 120,
    genre: 'Afro Drill',
    mood: 'Cruise',
    story: 'Cruising the Lekki-Epe expressway in a tinted whip with windows half cracked.',
    producer: 'Prod. Gammy Lekki Waves',
    isFree: false,
    requiredStudioLevel: 4,
    coverGradient: 'from-cyan-950 via-teal-900 to-teal-500',
    accentColor: '#14B8A6',
    icon: '🌴',
    chords: ['F#m', 'D', 'A', 'E'],
    keyScale: 'F# Minor',
    tags: ['Afro Drill', 'Island Keys', 'Bouncy 808', 'Lekki Cruise'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Ocean Breeze',
        startTime: 0,
        endTime: 15,
        instruments: ['tropical electric keys', 'shakers'],
        description: 'Breezy Caribbean-influenced Rhodes keys with ocean wave synth sweeps.',
        color: 'bg-teal-900',
      },
      {
        type: 'verse',
        name: 'Verse 1: Expressway Glide',
        startTime: 15,
        endTime: 60,
        instruments: ['Afro drill kick', 'syncopated rim', 'sliding 808', 'keys'],
        description: 'Polished afro-drill cadence blending warm guitars and sub-bass.',
        color: 'bg-teal-700',
      },
      {
        type: 'hook',
        name: 'Hook: Tollgate Drop',
        startTime: 60,
        endTime: 120,
        instruments: ['full brass section', 'double 808', 'vocal chop', 'cymbals'],
        description: 'Infectious danceable drop that makes every head in the car nod.',
        color: 'bg-cyan-500',
      },
      {
        type: 'verse',
        name: 'Verse 2: Night Coastline',
        startTime: 120,
        endTime: 150,
        instruments: ['guitar solo melody', 'shaker groove', 'sub bass'],
        description: 'Melodic acoustic guitar breakdown maintaining the continuous groove.',
        color: 'bg-teal-600',
      },
      {
        type: 'outro',
        name: 'Outro: Beach House Fade',
        startTime: 150,
        endTime: 175,
        instruments: ['keys decay', 'warm sub', 'peaceful fade'],
        description: 'Gentle chord resolution at destination gates.',
        color: 'bg-emerald-950',
      },
    ],
  },
  {
    id: 'long_beat_12',
    number: 12,
    name: 'No Sleep For Hustler',
    duration: 185, // 3:05
    bpm: 132,
    genre: 'Afro Street Anthem',
    mood: 'Hustle',
    story: '3 AM in the city, lights burning in the studio, caffeine and drive pushing forward.',
    producer: 'Prod. Augustine Midnight',
    isFree: false,
    requiredStudioLevel: 4,
    coverGradient: 'from-amber-950 via-stone-900 to-yellow-600',
    accentColor: '#EAB308',
    icon: '⚡',
    chords: ['Bbm', 'Gb', 'Db', 'Ab'],
    keyScale: 'Bb Minor',
    tags: ['Relentless', 'Midnight Hustle', 'Street Anthem', 'Anthem Brass'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: 3 AM Watch Clock',
        startTime: 0,
        endTime: 20,
        instruments: ['metallic clock tick synth', 'atmospheric pad'],
        description: 'Steadily ticking synth pulse counting down the midnight hustle hours.',
        color: 'bg-stone-800',
      },
      {
        type: 'verse',
        name: 'Verse 1: Relentless Grind',
        startTime: 20,
        endTime: 70,
        instruments: ['punchy kick', 'rapid hats', 'heavy 808', 'piano stabs'],
        description: 'Hard-hitting street tempo that demands lyrical precision.',
        color: 'bg-amber-800',
      },
      {
        type: 'hook',
        name: 'Hook: Street Anthem Drop',
        startTime: 70,
        endTime: 125,
        instruments: ['stadium synth brass', 'double kick', 'crushing sub', 'choir wash'],
        description: 'Anthemic synth brass melodies shaking car speakers across town.',
        color: 'bg-yellow-500',
      },
      {
        type: 'bridge',
        name: 'Bridge: Second Wind',
        startTime: 125,
        endTime: 155,
        instruments: ['arpeggiated synth bells', 'rolling snare', 'sub sweep'],
        description: 'Hypnotic melodic bridge building energy for the final sprint.',
        color: 'bg-amber-600',
      },
      {
        type: 'outro',
        name: 'Outro: Dawn Breaks',
        startTime: 155,
        endTime: 185,
        instruments: ['piano arpeggio fade', 'sub hum'],
        description: 'Warm sunrise acoustic piano chords closing the sleepless night.',
        color: 'bg-yellow-950',
      },
    ],
  },
  {
    id: 'long_beat_13',
    number: 13,
    name: 'Blood In The Booth',
    duration: 200, // 3:20
    bpm: 140,
    genre: 'Hard Drill',
    mood: 'Raw',
    story: 'Sweat dripping on the microphone pop filter, raw truth spilled into the tape.',
    producer: 'Prod. Augustine & Gang Syndi',
    isFree: false,
    requiredStudioLevel: 4,
    coverGradient: 'from-rose-950 via-red-950 to-red-600',
    accentColor: '#F43F5E',
    icon: '🎙️',
    chords: ['Dm', 'Bb', 'Gm', 'A7'],
    keyScale: 'D Minor',
    tags: ['Raw Emotion', 'Hard Drill', 'Sliding Bass', 'Pure Spitting'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Mic Soundcheck',
        startTime: 0,
        endTime: 15,
        instruments: ['distorted acoustic piano', 'tape hiss pad'],
        description: 'Aggressive minor-key piano progression loaded with raw attitude.',
        color: 'bg-red-950',
      },
      {
        type: 'verse',
        name: 'Verse 1: Spit Fire',
        startTime: 15,
        endTime: 65,
        instruments: ['vicious drill hats', 'deep sliding 808', 'snare pop', 'piano chords'],
        description: 'Relentless drill bass sliding over octave intervals for serious bars.',
        color: 'bg-rose-800',
      },
      {
        type: 'hook',
        name: 'Hook: Explosion In The Booth',
        startTime: 65,
        endTime: 115,
        instruments: ['full orchestra horns', 'crushing 808', 'rapid fire snares', 'bells'],
        description: 'Deafening sonic power with dark orchestral brass and heavy subs.',
        color: 'bg-red-600',
      },
      {
        type: 'verse',
        name: 'Verse 2: Second Round Bars',
        startTime: 115,
        endTime: 160,
        instruments: ['stripped drum groove', 'intense sub-bass', 'staccato piano'],
        description: 'Stripped back instrumentation letting the rapper breathe and conquer.',
        color: 'bg-red-700',
      },
      {
        type: 'outro',
        name: 'Outro: Drop The Mic',
        startTime: 160,
        endTime: 200,
        instruments: ['reverberant piano decay', 'slow sub tail'],
        description: 'Reverberant solo piano chords sustaining into absolute silence.',
        color: 'bg-neutral-950',
      },
    ],
  },
  {
    id: 'long_beat_14',
    number: 14,
    name: 'God Did - Street Version',
    duration: 210, // 3:30
    bpm: 110,
    genre: 'Afro Gospel Drill',
    mood: 'Blessed Hustler',
    story: 'From impossible odds to unshakeable victory, giving thanks for surviving the trenches.',
    producer: 'Prod. Gammy & Augustine Platinum',
    isFree: false,
    requiredStudioLevel: 4,
    coverGradient: 'from-violet-950 via-purple-900 to-amber-500',
    accentColor: '#A855F7',
    icon: '👑',
    chords: ['Ab', 'Eb/G', 'Fm', 'Db'],
    keyScale: 'Ab Major',
    tags: ['Gospel Drill', 'Triumph', 'Choir Chorus', 'Platinum Master'],
    sections: [
      {
        type: 'intro',
        name: 'Intro: Cathedral Choir Echo',
        startTime: 0,
        endTime: 25,
        instruments: ['grand pipe organ', 'choir wash pad', 'warm sub hum'],
        description: 'Majestic cathedral organ and lush gospel choir chords.',
        color: 'bg-purple-950',
      },
      {
        type: 'verse',
        name: 'Verse 1: Testimonial Flow',
        startTime: 25,
        endTime: 75,
        instruments: ['gospel drill kick', 'syncopated rim', 'sliding 808', 'organ chords'],
        description: 'A blend of drill rhythm and heavenly gospel harmony.',
        color: 'bg-violet-800',
      },
      {
        type: 'hook',
        name: 'Hook: The Blessed Drop',
        startTime: 75,
        endTime: 145,
        instruments: ['soaring brass choir', 'heavy 808', 'triumphant cymbals', 'gospel keys'],
        description: 'Full choir chanting victory with thunderous low-end and bright cymbals.',
        color: 'bg-amber-400',
      },
      {
        type: 'bridge',
        name: 'Praise & Thanksgiving',
        startTime: 145,
        endTime: 185,
        instruments: ['piano improvisation', 'choir harmony', 'percussion roll'],
        description: 'Emotional solo acoustic piano chords backing rising choir swells.',
        color: 'bg-purple-600',
      },
      {
        type: 'outro',
        name: 'Outro: Forever Blessed',
        startTime: 185,
        endTime: 210,
        instruments: ['organ fadeout', 'choir sustained note'],
        description: 'Peaceful sustained choir chord fading away like morning mist.',
        color: 'bg-indigo-950',
      },
    ],
  },
];

/**
 * Helper to check if a beat is unlocked for a given player Studio level (0 to 4)
 * - Level 0: Beats 1, 2, 3, 4 (4 free)
 * - Level 1: Beats 1 to 5 (4 free + 1 locked = 5)
 * - Level 2: Beats 1 to 7 (or 8) (4 free + 3 locked = 7)
 * - Level 3: Beats 1 to 10 (4 free + 4 locked = 8; or up to 10)
 * - Level 4: All 14 Beats unlocked (Complete)
 */
export function isLongBeatUnlocked(beat: LongBeat, studioLevel: number): boolean {
  if (beat.isFree || beat.requiredStudioLevel === 0) return true;
  return studioLevel >= beat.requiredStudioLevel;
}

export function getUnlockedBeatsCount(studioLevel: number): number {
  return LONG_BEATS_CATALOG.filter((b) => isLongBeatUnlocked(b, studioLevel)).length;
}

export function formatTimeMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function getBeatById(id: string): LongBeat | undefined {
  return LONG_BEATS_CATALOG.find((b) => b.id === id);
}

export function getSectionAtTime(beat: LongBeat, timeInSeconds: number): BeatSection {
  const found = beat.sections.find(
    (sec) => timeInSeconds >= sec.startTime && timeInSeconds < sec.endTime
  );
  return found || beat.sections[beat.sections.length - 1];
}
