'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flag,
  Trophy,
  Coins,
  Crown,
  Zap,
  Volume2,
  VolumeX,
  Flame,
  Clock,
  Sparkles,
  Users,
  ArrowLeft,
  RotateCcw,
  Gauge,
  ShieldAlert,
  AlertTriangle,
  Compass,
  ChevronsUp,
} from 'lucide-react';
import {
  StreetRaceLobby,
  RaceCarSkin,
  RaceLobbyPlayer,
  RACE_CARS,
} from './StreetRaceLobby';
import {
  HIGHWAY_LENGTH,
  ROAD_WIDTH,
  HighwayObstacle,
  HighwayMarker,
  getRoadCenterX,
  generateHighwayMarkers,
  generateHighwayObstacles,
  renderHighwayScenery,
  renderRoadSegments,
  renderObstaclesOnRoad,
  renderPlayerCarBehind,
  renderOpponentCar,
} from './StreetRaceHighway';
import {
  playCoinSound,
  playSirenSound,
  playClickSound,
  playSuccessSound,
  playPunchSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';

export interface StreetRaceMultiplayerProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
  initialRoomCode?: string;
}

interface RacerState {
  id: string;
  name: string;
  carSkin: RaceCarSkin;
  y: number;
  laneOffset: number;
  speed: number;
  nitro: number;
  isNitro: boolean;
  isBraking: boolean;
  isCrashed: boolean;
  crashTimer: number;
  isSpinning: boolean;
  spinTimer: number;
  isFinished: boolean;
  finishTime: number;
  rank: number;
  isMe: boolean;
}

interface OvertakeAlert {
  id: string;
  text: string;
  time: number;
}

interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const StreetRaceMultiplayer: React.FC<StreetRaceMultiplayerProps> = ({
  onBack,
  onToast,
  currentCoins,
  initialRoomCode,
}) => {
  const [inRace, setInRace] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [isHost, setIsHost] = useState(true);
  const [myCarSkin, setMyCarSkin] = useState<RaceCarSkin>(RACE_CARS[0]);
  const [lobbyPlayers, setLobbyPlayers] = useState<RaceLobbyPlayer[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const myRacerId = useRef<string>('racer_' + Math.random().toString(36).substring(2, 8));
  const [raceTimeSeconds, setRaceTimeSeconds] = useState(0);
  const [currentDistanceKm, setCurrentDistanceKm] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [nitroFuel, setNitroFuel] = useState(100);
  const [myRank, setMyRank] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashSecondsRemaining, setCrashSecondsRemaining] = useState(0);
  const [overtakeAlerts, setOvertakeAlerts] = useState<OvertakeAlert[]>([]);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const racersRef = useRef<Map<string, RacerState>>(new Map());
  const obstaclesRef = useRef<HighwayObstacle[]>([]);
  const markersRef = useRef<HighwayMarker[]>([]);
  const particlesRef = useRef<ParticleEffect[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const steeringInputRef = useRef<number>(0);
  const isAcceleratingRef = useRef<boolean>(false);
  const isBrakingRef = useRef<boolean>(false);
  const isNitroRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  const passedRacersSetRef = useRef<Set<string>>(new Set());

  // NEW: Round Joystick refs - ONLY addition for controls fix
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    const maxDist = rect.width / 2 - 12;
    const dist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
    if (dist > maxDist) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * maxDist;
      deltaY = Math.sin(angle) * maxDist;
    }
    setJoystickPos({ x: deltaX, y: deltaY });
    steeringInputRef.current = deltaX / maxDist;
    if (deltaY < -12) {
      isAcceleratingRef.current = true;
      isBrakingRef.current = false;
    } else if (deltaY > 12) {
      isBrakingRef.current = true;
      isAcceleratingRef.current = false;
    } else {
      isAcceleratingRef.current = false;
      isBrakingRef.current = false;
    }
  };

  const handleJoystickEnd = () => {
    setJoystickPos({ x: 0, y: 0 });
    steeringInputRef.current = 0;
    isAcceleratingRef.current = false;
    isBrakingRef.current = false;
  };

  const handleStartRace = (
    code: string,
    host: boolean,
    car: RaceCarSkin,
    players: RaceLobbyPlayer[]
  ) => {
    setRoomCode(code);
    setIsHost(host);
    setMyCarSkin(car);
    setLobbyPlayers(players);
    setInRace(true);
    obstaclesRef.current = generateHighwayObstacles();
    markersRef.current = generateHighwayMarkers();
    const myRacer: RacerState = {
      id: myRacerId.current,
      name: host ? 'Host Driver (You)' : 'Racer (You)',
      carSkin: car,
      y: 0,
      laneOffset: 0,
      speed: 0,
      nitro: 100,
      isNitro: false,
      isBraking: false,
      isCrashed: false,
      crashTimer: 0,
      isSpinning: false,
      spinTimer: 0,
      isFinished: false,
      finishTime: 0,
      rank: 1,
      isMe: true,
    };
    racersRef.current.set(myRacerId.current, myRacer);
    players.forEach((p, idx) => {
      if (p.id !== myRacerId.current) {
        racersRef.current.set(p.id, {
          id: p.id,
          name: p.name,
          carSkin: p.carSkin,
          y: idx * 25,
          laneOffset: idx % 2 === 0 ? -0.5 : 0.5,
          speed: 0,
          nitro: 100,
          isNitro: false,
          isBraking: false,
          isCrashed: false,
          crashTimer: 0,
          isSpinning: false,
          spinTimer: 0,
          isFinished: false,
          finishTime: 0,
          rank: idx + 2,
          isMe: false,
        });
      }
    });
    const currentCount = racersRef.current.size;
    if (currentCount < 4) {
      const botNames = ['Shadow Viper', 'Neon Phantom', 'Apex Striker'];
      for (let b = currentCount; b < 4; b++) {
        const botId = `bot_${b}`;
        const botSkin = RACE_CARS[b % RACE_CARS.length];
        racersRef.current.set(botId, {
          id: botId,
          name: botNames[b - 1] || `Rival ${b}`,
          carSkin: botSkin,
          y: b * 30,
          laneOffset: b === 1 ? -0.6 : b === 2 ? 0.6 : -0.2,
          speed: 0,
          nitro: 100,
          isNitro: false,
          isBraking: false,
          isCrashed: false,
          crashTimer: 0,
          isSpinning: false,
          spinTimer: 0,
          isFinished: false,
          finishTime: 0,
          rank: b + 1,
          isMe: false,
        });
      }
    }
    const channelName = `streetrace_${code.toUpperCase().trim()}`;
    const channel = new BroadcastChannel(channelName);
    broadcastChannelRef.current = channel;
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'RACER_SYNC') {
        const racer = racersRef.current.get(data.id);
        if (racer && !racer.isMe) {
          racer.y = data.y;
          racer.laneOffset = data.laneOffset;
          racer.speed = data.speed;
          racer.isNitro = data.isNitro;
          racer.isBraking = data.isBraking;
          racer.isCrashed = data.isCrashed;
          racer.isFinished = data.isFinished;
        } else if (!racer && data.id !== myRacerId.current) {
          racersRef.current.set(data.id, {
            id: data.id,
            name: data.name || 'Opponent',
            carSkin: data.carSkin || RACE_CARS[0],
            y: data.y,
            laneOffset: data.laneOffset,
            speed: data.speed,
            nitro: 100,
            isNitro: data.isNitro,
            isBraking: data.isBraking,
            isCrashed: data.isCrashed,
            crashTimer: 0,
            isSpinning: false,
            spinTimer: 0,
            isFinished: data.isFinished,
            finishTime: 0,
            rank: 4,
            isMe: false,
          });
        }
      } else if (data.type === 'OVERTAKE_NOTIFY') {
        if (data.overtakenId === myRacerId.current) {
          onToast(`⚠️ ${data.overtakerName} passed you!`);
        }
      }
    };
    onToast(`7KM Highway Race Started! Finish line at 7,000m`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key === 'Shift') isNitroRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      if (e.key === ' ' || e.key === 'Shift') isNitroRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!inRace || isFinished) return;
    const interval = setInterval(() => setRaceTimeSeconds((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [inRace, isFinished]);

  const handleCrossedFinishLine = (myFinalRank: number) => {
    setIsFinished(true);
    let reward = 50;
    if (myFinalRank === 1) reward = 500;
    else if (myFinalRank === 2) reward = 300;
    else if (myFinalRank === 3) reward = 100;
    setEarnedCoins(reward);
    addGameCoins(reward, `+${reward} SC - 7KM Street Race Rank #${myFinalRank}`, 'race_reward');
    playSuccessSound();
    confetti({ particleCount: 160, spread: 100 });
    onToast(`🏁 FINISH LINE REACHED! Rank #${myFinalRank}: +${reward} Street Coins!`);
  };

  const triggerOvertakeAlert = (rivalName: string) => {
    const alertId = Math.random().toString();
    setOvertakeAlerts((prev) => [...prev, { id: alertId, text: `⚡ OVERTOOK ${rivalName.toUpperCase()}!`, time: Date.now() }]);
    playCoinSound();
    setTimeout(() => setOvertakeAlerts((prev) => prev.filter((a) => a.id !== alertId)), 2800);
  };

  useEffect(() => {
    if (!inRace) return;
    let animId: number;
    const loop = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) { animId = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animId = requestAnimationFrame(loop); return; }
      const me = racersRef.current.get(myRacerId.current);
      if (me && !me.isFinished) {
        const keys = keysRef.current;
        let steer = 0;
        if (keys['a'] || keys['arrowleft']) steer -= 1;
        if (keys['d'] || keys['arrowright']) steer += 1;
        if (steeringInputRef.current !== 0) steer += steeringInputRef.current;
        const isAccelerating = keys['w'] || keys['arrowup'] || isAcceleratingRef.current;
        const isBraking = keys['s'] || keys['arrowdown'] || isBrakingRef.current;
        const wantsNitro = isNitroRef.current && me.nitro > 0;
        me.isBraking = isBraking;
        me.isNitro = wantsNitro;
        if (me.isCrashed) {
          me.crashTimer -= 0.016;
          setCrashSecondsRemaining(Math.max(0, Math.ceil(me.crashTimer)));
          me.speed = Math.max(0, me.speed - 3);
          if (Math.random() < 0.6) {
            particlesRef.current.push({
              x: canvas.width / 2 + (Math.random() * 30 - 15),
              y: canvas.height * 0.88,
              vx: (Math.random() - 0.5) * 2,
              vy: -Math.random() * 3 - 2,
              life: 30,
              maxLife: 30,
              color: '#64748B',
              size: Math.random() * 8 + 4,
            });
          }
          if (me.crashTimer <= 0) { me.isCrashed = false; setIsCrashed(false); }
        } else {
          const isOffRoad = Math.abs(me.laneOffset) > 0.92;
          const maxAllowedSpeed = isOffRoad ? me.carSkin.topSpeed * 0.22 : wantsNitro ? me.carSkin.topSpeed + 25 : me.carSkin.topSpeed;
          if (isAccelerating) {
            const accelRate = wantsNitro ? 1.6 : 0.85;
            me.speed = Math.min(maxAllowedSpeed, me.speed + accelRate);
          } else if (isBraking) {
            me.speed = Math.max(0, me.speed - 2.2);
          } else {
            me.speed = Math.max(0, me.speed - 0.35);
          }
          if (wantsNitro && isAccelerating) {
            me.nitro = Math.max(0, me.nitro - 0.6);
            setNitroFuel(Math.round(me.nitro));
          } else if (!wantsNitro && me.nitro < 100) {
            me.nitro = Math.min(100, me.nitro + 0.12);
            setNitroFuel(Math.round(me.nitro));
          }
          if (me.speed > 5) {
            const steerSensitivity = 0.018 * (me.speed / 100);
            me.laneOffset += steer * steerSensitivity;
            me.laneOffset = Math.max(-1.15, Math.min(1.15, me.laneOffset));
          }
          const curveTangent = Math.cos(me.y * 0.0005) * 0.0005 * 300 + Math.cos(me.y * 0.0002) * 0.0002 * 500;
          me.laneOffset -= curveTangent * (me.speed / 130) * 0.4;
          const moveDelta = (me.speed / 3.6) * 10 * 0.016;
          me.y += moveDelta;
          setCurrentDistanceKm(Math.min(7, +(me.y / 10000).toFixed(2)));
          setCurrentSpeedKmh(Math.round(me.speed));
          if (me.y >= HIGHWAY_LENGTH) {
            me.isFinished = true;
            me.y = HIGHWAY_LENGTH;
            handleCrossedFinishLine(me.rank);
          }
          for (let i = 0; i < obstaclesRef.current.length; i++) {
            const obs = obstaclesRef.current[i];
            const distY = Math.abs(obs.y - me.y);
            if (distY < 35 && Math.abs(obs.laneOffset - me.laneOffset) < 0.28) {
              if (obs.type === 'oil_slick') {
                me.isSpinning = true;
                me.speed *= 0.6;
                me.laneOffset += (Math.random() - 0.5) * 0.4;
                playPunchSound();
              } else {
                me.isCrashed = true;
                me.crashTimer = 3.0;
                me.speed = 0;
                setIsCrashed(true);
                playPunchSound();
                obstaclesRef.current.splice(i, 1);
                break;
              }
            }
          }
          racersRef.current.forEach((opp) => {
            if (opp.id === me.id) return;
            const distY = me.y - opp.y;
            if (Math.abs(distY) < 40 && Math.abs(me.laneOffset - opp.laneOffset) < 0.26) {
              const pushDir = me.laneOffset > opp.laneOffset ? 1 : -1;
              me.laneOffset += pushDir * 0.12;
              opp.laneOffset -= pushDir * 0.12;
              me.speed *= 0.8;
              opp.speed *= 0.8;
              playPunchSound();
            }
            if (distY > 10 && distY < 120 && !passedRacersSetRef.current.has(opp.id)) {
              passedRacersSetRef.current.add(opp.id);
              triggerOvertakeAlert(opp.name);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({ type: 'OVERTAKE_NOTIFY', overtakerName: me.name, overtakenId: opp.id });
              }
            } else if (distY < -10) {
              passedRacersSetRef.current.delete(opp.id);
            }
          });
        }
      }
      racersRef.current.forEach((racer) => {
        if (racer.isMe) return;
        if (!racer.isFinished) {
          const targetSpeed = 135 + Math.sin(racer.y * 0.001) * 25;
          if (racer.speed < targetSpeed) racer.speed += 0.5;
          else if (racer.speed > targetSpeed) racer.speed -= 0.3;
          const moveDelta = (racer.speed / 3.6) * 10 * 0.016;
          racer.y += moveDelta;
          racer.laneOffset += Math.sin(timestamp * 0.001 + racer.y * 0.002) * 0.004;
          racer.laneOffset = Math.max(-0.8, Math.min(0.8, racer.laneOffset));
          if (racer.y >= HIGHWAY_LENGTH) { racer.isFinished = true; racer.y = HIGHWAY_LENGTH; }
        }
      });
      const sortedRacers = Array.from(racersRef.current.values()).sort((a, b) => b.y - a.y);
      sortedRacers.forEach((racer, index) => { racer.rank = index + 1; if (racer.isMe) setMyRank(index + 1); });
      if (me && timestamp - lastSyncTimeRef.current > 60 && broadcastChannelRef.current) {
        lastSyncTimeRef.current = timestamp;
        broadcastChannelRef.current.postMessage({
          type: 'RACER_SYNC', id: me.id, name: me.name, carSkin: me.carSkin, y: me.y, laneOffset: me.laneOffset, speed: me.speed, isNitro: me.isNitro, isBraking: me.isBraking, isCrashed: me.isCrashed, isFinished: me.isFinished,
        });
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (me) {
        renderHighwayScenery(ctx, canvas.width, canvas.height, me.y, me.laneOffset * 200);
        renderRoadSegments(ctx, canvas.width, canvas.height, me.y, me.laneOffset * 200);
        renderObstaclesOnRoad(ctx, obstaclesRef.current, me.y, me.laneOffset * 200, canvas.width, canvas.height);
        racersRef.current.forEach((opp) => {
          if (!opp.isMe) renderOpponentCar(ctx, me.y, me.laneOffset * 200, opp.y, opp.laneOffset, opp.name, opp.carSkin.color, canvas.width, canvas.height);
        });
        const carScreenX = canvas.width / 2;
        const carScreenY = canvas.height * 0.86;
        renderPlayerCarBehind(ctx, carScreenX, carScreenY, steeringInputRef.current !== 0 ? steeringInputRef.current : (keysRef.current['a'] ? -1 : keysRef.current['d'] ? 1 : 0), me.isBraking, me.isNitro, me.isCrashed, me.carSkin.color);
      }
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.life -= 1;
        if (p.life <= 0) { particlesRef.current.splice(i, 1); continue; }
        ctx.save(); ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [inRace, isFinished, soundEnabled]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60); const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!inRace) {
    return <StreetRaceLobby onBack={onBack} onStartRace={handleStartRace} currentCoins={currentCoins} initialRoomCode={initialRoomCode} onToast={onToast} />;
  }

  const allRacers = Array.from(racersRef.current.values()).sort((a, b) => b.y - a.y);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none font-sans text-white">
      <canvas ref={canvasRef} width={typeof window !== 'undefined' ? window.innerWidth : 1200} height={typeof window !== 'undefined' ? window.innerHeight : 800} className="w-full h-full block" />

      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={onBack} className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 backdrop-blur"><ArrowLeft className="w-5 h-5 text-white" /></button>
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60 backdrop-blur"><span className="text-[10px] text-slate-400 block font-mono">HIGHWAY CODE</span><span className="text-sm font-black text-amber-400 font-mono tracking-wider">{roomCode}</span></div>
          <button onClick={() => setSoundEnabled((v) => !v)} className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700">{soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}</button>
        </div>
        <div className="flex flex-col items-center pointer-events-auto">
          <div className="bg-slate-900/90 border border-red-500/40 px-5 py-2 rounded-2xl shadow-xl shadow-red-500/10 backdrop-blur flex items-center gap-4">
            <div className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-red-400" /><span className="text-xs text-slate-300 font-bold">Distance: <span className="font-mono text-base font-black text-amber-400">{currentDistanceKm}km</span> / 7km</span></div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-cyan-400" /><span className="text-xs text-slate-300 font-bold">Time: <span className="font-mono text-base font-black text-white">{formatTime(raceTimeSeconds)}</span></span></div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5"><Gauge className="w-4 h-4 text-emerald-400" /><span className="text-xs text-slate-300 font-bold">Speed: <span className="font-mono text-base font-black text-emerald-400">{currentSpeedKmh} km/h</span></span></div>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto"><div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-4 py-1.5 rounded-xl font-black text-sm shadow-lg flex items-center gap-1.5"><Trophy className="w-4 h-4 fill-slate-950" /><span>RANK #{myRank}</span></div></div>
      </div>

      {/* NITRO BOOST NOW AT TOP - NOT BLOCKING CAR */}
      <div className="absolute top-20 left-4 z-20 pointer-events-none">
        <div className="bg-slate-900/85 border border-cyan-500/40 px-4 py-2.5 rounded-2xl backdrop-blur shadow-xl w-48">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1 text-cyan-400"><Zap className="w-4 h-4 fill-cyan-400" /> NITRO BOOST</span>
            <span className="font-mono text-cyan-300">{nitroFuel}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-1.5">
            <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-400 to-teal-300 transition-all duration-100" style={{ width: `${nitroFuel}%` }} />
          </div>
        </div>
      </div>

      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col gap-2">
        {overtakeAlerts.map((alert) => (<div key={alert.id} className="bg-amber-400 text-slate-950 px-6 py-2 rounded-full font-black text-base shadow-2xl shadow-amber-400/50 flex items-center gap-2 animate-bounce"><ChevronsUp className="w-6 h-6" /> {alert.text}</div>))}
      </div>

      {isCrashed && (<div className="absolute top-36 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-red-600/90 border-2 border-red-300 text-white px-6 py-2.5 rounded-2xl font-black text-sm shadow-2xl backdrop-blur flex items-center gap-2 animate-pulse"><ShieldAlert className="w-5 h-5 text-amber-300" /><span>OBSTACLE CRASH! ENGINE RECOVERING: {crashSecondsRemaining}s</span></div>)}

      <div className="absolute top-20 right-4 z-20 pointer-events-none hidden md:flex flex-col gap-1.5 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/60 backdrop-blur w-56 shadow-xl">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Users className="w-3 h-3 text-cyan-400" /> LIVE HIGHWAY RANKS</span>
        <div className="space-y-1 mt-1">{allRacers.map((r, i) => (<div key={r.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${r.isMe ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-300'}`}><div className="flex items-center gap-2 truncate"><span className="font-mono text-[11px] font-bold">#{i + 1}</span><span className="truncate">{r.name}</span></div><span className="font-mono text-[11px] text-slate-400">{(r.y / 10000).toFixed(1)}km</span></div>))}</div>
      </div>

      {/* ===== FIXED MOBILE CONTROLS ===== */}
      <div className="md:hidden">
        {/* LEFT: ROUND STEERING WHEEL - 360 degree */}
        <div className="absolute bottom-6 left-5 z-30 pointer-events-auto flex flex-col items-center gap-1">
          <div
            ref={joystickBaseRef}
            onTouchMove={(e) => { e.preventDefault(); handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY); }}
            onTouchEnd={handleJoystickEnd}
            onTouchStart={(e) => handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY)}
            onMouseMove={(e) => { if (e.buttons === 1) handleJoystickMove(e.clientX, e.clientY); }}
            onMouseDown={(e) => handleJoystickMove(e.clientX, e.clientY)}
            onMouseUp={handleJoystickEnd}
            onMouseLeave={handleJoystickEnd}
            className="w-[116px] h-[116px] rounded-full bg-slate-900/70 border-2 border-white/20 backdrop-blur-md flex items-center justify-center relative shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <span className="absolute top-[6px] text-[9px] text-white/30 font-bold">FWD</span>
            <span className="absolute bottom-[6px] text-[9px] text-white/30 font-bold">BACK</span>
            <span className="absolute left-[8px] text-[9px] text-white/30 font-bold">L</span>
            <span className="absolute right-[8px] text-[9px] text-white/30 font-bold">R</span>
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 absolute" />
            <div className="w-11 h-11 rounded-full bg-white shadow-xl border-2 border-slate-300 flex items-center justify-center transition-none" style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}>
              <div className="w-3 h-3 rounded-full bg-slate-800" />
            </div>
          </div>
          <span className="text-[9px] text-white/40 font-mono tracking-widest">ROUND STEER</span>
        </div>

        {/* RIGHT: STOP small, NITRO small, GAS bigger */}
        <div className="absolute bottom-6 right-5 z-30 pointer-events-auto flex flex-col items-center gap-2.5">
          <button onTouchStart={() => (isBrakingRef.current = true)} onTouchEnd={() => (isBrakingRef.current = false)} onMouseDown={() => (isBrakingRef.current = true)} onMouseUp={() => (isBrakingRef.current = false)} className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/60 backdrop-blur flex flex-col items-center justify-center font-black text-[9px] text-red-200 active:scale-90 shadow-lg">STOP</button>
          <button onTouchStart={() => (isNitroRef.current = true)} onTouchEnd={() => (isNitroRef.current = false)} onMouseDown={() => (isNitroRef.current = true)} onMouseUp={() => (isNitroRef.current = false)} className="w-14 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/60 backdrop-blur flex flex-col items-center justify-center text-cyan-200 active:scale-90 shadow-lg"><Zap className="w-4 h-4 fill-cyan-400" /><span className="text-[9px] font-black">NITRO</span></button>
          <button onTouchStart={() => (isAcceleratingRef.current = true)} onTouchEnd={() => (isAcceleratingRef.current = false)} onMouseDown={() => (isAcceleratingRef.current = true)} onMouseUp={() => (isAcceleratingRef.current = false)} className="w-[84px] h-[88px] rounded-[18px] bg-gradient-to-t from-amber-400 to-yellow-300 border-2 border-black flex flex-col items-center justify-center text-slate-950 active:scale-95 shadow-xl shadow-amber-500/30 font-black"><ChevronsUp className="w-7 h-7" /><span className="text-[13px] tracking-wider">GAS</span></button>
        </div>
      </div>

      {isFinished && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl shadow-amber-500/20">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-white">7KM HIGHWAY COMPLETE!</h2>
            <p className="text-sm text-slate-300 mt-1">You crossed the finish line of the 7-Kilometer endurance run!</p>
            <div className="my-5 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2.5 text-left">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Final Rank:</span><span className="font-black text-amber-400 font-mono text-base">#{myRank} of {allRacers.length} Racers</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Total Race Time:</span><span className="font-mono text-slate-200">{formatTime(raceTimeSeconds)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Total Distance:</span><span className="font-mono text-emerald-400 font-bold">7.00 KM</span></div>
              <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-base text-amber-300"><span>Street Coins Awarded:</span><span>+{earnedCoins} SC</span></div>
            </div>
            <button onClick={onBack} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-base hover:brightness-110 shadow-lg shadow-amber-500/30 transition-all">Collect Rewards & Return</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreetRaceMultiplayer;
