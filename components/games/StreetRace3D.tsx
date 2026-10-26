'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  Play,
  Volume2,
  VolumeX,
  Zap,
  AlertTriangle,
  Trophy,
  Tv,
  Flame,
  Users,
  Flag,
  Clock,
  Fuel,
  Sparkles,
} from 'lucide-react';
import { playCoinSound, playSirenSound, playClickSound, playPickupSound, playSuccessSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import {
  getTodayDailyClaim,
  consumeRacingNitro,
  claimRacingAdNitro,
  buyRacingNitroWithCoins,
  evaluateRacingBonusCoin,
} from '@/lib/dailyFree';
import confetti from 'canvas-confetti';
import { RaceMultiplayer } from '@/src/games/StreetRace/RaceMultiplayer';

interface StreetRace3DProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

type RaceMode = 'solo' | 'pvp';

interface TrafficCar {
  mesh: THREE.Group;
  speed: number;
  lane: number;
  isPassed: boolean;
}

interface RivalCar {
  id: number;
  name: string;
  color: number;
  mesh: THREE.Group;
  speed: number;
  distance: number;
  lane: number;
}

interface RoadCoin {
  mesh: THREE.Group;
  lane: number;
  isCollected: boolean;
}

interface NitroBottle {
  mesh: THREE.Group;
  lane: number;
  isCollected: boolean;
}

interface FuelCanister {
  mesh: THREE.Group;
  lane: number;
  isCollected: boolean;
}

export function StreetRace3D({ onBack, onToast, currentCoins = 0 }: StreetRace3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [playMode, setPlayMode] = useState<'single' | 'multiplayer'>('single');
  // Selected mode: null (shows selection card screen) | 'solo' | 'pvp'
  const [selectedMode, setSelectedMode] = useState<RaceMode | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'playing' | 'gameover' | 'finished'>('playing');
  const [speedKmh, setSpeedKmh] = useState(120);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [health, setHealth] = useState(100);
  const [nitroAvailable, setNitroAvailable] = useState(100);
  const [isBraking, setIsBraking] = useState(false);
  const [isNitro, setIsNitro] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [rewardAmount, setRewardAmount] = useState(0);

  // PVP specific state: Position, 60s Timer, Fail status
  const [pvpRank, setPvpRank] = useState<number>(1);
  const [pvpTimeRemaining, setPvpTimeRemaining] = useState<number>(60);
  const [pvpFailReason, setPvpFailReason] = useState<string | null>(null);
  const [adWatching, setAdWatching] = useState<boolean>(false);

  // Daily Free Nitro (Prompt 12)
  const [dailyFreeNitro, setDailyFreeNitro] = useState<number>(() => {
    try {
      return getTodayDailyClaim().free_nitro_remaining;
    } catch {
      return 3;
    }
  });
  const [nitroAdsWatched, setNitroAdsWatched] = useState<number>(() => {
    try {
      return getTodayDailyClaim().nitro_ad_claims_count;
    } catch {
      return 0;
    }
  });
  const [isWatchingNitroAd, setIsWatchingNitroAd] = useState(false);

  // Mutable refs for high-frequency game loop
  const inputRef = useRef({ left: false, right: false, brake: false, nitro: false });
  const playerCarRef = useRef<THREE.Group | null>(null);
  const exhaustFlamesRef = useRef<THREE.Mesh[]>([]);
  const targetXRef = useRef(0);
  const speedRef = useRef(1.2);
  const distanceRef = useRef(0);
  const healthRef = useRef(100);
  const coinsRef = useRef(0);
  const overtakesRef = useRef(0);
  const nitroRef = useRef(100);
  const isPlayingRef = useRef(true);
  const pvpTimerRef = useRef(60);
  const pvpRivalsRef = useRef<RivalCar[]>([]);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const trafficListRef = useRef<TrafficCar[]>([]);
  const coinsListRef = useRef<RoadCoin[]>([]);
  const nitroListRef = useRef<NitroBottle[]>([]);
  const fuelListRef = useRef<FuelCanister[]>([]);
  const roadSegmentsRef = useRef<THREE.Mesh[]>([]);

  // Sound helper
  const playSfx = useCallback(
    (type: 'coin' | 'crash' | 'click' | 'pickup' | 'win') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'crash') playSirenSound();
        else if (type === 'pickup') playPickupSound();
        else if (type === 'win') playSuccessSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Start selected mode
  const handleSelectMode = (mode: RaceMode) => {
    playClickSound();
    setSelectedMode(mode);
    setGameState('playing');
    setHealth(100);
    healthRef.current = 100;
    setDistanceMeters(0);
    distanceRef.current = 0;
    setCoinsCollected(0);
    coinsRef.current = 0;
    overtakesRef.current = 0;
    setSpeedKmh(120);
    speedRef.current = 1.2;
    setNitroAvailable(100);
    nitroRef.current = 100;
    targetXRef.current = 0;
    setPvpRank(1);
    pvpTimerRef.current = 60;
    setPvpTimeRemaining(60);
    setPvpFailReason(null);
    isPlayingRef.current = true;
  };

  // Daily Free Nitro Actions
  const handleUseFreeNitroBottle = useCallback(() => {
    if (dailyFreeNitro > 0) {
      const res = consumeRacingNitro();
      setDailyFreeNitro(res.remaining);
      nitroRef.current = 100;
      setNitroAvailable(100);
      playSfx('pickup');
      onToast(`⚡ Free Nitro Bottle Used! (${res.remaining}/3 left today)`);
    } else {
      onToast('No free nitro bottles left! Buy for 50 SC or watch an ad.');
    }
  }, [dailyFreeNitro, onToast, playSfx]);

  const handleWatchAdForNitro = useCallback(() => {
    if (nitroAdsWatched >= 5) {
      onToast('Maximum 5 nitro ad bonuses reached today!');
      return;
    }
    setIsWatchingNitroAd(true);
    playClickSound();
    setTimeout(() => {
      const res = claimRacingAdNitro();
      setIsWatchingNitroAd(false);
      if (res.success) {
        setDailyFreeNitro(res.remaining);
        setNitroAdsWatched(res.totalAdsClaimed);
        nitroRef.current = Math.min(100, nitroRef.current + 60);
        setNitroAvailable(Math.round(nitroRef.current));
        playSfx('pickup');
        onToast(`⚡ +1 Nitro Granted from Ad! (${res.totalAdsClaimed}/5 today)`);
      }
    }, 1500);
  }, [nitroAdsWatched, onToast, playSfx]);

  const handleBuyNitroBottle = useCallback(() => {
    if (currentCoins < 50) {
      onToast('Need at least 50 SC to buy a nitro bottle!');
      playClickSound();
      return;
    }
    addGameCoins(-50, '-50 SC - Bought Nitro Bottle', 'task_reward');
    const res = buyRacingNitroWithCoins();
    setDailyFreeNitro(res.remaining);
    nitroRef.current = 100;
    setNitroAvailable(100);
    playSfx('pickup');
    onToast('⚡ Refilled Nitro for 50 SC!');
  }, [currentCoins, onToast, playSfx]);

  // Finish or Game Over handler
  const handleEndRun = useCallback(
    (isWin: boolean, finalRank = 1, failMsg?: string) => {
      if (!isPlayingRef.current) return;
      isPlayingRef.current = false;
      setGameState(isWin ? 'finished' : 'gameover');
      if (failMsg) setPvpFailReason(failMsg);

      let finalBonus = coinsRef.current;

      if (selectedMode === 'pvp') {
        // Prompt 10: 1st = 500 SC + 100 Coins, 2nd = 250 SC + 50 Coins, 3rd = 100 SC + 25 Coins, 4th-6th = 20 SC
        let pvpPrize = 0;
        let bonusCoins = 0;
        if (finalRank === 1) {
          pvpPrize = 500;
          bonusCoins = 100;
        } else if (finalRank === 2) {
          pvpPrize = 250;
          bonusCoins = 50;
        } else if (finalRank === 3) {
          pvpPrize = 100;
          bonusCoins = 25;
        } else {
          pvpPrize = 20; // 4th-6th consolation
          bonusCoins = 0;
        }

        finalBonus += pvpPrize;
        setRewardAmount(finalBonus);

        if (isWin) {
          addGameCoins(finalBonus, `+${finalBonus} SC - PVP Race #${finalRank} Finish`, 'race_reward');
          onToast(`🏆 PVP Rank #${finalRank}! +${pvpPrize} SC & +${bonusCoins} Coins + ${coinsRef.current} SC Road Coins!`);
          playSfx('win');
          try {
            confetti({
              particleCount: 110,
              spread: 85,
              origin: { y: 0.6 },
              colors: ['#FFD700', '#FACC15', '#00F0FF', '#FFFFFF'],
            });
          } catch {}
        } else {
          // If not finish top 3 = FAIL but still get 20 SC consolation + keep road coins!
          if (finalBonus > 0) {
            addGameCoins(finalBonus, `+${finalBonus} SC - PVP Consolation & Road Coins`, 'race_reward');
            onToast(`Race Finished #${finalRank}! Kept +${finalBonus} SC (${pvpPrize} SC consolation + road coins).`);
          }
          playSfx('crash');
        }
      } else {
        // Solo Unlimited Payout
        const distanceBonus = Math.floor(distanceRef.current * 0.1);
        finalBonus += distanceBonus + overtakesRef.current * 15;
        setRewardAmount(finalBonus);
        addGameCoins(finalBonus, `+${finalBonus} SC - Solo Race Finish`, 'race_reward');
        onToast(`+${finalBonus} StreetCoins earned from Solo Race!`);
        if (isWin) playSfx('win');
      }
    },
    [onToast, playSfx, selectedMode]
  );

  // Watch Ad to Continue (Solo = continue from same spot, PVP = retry race)
  const handleWatchAdContinue = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      setHealth(100);
      healthRef.current = 100;
      setGameState('playing');
      isPlayingRef.current = true;

      if (selectedMode === 'solo') {
        // Continue from same spot
        if (playerCarRef.current) {
          playerCarRef.current.position.x = 0;
          targetXRef.current = 0;
        }
        onToast('Car repaired! Continuing from same spot!');
      } else {
        // PVP retry race
        distanceRef.current = 0;
        setDistanceMeters(0);
        pvpTimerRef.current = 60;
        setPvpTimeRemaining(60);
        setPvpRank(1);
        setPvpFailReason(null);
        if (playerCarRef.current) {
          playerCarRef.current.position.x = 0;
          targetXRef.current = 0;
        }
        onToast('PVP Race Restarted! Sprint the 2km in 60s!');
      }
      playSfx('pickup');
    }, 1800);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputRef.current.brake = true;
        setIsBraking(true);
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.nitro = true;
        setIsNitro(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputRef.current.brake = false;
        setIsBraking(false);
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.nitro = false;
        setIsNitro(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Three.js 3D Setup & Animation Loop
  useEffect(() => {
    if (!selectedMode) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x050508, 0.015);

    // 2. Camera: Following behind car
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 400);
    cameraRef.current = camera;
    camera.position.set(0, 4.2, -9);
    camera.lookAt(0, 1.2, 12);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x222233, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(20, 40, -10);
    scene.add(dirLight);

    const neonGlow = new THREE.PointLight(0xffd700, 2.0, 50);
    neonGlow.position.set(0, 8, 10);
    scene.add(neonGlow);

    // 5. Road
    const roadWidth = 11;
    const roadLength = 240;
    const roadSegments: THREE.Mesh[] = [];

    for (let i = 0; i < 2; i++) {
      const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x111116,
        roughness: 0.8,
        metalness: 0.2,
      });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, i * roadLength);
      scene.add(road);
      roadSegments.push(road);
    }
    roadSegmentsRef.current = roadSegments;

    // Glowing Neon Lane Stripes
    const stripesGroup = new THREE.Group();
    const stripeGeo = new THREE.PlaneGeometry(0.25, 6);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });

    for (let i = 0; i < 20; i++) {
      [-1.8, 1.8].forEach((xPos) => {
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(xPos, 0.02, i * 18);
        stripesGroup.add(stripe);
      });
    }
    scene.add(stripesGroup);

    // 6. BUILD PLAYER CAR (Yellow / Gold Supercar with exhaust flames)
    const playerCar = new THREE.Group();

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(2.1, 0.6, 4.4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.2,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.55;
    playerCar.add(chassis);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.5, 2.3);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x090a0f,
      metalness: 0.95,
      roughness: 0.1,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.95, -0.2);
    playerCar.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const wheelPositions = [
      [-1.1, 0.42, 1.3],
      [1.1, 0.42, 1.3],
      [-1.1, 0.42, -1.3],
      [1.1, 0.42, -1.3],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      playerCar.add(wheel);
    });

    // Exhaust Flames (Prompt 10: Show flame behind car when Nitro is active)
    const flameGeo = new THREE.ConeGeometry(0.22, 1.2, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const leftFlame = new THREE.Mesh(flameGeo, flameMat);
    leftFlame.rotation.x = -Math.PI / 2;
    leftFlame.position.set(-0.6, 0.4, -2.8);
    leftFlame.visible = false;
    playerCar.add(leftFlame);

    const rightFlame = new THREE.Mesh(flameGeo, flameMat);
    rightFlame.rotation.x = -Math.PI / 2;
    rightFlame.position.set(0.6, 0.4, -2.8);
    rightFlame.visible = false;
    playerCar.add(rightFlame);

    exhaustFlamesRef.current = [leftFlame, rightFlame];

    playerCar.position.set(0, 0, 0);
    scene.add(playerCar);
    playerCarRef.current = playerCar;

    // 7. BUILD PVP RIVAL CARS (5 Rival Street Racers)
    const rivalColors = [0xef4444, 0x10b981, 0x3b82f6, 0xa855f7, 0xf97316];
    const rivalNames = ['Red Demon', 'Green Phantom', 'Blue Venom', 'Purple Viper', 'Orange Beast'];
    const rivals: RivalCar[] = [];

    if (selectedMode === 'pvp') {
      rivalColors.forEach((color, idx) => {
        const rGroup = new THREE.Group();
        const rChassis = new THREE.Mesh(chassisGeo, new THREE.MeshStandardMaterial({ color, metalness: 0.8 }));
        rChassis.position.y = 0.55;
        rGroup.add(rChassis);

        const rCabin = new THREE.Mesh(cabinGeo, cabinMat);
        rCabin.position.set(0, 0.95, -0.2);
        rGroup.add(rCabin);

        wheelPositions.forEach(([wx, wy, wz]) => {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, wy, wz);
          rGroup.add(wheel);
        });

        const initialLane = [-3.2, -1.6, 0, 1.6, 3.2][idx];
        const initialZ = 25 + idx * 18;
        rGroup.position.set(initialLane, 0, initialZ);
        scene.add(rGroup);

        rivals.push({
          id: idx,
          name: rivalNames[idx],
          color,
          mesh: rGroup,
          speed: 1.05 + Math.random() * 0.28,
          distance: initialZ,
          lane: initialLane,
        });
      });
      pvpRivalsRef.current = rivals;
    }

    // 8. BUILD TRAFFIC CARS (For Solo mode or background obstacles)
    const traffic: TrafficCar[] = [];
    const lanes = [-3.2, 0, 3.2];
    for (let i = 0; i < 7; i++) {
      const tGroup = new THREE.Group();
      const tMesh = new THREE.Mesh(
        chassisGeo,
        new THREE.MeshStandardMaterial({ color: [0x4b5563, 0x1e3a8a, 0x991b1b][i % 3] })
      );
      tMesh.position.y = 0.55;
      tGroup.add(tMesh);
      const lane = lanes[i % lanes.length];
      tGroup.position.set(lane, 0, 45 + i * 36);
      scene.add(tGroup);
      traffic.push({ mesh: tGroup, speed: 0.6 + Math.random() * 0.4, lane, isPassed: false });
    }
    trafficListRef.current = traffic;

    // 9. ON ROAD SPAWN: GOLD SPINNING COINS (10-15 SC each, spawn every 5-10s)
    const coins: RoadCoin[] = [];
    const cGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const cMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    });

    for (let i = 0; i < 14; i++) {
      const cGroup = new THREE.Group();
      const coinMesh = new THREE.Mesh(cGeo, cMat);
      coinMesh.rotation.x = Math.PI / 2;
      cGroup.add(coinMesh);

      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      cGroup.position.set(lane, 0.6, 25 + i * 20);
      scene.add(cGroup);
      coins.push({ mesh: cGroup, lane, isCollected: false });
    }
    coinsListRef.current = coins;

    // 10. ON ROAD SPAWN: BLUE GLOWING NITRO BOTTLES (+30% Nitro, spawn every 15s)
    const nitroBottles: NitroBottle[] = [];
    const bottleGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12);
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.9,
    });

    for (let i = 0; i < 6; i++) {
      const nGroup = new THREE.Group();
      const bMesh = new THREE.Mesh(bottleGeo, bottleMat);
      bMesh.position.y = 0.5;
      nGroup.add(bMesh);

      const lane = lanes[(i + 1) % lanes.length];
      nGroup.position.set(lane, 0.5, 50 + i * 45);
      scene.add(nGroup);
      nitroBottles.push({ mesh: nGroup, lane, isCollected: false });
    }
    nitroListRef.current = nitroBottles;

    // 11. ON ROAD SPAWN: GREEN ENERGY FUEL CANISTER (+25% Hull)
    const fuelCanisters: FuelCanister[] = [];
    const fuelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
    const fuelMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.8,
    });

    for (let i = 0; i < 4; i++) {
      const fGroup = new THREE.Group();
      const fMesh = new THREE.Mesh(fuelGeo, fuelMat);
      fMesh.position.y = 0.45;
      fGroup.add(fMesh);

      const lane = lanes[(i + 2) % lanes.length];
      fGroup.position.set(lane, 0.5, 70 + i * 60);
      scene.add(fGroup);
      fuelCanisters.push({ mesh: fGroup, lane, isCollected: false });
    }
    fuelListRef.current = fuelCanisters;

    // 12. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 13. Main 3D Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);

      if (!isPlayingRef.current) {
        renderer.render(scene, camera);
        return;
      }

      // PVP 60-Second Timer Check
      if (selectedMode === 'pvp') {
        pvpTimerRef.current -= delta;
        setPvpTimeRemaining(Math.max(0, Math.ceil(pvpTimerRef.current)));
        if (pvpTimerRef.current <= 0) {
          handleEndRun(false, pvpRank, 'Time Expired (60s limit reached)');
          return;
        }
      }

      // Input steering - Moving to screen Left is +X, screen Right is -X
      const steerSpeed = 8.5 * delta;
      if (inputRef.current.left) targetXRef.current = Math.min(3.8, targetXRef.current + steerSpeed);
      if (inputRef.current.right) targetXRef.current = Math.max(-3.8, targetXRef.current - steerSpeed);

      // Nitro & Braking Speed calculation
      let targetSpeed = 1.35; // base ~ 125 km/h
      const usingNitro = inputRef.current.nitro && nitroRef.current > 0;

      if (inputRef.current.brake) {
        targetSpeed = 0.5; // braking ~ 50 km/h
      } else if (usingNitro) {
        targetSpeed = 2.4; // Nitro boost ~ 220 km/h
        nitroRef.current = Math.max(0, nitroRef.current - delta * 25);
        setNitroAvailable(Math.round(nitroRef.current));
      }

      // Toggle flame visibility & pulse scale
      exhaustFlamesRef.current.forEach((flame) => {
        flame.visible = usingNitro;
        if (usingNitro) {
          const s = 1.0 + Math.random() * 0.4;
          flame.scale.set(s, s * 1.2, s);
        }
      });

      speedRef.current += (targetSpeed - speedRef.current) * 0.1;
      const speed = speedRef.current;
      setSpeedKmh(Math.round(speed * 92));

      // Distance advancement
      const travelMeters = speed * delta * 60;
      distanceRef.current += travelMeters;
      setDistanceMeters(Math.floor(distanceRef.current));

      // PVP 2km (2000m) Finish Check
      if (selectedMode === 'pvp' && distanceRef.current >= 2000) {
        let currentRank = 1;
        rivals.forEach((r) => {
          if (r.distance > distanceRef.current) currentRank++;
        });
        setPvpRank(currentRank);
        // If not finish top 3 = FAIL, if 1..3 = WIN
        const isWin = currentRank <= 3;
        handleEndRun(isWin, currentRank, isWin ? undefined : `Finished #${currentRank} (Top 3 Required)`);
        return;
      }

      // Position player car with banking tilt
      const car = playerCarRef.current;
      if (car) {
        const prevX = car.position.x;
        car.position.x = THREE.MathUtils.lerp(car.position.x, targetXRef.current, 0.18);
        const deltaX = car.position.x - prevX;
        car.rotation.z = deltaX * 0.9;
        car.rotation.y = deltaX * 0.4;

        // Camera Follows Smoothly behind player car
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, car.position.x * 0.7, 0.1);
        camera.position.y = 4.2;
        camera.position.z = -8.5;
        camera.lookAt(car.position.x * 0.4, 1.2, 14);
      }

      // Scroll Road & stripes forward
      const forwardMovement = speed * 1.5;
      roadSegments.forEach((road) => {
        road.position.z -= forwardMovement;
        if (road.position.z <= -roadLength) road.position.z += roadLength * 2;
      });

      stripesGroup.children.forEach((stripe) => {
        stripe.position.z -= forwardMovement;
        if (stripe.position.z <= -20) stripe.position.z += roadLength * 2;
      });

      // Update PVP Rivals
      if (selectedMode === 'pvp') {
        let currentRank = 1;
        rivals.forEach((r) => {
          r.distance += r.speed * delta * 60;
          r.mesh.position.z -= forwardMovement - r.speed * 1.4;

          // Track rank relative to player
          if (r.distance > distanceRef.current) currentRank++;
        });
        setPvpRank(currentRank);
      }

      // Update Traffic Cars (Collision & Overtake)
      const pCar = playerCarRef.current;
      traffic.forEach((t) => {
        t.mesh.position.z -= forwardMovement - t.speed;
        if (t.mesh.position.z <= -15) {
          t.mesh.position.z = 180 + Math.random() * 40;
          t.mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
          t.isPassed = false;
        }

        // Overtake counter
        if (!t.isPassed && t.mesh.position.z < 0 && pCar) {
          t.isPassed = true;
          overtakesRef.current += 1;
        }

        // Collision Check with Player
        if (pCar && Math.abs(t.mesh.position.z - pCar.position.z) < 3.2) {
          if (Math.abs(t.mesh.position.x - pCar.position.x) < 1.7) {
            healthRef.current = Math.max(0, healthRef.current - 45);
            setHealth(healthRef.current);
            playSfx('crash');
            t.mesh.position.z += 25;
            if (healthRef.current <= 0) {
              handleEndRun(false, pvpRank, 'Vehicle Wrecked');
            }
          }
        }
      });

      // Update Road Coins (Spin & Pickup detection)
      coins.forEach((c) => {
        c.mesh.rotation.y += 3.0 * delta;
        c.mesh.position.z -= forwardMovement;

        if (c.mesh.position.z <= -10) {
          c.mesh.position.z = 160 + Math.random() * 50;
          c.mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
          c.mesh.visible = true;
          c.isCollected = false;
        }

        if (!c.isCollected && c.mesh.visible && pCar) {
          if (Math.abs(c.mesh.position.z - pCar.position.z) < 2.0 && Math.abs(c.mesh.position.x - pCar.position.x) < 1.4) {
            c.isCollected = true;
            c.mesh.visible = false;

            // Prompt 10 & 12: Each coin = 10 to 15 SC (first 5 bonus 2X)
            const baseAmount = Math.floor(Math.random() * 6) + 10; // 10-15 SC
            const { isBonus, awardedAmount, bonusCountSoFar } = evaluateRacingBonusCoin(baseAmount);

            coinsRef.current += awardedAmount;
            setCoinsCollected(coinsRef.current);
            playSfx('coin');

            if (isBonus) {
              onToast(`🪙 DAILY BONUS COIN: +${awardedAmount} SC (2X) [${bonusCountSoFar}/5]`);
              try {
                confetti({
                  particleCount: 25,
                  spread: 45,
                  origin: { y: 0.6 },
                  colors: ['#FFD700', '#FFA500', '#FFFFFF'],
                });
              } catch {}
            } else {
              onToast(`🪙 +${awardedAmount} SC Picked on Road!`);
            }
          }
        }
      });

      // Update Road Nitro Bottles (Spin & +30% Nitro pickup)
      nitroBottles.forEach((n) => {
        n.mesh.rotation.y += 2.5 * delta;
        n.mesh.position.z -= forwardMovement;

        if (n.mesh.position.z <= -10) {
          n.mesh.position.z = 180 + Math.random() * 60;
          n.mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
          n.mesh.visible = true;
          n.isCollected = false;
        }

        if (!n.isCollected && n.mesh.visible && pCar) {
          if (Math.abs(n.mesh.position.z - pCar.position.z) < 2.0 && Math.abs(n.mesh.position.x - pCar.position.x) < 1.4) {
            n.isCollected = true;
            n.mesh.visible = false;
            nitroRef.current = Math.min(100, nitroRef.current + 30);
            setNitroAvailable(Math.round(nitroRef.current));
            playSfx('pickup');
            onToast('⚡ +30% Nitro Booster Picked! Speed Surging!');
          }
        }
      });

      // Update Energy Fuel Canisters (+25% Hull Health)
      fuelCanisters.forEach((f) => {
        f.mesh.rotation.y += 2.0 * delta;
        f.mesh.position.z -= forwardMovement;

        if (f.mesh.position.z <= -10) {
          f.mesh.position.z = 190 + Math.random() * 60;
          f.mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
          f.mesh.visible = true;
          f.isCollected = false;
        }

        if (!f.isCollected && f.mesh.visible && pCar) {
          if (Math.abs(f.mesh.position.z - pCar.position.z) < 2.0 && Math.abs(f.mesh.position.x - pCar.position.x) < 1.4) {
            f.isCollected = true;
            f.mesh.visible = false;
            healthRef.current = Math.min(100, healthRef.current + 25);
            setHealth(healthRef.current);
            playSfx('pickup');
            onToast('⛽ Energy Fuel Picked: +25% Hull Repaired!');
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [handleEndRun, onToast, playSfx, pvpRank, selectedMode]);

  // -------------------------------------------------------------------------
  // MODE SELECTION SCREEN (Card 1: SOLO RACE | Card 2: PVP RACE | Card 3: MULTIPLAYER)
  // -------------------------------------------------------------------------
  if (playMode === 'multiplayer') {
    return (
      <RaceMultiplayer
        onBack={() => setPlayMode('single')}
        onToast={onToast}
        currentCoins={currentCoins}
      />
    );
  }

  if (!selectedMode) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#090A0E] text-white flex flex-col select-none overflow-y-auto font-sans"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#12131A] border-b border-[#FFD700]/30 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playClickSound();
                onBack();
              }}
              type="button"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-[#FFD700]" />
            </button>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
                <span>STREET RACING</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">
                  3D HIGHWAY
                </span>
              </h1>
              <p className="text-[10px] text-gray-400">Choose Mode • Coins & Nitro On Road</p>
            </div>
          </div>

          {/* [Single] [Multiplayer] Mode Toggle */}
          <div className="flex items-center p-0.5 bg-black/60 rounded-xl border border-white/10">
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-[#FFD700] text-black shadow-sm"
            >
              Single
            </button>
            <button
              onClick={() => {
                playClickSound();
                setPlayMode('multiplayer');
              }}
              type="button"
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 text-[#FFD700] hover:text-white"
            >
              <span>🌐</span>
              <span>Multiplayer</span>
            </button>
          </div>
        </div>

        {/* Big Cards Mode Selector */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full gap-3.5 my-2">
          {/* CARD 0: MULTIPLAYER CIRCUIT SPRINT (P2P SQUAD) */}
          <div className="w-full rounded-3xl bg-gradient-to-b from-[#201A08] via-[#14120A] to-[#0A0A0E] border-2 border-[#FFD700] p-4 shadow-[0_0_25px_rgba(255,215,0,0.3)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#FFD700]" />
                  <span>MULTIPLAYER GRAND PRIX</span>
                </span>
                <span className="text-xl">🌐🏎️</span>
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight">4-PLAYER CIRCUIT SPRINT</h3>
              <p className="text-xs text-[#FFD700] font-medium mt-0.5">
                Real-Time Peer-to-Peer 2-Lap Duel
              </p>
              <p className="text-[11px] text-gray-300 mt-0.5 font-mono">
                1st: 100 SC • 2nd: 80 SC • 3rd: 50 SC • Collision Shock & Nitro Sync
              </p>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setPlayMode('multiplayer');
              }}
              type="button"
              className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 fill-black" />
              <span>ENTER MULTIPLAYER ROOM</span>
            </button>
          </div>

          {/* CARD 1: SOLO RACE - Unlimited */}
          <div className="w-full rounded-3xl bg-gradient-to-b from-[#181822] via-[#0E0E14] to-[#0A0A0E] border border-yellow-400/40 p-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-black uppercase tracking-wider">
                  UNLIMITED
                </span>
                <span className="text-xl">🚗</span>
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight">SOLO RACE - Unlimited</h3>
              <p className="text-xs text-yellow-400/90 font-medium mt-0.5">
                Dodge cars, pick coins, endless
              </p>
            </div>

            <button
              onClick={() => handleSelectMode('solo')}
              type="button"
              className="mt-3 w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              START SOLO RACE
            </button>
          </div>

          {/* CARD 2: PVP RACE - Lagos Grand Prix */}
          <div className="w-full rounded-3xl bg-gradient-to-b from-[#101A24] via-[#0B121A] to-[#080D12] border border-cyan-400/40 p-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider">
                  LAGOS GRAND PRIX
                </span>
                <span className="text-xl tracking-tighter">🚗🚗🚗</span>
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight">PVP RACE (AI Rivals)</h3>
              <p className="text-xs text-cyan-400/90 font-medium mt-0.5">
                Race 5 AI enemies, 2km finish line
              </p>
            </div>

            <button
              onClick={() => handleSelectMode('pvp')}
              type="button"
              className="mt-3 w-full py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-black text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4 text-cyan-300" />
              ENTER AI PVP RACE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black select-none overflow-hidden touch-none flex flex-col font-sans">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD BAR */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-auto">
        {/* Back to Modes Button */}
        <button
          onClick={() => {
            playClickSound();
            setSelectedMode(null);
          }}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white hover:text-[#FFD700] hover:border-[#FFD700] transition-colors text-xs font-bold active:scale-95 backdrop-blur-md cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFD700]" />
          <span>&lt; Mode Select</span>
        </button>

        {/* HUD Stats */}
        <div className="flex items-center gap-2">
          {/* PVP 60s Timer */}
          {selectedMode === 'pvp' && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-500 text-red-300 font-mono font-black text-xs">
              <Clock className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span>{pvpTimeRemaining}s</span>
            </div>
          )}

          {/* PVP Position Indicator */}
          {selectedMode === 'pvp' && (
            <div className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-mono font-black text-xs">
              POS: #{pvpRank} / 6
            </div>
          )}

          {/* Road Coins Collected */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/75 border border-[#FFD700]/50 backdrop-blur-md">
            <span className="text-sm font-black text-[#FFD700]">🪙</span>
            <span className="text-xs font-black text-white">{coinsCollected} SC</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            type="button"
            className="p-1.5 rounded-xl bg-black/70 border border-white/20 text-white/80 hover:text-white backdrop-blur-md cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#FFD700]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* DASHBOARD SPEEDOMETER, NITRO, DISTANCE */}
      <div className="relative z-10 px-4 flex items-center justify-between pointer-events-none">
        {/* Speedometer */}
        <div className="flex flex-col items-start bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-white tracking-tight">{speedKmh}</span>
            <span className="text-[10px] font-bold text-gray-400">km/h</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">
            {selectedMode === 'pvp' ? `${Math.max(0, 2000 - distanceMeters)}m to finish` : `${distanceMeters}m traveled`}
          </span>
        </div>

        {/* Health & Nitro Bars */}
        <div className="flex flex-col gap-2 w-36 bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-xl">
          {/* Car Hull */}
          <div>
            <div className="flex justify-between text-[9px] font-bold text-gray-300 mb-0.5">
              <span>HULL</span>
              <span className={health < 40 ? 'text-red-400' : 'text-emerald-400'}>{health}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  health < 40 ? 'bg-red-500 shadow-[0_0_8px_#EF4444]' : 'bg-emerald-400'
                }`}
                style={{ width: `${health}%` }}
              />
            </div>
          </div>

          {/* Nitro Gauge */}
          <div>
            <div className="flex justify-between items-center text-[9px] font-bold text-cyan-300 mb-0.5">
              <span className="flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-cyan-400" /> NITRO
              </span>
              <span className="font-mono">{nitroAvailable}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 shadow-[0_0_8px_#00F0FF] transition-all"
                style={{ width: `${nitroAvailable}%` }}
              />
            </div>
            {/* Free Nitro Daily Status & Quick Refill */}
            <div className="mt-1 flex items-center justify-between text-[8px] font-bold">
              <span className="text-cyan-400 font-mono">Free Nitro: {dailyFreeNitro}/3</span>
              {dailyFreeNitro > 0 ? (
                <button
                  onClick={handleUseFreeNitroBottle}
                  type="button"
                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 pointer-events-auto active:scale-95"
                >
                  Use Bottle
                </button>
              ) : (
                <div className="flex gap-1 pointer-events-auto">
                  <button
                    onClick={handleWatchAdForNitro}
                    disabled={isWatchingNitroAd || nitroAdsWatched >= 5}
                    type="button"
                    className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[7px]"
                  >
                    +1 Ad ({nitroAdsWatched}/5)
                  </button>
                  <button
                    onClick={handleBuyNitroBottle}
                    type="button"
                    className="px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 text-[7px]"
                  >
                    50 SC
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TOUCH CONTROLS */}
      <div className="mt-auto relative z-20 p-4 pb-6 flex items-end justify-between pointer-events-auto">
        {/* Left / Right Steering Buttons */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={() => {
              inputRef.current.left = true;
            }}
            onPointerUp={() => {
              inputRef.current.left = false;
            }}
            onPointerCancel={() => {
              inputRef.current.left = false;
            }}
            onPointerLeave={() => {
              inputRef.current.left = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              inputRef.current.left = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              inputRef.current.left = false;
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              inputRef.current.left = false;
            }}
            type="button"
            aria-label="Steer Left"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/80 border-2 border-[#FFD700]/70 flex items-center justify-center text-[#FFD700] active:scale-95 active:bg-[#FFD700]/20 backdrop-blur-md shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer select-none"
          >
            <span className="text-2xl font-black">◀</span>
          </button>

          <button
            onPointerDown={() => {
              inputRef.current.right = true;
            }}
            onPointerUp={() => {
              inputRef.current.right = false;
            }}
            onPointerCancel={() => {
              inputRef.current.right = false;
            }}
            onPointerLeave={() => {
              inputRef.current.right = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              inputRef.current.right = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              inputRef.current.right = false;
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              inputRef.current.right = false;
            }}
            type="button"
            aria-label="Steer Right"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/80 border-2 border-[#FFD700]/70 flex items-center justify-center text-[#FFD700] active:scale-95 active:bg-[#FFD700]/20 backdrop-blur-md shadow-[0_0_15px_rgba(255,215,0,0.3)] touch-manipulation cursor-pointer select-none"
          >
            <span className="text-2xl font-black">▶</span>
          </button>
        </div>

        {/* Brake & Nitro Pedals */}
        <div className="flex items-center gap-2">
          {/* Brake Pedal */}
          <button
            onPointerDown={() => {
              inputRef.current.brake = true;
              setIsBraking(true);
            }}
            onPointerUp={() => {
              inputRef.current.brake = false;
              setIsBraking(false);
            }}
            onPointerLeave={() => {
              inputRef.current.brake = false;
              setIsBraking(false);
            }}
            type="button"
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-black text-xs active:scale-95 backdrop-blur-md touch-manipulation cursor-pointer ${
              isBraking ? 'bg-red-600/50 border-red-500 text-white' : 'bg-black/80 border-red-500/60 text-red-400'
            }`}
          >
            <span className="text-sm">🛑</span>
            <span className="text-[9px] tracking-wider uppercase">BRAKE</span>
          </button>

          {/* Nitro Boost Pedal */}
          <button
            onPointerDown={() => {
              inputRef.current.nitro = true;
              setIsNitro(true);
            }}
            onPointerUp={() => {
              inputRef.current.nitro = false;
              setIsNitro(false);
            }}
            onPointerLeave={() => {
              inputRef.current.nitro = false;
              setIsNitro(false);
            }}
            type="button"
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 flex flex-col items-center justify-center font-black active:scale-95 backdrop-blur-md touch-manipulation cursor-pointer ${
              isNitro
                ? 'bg-cyan-500 text-black border-white shadow-[0_0_20px_#00F0FF]'
                : 'bg-black/80 border-cyan-400/80 text-cyan-400'
            }`}
          >
            <Zap className="w-6 h-6 animate-pulse" />
            <span className="text-[9px] tracking-wider uppercase">NITRO</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MANDATORY POPUP: RACE FAILED / RACE FINISHED */}
      {/* Title: RACE FAILED / RACE FINISHED */}
      {/* Buttons: Home Base | Watch Ad to Continue (Solo = continue from same spot, PVP = retry race) */}
      {/* ------------------------------------------------------------- */}
      {(gameState === 'finished' || gameState === 'gameover') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D0D12] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.4)] flex flex-col items-center">
            {gameState === 'finished' ? (
              <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center mb-3">
                <Trophy className="w-9 h-9 text-[#FFD700] drop-shadow-[0_0_10px_#FFD700]" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500 flex items-center justify-center mb-3">
                <AlertTriangle className="w-9 h-9 text-red-500 drop-shadow-[0_0_10px_#EF4444]" />
              </div>
            )}

            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              {gameState === 'finished' ? 'RACE FINISHED' : 'RACE FAILED'}
            </h2>

            <p className="text-xs text-gray-400 mt-1 mb-4">
              {gameState === 'finished'
                ? selectedMode === 'pvp'
                  ? `PVP Sprint Completed! Position #${pvpRank} secured.`
                  : 'You blazed through the endless highway like a true street boss.'
                : pvpFailReason || (selectedMode === 'pvp' ? 'Failed to finish in top 3 within 60s.' : 'Vehicle wrecked on the highway.')}
            </p>

            {/* Total Reward / Road Coins Kept */}
            <div className="w-full py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400">Total Coins Earned:</span>
              <span className="text-lg font-black text-[#FFD700]">🪙 +{rewardAmount} SC</span>
            </div>

            {/* Mandatory Action Buttons */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={handleWatchAdContinue}
                disabled={adWatching}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.6)] active:scale-95 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4 fill-black" />
                {adWatching
                  ? 'Loading Ad...'
                  : selectedMode === 'solo'
                  ? 'Watch Ad to Continue (Resume with Shield)'
                  : 'Watch Ad to Continue (Restart Race Free)'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/10"
              >
                Home Base
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setSelectedMode(null);
                }}
                type="button"
                className="w-full py-2 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Change Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
