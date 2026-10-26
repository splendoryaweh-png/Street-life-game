'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  PhoneCall,
  PhoneOff,
  Package,
  MapPin,
  Coins,
  Trophy,
  Gauge,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw,
  Bike as BikeIcon,
  Navigation,
  Compass,
  Radio,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  playCoinSound,
  playSuccessSound,
  playClickSound,
  playPickupSound,
  playSirenSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';

export interface StreetRiderProps {
  onBack?: () => void;
  onToast?: (msg: string) => void;
  currentCoins?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

// -------------------------------------------------------------
// SOUND SYNTHESIZER (Engine rumble, horn, phone ring)
// -------------------------------------------------------------
class BikeAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;

  public init() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch {}
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.gain && this.ctx) {
      this.gain.gain.setValueAtTime(muted ? 0 : 0.08, this.ctx.currentTime);
    }
  }

  public startEngine() {
    if (this.isRunning || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc.type = 'sawtooth';
      this.osc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.gain.gain.setValueAtTime(0.06, this.ctx.currentTime);

      this.osc.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.osc.start();
      this.isRunning = true;
    } catch {}
  }

  public updateEnginePitch(speedRatio: number) {
    if (!this.osc || !this.gain || !this.ctx || !this.isRunning) return;
    const targetFreq = 45 + speedRatio * 140;
    this.osc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    const targetGain = this.isMuted ? 0 : 0.04 + speedRatio * 0.06;
    this.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
  }

  public playHorn() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const hornGain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(420, this.ctx.currentTime);
      osc2.frequency.setValueAtTime(530, this.ctx.currentTime);

      hornGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      hornGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc1.connect(hornGain);
      osc2.connect(hornGain);
      hornGain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 0.35);
      osc2.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }

  public playPhoneBeep() {
    if (this.isMuted || !this.ctx) return;
    try {
      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(850, this.ctx.currentTime);
      ringGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      ringGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      ringOsc.connect(ringGain);
      ringGain.connect(this.ctx.destination);
      ringOsc.start();
      ringOsc.stop(this.ctx.currentTime + 0.25);
    } catch {}
  }

  public stop() {
    try {
      if (this.osc) {
        this.osc.stop();
        this.osc.disconnect();
        this.osc = null;
      }
      this.isRunning = false;
    } catch {}
  }
}

// -------------------------------------------------------------
// STREET NAME GENERATION BY REGION
// -------------------------------------------------------------
function detectPlayerRegion(): 'nigeria' | 'uk' | 'us' | 'default' {
  if (typeof window === 'undefined') return 'nigeria';
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const lang = (navigator.language || '').toLowerCase();
    if (
      tz.includes('lagos') ||
      tz.includes('africa') ||
      tz.includes('accra') ||
      tz.includes('nairobi') ||
      tz.includes('cairo') ||
      lang.includes('ng')
    ) {
      return 'nigeria';
    }
    if (tz.includes('london') || lang.includes('en-gb')) {
      return 'uk';
    }
    if (
      tz.includes('new_york') ||
      tz.includes('america') ||
      tz.includes('los_angeles') ||
      tz.includes('chicago') ||
      lang.includes('en-us')
    ) {
      return 'us';
    }
  } catch {}
  return 'nigeria';
}

const REGION_STREETS = {
  nigeria: [
    'Oso Street, Lagos',
    'Alaba Market Road',
    'Ikeja Expressway',
    'Broad Street, Marina',
    'Yaba Tech Corridor',
    'Computer Village Lane',
    'Ojuelegba Junction',
    'Lekki Admiralty Way',
  ],
  us: [
    'Brooklyn 5th Avenue',
    'Harlem Street, NYC',
    'Queens Boulevard',
    'Bronx Expressway',
    'Broadway & 42nd',
    'Atlantic Avenue',
    'Sunset Boulevard',
  ],
  uk: [
    'Brixton Road, London',
    'Camden High Street',
    'Soho Alleyway',
    'Shoreditch High Way',
    'Peckham Rye Lane',
    'Oxford Circus Road',
  ],
  default: [
    'Main Street Block 7',
    'Central Grand Avenue',
    'Downtown Neon Strip',
    'Harbor West Way',
    'Industrial Quarter',
  ],
};

function getRandomStreetName(exclude?: string): string {
  const reg = detectPlayerRegion();
  const pool = REGION_STREETS[reg] || REGION_STREETS.default;
  const filtered = pool.filter((s) => s !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)] || pool[0];
}

// -------------------------------------------------------------
// WORLD SPECIFICATIONS & ROADS
// -------------------------------------------------------------
const WORLD_SIZE = 5000;
const ROAD_WIDTH = 180;
const GRID_SPACING = 700;

interface WorldBuilding {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  name?: string;
  hasNeon?: boolean;
}

