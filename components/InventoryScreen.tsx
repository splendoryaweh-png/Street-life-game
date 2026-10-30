'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserGameState } from '@/types/game';
import { addGameCoins } from '@/lib/storage';
import {
  HustlePlayerState,
  getHustlePlayerState,
  saveHustlePlayerState,
  formatEquippedProfileSummary,
  CLOTHES_CATALOG,
  HOUSES_CATALOG,
  VEHICLES_CATALOG,
  PHONES_CATALOG,
  HOUSE_DESIGN_CATALOG,
  STUDIO_LEVELS_CATALOG,
  STUDIO_FILTERS_CATALOG,
  FOOD_CATALOG,
  HUSTLE_VIEW_IMAGES,
  CatalogItem,
  getPlayerStudioLevel,
} from '@/lib/hustleInventory';
import {
  playClickSound,
  playCoinSound,
  playSuccessSound,
  playPickupSound,
  playMediaWithAutoplayFallback,
} from '@/lib/sound';
import {
  BEAT_LIBRARY,
  BeatDefinition,
  SelectedBeatMetadata,
  getBeatMetadata,
  startBeatAudioLoop,
  stopBeatAudioLoop,
  isBeatUnlocked,
  STUDIO_LEVEL_NAMES,
} from '@/lib/freestyleBeats';
import { AdsgramThreeChainModal } from '@/components/AdsgramThreeChainModal';
import {
  Store,
  Hammer,
  ShoppingBag,
  Mic,
  Lock,
  Unlock,
  CheckCircle2,
  Tv,
  Zap,
  Eye,
  Home,
  Car,
  Smartphone,
  Sparkles,
  Sliders,
  Utensils,
  ChevronRight,
  Play,
  Square,
  AlertTriangle,
  RotateCcw,
  Send,
  Radio,
  Flame,
  Award,
  Clock,
  X,
  Video,
  Music,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface InventoryScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
}

type MainTab = 'shop' | 'craft' | 'market' | 'studio';
type ShopCategory =
  | 'clothes'
  | 'houses'
  | 'vehicles'
  | 'phones'
  | 'house_design'
  | 'studio_levels'
  | 'studio_filters'
  | 'food_drinks';

type ActiveViewMode = 'outside' | 'inside' | 'studio' | 'vehicle' | null;

function getRentExpiresTimestamp(): number {
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

function calculateDaysLeft(expiresTimestamp: number, currentNow: number): number {
  const effectiveNow = currentNow > 0 ? currentNow : Date.now();
  if (effectiveNow >= expiresTimestamp) return 0;
  return Math.ceil((expiresTimestamp - effectiveNow) / (24 * 3600 * 1000));
}

export function InventoryScreen({ gameState, onToast }: InventoryScreenProps) {
  const userId = gameState.deviceId || 'player_anon';

  // Persistent Player State
  const [playerState, setPlayerState] = useState<HustlePlayerState>(() =>
    getHustlePlayerState(userId)
  );

  // Current client timestamp for rental expiry calculations (safely updated once per minute)
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(() =>
    typeof window !== 'undefined' ? Date.now() : 0
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Top Tabs: Shop (default open), Craft, Market, Studio
  const [mainTab, setMainTab] = useState<MainTab>('shop');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('clothes');

  // Realistic Visual Photo View Modal / Showcase
  const [activeViewMode, setActiveViewMode] = useState<ActiveViewMode>(null);

  // Ad Watching State
  const [isWatchingAd, setIsWatchingAd] = useState<boolean>(false);

  // Studio Recording States & Selected Beat Metadata (name, BPM, file path)
  const [selectedBeat, setSelectedBeat] = useState<BeatDefinition>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('freestyle_selected_beat_metadata');
        if (stored) {
          const parsed = JSON.parse(stored);
          const found = BEAT_LIBRARY.find((b) => b.id === parsed.id);
          if (found) return found;
        }
      } catch {}
    }
    return BEAT_LIBRARY[0];
  });

  const [selectedBeatMetadata, setSelectedBeatMetadata] = useState<SelectedBeatMetadata>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('freestyle_selected_beat_metadata');
        if (stored) {
          const parsed = JSON.parse(stored);
          const found = BEAT_LIBRARY.find((b) => b.id === parsed.id);
          if (found) return getBeatMetadata(found);
          if (parsed.filePath) return parsed;
        }
      } catch {}
    }
    return getBeatMetadata(BEAT_LIBRARY[0]);
  });

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isPlayingBeat, setIsPlayingBeat] = useState<boolean>(false);
  const [isBeatMutedInRecording, setIsBeatMutedInRecording] = useState<boolean>(false);
  const [freestyleRecordedAudio, setFreestyleRecordedAudio] = useState<string | null>(null);
  const [isPlayingVocalWithBeat, setIsPlayingVocalWithBeat] = useState<boolean>(false);
  const [lastStudioPayoutMsg, setLastStudioPayoutMsg] = useState<string | null>(null);
  const [showAdsgramChain, setShowAdsgramChain] = useState<boolean>(false);

  // Freestyle Booth: Mode Switcher, Beat Filtering & Lock Modal
  const [freestyleMode, setFreestyleMode] = useState<'audio' | 'video'>('audio');
  const [beatFilter, setBeatFilter] = useState<'all' | 'unlocked' | 'locked' | 0 | 1 | 2 | 3 | 4>('all');
  const [lockedBeatToUpgrade, setLockedBeatToUpgrade] = useState<BeatDefinition | null>(null);

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedVideoPlaybackRef = useRef<HTMLVideoElement | null>(null);
  const handleStopAndSubmitFreestyleRef = useRef<() => void>(() => {});

  // Player's Computed Studio Level (0 = Ghetto Starter, 1 = 50k, 2 = 100k, 3 = 200k, 4 = 500k)
  const playerStudioLevel = getPlayerStudioLevel(playerState);
  const currentStudioInfo =
    STUDIO_LEVELS_CATALOG.find((s) => s.id === playerState.equipped.studio) ||
    STUDIO_LEVELS_CATALOG[playerStudioLevel] ||
    STUDIO_LEVELS_CATALOG[0];

  const unlockedBeatsCount = BEAT_LIBRARY.filter((b) => isBeatUnlocked(b, playerStudioLevel)).length;
  const isStudioUnlocked = playerStudioLevel >= 1;

  // Low balance threshold: < 1,000 SC
  const isBalanceLow = gameState.streetCoin < 1000;

  // Ensure live video stream attaches to the preview element once mounted
  useEffect(() => {
    if (isRecording && freestyleMode === 'video' && liveStreamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = liveStreamRef.current;
    }
  }, [isRecording, freestyleMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBeatAudioLoop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // WATCH AD TO GET 10 SC
  // ---------------------------------------------------------------------------
  const handleWatchAdForCoins = () => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    playClickSound();

    setTimeout(() => {
      setIsWatchingAd(false);
      addGameCoins(10, '+10 SC - Watched Inventory Ad', 'ad_reward');
      playSuccessSound();
      onToast('🎉 +10 Street Coins credited to your balance!');
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FACC15', '#FFFFFF'],
        });
      } catch {}
    }, 1600);
  };

  // ---------------------------------------------------------------------------
  // TAB CLICK HANDLERS
  // ---------------------------------------------------------------------------
  const handleTabClick = (tab: MainTab) => {
    playClickSound();

    if (tab === 'craft') {
      onToast('🛠️ Crafting System — Coming Soon in next street update!');
      return;
    }
    if (tab === 'market') {
      onToast('🏪 Street Hustle Market — Coming Soon in next street update!');
      return;
    }
    if (tab === 'studio') {
      setMainTab('studio');
      return;
    }
    // If navigating away from studio, stop beat preview if running
    if (isPlayingBeat && !isRecording) {
      stopBeatAudioLoop();
      setIsPlayingBeat(false);
      setIsPlayingVocalWithBeat(false);
    }
    setMainTab(tab);
  };

  // ---------------------------------------------------------------------------
  // BUY & EQUIP ACTIONS
  // ---------------------------------------------------------------------------
  const handleBuyItem = (item: CatalogItem, isRent = false) => {
    playClickSound();
    const cost = item.price;

    if (gameState.streetCoin < cost) {
      onToast(`Insufficient funds! Need ${cost.toLocaleString()} SC. Watch ad for +1,000 SC.`);
      return;
    }

    // Deduct coins
    addGameCoins(-cost, `-${cost} SC - Bought ${item.name}`, 'task_reward');
    playCoinSound();

    const currentOwned = { ...playerState.owned };
    const currentEquipped = { ...playerState.equipped };

    if (item.category === 'CLOTHES') {
      if (!currentOwned.clothes.includes(item.id)) {
        currentOwned.clothes.push(item.id);
      }
      currentEquipped.clothes = item.id;
      onToast(`👕 Bought & Equipped ${item.name}!`);
    } else if (item.category === 'HOUSES') {
      if (isRent) {
        // Rent: 30 days expiration (30 * 24 * 60 * 60 * 1000)
        const expires = getRentExpiresTimestamp();
        currentOwned.houses[item.id] = { type: 'rent', rentExpires: expires };
        currentEquipped.house = item.id;
        currentEquipped.houseType = 'rent';
        currentEquipped.rentExpiresTimestamp = expires;
        onToast(`🏠 Rented ${item.name} for 30 days!`);
      } else {
        // Buy permanent
        currentOwned.houses[item.id] = { type: 'buy' };
        currentEquipped.house = item.id;
        currentEquipped.houseType = 'buy';
        currentEquipped.rentExpiresTimestamp = null;
        onToast(`🏡 Purchased ${item.name} permanently!`);
      }
    } else if (item.category === 'VEHICLES') {
      if (!currentOwned.vehicles.includes(item.id)) {
        currentOwned.vehicles.push(item.id);
      }
      currentEquipped.vehicle = item.id;
      onToast(`🚗 Bought & Equipped ${item.name}!`);
    } else if (item.category === 'PHONES') {
      if (!currentOwned.phones.includes(item.id)) {
        currentOwned.phones.push(item.id);
      }
      currentEquipped.phone = item.id;
      onToast(`📱 Bought & Holding ${item.name}!`);
    } else if (item.category === 'HOUSE_DESIGN') {
      if (!currentOwned.houseDesign.includes(item.id)) {
        currentOwned.houseDesign.push(item.id);
      }
      if (!currentEquipped.installedHouseDesign.includes(item.id)) {
        currentEquipped.installedHouseDesign.push(item.id);
      }
      onToast(`✨ Installed ${item.name} in your home!`);
    } else if (item.category === 'STUDIO_LEVELS') {
      if (!currentOwned.studioLevels.includes(item.id)) {
        currentOwned.studioLevels.push(item.id);
      }
      currentEquipped.studio = item.id;
      onToast(`🎙️ Upgraded to ${item.name}! Studio Tab is now unlocked.`);
    } else if (item.category === 'STUDIO_FILTERS') {
      if (!currentOwned.studioFilters.includes(item.id)) {
        currentOwned.studioFilters.push(item.id);
      }
      if (!currentEquipped.studioFilters.includes(item.id)) {
        currentEquipped.studioFilters.push(item.id);
      }
      onToast(`🎛️ Equipped ${item.name} in your studio!`);
    } else if (item.category === 'FOOD_DRINKS') {
      const bonus = item.energyBonus || 15;
      if (playerState.energy >= 100) {
        // Energy already maxed - put directly into food stock
        const prevStock = currentOwned.foodStock[item.id] || 0;
        currentOwned.foodStock[item.id] = prevStock + 1;
        const updated = saveHustlePlayerState(userId, {
          equipped: currentEquipped,
          owned: currentOwned,
        });
        setPlayerState(updated);
        playPickupSound();
        onToast(`🍔 Stocked 1x ${item.name}! (Energy is full 100/100). Owned: ${prevStock + 1}`);
        return;
      }
      // Eat/Drink immediately
      const newEnergy = Math.min(100, playerState.energy + bonus);
      currentEquipped.food = item.id;
      const updated = saveHustlePlayerState(userId, {
        energy: newEnergy,
        equipped: currentEquipped,
        owned: currentOwned,
      });
      setPlayerState(updated);
      playPickupSound();
      onToast(`🍔 Consumed ${item.name}! Energy +${bonus} (Current: ${newEnergy}/100)`);
      return;
    }

    const updated = saveHustlePlayerState(userId, {
      equipped: currentEquipped,
      owned: currentOwned,
    });
    setPlayerState(updated);
  };

  // Equip already owned item
  const handleEquipOwnedItem = (item: CatalogItem) => {
    playClickSound();
    const currentEquipped = { ...playerState.equipped };

    if (item.category === 'CLOTHES') {
      currentEquipped.clothes = item.id;
      onToast(`👕 Wearing ${item.name}`);
    } else if (item.category === 'HOUSES') {
      const houseRecord = playerState.owned.houses[item.id];
      currentEquipped.house = item.id;
      currentEquipped.houseType = houseRecord?.type || 'homeless';
      currentEquipped.rentExpiresTimestamp = houseRecord?.rentExpires || null;
      onToast(`🏠 Moved into ${item.name}`);
    } else if (item.category === 'VEHICLES') {
      if (playerState.energy <= 0 && item.id !== 'walking') {
        onToast("⚡ Energy is 0! Can't drive vehicle. Eat food or drink in Shop to restore energy.");
        return;
      }
      currentEquipped.vehicle = item.id;
      onToast(`🚗 Driving ${item.name}`);
    } else if (item.category === 'PHONES') {
      currentEquipped.phone = item.id;
      onToast(`📱 Holding ${item.name}`);
    } else if (item.category === 'HOUSE_DESIGN') {
      if (currentEquipped.installedHouseDesign.includes(item.id)) {
        currentEquipped.installedHouseDesign = currentEquipped.installedHouseDesign.filter((id) => id !== item.id);
        onToast(`✨ Uninstalled ${item.name} from home`);
      } else {
        currentEquipped.installedHouseDesign.push(item.id);
        onToast(`✨ Installed ${item.name} in home`);
      }
    } else if (item.category === 'STUDIO_LEVELS') {
      currentEquipped.studio = item.id;
      onToast(`🎙️ Switched to ${item.name}`);
    } else if (item.category === 'STUDIO_FILTERS') {
      if (currentEquipped.studioFilters.includes(item.id)) {
        currentEquipped.studioFilters = currentEquipped.studioFilters.filter((f) => f !== item.id);
        onToast(`🎛️ Unequipped ${item.name}`);
      } else {
        currentEquipped.studioFilters.push(item.id);
        onToast(`🎛️ Equipped ${item.name}`);
      }
    }

    const updated = saveHustlePlayerState(userId, { equipped: currentEquipped });
    setPlayerState(updated);
  };

  // Eat from food stock
  const handleEatStockFood = (item: CatalogItem) => {
    playClickSound();
    const stock = playerState.owned.foodStock[item.id] || 0;
    if (stock <= 0) {
      onToast(`Out of ${item.name}! Purchase more in Shop.`);
      return;
    }

    const bonus = item.energyBonus || 15;
    const newEnergy = Math.min(100, playerState.energy + bonus);
    const newStock = { ...playerState.owned.foodStock, [item.id]: stock - 1 };
    const newEquipped = { ...playerState.equipped, food: item.id };

    const updated = saveHustlePlayerState(userId, {
      energy: newEnergy,
      equipped: newEquipped,
      owned: { ...playerState.owned, foodStock: newStock },
    });
    setPlayerState(updated);
    playPickupSound();
    onToast(`🍔 Ate ${item.name}! Energy +${bonus} (Current: ${newEnergy}/100)`);
  };

  // ---------------------------------------------------------------------------
  // MUSIC STUDIO RECORDING FLOW & BEAT SELECTION
  // ---------------------------------------------------------------------------
  const handleSelectBeat = (beat: BeatDefinition, autoPlay = true) => {
    if (isRecording) {
      onToast('⚠️ Finish or submit your recording before selecting a new beat.');
      return;
    }

    const isUnlocked = isBeatUnlocked(beat, playerStudioLevel);
    if (!isUnlocked) {
      playClickSound();
      setLockedBeatToUpgrade(beat);
      return;
    }

    playClickSound();
    setSelectedBeat(beat);
    const meta = getBeatMetadata(beat);
    setSelectedBeatMetadata(meta);

    // Save selected beat metadata (name, BPM, file path) to local state & localStorage for recording flow
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('freestyle_selected_beat_metadata', JSON.stringify(meta));
      } catch {}
    }

    onToast(`🎵 Selected "${beat.title}" (${beat.bpm} BPM) • Saved for Recording!`);

    if (autoPlay) {
      startBeatAudioLoop(beat.id);
      setIsPlayingBeat(true);
      setIsBeatMutedInRecording(false);
    }
  };

  const handleBeatCardClick = (beat: BeatDefinition) => {
    handleSelectBeat(beat, true);
  };

  const handleToggleBeatPreview = (e: React.MouseEvent, beat: BeatDefinition) => {
    e.stopPropagation();
    if (isRecording) {
      onToast('⚠️ Backing beat is currently locked to your active recording.');
      return;
    }

    const isUnlocked = isBeatUnlocked(beat, playerStudioLevel);
    if (!isUnlocked) {
      playClickSound();
      setLockedBeatToUpgrade(beat);
      return;
    }

    setSelectedBeat(beat);
    const meta = getBeatMetadata(beat);
    setSelectedBeatMetadata(meta);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('freestyle_selected_beat_metadata', JSON.stringify(meta));
      } catch {}
    }

    if (isPlayingBeat && selectedBeat.id === beat.id) {
      stopBeatAudioLoop();
      setIsPlayingBeat(false);
      setIsPlayingVocalWithBeat(false);
    } else {
      startBeatAudioLoop(beat.id);
      setIsPlayingBeat(true);
      setIsBeatMutedInRecording(false);
    }
  };

  const handleDirectStudioUpgrade = (targetBeat: BeatDefinition) => {
    const targetLevel = targetBeat.requiredStudioLevel;
    const targetCatalogItem =
      STUDIO_LEVELS_CATALOG.find((item) => {
        if (targetLevel === 1) return item.id === 'street_studio';
        if (targetLevel === 2) return item.id === 'pro_studio';
        if (targetLevel === 3) return item.id === 'hitmaker_studio';
        if (targetLevel === 4) return item.id === 'celebrity_studio';
        return false;
      }) || STUDIO_LEVELS_CATALOG[targetLevel] || STUDIO_LEVELS_CATALOG[1];

    const cost = targetBeat.requiredCoins || targetCatalogItem.price;

    if (gameState.streetCoin < cost) {
      onToast(`Insufficient funds! Need ${cost.toLocaleString()} SC for Studio Level ${targetLevel}. Watch ad for +1,000 SC.`);
      return;
    }

    // Deduct coins
    addGameCoins(-cost, `-${cost} SC - Upgraded to ${targetCatalogItem.name}`, 'task_reward');
    playCoinSound();

    const currentOwned = { ...playerState.owned };
    const currentEquipped = { ...playerState.equipped };

    // Add target catalog item and all lower levels up to targetLevel
    STUDIO_LEVELS_CATALOG.forEach((studioItem, idx) => {
      if (idx <= targetLevel && !currentOwned.studioLevels.includes(studioItem.id)) {
        currentOwned.studioLevels.push(studioItem.id);
      }
    });
    currentEquipped.studio = targetCatalogItem.id;

    const updated = saveHustlePlayerState(userId, {
      owned: currentOwned,
      equipped: currentEquipped,
    });
    setPlayerState(updated);
    playSuccessSound();
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#EC4899', '#A855F7', '#00F0FF'],
      });
    } catch {}

    onToast(`🎉 Studio upgraded to ${targetCatalogItem.name}! "${targetBeat.title}" is now UNLOCKED!`);
    setSelectedBeat(targetBeat);
    const meta = getBeatMetadata(targetBeat);
    setSelectedBeatMetadata(meta);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('freestyle_selected_beat_metadata', JSON.stringify(meta));
      } catch {}
    }
    startBeatAudioLoop(targetBeat.id);
    setIsPlayingBeat(true);
    setLockedBeatToUpgrade(null);
  };

  const handleJumpToShopForStudio = () => {
    setLockedBeatToUpgrade(null);
    setMainTab('shop');
    setShopCategory('studio_levels');
    onToast('🛒 Navigated to Shop > Music Studio Levels!');
  };

  const handleStartRecordingFreestyle = async () => {
    if (playerState.energy < 5) {
      onToast("⚡ Need at least 5 Energy to record a freestyle! Eat or drink in Shop to restore energy.");
      return;
    }

    // Reset recorded track and revoke old object URL
    if (freestyleRecordedAudio) {
      try {
        URL.revokeObjectURL(freestyleRecordedAudio);
      } catch {}
    }
    setFreestyleRecordedAudio(null);
    setIsPlayingVocalWithBeat(false);
    setIsBeatMutedInRecording(false);

    try {
      let stream: MediaStream;
      if (freestyleMode === 'video') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          });
        } catch {
          // Camera denied/unavailable - fallback to audio
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      liveStreamRef.current = stream;

      audioChunksRef.current = [];
      const mimeType = freestyleMode === 'video' ? 'video/webm' : 'audio/webm';
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: freestyleMode === 'video' ? 'video/webm' : 'audio/webm',
        });
        const url = URL.createObjectURL(recordedBlob);
        setFreestyleRecordedAudio(url);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      onToast(`🎙️ Recording ${freestyleMode === 'video' ? 'Video + Audio' : 'Voice'} Freestyle! Backing beat playing in background...`);

      // Make the selected beat playable during recording so user stays on rhythm!
      startBeatAudioLoop(selectedBeat.id);
      setIsPlayingBeat(true);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 180) {
            setTimeout(() => {
              handleStopAndSubmitFreestyleRef.current();
            }, 0);
            return 180;
          }
          return next;
        });
      }, 1000);
    } catch {
      // Fallback live studio mode if mic is denied/unavailable
      setIsRecording(true);
      setRecordingSeconds(0);
      onToast(`🎙️ Studio mode active! Beat "${selectedBeat.title}" playing in background...`);
      startBeatAudioLoop(selectedBeat.id);
      setIsPlayingBeat(true);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 180) {
            setTimeout(() => {
              handleStopAndSubmitFreestyleRef.current();
            }, 0);
            return 180;
          }
          return next;
        });
      }, 1000);
    }
  };

  const handleStopAndSubmitFreestyle = () => {
    if (recordingSeconds < 60) {
      onToast(`⏱️ Too short! Minimum 1 minute (60s) required to send freestyle. (${60 - recordingSeconds}s left)`);
      return;
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    setIsRecording(false);
    stopBeatAudioLoop();
    setIsPlayingBeat(false);

    // Calculate payout & feedback based on equipped studio level
    const studioId = playerState.equipped.studio;
    let earnedCoins = 100;
    let earnedFans = 0;
    let feedbackMsg = '';

    if (studioId === 'celebrity_studio') {
      earnedCoins = 10000;
      earnedFans = 2500;
      feedbackMsg = '🌟 WORLDWIDE HIT! Viral across charts! Earned 10,000 SC + 2,500 fans!';
    } else if (studioId === 'hitmaker_studio') {
      earnedCoins = 5000;
      earnedFans = 1200;
      feedbackMsg = '👑 GOLD ANTHEM! Stadium radio smash! Earned 5,000 SC + 1,200 fans!';
    } else if (studioId === 'pro_studio') {
      earnedCoins = 2000;
      earnedFans = 500;
      feedbackMsg = '🔥 HIT! Blowing on the block! Earned 2,000 SC + 500 fans!';
    } else if (studioId === 'street_studio') {
      earnedCoins = 500;
      earnedFans = 100;
      feedbackMsg = '⚡ Solid street track! Upgraded sound! Earned 500 SC + 100 fans!';
    } else {
      // Bedroom starter
      earnedCoins = 100;
      earnedFans = 20;
      feedbackMsg = '🎤 Ghetto freestyle fire! Upgrade Studio for hit payouts! Earned 100 SC';
    }

    // Award coins and fans, consume 5 energy
    addGameCoins(earnedCoins, `+${earnedCoins} SC - Freestyle Track Hit`, 'task_reward');
    const newEnergy = Math.max(0, playerState.energy - 5);
    const updated = saveHustlePlayerState(userId, {
      energy: newEnergy,
      fansCount: playerState.fansCount + earnedFans,
    });
    setPlayerState(updated);
    setLastStudioPayoutMsg(feedbackMsg);
    playSuccessSound();
    onToast(feedbackMsg);

    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FACC15', '#00F0FF', '#FFFFFF'],
      });
    } catch {}
  };

  // Keep ref up to date
  useEffect(() => {
    handleStopAndSubmitFreestyleRef.current = handleStopAndSubmitFreestyle;
  });

  const handleToggleRecordedPreviewWithBeat = () => {
    const mediaEl: HTMLMediaElement | null =
      freestyleMode === 'video'
        ? recordedVideoPlaybackRef.current
        : recordedAudioRef.current;

    if (isPlayingVocalWithBeat) {
      stopBeatAudioLoop();
      setIsPlayingBeat(false);
      setIsPlayingVocalWithBeat(false);
      if (mediaEl) {
        mediaEl.pause();
      }
    } else {
      startBeatAudioLoop(selectedBeat.id);
      setIsPlayingBeat(true);
      setIsPlayingVocalWithBeat(true);
      if (mediaEl) {
        mediaEl.currentTime = 0;
        // Force browser to allow sound
        playMediaWithAutoplayFallback(mediaEl, () => {
          // Ask user to tap screen first to allow sound
          onToast('🔊 Tap anywhere on screen to allow sound');
        });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // GENERATE DYNAMIC PROMPT TEMPLATES (EXACT TEMPLATES FROM PROMPT 6)
  // ---------------------------------------------------------------------------
  const equippedClothesName =
    CLOTHES_CATALOG.find((c) => c.id === playerState.equipped.clothes)?.name ||
    'Basic T-shirt';

  const equippedHouseName =
    HOUSES_CATALOG.find((h) => h.id === playerState.equipped.house)?.name ||
    'Street Corner';

  const equippedVehicleName =
    VEHICLES_CATALOG.find((v) => v.id === playerState.equipped.vehicle)?.name ||
    'Walking';

  const equippedPhoneName =
    PHONES_CATALOG.find((p) => p.id === playerState.equipped.phone)?.name ||
    'Basic Phone';

  const equippedStudioName =
    STUDIO_LEVELS_CATALOG.find((s) => s.id === playerState.equipped.studio)?.name ||
    'Bedroom Studio (Starter)';

  const ownedDesignNames =
    playerState.equipped.installedHouseDesign.length > 0
      ? playerState.equipped.installedHouseDesign
          .map((id) => HOUSE_DESIGN_CATALOG.find((d) => d.id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : 'LED strip lights, cozy couch, plants';

  const ownedFilterNames =
    playerState.equipped.studioFilters.length > 0
      ? playerState.equipped.studioFilters
          .map((id) => STUDIO_FILTERS_CATALOG.find((f) => f.id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : 'standard mic and acoustic panels';

  const outsidePromptTemplate = `Generate image: Realistic photography, vertical 9:16, same young man [${equippedClothesName}], standing in front of [${equippedHouseName}] exterior, global modern city street, [${equippedVehicleName}] parked by his right side, holding [${equippedPhoneName}] in hand, high detail, photorealistic`;

  const insidePromptTemplate = `Generate image: Realistic photography, vertical 9:16, same young man [${equippedClothesName}] sitting inside [${equippedHouseName}] interior, cozy living room with [${ownedDesignNames}], holding [${equippedPhoneName}], warm LED lighting, photorealistic`;

  const studioPromptTemplate = `Generate image: Realistic photography, vertical 9:16, same young man [${equippedClothesName}] in [${equippedStudioName}] music studio interior, with [${ownedFilterNames} as equipment], LED lights, mic + mixer + acoustic panels, holding [${equippedPhoneName}], recording freestyle, photorealistic`;

  const vehiclePromptTemplate = `Generate image: Realistic photography, same young man [${equippedClothesName}] sitting inside/driving [${equippedVehicleName}], hands on wheel/handle, [${equippedPhoneName}] on dashboard, city through window`;

  return (
    <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain space-y-4 select-none font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 3. TOP NAVIGATION - INVENTORY HEADER */}
      {/* 🏪 INVENTORY - Street Hustle */}
      {/* [Shop] [Craft] [Market] [Studio 🔒/✅] */}
      {/* 💰 Balance: {SC} SC | ⚡ Energy: {ENERGY}/100 */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-3xl bg-[#0F0F14] border-2 border-[#FFD700]/70 p-4 shadow-[0_0_25px_rgba(255,215,0,0.15)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <h2 className="text-lg font-black tracking-tight text-white uppercase">
              INVENTORY - Street Hustle
            </h2>
          </div>
          <button
            onClick={() => setActiveViewMode('outside')}
            type="button"
            className="px-2.5 py-1 rounded-xl bg-yellow-400/20 border border-yellow-400/50 text-yellow-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(250,204,21,0.3)]"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Character</span>
          </button>
        </div>

        {/* 4 TOP TABS */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10">
          <button
            onClick={() => handleTabClick('shop')}
            type="button"
            className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
              mainTab === 'shop'
                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-[0_0_12px_rgba(250,204,21,0.5)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Shop</span>
          </button>

          <button
            onClick={() => handleTabClick('craft')}
            type="button"
            className="py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-all cursor-pointer"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Craft</span>
          </button>

          <button
            onClick={() => handleTabClick('market')}
            type="button"
            className="py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Market</span>
          </button>

          <button
            onClick={() => handleTabClick('studio')}
            type="button"
            className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
              mainTab === 'studio'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                : playerStudioLevel >= 1
                ? 'text-purple-300 hover:text-white border border-purple-500/30'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Studio</span>
            {playerStudioLevel >= 1 ? (
              <span className="text-[10px]">Lvl {playerStudioLevel} ✅</span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 text-[9px] font-bold">Lvl 0</span>
            )}
          </button>
        </div>

        {/* BALANCE & ENERGY STRIP */}
        <div className="flex items-center justify-between pt-1 text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5 text-[#FFD700]">
            <span>💰</span>
            <span>Balance:</span>
            <span className="text-white font-black text-sm">
              {gameState.streetCoin.toLocaleString()} SC
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400">
            <span>⚡</span>
            <span>Energy:</span>
            <span
              className={`font-black text-sm ${
                playerState.energy <= 20 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {playerState.energy}/100
            </span>
          </div>
        </div>

        {/* Rent Expiration Warning if applicable */}
        {playerState.equipped.houseType === 'rent' && playerState.equipped.rentExpiresTimestamp && (
          <div
            className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
              calculateDaysLeft(playerState.equipped.rentExpiresTimestamp, currentTimestamp) <= 0
                ? 'bg-red-500/20 border-red-500/50 text-red-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {calculateDaysLeft(playerState.equipped.rentExpiresTimestamp, currentTimestamp) <= 0
                ? '⚠️ Rent has EXPIRED! Renew to avoid street homelessness.'
                : `Rent Active: ${calculateDaysLeft(playerState.equipped.rentExpiresTimestamp, currentTimestamp)} days left`}
            </span>
            <button
              onClick={() => {
                setMainTab('shop');
                setShopCategory('houses');
              }}
              className="px-2.5 py-1 rounded-lg bg-yellow-400 text-black text-[10px] font-black uppercase hover:bg-yellow-300 transition-all cursor-pointer"
            >
              Renew Rent
            </button>
          </div>
        )}

        {/* 2. CURRENCY RULE: "Watch ad to get 1,000 SC" PROMPT */}
        <div className="pt-1 space-y-1.5">
          {isBalanceLow && (
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-[10px] text-amber-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>⚠️</span>
                <span>Low Balance (&lt; 10 SC). Watch ad to replenish funds!</span>
              </span>
              <span className="font-mono text-yellow-400 font-black">+10 SC</span>
            </div>
          )}
          <button
            onClick={handleWatchAdForCoins}
            disabled={isWatchingAd}
            type="button"
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border border-yellow-400/50 text-yellow-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(250,204,21,0.2)]"
          >
            <Tv className="w-4 h-4 text-yellow-400" />
            <span>
              {isWatchingAd ? 'Playing Ad Reward...' : 'Watch ad to get 10 SC'}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. EQUIP RULE CRITICAL PROFILE STRIP */}
      {/* Shows ONLY equipped: "👕 Designer Shirt | 🏠 Studio (Bought)..." */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 rounded-2xl bg-black/80 border border-white/10 text-[11px] text-gray-300 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-400">
          <span>Active Equipped Loadout (1 per category)</span>
          <span className="text-[#FFD700]">Profile Showcase</span>
        </div>
        <p className="font-mono text-xs text-white leading-relaxed">
          {formatEquippedProfileSummary(playerState)}
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. SHOP TAB - 8 CATEGORIES */}
      {/* ------------------------------------------------------------- */}
      {mainTab === 'shop' && (
        <div className="space-y-3">
          {/* 8 Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'clothes', label: 'Clothes', icon: '👕' },
              { id: 'houses', label: 'Houses', icon: '🏠' },
              { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
              { id: 'phones', label: 'Phones', icon: '📱' },
              { id: 'house_design', label: 'Design', icon: '✨' },
              { id: 'studio_levels', label: 'Studio', icon: '🎙️' },
              { id: 'studio_filters', label: 'Filters', icon: '🎛️' },
              { id: 'food_drinks', label: 'Food', icon: '🍔' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  playClickSound();
                  setShopCategory(cat.id as ShopCategory);
                }}
                type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                  shopCategory === cat.id
                    ? 'bg-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.5)]'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Jump to Freestyle Studio Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-[#181126] to-pink-950/50 border border-purple-500/40 flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-lg">
                🎙️
              </div>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>Freestyle Booth (15 Beats)</span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 text-[9px]">
                    Lvl {playerStudioLevel}
                  </span>
                </h4>
                <p className="text-[10px] text-purple-300">
                  {unlockedBeatsCount}/15 Beats Unlocked • Record & test beats
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playClickSound();
                setMainTab('studio');
              }}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Enter Booth</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* RENDER CURRENT CATEGORY ITEMS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* A) CLOTHES */}
            {shopCategory === 'clothes' &&
              CLOTHES_CATALOG.map((item) => {
                const isOwned = playerState.owned.clothes.includes(item.id);
                const isEquipped = playerState.equipped.clothes === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-[#FFD700]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-mono font-black text-[#FFD700]">
                          {item.price.toLocaleString()} SC
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 hover:bg-yellow-400/30'
                          }`}
                        >
                          {isEquipped ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Equipped</span>
                            </>
                          ) : (
                            <span>Wear</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(250,204,21,0.3)] active:scale-95 transition-all cursor-pointer"
                        >
                          Buy ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* B) HOUSES - RENT vs BUY */}
            {shopCategory === 'houses' &&
              HOUSES_CATALOG.map((item) => {
                const houseRecord = playerState.owned.houses[item.id];
                const isRentExpired = Boolean(
                  houseRecord?.type === 'rent' &&
                  houseRecord?.rentExpires &&
                  currentTimestamp >= houseRecord.rentExpires
                );
                const isOwned = Boolean(houseRecord) && !isRentExpired;
                const isEquipped = playerState.equipped.house === item.id && !isRentExpired;
                const isRent = item.type === 'rent';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-cyan-400/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isRent
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          }`}
                        >
                          {isRent ? 'RENT (30 DAYS)' : 'BUY (PERMANENT)'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                          }`}
                        >
                          {isEquipped ? 'Current Home' : 'Move In'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item, isRent)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                            isRent
                              ? 'bg-gradient-to-r from-cyan-400 to-teal-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                              : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-[0_0_10px_rgba(250,204,21,0.4)]'
                          }`}
                        >
                          {isRentExpired
                            ? `Renew Rent (${item.price.toLocaleString()} SC)`
                            : isRent
                            ? `Rent (${item.price.toLocaleString()} SC)`
                            : `Buy (${item.price.toLocaleString()} SC)`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* C) VEHICLES */}
            {shopCategory === 'vehicles' &&
              VEHICLES_CATALOG.map((item) => {
                const isOwned = playerState.owned.vehicles.includes(item.id) || item.price === 0;
                const isEquipped = playerState.equipped.vehicle === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-[#FFD700]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-mono font-black text-[#FFD700]">
                          {item.price === 0 ? 'FREE' : `${item.price.toLocaleString()} SC`}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                          }`}
                        >
                          {isEquipped ? 'Currently Driving' : 'Drive'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(250,204,21,0.3)] active:scale-95 transition-all cursor-pointer"
                        >
                          Buy ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* D) PHONES */}
            {shopCategory === 'phones' &&
              PHONES_CATALOG.map((item) => {
                const isOwned = playerState.owned.phones.includes(item.id) || item.price === 0;
                const isEquipped = playerState.equipped.phone === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-[#FFD700]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-mono font-black text-[#FFD700]">
                          {item.price === 0 ? 'FREE' : `${item.price.toLocaleString()} SC`}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                          }`}
                        >
                          {isEquipped ? 'Holding' : 'Hold'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(250,204,21,0.3)] active:scale-95 transition-all cursor-pointer"
                        >
                          Buy ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* E) HOUSE DESIGN - INSIDE ITEMS */}
            {shopCategory === 'house_design' &&
              HOUSE_DESIGN_CATALOG.map((item) => {
                const isOwned = (playerState.owned.houseDesign || []).includes(item.id);
                const isInstalled = (playerState.equipped.installedHouseDesign || []).includes(item.id);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-purple-400/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-mono font-black text-purple-300">
                          {item.price.toLocaleString()} SC
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isInstalled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                          }`}
                        >
                          {isInstalled ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Installed (Tap to Remove)</span>
                            </>
                          ) : (
                            <span>Install in Home</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.3)] active:scale-95 transition-all cursor-pointer"
                        >
                          Buy & Install ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* F) MUSIC STUDIO LEVELS */}
            {shopCategory === 'studio_levels' &&
              STUDIO_LEVELS_CATALOG.map((item) => {
                const isOwned = playerState.owned.studioLevels.includes(item.id);
                const isEquipped = playerState.equipped.studio === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-pink-400/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/40 text-[9px] font-black uppercase tracking-wider">
                          Sound {item.soundQuality}%
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-300 mt-0.5">{item.desc}</p>
                      <p className="text-[10px] text-emerald-400 font-bold mt-1">
                        Payout: +{item.payoutPerSong?.toLocaleString()} SC per track
                      </p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                          }`}
                        >
                          {isEquipped ? 'Active Studio' : 'Switch Studio'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(236,72,153,0.4)] active:scale-95 transition-all cursor-pointer"
                        >
                          Upgrade ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* G) STUDIO FILTERS */}
            {shopCategory === 'studio_filters' &&
              STUDIO_FILTERS_CATALOG.map((item) => {
                const isOwned = playerState.owned.studioFilters.includes(item.id);
                const isEquipped = playerState.equipped.studioFilters.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-cyan-400/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-mono font-black text-cyan-300">
                          {item.price.toLocaleString()} SC
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="pt-1">
                      {isOwned ? (
                        <button
                          onClick={() => handleEquipOwnedItem(item)}
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                          }`}
                        >
                          {isEquipped ? 'Equipped' : 'Equip Filter'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyItem(item)}
                          type="button"
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.3)] active:scale-95 transition-all cursor-pointer"
                        >
                          Buy ({item.price.toLocaleString()} SC)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* H) FOOD & DRINKS */}
            {shopCategory === 'food_drinks' &&
              FOOD_CATALOG.map((item) => {
                const stock = playerState.owned.foodStock[item.id] || 0;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#121218] border border-white/10 flex flex-col justify-between space-y-2 hover:border-emerald-400/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black">
                          {item.desc}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                        Cost: {item.price.toLocaleString()} SC • Owned: {stock}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => handleBuyItem(item)}
                        type="button"
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95 transition-all cursor-pointer"
                      >
                        Buy & Eat
                      </button>

                      {stock > 0 && (
                        <button
                          onClick={() => handleEatStockFood(item)}
                          type="button"
                          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase transition-all cursor-pointer"
                        >
                          Eat ({stock})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. MUSIC STUDIO TAB / WORKSPACE & FREESTYLE BOOTH */}
      {/* ------------------------------------------------------------- */}
      {mainTab === 'studio' && (
        <div className="rounded-3xl bg-gradient-to-b from-[#181124] to-[#0E0A16] border-2 border-purple-500/60 p-4 space-y-4 shadow-[0_0_25px_rgba(168,85,247,0.25)]">
          {/* Studio Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 text-[10px] font-black uppercase tracking-wider">
                  FREESTYLE BOOTH
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-black uppercase tracking-wider">
                  Level {playerStudioLevel} • {STUDIO_LEVEL_NAMES[playerStudioLevel] || currentStudioInfo.name}
                </span>
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mt-1 flex items-center gap-1.5">
                <span>{currentStudioInfo.name}</span>
                {playerStudioLevel >= 1 && <span className="text-emerald-400 text-sm">✅</span>}
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveViewMode('studio')}
                type="button"
                className="px-2.5 py-1.5 rounded-xl bg-purple-500/30 hover:bg-purple-500/40 border border-purple-400/50 text-purple-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Studio View</span>
              </button>
            </div>
          </div>

          {/* Studio Stats & Upgrade Banner */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-black/60 border border-white/10">
              <span className="text-[10px] text-gray-400 block">Sound Quality</span>
              <span className="text-sm font-black text-purple-300 font-mono">
                {currentStudioInfo.soundQuality || 40}%
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/60 border border-white/10">
              <span className="text-[10px] text-gray-400 block">Track Payout</span>
              <span className="text-sm font-black text-[#FFD700] font-mono">
                +{currentStudioInfo.payoutPerSong?.toLocaleString() || 100} SC
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/60 border border-white/10">
              <span className="text-[10px] text-gray-400 block">Fan Base</span>
              <span className="text-sm font-black text-pink-300 font-mono">
                {playerState.fansCount.toLocaleString()} Fans
              </span>
            </div>
          </div>

          {/* Unlocked Beats Progress Bar & Studio Upgrade CTA */}
          <div className="p-3 rounded-2xl bg-[#120D1A] border border-purple-500/30 flex items-center justify-between gap-3">
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-300 flex items-center gap-1">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  <span>Beats Library Access:</span>
                </span>
                <span className="text-purple-300 font-mono">
                  {unlockedBeatsCount} / {BEAT_LIBRARY.length} Unlocked
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 transition-all duration-300"
                  style={{
                    width: `${Math.round((unlockedBeatsCount / BEAT_LIBRARY.length) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {playerStudioLevel < 4 && (
              <button
                onClick={() => {
                  setMainTab('shop');
                  setShopCategory('studio_levels');
                  onToast('🛒 Choose a studio level to upgrade and unlock exclusive beats!');
                }}
                type="button"
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <span>Upgrade Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* SCREEN 1 - CHOOSE FREESTYLE TYPE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center justify-between">
              <span>Step 1: Choose Freestyle Type</span>
              <span className="text-[10px] text-purple-400 font-bold">
                Mode: {freestyleMode === 'audio' ? 'Audio Only 🎤' : 'Video + Audio 📹'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  playClickSound();
                  setFreestyleMode('audio');
                }}
                type="button"
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  freestyleMode === 'audio'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : 'bg-black/50 text-gray-400 border-white/10 hover:border-white/30'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>🎤 AUDIO FREESTYLE</span>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setFreestyleMode('video');
                }}
                type="button"
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  freestyleMode === 'video'
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                    : 'bg-black/50 text-gray-400 border-white/10 hover:border-white/30'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>📹 VIDEO FREESTYLE</span>
              </button>
            </div>
          </div>

          {/* SCREEN 2 - BEAT LIBRARY VISUAL GRID */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎵 Step 2: Beat Library</span>
                  <span className="text-[10px] font-normal text-gray-400">
                    ({BEAT_LIBRARY.length} Beats Available)
                  </span>
                </h4>
                <p className="text-[11px] text-gray-400">
                  Click any unlocked beat to select (highlighted in gold) and preview. Click locked beats to upgrade studio.
                </p>
              </div>

              {/* Active Selected Beat indicator */}
              <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#2B1F08] to-[#150F02] border border-[#FFD700]/70 text-[11px] text-[#FFD700] font-mono font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(255,215,0,0.25)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse" />
                <span>Selected: {selectedBeatMetadata.name} ({selectedBeatMetadata.bpm} BPM)</span>
              </div>
            </div>

            {/* SELECTED BEAT METADATA HUD CARD (Saved to Local State for Recording Flow) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#201505] via-[#150F1E] to-[#0E0A16] border-2 border-[#FFD700]/80 shadow-[0_0_25px_rgba(255,215,0,0.25)] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/60 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5" />
                    SAVED TO LOCAL STATE
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Active Beat for Recording Flow
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleToggleBeatPreview(e, selectedBeat)}
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-[#FFD700] hover:bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    {isPlayingBeat ? (
                      <>
                        <Square className="w-3 h-3 fill-black text-black" />
                        <span>Stop Loop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-black text-black" />
                        <span>Play Loop</span>
                      </>
                    )}
                  </button>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                    Ready for {freestyleMode === 'video' ? 'Video 📹' : 'Audio 🎤'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Beat Name</span>
                  <span className="font-black text-white flex items-center gap-1.5 mt-0.5 text-sm">
                    <span>{selectedBeatMetadata.icon}</span>
                    <span className="truncate">{selectedBeatMetadata.name} ({selectedBeatMetadata.title})</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Tempo & Genre</span>
                  <span className="font-mono font-black text-[#FFD700] mt-0.5 block text-sm">
                    ⚡ {selectedBeatMetadata.bpm} BPM • {selectedBeatMetadata.genre}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Audio File Path</span>
                  <span className="font-mono text-xs text-purple-300 truncate mt-0.5 block font-bold" title={selectedBeatMetadata.filePath}>
                    📁 {selectedBeatMetadata.filePath}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: `All (${BEAT_LIBRARY.length})` },
                { id: 'unlocked', label: `Unlocked (${unlockedBeatsCount})` },
                { id: 'locked', label: `Locked (${BEAT_LIBRARY.length - unlockedBeatsCount})` },
                { id: 0, label: 'Free (3)' },
                { id: 1, label: 'Lvl 1 (50k)' },
                { id: 2, label: 'Lvl 2 (100k)' },
                { id: 3, label: 'Lvl 3 (200k)' },
                { id: 4, label: 'Lvl 4 (500k)' },
              ].map((tab) => (
                <button
                  key={String(tab.id)}
                  onClick={() => {
                    playClickSound();
                    setBeatFilter(tab.id as typeof beatFilter);
                  }}
                  type="button"
                  className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
                    beatFilter === tab.id
                      ? 'bg-gradient-to-r from-amber-400 to-[#FFD700] text-black font-black shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                      : 'bg-black/50 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* BEATS VISUAL GRID - GOLD BORDER HIGHLIGHT ON SELECTION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {BEAT_LIBRARY.filter((beat) => {
                const isUnlocked = isBeatUnlocked(beat, playerStudioLevel);
                if (beatFilter === 'all') return true;
                if (beatFilter === 'unlocked') return isUnlocked;
                if (beatFilter === 'locked') return !isUnlocked;
                if (typeof beatFilter === 'number') return beat.requiredStudioLevel === beatFilter;
                return true;
              }).map((beat) => {
                const isUnlocked = isBeatUnlocked(beat, playerStudioLevel);
                const isSelected = selectedBeat.id === beat.id;
                const isPlayingThis = isPlayingBeat && isSelected;

                return (
                  <div
                    key={beat.id}
                    onClick={() => handleBeatCardClick(beat)}
                    className={`relative rounded-2xl p-4 flex flex-col justify-between transition-all cursor-pointer group ${
                      !isUnlocked
                        ? 'bg-gradient-to-b from-[#181224]/90 to-[#0C0914]/90 border border-amber-500/25 hover:border-amber-400/60 shadow-inner'
                        : isSelected
                        ? 'bg-gradient-to-b from-[#2B1F08] via-[#1D1405] to-[#0E0A03] border-2 border-[#FFD700] ring-2 ring-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.45)] scale-[1.01]'
                        : 'bg-gradient-to-b from-[#161622]/90 to-[#0E0E16]/90 border border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    {/* Top Row: Icon, BPM & Status / Preview Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md transition-all ${
                            !isUnlocked
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                              : isSelected
                              ? 'bg-[#FFD700]/25 border-2 border-[#FFD700] text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                              : 'bg-purple-500/20 border border-purple-400/40 text-purple-200'
                          }`}
                        >
                          {beat.icon}
                        </div>
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold block ${
                              isSelected
                                ? 'bg-[#FFD700]/15 border-[#FFD700]/40 text-[#FFD700]'
                                : 'bg-white/5 border-white/10 text-purple-300'
                            }`}
                          >
                            ⚡ {beat.bpm} BPM
                          </span>
                        </div>
                      </div>

                      <div>
                        {isUnlocked ? (
                          <div className="flex items-center gap-1.5">
                            {isSelected ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/60 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(255,215,0,0.3)]">
                                <Sparkles className="w-2.5 h-2.5" />
                                SELECTED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider">
                                {beat.isFree ? 'FREE' : 'UNLOCKED'}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleToggleBeatPreview(e, beat)}
                              type="button"
                              title={isPlayingThis ? 'Stop Beat Preview' : 'Play Beat Preview'}
                              className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                isPlayingThis
                                  ? 'bg-[#FFD700] text-black border-yellow-300 shadow-[0_0_15px_rgba(255,215,0,0.6)]'
                                  : isSelected
                                  ? 'bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] border-[#FFD700]/40'
                                  : 'bg-white/10 hover:bg-white/20 text-gray-300 border-white/15'
                              }`}
                            >
                              {isPlayingThis ? (
                                <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                                  <span className="w-1 bg-black rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                                  <span className="w-1 bg-black rounded-full animate-bounce [animation-delay:-0.15s] h-3.5" />
                                  <span className="w-1 bg-black rounded-full animate-bounce h-2" />
                                </div>
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>Level {beat.requiredStudioLevel}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title, Genre & File Path */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <h4 className={`text-sm font-black truncate ${isSelected ? 'text-[#FFD700]' : 'text-white'}`}>
                          {beat.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-bold truncate">
                          {beat.genre}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-300 leading-snug line-clamp-2">
                        {beat.description}
                      </p>

                      {/* File Path Metadata Display */}
                      <div className="pt-1">
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-mono truncate flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700]'
                            : 'bg-black/40 border border-white/5 text-gray-400'
                        }`}>
                          <span>📁</span>
                          <span className="truncate">{beat.filePath}</span>
                        </div>
                      </div>

                      {/* Badges if present */}
                      {beat.badge && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-pink-500/40 text-pink-300 text-[9px] font-black tracking-wide uppercase">
                            <Sparkles className="w-2.5 h-2.5 text-pink-400" />
                            <span>{beat.badge}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-3 pt-2 border-t border-white/5">
                      {isUnlocked ? (
                        isSelected ? (
                          <div className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#F59E0B] text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(255,215,0,0.45)]">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-black text-[#FFD700]" />
                            <span>Selected for Freestyle ✓</span>
                          </div>
                        ) : (
                          <div className="w-full py-2 px-2.5 rounded-xl bg-white/5 group-hover:bg-[#FFD700]/15 border border-white/10 group-hover:border-[#FFD700]/50 text-gray-300 group-hover:text-[#FFD700] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all">
                            <span>Select Beat 🎵</span>
                          </div>
                        )
                      ) : (
                        <div className="w-full py-2 px-2.5 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Upgrade Studio to Unlock</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECORD FREESTYLE BOOTH CTA & PLAYBACK */}
          <div className="p-4 rounded-3xl bg-black/85 border-2 border-purple-500/50 text-center space-y-4 shadow-inner">
            <div className="flex flex-col items-center">
              <span className="text-3xl">🎙️</span>
              <h4 className="text-base font-black text-white mt-1">
                {isRecording ? 'LIVE FREESTYLE RECORDING IN PROGRESS...' : 'STEP 3: RECORD FREESTYLE TRACK'}
              </h4>
              <p className="text-xs text-gray-300 mt-0.5">
                {isRecording
                  ? `Speaking on mic... ${recordingSeconds}s elapsed (${recordingSeconds < 60 ? `Need ${60 - recordingSeconds}s more` : 'Minimum 60s reached ✅'})`
                  : `Selected Beat: "${selectedBeatMetadata.name}" • ${selectedBeatMetadata.bpm} BPM • Plays live while recording`}
              </p>
            </div>

            {/* Video Live Preview Stream (When in Video Mode & Recording) */}
            {freestyleMode === 'video' && isRecording && (
              <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-pink-500/60 bg-black aspect-video sm:aspect-square flex items-center justify-center shadow-[0_0_25px_rgba(236,72,153,0.3)]">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>REC • {recordingSeconds}s</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 p-2 rounded-xl bg-black/80 backdrop-blur-sm border border-white/10 text-left text-[11px] text-[#FFD700] font-mono flex items-center justify-between">
                  <span>🎵 {selectedBeatMetadata.name} ({selectedBeatMetadata.bpm} BPM)</span>
                  <span className="text-emerald-400 font-bold">Live Sync</span>
                </div>
              </div>
            )}

            {/* Beat Audio Monitoring & Status Pill */}
            <div className="p-3 rounded-2xl bg-[#120F1C] border border-purple-500/30 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
                  <Music className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-gray-400 text-[10px] block uppercase font-bold">Selected Beat Audio</span>
                  <span className="text-white font-black">{selectedBeatMetadata.name} ({selectedBeatMetadata.bpm} BPM)</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleToggleBeatPreview(e, selectedBeat)}
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isPlayingBeat ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                      <span>Stop Beat</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#FFD700] fill-[#FFD700]" />
                      <span>Test Beat Audio</span>
                    </>
                  )}
                </button>

                {isRecording && (
                  <button
                    onClick={() => {
                      if (isPlayingBeat) {
                        stopBeatAudioLoop();
                        setIsPlayingBeat(false);
                        setIsBeatMutedInRecording(true);
                      } else {
                        startBeatAudioLoop(selectedBeat.id);
                        setIsPlayingBeat(true);
                        setIsBeatMutedInRecording(false);
                      }
                    }}
                    type="button"
                    className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-[11px] text-purple-200 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isBeatMutedInRecording ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{isBeatMutedInRecording ? 'Unmute Beat' : 'Mute Beat'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            {isRecording ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (recordingSeconds < 60) {
                      onToast(`⏱️ Too short! Minimum 1 minute (60s) required to send track. (${60 - recordingSeconds}s remaining)`);
                      return;
                    }
                    handleStopAndSubmitFreestyle();
                  }}
                  type="button"
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer ${
                    recordingSeconds >= 60
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)] animate-pulse'
                      : 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  }`}
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>
                    Finish & Submit Track ({recordingSeconds}s / {recordingSeconds < 60 ? `Need ${60 - recordingSeconds}s more` : 'Ready to Send! ✅'})
                  </span>
                </button>
                <p className="text-[10px] text-gray-400">
                  Minimum 60 seconds required. Playing &ldquo;{selectedBeatMetadata.name}&rdquo; at {selectedBeatMetadata.bpm} BPM.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartRecordingFreestyle}
                    type="button"
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_25px_rgba(168,85,247,0.5)] cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Record Freestyle Now (-5 Energy)</span>
                  </button>
                  <button
                    onClick={() => setShowAdsgramChain(true)}
                    type="button"
                    title="Watch 3 Ads for 1,000 SC"
                    className="px-3.5 py-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Tv className="w-4 h-4" />
                    <span>+10 SC</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Requires 5 Energy. Backing beat &ldquo;{selectedBeatMetadata.name}&rdquo; ({selectedBeatMetadata.bpm} BPM) loops live during recording.
                </p>
              </div>
            )}

            {/* RECORDED FREESTYLE TRACK PREVIEW & SYNC PLAYBACK */}
            {freestyleRecordedAudio && !isRecording && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#1E142B] to-[#100B18] border-2 border-emerald-500/50 text-left space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      Recorded Track Ready for Preview
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    Duration: {recordingSeconds}s
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs space-y-1">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <span>🎵 Beat: {selectedBeatMetadata.name} ({selectedBeatMetadata.bpm} BPM)</span>
                  </div>
                  <div className="text-gray-400 text-[10px] font-mono truncate">
                    📁 Track Path: {selectedBeatMetadata.filePath}
                  </div>
                </div>

                {/* Audio/Video Media Element */}
                {freestyleMode === 'video' ? (
                  <video
                    ref={recordedVideoPlaybackRef}
                    src={freestyleRecordedAudio}
                    controls
                    playsInline
                    className="w-full rounded-xl border border-white/20 bg-black aspect-video max-h-60"
                    onEnded={() => {
                      setIsPlayingVocalWithBeat(false);
                      stopBeatAudioLoop();
                      setIsPlayingBeat(false);
                    }}
                    onPause={() => {
                      if (isPlayingVocalWithBeat) {
                        setIsPlayingVocalWithBeat(false);
                        stopBeatAudioLoop();
                        setIsPlayingBeat(false);
                      }
                    }}
                  />
                ) : (
                  <audio
                    ref={recordedAudioRef}
                    src={freestyleRecordedAudio}
                    controls
                    className="w-full"
                    onEnded={() => {
                      setIsPlayingVocalWithBeat(false);
                      stopBeatAudioLoop();
                      setIsPlayingBeat(false);
                    }}
                    onPause={() => {
                      if (isPlayingVocalWithBeat) {
                        setIsPlayingVocalWithBeat(false);
                        stopBeatAudioLoop();
                        setIsPlayingBeat(false);
                      }
                    }}
                  />
                )}

                {/* Simultaneous Vocal + Beat Playback Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleToggleRecordedPreviewWithBeat}
                    type="button"
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                      isPlayingVocalWithBeat
                        ? 'bg-rose-600 text-white border border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    }`}
                  >
                    {isPlayingVocalWithBeat ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-white text-white" />
                        <span>Stop Vocal + Beat Playback</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-black text-black" />
                        <span>Play Vocal With Backing Beat ({selectedBeatMetadata.bpm} BPM)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (freestyleRecordedAudio) {
                        try {
                          URL.revokeObjectURL(freestyleRecordedAudio);
                        } catch {}
                      }
                      setFreestyleRecordedAudio(null);
                      setIsPlayingVocalWithBeat(false);
                      stopBeatAudioLoop();
                      setIsPlayingBeat(false);
                      onToast('Ready to record a new take!');
                    }}
                    type="button"
                    className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    New Take
                  </button>
                </div>
              </div>
            )}

            {lastStudioPayoutMsg && (
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-xs text-purple-200 font-bold">
                {lastStudioPayoutMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* UPGRADE STUDIO TO UNLOCK POPUP MODAL */}
      {/* ------------------------------------------------------------- */}
      {lockedBeatToUpgrade && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1F172C] via-[#140F1E] to-[#0C0812] border-2 border-amber-400/80 p-5 shadow-[0_0_40px_rgba(245,158,11,0.35)] text-left space-y-4">
            {/* Close button */}
            <button
              onClick={() => setLockedBeatToUpgrade(null)}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Lock className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase tracking-wider">
                  LOCKED STUDIO BEAT
                </span>
                <h3 className="text-base font-black text-white tracking-tight mt-0.5">
                  Upgrade Studio to Unlock
                </h3>
              </div>
            </div>

            {/* Beat Spotlight Card */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{lockedBeatToUpgrade.icon}</span>
                  <div>
                    <h4 className="text-sm font-black text-white">{lockedBeatToUpgrade.title}</h4>
                    <p className="text-[10px] text-purple-300">{lockedBeatToUpgrade.genre} • {lockedBeatToUpgrade.bpm} BPM</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-mono font-bold">
                  ⚡ {lockedBeatToUpgrade.bpm} BPM
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-snug">
                {lockedBeatToUpgrade.description}
              </p>

              {lockedBeatToUpgrade.badge && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-pink-500/20 border border-pink-400/40 text-pink-300 text-[10px] font-black uppercase">
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    <span>{lockedBeatToUpgrade.badge}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Studio Requirements Breakdown */}
            <div className="p-3.5 rounded-2xl bg-[#0F0C16] border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Required Studio:</span>
                <span className="font-black text-amber-300">
                  Level {lockedBeatToUpgrade.requiredStudioLevel} ({STUDIO_LEVEL_NAMES[lockedBeatToUpgrade.requiredStudioLevel] || 'Upgraded Studio'})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Upgrade Cost:</span>
                <span className="font-black text-[#FFD700] font-mono">
                  {lockedBeatToUpgrade.requiredCoins.toLocaleString()} SC
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Your Current Studio:</span>
                <span className="font-bold text-gray-200">
                  Level {playerStudioLevel} ({currentStudioInfo.name})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                <span className="text-gray-400">Your Street Coins:</span>
                <span className="font-black text-white font-mono">
                  {gameState.streetCoin.toLocaleString()} SC
                </span>
              </div>

              {/* Balance Progress Bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      gameState.streetCoin >= lockedBeatToUpgrade.requiredCoins
                        ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                        : 'bg-gradient-to-r from-amber-400 to-yellow-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((gameState.streetCoin / lockedBeatToUpgrade.requiredCoins) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>Balance Coverage</span>
                  <span>
                    {Math.min(100, Math.round((gameState.streetCoin / lockedBeatToUpgrade.requiredCoins) * 100))}%
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {gameState.streetCoin >= lockedBeatToUpgrade.requiredCoins ? (
                <button
                  onClick={() => handleDirectStudioUpgrade(lockedBeatToUpgrade)}
                  type="button"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(255,215,0,0.5)] active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>UPGRADE STUDIO NOW ({lockedBeatToUpgrade.requiredCoins.toLocaleString()} SC)</span>
                </button>
              ) : (
                <>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-[11px] text-amber-300 font-bold">
                    ⚠️ Need {(lockedBeatToUpgrade.requiredCoins - gameState.streetCoin).toLocaleString()} more SC to upgrade!
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleJumpToShopForStudio}
                      type="button"
                      className="py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Shop Studios</span>
                    </button>
                    <button
                      onClick={() => {
                        handleWatchAdForCoins();
                      }}
                      type="button"
                      className="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>+10 SC Ad</span>
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={() => setLockedBeatToUpgrade(null)}
                type="button"
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. IMAGE GENERATION - 3 VIEWS / 4 VIEWS MODAL SHOWCASE */}
      {/* ------------------------------------------------------------- */}
      {activeViewMode && (
        <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-xl flex flex-col p-3 overflow-y-auto font-sans animate-in fade-in select-none">
          <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between py-2 space-y-3">
            {/* Header / Mode Switcher */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveViewMode('outside');
                  }}
                  type="button"
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase ${
                    activeViewMode === 'outside'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Outside View
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveViewMode('inside');
                  }}
                  type="button"
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase ${
                    activeViewMode === 'inside'
                      ? 'bg-cyan-400 text-black'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Inside House
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveViewMode('studio');
                  }}
                  type="button"
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase ${
                    activeViewMode === 'studio'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Studio
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveViewMode('vehicle');
                  }}
                  type="button"
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase ${
                    activeViewMode === 'vehicle'
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Vehicle
                </button>
              </div>

              <button
                onClick={() => {
                  playClickSound();
                  setActiveViewMode(null);
                }}
                type="button"
                className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* REALISTIC 9:16 PHOTOGRAPHY CONTAINER */}
            <div className="relative w-full aspect-[9/16] max-h-[520px] rounded-3xl overflow-hidden border-2 border-white/20 bg-black shadow-2xl mx-auto flex items-center justify-center">
              <img
                src={
                  activeViewMode === 'outside'
                    ? HUSTLE_VIEW_IMAGES.outside
                    : activeViewMode === 'inside'
                    ? HUSTLE_VIEW_IMAGES.inside
                    : activeViewMode === 'studio'
                    ? HUSTLE_VIEW_IMAGES.studio
                    : HUSTLE_VIEW_IMAGES.vehicle
                }
                alt={`Street Hustle ${activeViewMode} View`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />

              {/* Dynamic Overlay Tag */}
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {activeViewMode === 'outside' && 'A) OUTSIDE VIEW'}
                  {activeViewMode === 'inside' && 'B) INSIDE HOUSE VIEW'}
                  {activeViewMode === 'studio' && 'C) STUDIO VIEW'}
                  {activeViewMode === 'vehicle' && 'D) VEHICLE VIEW'}
                </span>
              </div>
            </div>

            {/* EXACT PROMPT TEMPLATE ACCORDING TO USER SPEC */}
            <div className="p-3 rounded-2xl bg-black/80 border border-white/15 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400 block">
                Prompt Template (Realistic Photography • Vertical 9:16):
              </span>
              <p className="text-[10px] font-mono text-gray-300 leading-snug">
                {activeViewMode === 'outside' && outsidePromptTemplate}
                {activeViewMode === 'inside' && insidePromptTemplate}
                {activeViewMode === 'studio' && studioPromptTemplate}
                {activeViewMode === 'vehicle' && vehiclePromptTemplate}
              </p>
            </div>

            {/* MANDATORY ACTION BUTTONS SPECIFIED PER VIEW */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {activeViewMode === 'outside' && (
                <>
                  <button
                    onClick={() => setActiveViewMode('inside')}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    View Inside
                  </button>
                  <button
                    onClick={() => setActiveViewMode('vehicle')}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    Enter Vehicle
                  </button>
                  <button
                    onClick={() => setActiveViewMode('studio')}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold text-xs uppercase"
                  >
                    View Studio
                  </button>
                  <button
                    onClick={() => {
                      setActiveViewMode(null);
                      setMainTab('shop');
                      setShopCategory('house_design');
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    Design House
                  </button>
                  <button
                    onClick={() => setActiveViewMode(null)}
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-yellow-400 text-black font-black text-xs uppercase tracking-wider"
                  >
                    Inventory
                  </button>
                </>
              )}

              {activeViewMode === 'inside' && (
                <>
                  <button
                    onClick={() => setActiveViewMode('outside')}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    View Outside
                  </button>
                  <button
                    onClick={() => {
                      setActiveViewMode(null);
                      setMainTab('shop');
                      setShopCategory('house_design');
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/40 font-bold text-xs uppercase"
                  >
                    Design House
                  </button>
                  <button
                    onClick={() => setActiveViewMode(null)}
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-yellow-400 text-black font-black text-xs uppercase tracking-wider"
                  >
                    Inventory
                  </button>
                </>
              )}

              {activeViewMode === 'studio' && (
                <>
                  <button
                    onClick={() => {
                      setActiveViewMode(null);
                      setMainTab('studio');
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-xs uppercase"
                  >
                    🎙️ Record Freestyle
                  </button>
                  <button
                    onClick={() => {
                      setActiveViewMode(null);
                      setMainTab('shop');
                      setShopCategory('studio_levels');
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    🛒 Upgrade Studio
                  </button>
                  <button
                    onClick={() => {
                      setActiveViewMode(null);
                      setMainTab('shop');
                      setShopCategory('studio_filters');
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    🎛️ Buy Filters
                  </button>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => setActiveViewMode('outside')}
                      type="button"
                      className="flex-1 py-2 rounded-xl bg-white/5 text-gray-300 text-xs font-bold"
                    >
                      View Outside
                    </button>
                    <button
                      onClick={() => setActiveViewMode('inside')}
                      type="button"
                      className="flex-1 py-2 rounded-xl bg-white/5 text-gray-300 text-xs font-bold"
                    >
                      View Inside
                    </button>
                  </div>
                </>
              )}

              {activeViewMode === 'vehicle' && (
                <>
                  <button
                    onClick={() => setActiveViewMode('outside')}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
                  >
                    Exit Vehicle
                  </button>
                  <button
                    onClick={() => {
                      if (playerState.energy <= 0 && playerState.equipped.vehicle !== 'walking') {
                        onToast("⚡ Energy is 0! Can't drive vehicle. Eat food or drink in Shop to restore energy.");
                        return;
                      }
                      playPickupSound();
                      onToast(`🚗 Driving ${equippedVehicleName} through modern city streets!`);
                    }}
                    type="button"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs uppercase cursor-pointer"
                  >
                    Drive
                  </button>
                  <button
                    onClick={() => setActiveViewMode(null)}
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-white/10 text-white font-black text-xs uppercase tracking-wider"
                  >
                    Inventory
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADSGRAM 3-CHAIN MODAL */}
      <AdsgramThreeChainModal
        isOpen={showAdsgramChain}
        onClose={() => setShowAdsgramChain(false)}
        onCompleteChain={(totalCoins) => {
          setShowAdsgramChain(false);
          addGameCoins(totalCoins, `+${totalCoins} SC - Adsgram 3-Chain Completed`, 'ad_reward');
          onToast(`🔥 +${totalCoins} SC credited from Adsgram Chain!`);
        }}
      />
    </div>
  );
}