interface ObstacleCone {
  x: number;
  y: number;
  radius: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface SkidMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export function StreetRider({
  onBack,
  onToast,
  currentCoins = 50000,
  isOpen = true,
  onClose,
}: StreetRiderProps) {
  // Exit handler supporting either onBack or onClose
  const handleExit = () => {
    playClickSound();
    if (onBack) onBack();
    else if (onClose) onClose();
  };

  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else console.log(msg);
    },
    [onToast]
  );

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Engine
  const audioRef = useRef<BikeAudioEngine>(new BikeAudioEngine());
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Coins & Deliveries State
  const [coins, setCoins] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('streetlife_coins');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
    }
    return currentCoins;
  });
  const [deliveriesCount, setDeliveriesCount] = useState<number>(0);
  const [speedKmh, setSpeedKmh] = useState<number>(0);

  // Game Phases: 'pickup' | 'delivery'
  const [phase, setPhase] = useState<'pickup' | 'delivery'>('pickup');
  const [targetStreet, setTargetStreet] = useState<string>(() => getRandomStreetName());
  const [nextDeliveryStreet, setNextDeliveryStreet] = useState<string>(() => getRandomStreetName());

  // Phone Call Modal System
  const [showPhoneCall, setShowPhoneCall] = useState<boolean>(false);
  const [phoneMessage, setPhoneMessage] = useState<string>('');
  const [typedMessage, setTypedMessage] = useState<string>('');
  const [isPhoneRinging, setIsPhoneRinging] = useState<boolean>(false);
  const [callContext, setCallContext] = useState<'intro' | 'next_mission'>('intro');

  // Parking Progress State (0 - 100%)
  const [parkingProgress, setParkingProgress] = useState<number>(0);
  const [parkingWarning, setParkingWarning] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Bike Customization
  const [bikeColor, setBikeColor] = useState<string>('#00F0FF'); // Neon Cyan

  // Live Game State in Ref to avoid frame closure drops
  const stateRef = useRef({
    // Bike Transform
    x: 2100,
    y: 2100,
    angle: -Math.PI / 2, // Facing North
    speed: 0,
    maxSpeed: 12,
    acceleration: 0.25,
    brakeDeceleration: 0.4,
    friction: 0.08,
    steerDir: 0, // -1 (left), 1 (right), 0 (center)
    tiltAngle: 0,

    // Controls Active
    isAccelerating: false,
    isBraking: false,
    isSteeringLeft: false,
    isSteeringRight: false,
    handbrake: false,

    // Targets
    pickupPos: { x: 2100, y: 1200 },
    deliveryPos: { x: 3500, y: 2800 },
    targetStreetName: '',

    // Parking logic
    phase: 'pickup' as 'pickup' | 'delivery',
    parkingHoldFrames: 0, // 60 frames = 1 sec
    isInsideCircle: false,

    // Flying Package Animation
    flyingPackage: null as {
      startX: number;
      startY: number;
      x: number;
      y: number;
      progress: number;
      active: boolean;
    } | null,

    // Road Grid Nodes
    roadLines: [] as { x1: number; y1: number; x2: number; y2: number }[],
    buildings: [] as WorldBuilding[],
    cones: [] as ObstacleCone[],
    particles: [] as Particle[],
    skids: [] as SkidMark[],

    // Visual rotation of beacon circle
    beaconAngle: 0,
    lastTime: Date.now(),
  });

  // Initialize Audio & Phone Call after 2 seconds
  useEffect(() => {
    const audio = audioRef.current;
    audio.init();

    // Generate initial world geometry
    const buildings: WorldBuilding[] = [];
    const colors = ['#1a1a24', '#20202e', '#161622', '#242028', '#1c2226'];
    const signs = ['KAFE 24/7', 'CYBER CLUB', 'STREET DIESEL', 'BANK', 'MOTORS', 'RECORDS', 'HOTEL'];

    for (let gx = 200; gx < WORLD_SIZE - 200; gx += GRID_SPACING) {
      for (let gy = 200; gy < WORLD_SIZE - 200; gy += GRID_SPACING) {
        // Place buildings between roads
        const blockW = GRID_SPACING - ROAD_WIDTH - 80;
        const blockH = GRID_SPACING - ROAD_WIDTH - 80;
        const bx = gx + ROAD_WIDTH / 2 + 40;
        const by = gy + ROAD_WIDTH / 2 + 40;

        // Subdivide block into 2-3 lots
        buildings.push({
          x: bx,
          y: by,
          w: blockW * 0.48,
          h: blockH * 0.48,
          color: colors[Math.floor(Math.random() * colors.length)],
          name: Math.random() > 0.5 ? signs[Math.floor(Math.random() * signs.length)] : undefined,
          hasNeon: Math.random() > 0.4,
        });

        buildings.push({
          x: bx + blockW * 0.52,
          y: by,
          w: blockW * 0.48,
          h: blockH * 0.48,
          color: colors[Math.floor(Math.random() * colors.length)],
          name: Math.random() > 0.5 ? signs[Math.floor(Math.random() * signs.length)] : undefined,
          hasNeon: Math.random() > 0.4,
        });

        buildings.push({
          x: bx,
          y: by + blockH * 0.52,
          w: blockW,
          h: blockH * 0.48,
          color: colors[Math.floor(Math.random() * colors.length)],
          name: Math.random() > 0.6 ? signs[Math.floor(Math.random() * signs.length)] : undefined,
          hasNeon: Math.random() > 0.3,
        });
      }
    }

    // Generate scattered safety cones along roadside
    const cones: ObstacleCone[] = [];
    for (let i = 0; i < 40; i++) {
      cones.push({
        x: 600 + Math.random() * (WORLD_SIZE - 1200),
        y: 600 + Math.random() * (WORLD_SIZE - 1200),
        radius: 12,
      });
    }

    // Build road line graph
    const roadLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let y = 350; y < WORLD_SIZE; y += GRID_SPACING) {
      roadLines.push({ x1: 0, y1: y, x2: WORLD_SIZE, y2: y });
    }
    for (let x = 350; x < WORLD_SIZE; x += GRID_SPACING) {
      roadLines.push({ x1: x, y1: 0, x2: x, y2: WORLD_SIZE });
    }

    stateRef.current.buildings = buildings;
    stateRef.current.cones = cones;
    stateRef.current.roadLines = roadLines;

    // Use initialized street target
    stateRef.current.targetStreetName = targetStreet;
    stateRef.current.pickupPos = {
      x: 2100 + (Math.random() > 0.5 ? 700 : -700),
      y: 2100 - (800 + Math.random() * 500),
    };

    // PHONE CALL 1: Show after 2 seconds
    const callTimer = setTimeout(() => {
      triggerPhoneCall('intro', targetStreet);
    }, 2000);

    return () => {
      clearTimeout(callTimer);
      audio.stop();
    };
  }, [targetStreet]);

  // Trigger Phone Call Modal with Typewriter effect
  const triggerPhoneCall = (type: 'intro' | 'next_mission', street: string) => {
    setCallContext(type);
    setIsPhoneRinging(true);
    setShowPhoneCall(true);
    audioRef.current.playPhoneBeep();

    const msg =
      type === 'intro'
        ? `Yo Rider! Come take package for ${street} - I dey wait. No waste time!`
        : `Good job! Another package don land for ${street}. Go carry am quick!`;

    setPhoneMessage(msg);
    setTypedMessage('');

    let charIdx = 0;
    const typeInterval = setInterval(() => {
      if (charIdx <= msg.length) {
        setTypedMessage(msg.slice(0, charIdx));
        charIdx++;
      } else {
        clearInterval(typeInterval);
        setIsPhoneRinging(false);
      }
    }, 25);
  };

  // Accept Call
  const handleAcceptCall = () => {
    playClickSound();
    playSuccessSound();
    setShowPhoneCall(false);
    setIsPhoneRinging(false);
    audioRef.current.startEngine();
    toast(`📍 GPS Navigating to: ${targetStreet}`);
  };

  // Decline Call
  const handleDeclineCall = () => {
    playClickSound();
    setShowPhoneCall(false);
    setIsPhoneRinging(false);
    toast('⚠️ Delivery Boss: "Hey! You decline work?! Accept when ready!"');
  };

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') {
        stateRef.current.isAccelerating = true;
      } else if (key === 's' || key === 'arrowdown') {
        stateRef.current.isBraking = true;
      } else if (key === 'a' || key === 'arrowleft') {
        stateRef.current.isSteeringLeft = true;
      } else if (key === 'd' || key === 'arrowright') {
        stateRef.current.isSteeringRight = true;
      } else if (key === ' ' || key === 'spacebar') {
        stateRef.current.handbrake = true;
        stateRef.current.isBraking = true;
      } else if (key === 'h') {
        audioRef.current.playHorn();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') {
        stateRef.current.isAccelerating = false;
      } else if (key === 's' || key === 'arrowdown') {
        stateRef.current.isBraking = false;
      } else if (key === 'a' || key === 'arrowleft') {
        stateRef.current.isSteeringLeft = false;
      } else if (key === 'd' || key === 'arrowright') {
        stateRef.current.isSteeringRight = false;
      } else if (key === ' ' || key === 'spacebar') {
        stateRef.current.handbrake = false;
        stateRef.current.isBraking = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // MAIN GAME LOOP (Canvas rendering & Physics calculation)
  useEffect(() => {
    let animId: number;

    const gameLoop = () => {
      const canvas = canvasRef.current;
      const miniMap = miniMapRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      // Responsive canvas size
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const state = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // -------------------------------------------------------------
      // 1. BIKE PHYSICS & CRITICAL STOP SYSTEM
      // -------------------------------------------------------------
      // Acceleration & Braking
      if (state.isAccelerating) {
        if (state.speed < state.maxSpeed) {
          state.speed += state.acceleration;
        }
      } else if (state.isBraking) {
        // Active Brake - MUST BE ABLE TO STOP COMPLETELY AT speed = 0
        if (state.speed > 0) {
          state.speed = Math.max(0, state.speed - state.brakeDeceleration);
        } else if (state.speed < 0) {
          state.speed = Math.min(0, state.speed + state.brakeDeceleration);
        }
        // Absolute full stop clamp!
        if (Math.abs(state.speed) < 0.1) {
          state.speed = 0;
        }

        // Reverse gear: If player holds brake while already stopped, reverse gently
        if (state.speed === 0 && !state.handbrake) {
          state.speed = -1.2;
        }
      } else {
        // Natural friction coasting
        if (state.speed > 0) {
          state.speed = Math.max(0, state.speed - state.friction);
        } else if (state.speed < 0) {
          state.speed = Math.min(0, state.speed + state.friction);
        }
        if (Math.abs(state.speed) < 0.08) {
          state.speed = 0;
        }
      }

      // Handbrake instant stop
      if (state.handbrake) {
        state.speed = 0;
      }

      // Steering: changes angle only when speed is non-zero
      let steerInput = 0;
      if (state.isSteeringLeft) steerInput -= 1;
      if (state.isSteeringRight) steerInput += 1;
      state.steerDir = steerInput;

      if (Math.abs(state.speed) > 0.5) {
        const speedScale = Math.min(1.2, Math.abs(state.speed) / 6);
        const directionMultiplier = state.speed >= 0 ? 1 : -1;
        state.angle += steerInput * 0.052 * speedScale * directionMultiplier;
        state.tiltAngle = steerInput * 0.28 * Math.min(1, Math.abs(state.speed) / 5);
      } else {
        state.tiltAngle *= 0.85;
      }

      // Update bike position
      state.x += Math.cos(state.angle) * state.speed;
      state.y += Math.sin(state.angle) * state.speed;

      // Keep within world bounds
      state.x = Math.max(100, Math.min(WORLD_SIZE - 100, state.x));
      state.y = Math.max(100, Math.min(WORLD_SIZE - 100, state.y));

      // Audio engine pitch
      const absSpeed = Math.abs(state.speed);
      audioRef.current.updateEnginePitch(absSpeed / state.maxSpeed);

      // Speedometer state update (throttled)
      setSpeedKmh(Math.round(absSpeed * 7.5));

      // Exhaust Smoke Particles
      if (state.isAccelerating && absSpeed > 1) {
        const exhaustAngle = state.angle + Math.PI;
        state.particles.push({
          x: state.x + Math.cos(exhaustAngle) * 35 + (Math.random() - 0.5) * 8,
          y: state.y + Math.sin(exhaustAngle) * 35 + (Math.random() - 0.5) * 8,
          vx: Math.cos(exhaustAngle) * (Math.random() * 2 + 1) + (Math.random() - 0.5) * 0.8,
          vy: Math.sin(exhaustAngle) * (Math.random() * 2 + 1) + (Math.random() - 0.5) * 0.8,
          life: 0,
          maxLife: 20 + Math.random() * 10,
          color: Math.random() > 0.6 ? '#FFD700' : '#888888',
          size: 3 + Math.random() * 4,
        });
      }

      // Skid marks when braking hard at speed
      if (state.isBraking && absSpeed > 4) {
        state.skids.push({
          x: state.x - Math.cos(state.angle) * 20,
          y: state.y - Math.sin(state.angle) * 20,
          angle: state.angle,
          alpha: 0.8,
        });
      }

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.size *= 1.02;
        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // Update skid marks (fade out)
      for (let i = state.skids.length - 1; i >= 0; i--) {
        const s = state.skids[i];
        s.alpha -= 0.002;
        if (s.alpha <= 0) {
          state.skids.splice(i, 1);
        }
      }
      if (state.skids.length > 150) {
        state.skids.splice(0, state.skids.length - 150);
      }

      // -------------------------------------------------------------
      // 2. CAMERA SETUP (FOLLOWS BIKE CENTERED)
      // -------------------------------------------------------------
      const cameraX = state.x - width / 2;
      const cameraY = state.y - height / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Draw Ground & City Grid Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(cameraX, cameraY, width, height);

      // Ground pavement tiles texture
      ctx.strokeStyle = '#14141c';
      ctx.lineWidth = 1;
      const startTileX = Math.floor(cameraX / 100) * 100;
      const startTileY = Math.floor(cameraY / 100) * 100;
      for (let tx = startTileX; tx < cameraX + width + 100; tx += 100) {
        ctx.beginPath();
        ctx.moveTo(tx, cameraY);
        ctx.lineTo(tx, cameraY + height);
        ctx.stroke();
      }
      for (let ty = startTileY; ty < cameraY + height + 100; ty += 100) {
        ctx.beginPath();
        ctx.moveTo(cameraX, ty);
        ctx.lineTo(cameraX + width, ty);
        ctx.stroke();
      }

      // Draw Roads (Two lanes, white dashed divider, yellow curbs)
      ctx.lineCap = 'round';
      state.roadLines.forEach((road) => {
        // Road Asphalt Base
        ctx.strokeStyle = '#181820';
        ctx.lineWidth = ROAD_WIDTH;
        ctx.beginPath();
        ctx.moveTo(road.x1, road.y1);
        ctx.lineTo(road.x2, road.y2);
        ctx.stroke();

        // Curbs (Sidewalk edge glow)
        ctx.strokeStyle = '#333340';
        ctx.lineWidth = 6;
        const isHorizontal = road.y1 === road.y2;
        if (isHorizontal) {
          ctx.beginPath();
          ctx.moveTo(road.x1, road.y1 - ROAD_WIDTH / 2);
          ctx.lineTo(road.x2, road.y2 - ROAD_WIDTH / 2);
          ctx.moveTo(road.x1, road.y1 + ROAD_WIDTH / 2);
          ctx.lineTo(road.x2, road.y2 + ROAD_WIDTH / 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(road.x1 - ROAD_WIDTH / 2, road.y1);
          ctx.lineTo(road.x2 - ROAD_WIDTH / 2, road.y2);
          ctx.moveTo(road.x1 + ROAD_WIDTH / 2, road.y1);
          ctx.lineTo(road.x2 + ROAD_WIDTH / 2, road.y2);
          ctx.stroke();
        }

        // Center dashed divider
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 25]);
        ctx.beginPath();
        ctx.moveTo(road.x1, road.y1);
        ctx.lineTo(road.x2, road.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw Skid Marks
      state.skids.forEach((skid) => {
        ctx.save();
        ctx.translate(skid.x, skid.y);
        ctx.rotate(skid.angle);
        ctx.fillStyle = `rgba(10, 10, 10, ${skid.alpha})`;
        ctx.fillRect(-6, -7, 12, 4);
        ctx.fillRect(-6, 3, 12, 4);
        ctx.restore();
      });

      // Draw Buildings on the roadside
      state.buildings.forEach((b) => {
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);

        // Building Body
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // Roof Edge Border
        ctx.strokeStyle = '#2c2c3e';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // Neon Sign / Storefront
        if (b.name) {
          ctx.fillStyle = b.hasNeon ? '#FFD700' : '#00F0FF';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
        }
      });

      // Draw Obstacle Cones
      state.cones.forEach((c) => {
        ctx.fillStyle = '#ff5500';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      });

      // -------------------------------------------------------------
      // 3. PICKUP & DELIVERY TARGET CIRCLE (CYCLE CIRCLE PARKING)
      // -------------------------------------------------------------
      const currentTarget = state.phase === 'pickup' ? state.pickupPos : state.deliveryPos;
      state.beaconAngle += 0.025;

      const distToTarget = Math.hypot(currentTarget.x - state.x, currentTarget.y - state.y);
      const isInside = distToTarget < 75;
      state.isInsideCircle = isInside;

      // Pulsating radius
      const pulseSize = 80 + Math.sin(Date.now() * 0.005) * 5;
      const circleColor = state.phase === 'pickup' ? '#FFD700' : '#10B981';

      // Outer Pulsating Beacon Rings
      ctx.strokeStyle = state.phase === 'pickup' ? 'rgba(255, 215, 0, 0.25)' : 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(currentTarget.x, currentTarget.y, pulseSize + 25, 0, Math.PI * 2);
      ctx.stroke();

      // Main Dashed Parking Circle
      ctx.save();
      ctx.translate(currentTarget.x, currentTarget.y);
      ctx.rotate(state.beaconAngle);
      ctx.strokeStyle = circleColor;
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Inner Translucent Fill
      ctx.fillStyle = state.phase === 'pickup' ? 'rgba(255, 215, 0, 0.12)' : 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.arc(currentTarget.x, currentTarget.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Center Icon & Text
      ctx.fillStyle = circleColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const circleText = state.phase === 'pickup' ? 'PARK HERE TO PICKUP' : 'PARK HERE TO DELIVER';
      ctx.fillText(circleText, currentTarget.x, currentTarget.y - 12);
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`[ ${Math.round(distToTarget)}m ]`, currentTarget.x, currentTarget.y + 12);

      // -------------------------------------------------------------
      // 4. PARKING & PICKUP LOGIC (SPEED < 0.5 CRITICAL CHECK)
      // -------------------------------------------------------------
      if (isInside) {
        // Player must stop inside circle (speed < 0.5)
        if (absSpeed < 0.5) {
          state.parkingHoldFrames += 1;
          const progress = Math.min(100, Math.round((state.parkingHoldFrames / 60) * 100));
          setParkingProgress(progress);
          setParkingWarning(null);

          // 1 second complete hold (60 frames)
          if (state.parkingHoldFrames >= 60) {
            state.parkingHoldFrames = 0;
            setParkingProgress(0);

            if (state.phase === 'pickup') {
              // Collected Package!
              playPickupSound();
              setSuccessBanner('📦 PACKAGE COLLECTED!');
              toast('📦 Package Collected! Now ride to the delivery point.');

              // Trigger Flying Package animation
              state.flyingPackage = {
                startX: currentTarget.x,
                startY: currentTarget.y,
                x: currentTarget.x,
                y: currentTarget.y,
                progress: 0,
                active: true,
              };

              // Transition to DELIVERY PHASE
              state.phase = 'delivery';
              setPhase('delivery');

              // Generate new Delivery Target (1000 - 2000m away on road)
              const nextDeliv = getRandomStreetName(targetStreet);
              setNextDeliveryStreet(nextDeliv);
              state.targetStreetName = nextDeliv;

              const angleOffset = Math.random() * Math.PI * 2;
              const deliveryDistance = 1200 + Math.random() * 800;
              state.deliveryPos = {
                x: Math.max(300, Math.min(WORLD_SIZE - 300, state.x + Math.cos(angleOffset) * deliveryDistance)),
                y: Math.max(300, Math.min(WORLD_SIZE - 300, state.y + Math.sin(angleOffset) * deliveryDistance)),
              };

              setTimeout(() => {
                setSuccessBanner(null);
              }, 2500);
            } else {
              // Successfully Delivered Package!
              playSuccessSound();
              playCoinSound();
              confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

              // Reward: 50 coins saved to localStorage
              const newCoins = coins + 50;
              setCoins(newCoins);
              setDeliveriesCount((prev) => prev + 1);

              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('streetlife_coins', String(newCoins));
                } catch {}
              }
              addGameCoins(50, 'Street Rider package delivery', 'rider_delivery');

              setSuccessBanner('🎉 DELIVERED! +50 COINS');
              toast('🎉 Delivery Complete! +50 Street Coins Earned!');

              // Transition back to PICKUP with new caller dispatch
              state.phase = 'pickup';
              setPhase('pickup');

              const nextPickupStreet = getRandomStreetName();
              setTargetStreet(nextPickupStreet);
              state.targetStreetName = nextPickupStreet;

              const angleOffset = Math.random() * Math.PI * 2;
              const nextDist = 900 + Math.random() * 600;
              state.pickupPos = {
                x: Math.max(300, Math.min(WORLD_SIZE - 300, state.x + Math.cos(angleOffset) * nextDist)),
                y: Math.max(300, Math.min(WORLD_SIZE - 300, state.y + Math.sin(angleOffset) * nextDist)),
              };

              // Trigger phone call for next package after 1.5s
              setTimeout(() => {
                setSuccessBanner(null);
                triggerPhoneCall('next_mission', nextPickupStreet);
              }, 1500);
            }
          }
        } else {
          // Inside circle but moving too fast
          state.parkingHoldFrames = 0;
          setParkingProgress(0);
          setParkingWarning('⚠️ BRAKE! Stop inside circle to complete task');
        }
      } else {
        // Outside circle
        state.parkingHoldFrames = 0;
        setParkingProgress(0);
        setParkingWarning(null);
      }

      // Draw Flying Package Animation
      if (state.flyingPackage && state.flyingPackage.active) {
        state.flyingPackage.progress += 0.05;
        state.flyingPackage.x =
          state.flyingPackage.startX +
          (state.x - state.flyingPackage.startX) * state.flyingPackage.progress;
        state.flyingPackage.y =
          state.flyingPackage.startY +
          (state.y - state.flyingPackage.startY) * state.flyingPackage.progress -
          Math.sin(state.flyingPackage.progress * Math.PI) * 40;

        ctx.fillStyle = '#FFD700';
        ctx.fillRect(state.flyingPackage.x - 10, state.flyingPackage.y - 10, 20, 20);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(state.flyingPackage.x - 10, state.flyingPackage.y - 10, 20, 20);

        if (state.flyingPackage.progress >= 1) {
          state.flyingPackage.active = false;
        }
      }

      // Draw Exhaust Smoke Particles
      state.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // -------------------------------------------------------------
      // 5. DRAW REALISTIC BIKE & RIDER (With Headlight & Brake Light)
      // -------------------------------------------------------------
      ctx.save();
      ctx.translate(state.x, state.y);
      ctx.rotate(state.angle);

      // Dynamic lean tilt
      ctx.transform(1, 0, Math.tan(state.tiltAngle * 0.4), 1, 0, 0);

      // Bike Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front Headlight Beam (High-Power Cone)
      const gradHeadlight = ctx.createRadialGradient(25, 0, 5, 120, 0, 95);
      gradHeadlight.addColorStop(0, 'rgba(255, 255, 230, 0.45)');
      gradHeadlight.addColorStop(0.5, 'rgba(255, 255, 200, 0.15)');
      gradHeadlight.addColorStop(1, 'rgba(255, 255, 200, 0)');

      ctx.fillStyle = gradHeadlight;
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(135, -45);
      ctx.lineTo(135, 45);
      ctx.closePath();
      ctx.fill();

      // Rear Red Brake Light Beam
      if (state.isBraking) {
        const brakeGrad = ctx.createRadialGradient(-30, 0, 2, -50, 0, 35);
        brakeGrad.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
        brakeGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = brakeGrad;
        ctx.beginPath();
        ctx.arc(-30, 0, 35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wheels (Front & Rear Rubber Tires with spokes)
      ctx.fillStyle = '#111111';
      // Front wheel
      ctx.fillRect(18, -4, 18, 8);
      // Rear wheel
      ctx.fillRect(-32, -5, 18, 10);

      // Wheel Rims
      ctx.fillStyle = '#666666';
      ctx.fillRect(23, -2, 8, 4);
      ctx.fillRect(-27, -2, 8, 4);

      // Bike Chassis / Frame
      ctx.fillStyle = '#222228';
      ctx.beginPath();
      ctx.roundRect(-22, -6, 44, 12, 4);
      ctx.fill();

      // Colored Painted Fairing Body
      ctx.fillStyle = bikeColor;
      ctx.beginPath();
      ctx.roundRect(-10, -7, 24, 14, [4, 8, 8, 4]);
      ctx.fill();

      // Engine Exhaust Pipes
      ctx.fillStyle = '#888888';
      ctx.fillRect(-26, -9, 20, 3);
      ctx.fillRect(-26, 6, 20, 3);

      // Handlebars
      ctx.fillStyle = '#444444';
      ctx.fillRect(14, -14, 4, 28);
      // Grip handles
      ctx.fillStyle = '#000000';
      ctx.fillRect(13, -15, 6, 4);
      ctx.fillRect(13, 11, 6, 4);

      // Delivery Backpack / Box on Rear Rack
      ctx.fillStyle = state.phase === 'delivery' ? '#FFD700' : '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(-28, -9, 16, 18, 3);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-28, -9, 16, 18);

      // Courier Rider Body
      // Legs / Lower Body
      ctx.fillStyle = '#1c1c24';
      ctx.fillRect(-12, -7, 14, 14);

      // Rider Jacket (Street Hoodie)
      ctx.fillStyle = '#2b2d42';
      ctx.beginPath();
      ctx.roundRect(-6, -8, 16, 16, 4);
      ctx.fill();

      // High-Visibility Reflector Stripe on Back
      ctx.fillStyle = '#76c893';
      ctx.fillRect(-4, -6, 3, 12);

      // Helmet (Top View with Tinted Visor)
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(4, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Helmet Visor Shield
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(7, 0, 4.5, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      ctx.restore();

      // -------------------------------------------------------------
      // 6. MAIN NAVIGATION: BIG 3D FLOATING ARROW ON ROAD
      // -------------------------------------------------------------
      const arrowDistance = 110;
      const arrowX = state.x + Math.cos(state.angle) * arrowDistance;
      const arrowY = state.y + Math.sin(state.angle) * arrowDistance;

      // Calculate absolute angle towards current target
      const angleToTarget = Math.atan2(currentTarget.y - state.y, currentTarget.x - state.x);

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angleToTarget);

      // Pulsating glowing 3D arrow
      const arrowGlow = Math.sin(Date.now() * 0.008) * 3;
      const arrowCol = state.phase === 'pickup' ? '#FFD700' : '#10B981';

      ctx.shadowColor = arrowCol;
      ctx.shadowBlur = 15;

      // Draw Arrow Head
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(26 + arrowGlow, 0);
      ctx.lineTo(-12, -18);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-24, -6);
      ctx.lineTo(-24, 6);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-12, 18);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Distance tag attached to floating navigation arrow
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeStyle = arrowCol;
      ctx.lineWidth = 1.5;
      const distTag = `${Math.round(distToTarget)}m to ${state.phase}`;
      ctx.font = 'bold 11px monospace';
      const tagW = ctx.measureText(distTag).width + 16;
      ctx.beginPath();
      ctx.roundRect(arrowX - tagW / 2, arrowY + 22, tagW, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(distTag, arrowX, arrowY + 36);
      ctx.restore();

      // Restore camera translation
      ctx.restore();

      // -------------------------------------------------------------
      // 7. ROUND MINI-MAP (Top Right Corner - 150x150 Circle)
      // -------------------------------------------------------------
      if (miniMap) {
        const mctx = miniMap.getContext('2d');
        if (mctx) {
          const mw = miniMap.width;
          const mh = miniMap.height;
          const mRadius = mw / 2;

          mctx.clearRect(0, 0, mw, mh);

          // Clip to circle
          mctx.save();
          mctx.beginPath();
          mctx.arc(mRadius, mRadius, mRadius - 4, 0, Math.PI * 2);
          mctx.clip();

          // Radar Dark Background
          mctx.fillStyle = '#08080d';
          mctx.fillRect(0, 0, mw, mh);

          // Radar Grid Rings
          mctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          mctx.lineWidth = 1;
          mctx.beginPath();
          mctx.arc(mRadius, mRadius, mRadius * 0.35, 0, Math.PI * 2);
          mctx.arc(mRadius, mRadius, mRadius * 0.7, 0, Math.PI * 2);
          mctx.stroke();

          // Scale factor (shows ~1800m range around player)
          const miniScale = mw / 2400;

          mctx.save();
          mctx.translate(mRadius, mRadius);

          // Draw nearby roads as clean lines
          mctx.strokeStyle = '#222230';
          mctx.lineWidth = ROAD_WIDTH * miniScale;
          state.roadLines.forEach((r) => {
            mctx.beginPath();
            mctx.moveTo((r.x1 - state.x) * miniScale, (r.y1 - state.y) * miniScale);
            mctx.lineTo((r.x2 - state.x) * miniScale, (r.y2 - state.y) * miniScale);
            mctx.stroke();
          });

          // Draw Target Dot on Mini-Map
          const targetRelX = (currentTarget.x - state.x) * miniScale;
          const targetRelY = (currentTarget.y - state.y) * miniScale;
          const distFromCenter = Math.hypot(targetRelX, targetRelY);

          // If target is inside map view
          if (distFromCenter < mRadius - 12) {
            mctx.fillStyle = circleColor;
            mctx.beginPath();
            mctx.arc(targetRelX, targetRelY, 6, 0, Math.PI * 2);
            mctx.fill();
            mctx.strokeStyle = '#ffffff';
            mctx.lineWidth = 1.5;
            mctx.stroke();
          } else {
            // Draw Target Indicator Arrow along Mini-Map Rim
            const edgeAngle = Math.atan2(targetRelY, targetRelX);
            const edgeX = Math.cos(edgeAngle) * (mRadius - 14);
            const edgeY = Math.sin(edgeAngle) * (mRadius - 14);

            mctx.save();
            mctx.translate(edgeX, edgeY);
            mctx.rotate(edgeAngle);
            mctx.fillStyle = circleColor;
            mctx.beginPath();
            mctx.moveTo(8, 0);
            mctx.lineTo(-6, -6);
            mctx.lineTo(-3, 0);
            mctx.lineTo(-6, 6);
            mctx.closePath();
            mctx.fill();
            mctx.restore();
          }

          // Draw Player Bike Dot in Center
          mctx.save();
          mctx.rotate(state.angle);
          mctx.fillStyle = '#00F0FF';
          mctx.beginPath();
          mctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          mctx.fill();

          // Forward triangle heading
          mctx.fillStyle = '#ffffff';
          mctx.beginPath();
          mctx.moveTo(7, 0);
          mctx.lineTo(-3, -3);
          mctx.lineTo(-3, 3);
          mctx.closePath();
          mctx.fill();
          mctx.restore();

          mctx.restore(); // Restore center translate
          mctx.restore(); // Restore circular clip

          // Outer Bezel / Border for Mini-Map
          mctx.strokeStyle = circleColor;
          mctx.lineWidth = 3;
          mctx.beginPath();
          mctx.arc(mRadius, mRadius, mRadius - 2, 0, Math.PI * 2);
          mctx.stroke();

          // North Marker
          mctx.fillStyle = '#ffffff';
          mctx.font = 'bold 9px monospace';
          mctx.textAlign = 'center';
          mctx.fillText('N', mRadius, 14);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [coins, bikeColor, targetStreet, toast]);

  // Touch & Pointer Control Handlers
  const handleTouchControl = (
    action: 'accel' | 'brake' | 'left' | 'right',
    pressed: boolean
  ) => {
    if (action === 'accel') stateRef.current.isAccelerating = pressed;
    if (action === 'brake') stateRef.current.isBraking = pressed;
    if (action === 'left') stateRef.current.isSteeringLeft = pressed;
    if (action === 'right') stateRef.current.isSteeringRight = pressed;
  };

  const handleToggleMute = () => {
    playClickSound();
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    audioRef.current.setMute(next);
  };

  const currentTaskLabel =
    phase === 'pickup'
      ? `Go to pickup - ${targetStreet}`
      : `Deliver to ${nextDeliveryStreet}`;

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col select-none overflow-hidden touch-none font-sans">
      {/* =========================================================================
          TOP HUD BAR
         ========================================================================= */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-start justify-between pointer-events-none">
        {/* Left: Exit, Coins, Deliveries, Speedometer */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExit}
              type="button"
              className="p-2.5 rounded-2xl bg-black/80 hover:bg-black text-white border border-white/20 active:scale-95 transition-all cursor-pointer shadow-lg backdrop-blur-md"
              title="Exit Game"
            >
              <ArrowLeft className="w-5 h-5 text-gray-200" />
            </button>

            <button
              onClick={handleToggleMute}
              type="button"
              className="p-2.5 rounded-2xl bg-black/80 hover:bg-black text-white border border-white/20 active:scale-95 transition-all cursor-pointer shadow-lg backdrop-blur-md"
              title={isAudioMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isAudioMuted ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-[#FFD700]" />
              )}
            </button>

            <button
              onClick={() => audioRef.current.playHorn()}
              type="button"
              className="px-3 py-2 rounded-2xl bg-black/80 hover:bg-black text-[#FFD700] border border-[#FFD700]/30 font-black text-xs uppercase active:scale-95 transition-all cursor-pointer shadow-lg backdrop-blur-md flex items-center gap-1"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>HORN</span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="px-3.5 py-2 rounded-2xl bg-black/80 border border-white/15 backdrop-blur-md shadow-xl flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#FFD700]" />
              <span className="text-sm font-black text-[#FFD700] font-mono">
                {coins.toLocaleString()} SC
              </span>
            </div>

            <div className="w-px h-4 bg-white/20" />

            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white font-mono">
                {deliveriesCount} Done
              </span>
            </div>

            <div className="w-px h-4 bg-white/20" />

            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-cyan-300 font-mono">
                {speedKmh} km/h
              </span>
            </div>
          </div>
        </div>

        {/* Center Task Headline */}
        <div className="hidden sm:flex flex-col items-center pointer-events-auto max-w-sm">
          <div
            className={`px-4 py-2 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-2 ${
              phase === 'pickup'
                ? 'bg-amber-500/20 border-amber-500/40 text-[#FFD700]'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {phase === 'pickup' ? (
              <Package className="w-4 h-4 animate-bounce" />
            ) : (
              <MapPin className="w-4 h-4 animate-pulse" />
            )}
            <span className="text-xs font-black uppercase tracking-wider truncate">
              {currentTaskLabel}
            </span>
          </div>
        </div>

        {/* Right: Round Mini-Map (150x150) */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] rounded-full p-1 bg-black/75 border border-white/20 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <canvas
              ref={miniMapRef}
              width={150}
              height={150}
              className="w-full h-full rounded-full"
            />
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/80 text-gray-300 border border-white/10 pointer-events-none">
              GPS RADAR
            </div>
          </div>

          {/* Phone Dispatch Button */}
          <button
            onClick={() => triggerPhoneCall('intro', targetStreet)}
            type="button"
            className="px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black border border-white/20 text-xs font-bold text-amber-300 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer backdrop-blur-md"
          >
            <PhoneCall className="w-3.5 h-3.5 text-green-400" />
            <span>Dispatch</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Task Banner */}
      <div className="sm:hidden absolute top-28 left-4 right-4 z-20 flex justify-center pointer-events-none">
        <div
          className={`px-3.5 py-1.5 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2 max-w-full ${
            phase === 'pickup'
              ? 'bg-amber-500/20 border-amber-500/40 text-[#FFD700]'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
          }`}
        >
          {phase === 'pickup' ? (
            <Package className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <MapPin className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="text-xs font-black uppercase tracking-wider truncate">
            {currentTaskLabel}
          </span>
        </div>
      </div>

      {/* =========================================================================
          CENTER ALERTS & PARKING PROGRESS BAR
         ========================================================================= */}
      {/* Success Banner */}
      {successBanner && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-3xl bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_35px_rgba(255,215,0,0.6)] animate-bounce flex items-center gap-2">
          <Sparkles className="w-5 h-5 fill-black" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Warning Alert: Brake message */}
      {parkingWarning && !successBanner && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-red-600/90 text-white font-black text-xs uppercase tracking-wider shadow-lg animate-pulse border border-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{parkingWarning}</span>
        </div>
      )}

      {/* Parking Progress Meter */}
      {parkingProgress > 0 && !successBanner && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-40 w-64 p-3 rounded-2xl bg-black/90 border-2 border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.4)] backdrop-blur-md text-center">
          <div className="flex items-center justify-between text-xs font-black uppercase text-[#FFD700] mb-1.5">
            <span>Parking...</span>
            <span className="font-mono">{parkingProgress}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-amber-400 to-[#FFD700] h-full rounded-full transition-all duration-75 shadow-[0_0_10px_#FFD700]"
              style={{ width: `${parkingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          CANVAS VIEWPORT
         ========================================================================= */}
      <canvas
        ref={canvasRef}
        className="w-full h-full flex-1 block touch-none cursor-crosshair"
      />

      {/* =========================================================================
          BOTTOM ON-SCREEN MOBILE CONTROLS
         ========================================================================= */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-6 flex items-end justify-between pointer-events-none">
        {/* Left Side: Steering Controls */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Steer Left */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleTouchControl('left', true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleTouchControl('left', false);
            }}
            onPointerLeave={() => handleTouchControl('left', false)}
            type="button"
            className="w-18 h-18 rounded-3xl bg-neutral-900/90 hover:bg-neutral-800 active:scale-90 border-2 border-white/20 active:border-[#00F0FF] shadow-2xl flex items-center justify-center text-white backdrop-blur-lg select-none cursor-pointer"
          >
            <span className="text-2xl font-black">◀</span>
          </button>

          {/* Steer Right */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleTouchControl('right', true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleTouchControl('right', false);
            }}
            onPointerLeave={() => handleTouchControl('right', false)}
            type="button"
            className="w-18 h-18 rounded-3xl bg-neutral-900/90 hover:bg-neutral-800 active:scale-90 border-2 border-white/20 active:border-[#00F0FF] shadow-2xl flex items-center justify-center text-white backdrop-blur-lg select-none cursor-pointer"
          >
            <span className="text-2xl font-black">▶</span>
          </button>
        </div>

        {/* Right Side: Speed & Brake Buttons */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Brake / Stop Button (Red - VERY IMPORTANT FOR PARKING) */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleTouchControl('brake', true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleTouchControl('brake', false);
            }}
            onPointerLeave={() => handleTouchControl('brake', false)}
            type="button"
            className="w-18 h-18 rounded-3xl bg-red-600/90 hover:bg-red-700 active:scale-90 border-2 border-red-400 active:border-white shadow-[0_0_20px_rgba(239,68,68,0.5)] flex flex-col items-center justify-center text-white backdrop-blur-lg select-none cursor-pointer"
          >
            <span className="text-xs font-black uppercase tracking-wider">STOP</span>
            <span className="text-[10px] font-bold text-red-200">BRAKE</span>
          </button>

          {/* Speed / Accelerate Button (Green) */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleTouchControl('accel', true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              handleTouchControl('accel', false);
            }}
            onPointerLeave={() => handleTouchControl('accel', false)}
            type="button"
            className="w-20 h-20 rounded-3xl bg-emerald-500 hover:bg-emerald-600 active:scale-90 border-2 border-emerald-300 active:border-white shadow-[0_0_25px_rgba(16,185,129,0.5)] flex flex-col items-center justify-center text-black font-black backdrop-blur-lg select-none cursor-pointer"
          >
            <Zap className="w-5 h-5 fill-black" />
            <span className="text-xs tracking-wider">GAS</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PHONE CALL MODAL (STREET GANG STAR STYLE)
         ========================================================================= */}
      {showPhoneCall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16161f] border-2 border-amber-400/80 rounded-3xl p-5 shadow-[0_0_40px_rgba(245,158,11,0.35)] relative animate-in fade-in zoom-in-95 duration-200">
            {/* Phone Ring Vibration Accent */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-[#FFD700] flex items-center justify-center ${
                    isPhoneRinging ? 'animate-bounce' : ''
                  }`}
                >
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    DISPATCH BOSS (INCOMING)
                  </h3>
                  <p className="text-[10px] text-emerald-400 font-mono">
                    {isPhoneRinging ? 'RINGING...' : 'SECURE AUDIO LINE'}
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono text-[10px]">
                {detectPlayerRegion().toUpperCase()} DISPATCH
              </span>
            </div>

            {/* Caller Boss Avatar & Dialogue Box */}
            <div className="flex items-start gap-3.5 mb-5 p-3 rounded-2xl bg-black/60 border border-white/10">
              {/* Delivery Boss Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 p-0.5 shrink-0 shadow-md">
                <div className="w-full h-full rounded-[14px] bg-[#1a1a24] flex items-center justify-center text-2xl font-black text-white">
                  🧔🏿‍♂️
                </div>
              </div>

              {/* Typewriter Dialogue Text */}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase text-[#FFD700] block mb-1">
                  Big Chief Don
                </span>
                <p className="text-xs font-semibold text-gray-200 leading-relaxed min-h-[48px]">
                  {typedMessage}
                  {typedMessage.length < phoneMessage.length && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#FFD700] ml-1 animate-pulse" />
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons: Accept / Decline */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDeclineCall}
                type="button"
                className="py-3 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>

              <button
                onClick={handleAcceptCall}
                type="button"
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95 transition-all cursor-pointer hover:brightness-110"
              >
                <PhoneCall className="w-4 h-4 fill-black" />
                <span>Accept Job</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreetRider;
