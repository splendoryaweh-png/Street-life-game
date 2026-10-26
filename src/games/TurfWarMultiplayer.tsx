'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Swords,
  Shield,
  Heart,
  Skull,
  Crosshair,
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
  Bus,
  ArrowLeft,
  RotateCcw,
  Target,
  Radio,
  Share2,
  Check,
  AlertCircle,
  Award,
} from 'lucide-react';
import { TurfWarLobby, TurfRole, TurfLobbyPlayer } from './TurfWarLobby';
import {
  playShootSound,
  playPunchSound,
  playCoinSound,
  playSuccessSound,
  playClickSound,
  playSirenSound,
} from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';

export interface TurfWarMultiplayerProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
  initialRoomCode?: string;
}

interface PlayerState {
  id: string;
  name: string;
  role: TurfRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  kills: number;
  score: number;
  color: string;
  isMe: boolean;
  isAlive: boolean;
  isFiring: boolean;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
}

interface Enemy {
  id: string;
  type: 'thug' | 'enforcer' | 'boss' | 'bus';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  lastAttack: number;
  targetPlayerId: string;
}

interface Bullet {
  id: string;
  playerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  life: number;
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

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
}

interface TurfZone {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  control: number; // -100 (Enemy) to 100 (Players)
  color: string;
}

const MATCH_DURATION_SECONDS = 3600; // 1 HOUR PER MATCH

export const TurfWarMultiplayer: React.FC<TurfWarMultiplayerProps> = ({
  onBack,
  onToast,
  currentCoins,
  initialRoomCode,
}) => {
  // Lobby state vs In-game state
  const [inGame, setInGame] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [isHost, setIsHost] = useState(true);
  const [myRole, setMyRole] = useState<TurfRole>('attacker');
  const [lobbyPlayers, setLobbyPlayers] = useState<TurfLobbyPlayer[]>([]);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Match stats
  const [matchTimeRemaining, setMatchTimeRemaining] = useState(MATCH_DURATION_SECONDS);
  const [currentWave, setCurrentWave] = useState(1);
  const [waveEnemiesRemaining, setWaveEnemiesRemaining] = useState(5);
  const [totalKills, setTotalKills] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isHourVictory, setIsHourVictory] = useState(false);

  // My Player ID
  const myPlayerId = useRef<string>(
    'p_' + Math.random().toString(36).substring(2, 8)
  );

  // Canvas & Game loop refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Live game entities stored in refs for 60fps performance
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const turfZonesRef = useRef<TurfZone[]>([
    { id: 'zone_a', name: 'TURF ALPHA (North)', x: 400, y: 220, radius: 90, control: 50, color: '#10B981' },
    { id: 'zone_b', name: 'TURF BRAVO (Central)', x: 800, y: 600, radius: 110, control: 20, color: '#3B82F6' },
    { id: 'zone_c', name: 'TURF CHARLIE (South)', x: 1200, y: 980, radius: 90, control: -30, color: '#F59E0B' },
  ]);

  // Keys & Input state
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const joystickPosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const touchAimRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const isShootingRef = useRef<boolean>(false);
  const lastShootTimeRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const waveSpawningRef = useRef<boolean>(false);

  // Camera viewport offset
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map boundaries
  const MAP_WIDTH = 1600;
  const MAP_HEIGHT = 1200;

  // Initialize my player
  const initMyPlayer = useCallback(
    (role: TurfRole, name = 'You') => {
      const isAttacker = role === 'attacker';
      const maxHp = isAttacker ? 220 : 320;
      const maxArmor = isAttacker ? 100 : 250;
      const myState: PlayerState = {
        id: myPlayerId.current,
        name,
        role,
        x: 800 + (Math.random() * 80 - 40),
        y: 600 + (Math.random() * 80 - 40),
        vx: 0,
        vy: 0,
        angle: 0,
        hp: maxHp,
        maxHp,
        armor: maxArmor,
        maxArmor,
        kills: 0,
        score: 0,
        color: isAttacker ? '#EF4444' : '#3B82F6',
        isMe: true,
        isAlive: true,
        isFiring: false,
        ammo: 30,
        maxAmmo: 30,
        isReloading: false,
        reloadProgress: 0,
      };

      playersRef.current.set(myPlayerId.current, myState);
    },
    []
  );

  // Spawn unlimited wave formula:
  // enemyCount = wave * 2 + 3
  // enemyHealth = 100 + wave * 15
  // enemyDamage = 10 + wave * 2
  const spawnUnlimitedWave = useCallback((waveNum: number) => {
    waveSpawningRef.current = true;
    const enemyCount = waveNum * 2 + 3;
    const baseHp = 100 + waveNum * 15;
    const baseDmg = 10 + waveNum * 2;
    const newEnemies: Enemy[] = [];

    // Boss bus or armored enforcer every 3 waves
    const hasBossBus = waveNum % 3 === 0;

    for (let i = 0; i < enemyCount; i++) {
      // Spawn at perimeter
      const side = Math.floor(Math.random() * 4);
      let ex = 0;
      let ey = 0;
      if (side === 0) {
        ex = Math.random() * MAP_WIDTH;
        ey = -50;
      } else if (side === 1) {
        ex = MAP_WIDTH + 50;
        ey = Math.random() * MAP_HEIGHT;
      } else if (side === 2) {
        ex = Math.random() * MAP_WIDTH;
        ey = MAP_HEIGHT + 50;
      } else {
        ex = -50;
        ey = Math.random() * MAP_HEIGHT;
      }

      const isEnforcer = i % 4 === 0;
      newEnemies.push({
        id: `enemy_w${waveNum}_${i}_${Math.random()}`,
        type: isEnforcer ? 'enforcer' : 'thug',
        x: ex,
        y: ey,
        vx: 0,
        vy: 0,
        hp: isEnforcer ? Math.round(baseHp * 1.6) : baseHp,
        maxHp: isEnforcer ? Math.round(baseHp * 1.6) : baseHp,
        speed: isEnforcer ? 1.8 : 2.3,
        damage: isEnforcer ? Math.round(baseDmg * 1.4) : baseDmg,
        radius: isEnforcer ? 22 : 16,
        color: isEnforcer ? '#9333EA' : '#DC2626',
        lastAttack: 0,
        targetPlayerId: myPlayerId.current,
      });
    }

    if (hasBossBus) {
      newEnemies.push({
        id: `enemy_bus_${waveNum}`,
        type: 'bus',
        x: Math.random() > 0.5 ? -100 : MAP_WIDTH + 100,
        y: MAP_HEIGHT / 2 + (Math.random() * 200 - 100),
        vx: 0,
        vy: 0,
        hp: baseHp * 4,
        maxHp: baseHp * 4,
        speed: 1.2,
        damage: baseDmg * 2.2,
        radius: 42,
        color: '#EAB308',
        lastAttack: 0,
        targetPlayerId: myPlayerId.current,
      });
      playSirenSound();
    }

    enemiesRef.current = newEnemies;
    setWaveEnemiesRemaining(newEnemies.length);
    waveSpawningRef.current = false;
  }, []);

  // Start match from Lobby
  const handleStartMatch = (
    code: string,
    host: boolean,
    role: TurfRole,
    players: TurfLobbyPlayer[]
  ) => {
    setRoomCode(code);
    setIsHost(host);
    setMyRole(role);
    setLobbyPlayers(players);
    setInGame(true);

    initMyPlayer(role);

    // Register teammates
    players.forEach((p) => {
      if (p.id !== myPlayerId.current) {
        playersRef.current.set(p.id, {
          id: p.id,
          name: p.name,
          role: p.role,
          x: 800 + (Math.random() * 100 - 50),
          y: 600 + (Math.random() * 100 - 50),
          vx: 0,
          vy: 0,
          angle: 0,
          hp: p.role === 'attacker' ? 220 : 320,
          maxHp: p.role === 'attacker' ? 220 : 320,
          armor: p.role === 'attacker' ? 100 : 250,
          maxArmor: p.role === 'attacker' ? 100 : 250,
          kills: 0,
          score: 0,
          color: p.role === 'attacker' ? '#EF4444' : '#3B82F6',
          isMe: false,
          isAlive: true,
          isFiring: false,
          ammo: 30,
          maxAmmo: 30,
          isReloading: false,
          reloadProgress: 0,
        });
      }
    });

    // Host spawns wave 1
    if (host) {
      spawnUnlimitedWave(1);
    }

    // Set up BroadcastChannel
    const channelName = `turfwar_${code}`;
    const channel = new BroadcastChannel(channelName);
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PLAYER_SYNC') {
        const p = playersRef.current.get(data.id);
        if (p && !p.isMe) {
          p.x = data.x;
          p.y = data.y;
          p.angle = data.angle;
          p.hp = data.hp;
          p.armor = data.armor;
          p.kills = data.kills;
          p.isFiring = data.isFiring;
          p.isAlive = data.isAlive;
        } else if (!p && data.id !== myPlayerId.current) {
          playersRef.current.set(data.id, {
            id: data.id,
            name: data.name || 'Teammate',
            role: data.role || 'defender',
            x: data.x,
            y: data.y,
            vx: 0,
            vy: 0,
            angle: data.angle,
            hp: data.hp,
            maxHp: data.maxHp || 250,
            armor: data.armor,
            maxArmor: data.maxArmor || 150,
            kills: data.kills || 0,
            score: 0,
            color: data.role === 'attacker' ? '#EF4444' : '#3B82F6',
            isMe: false,
            isAlive: data.isAlive ?? true,
            isFiring: data.isFiring ?? false,
            ammo: 30,
            maxAmmo: 30,
            isReloading: false,
            reloadProgress: 0,
          });
        }
      } else if (data.type === 'BULLET_SPAWN') {
        if (data.playerId !== myPlayerId.current) {
          bulletsRef.current.push(data.bullet);
        }
      } else if (data.type === 'ENEMY_SYNC' && !host) {
        enemiesRef.current = data.enemies;
        setCurrentWave(data.wave);
        setWaveEnemiesRemaining(data.enemies.length);
      } else if (data.type === 'WAVE_ADVANCE') {
        setCurrentWave(data.wave);
        if (host) {
          spawnUnlimitedWave(data.wave);
        }
      } else if (data.type === 'MATCH_TICK' && !host) {
        setMatchTimeRemaining(data.remaining);
      }
    };

    onToast(`Joined 1-Hour Turf War: ${code}!`);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r') {
        triggerReload();
      }
      if (e.key === ' ' || e.code === 'Space') {
        isShootingRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      if (e.key === ' ' || e.code === 'Space') {
        isShootingRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Reload action
  const triggerReload = () => {
    const me = playersRef.current.get(myPlayerId.current);
    if (!me || me.isReloading || me.ammo === me.maxAmmo) return;
    me.isReloading = true;
    me.reloadProgress = 0;
  };

  // 1-Hour Match Countdown Timer (Decrements every second)
  useEffect(() => {
    if (!inGame || isGameOver || isHourVictory) return;

    const timer = setInterval(() => {
      setMatchTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleMatchHourCompleted();
          return 0;
        }

        // Host syncs time tick
        if (isHost && broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'MATCH_TICK',
            remaining: prev - 1,
          });
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame, isGameOver, isHourVictory, isHost]);

  // Handle 1-Hour Match Completion
  const handleMatchHourCompleted = () => {
    setIsHourVictory(true);
    // Rewards: 10 coins per kill, 100 per wave, 1000 bonus for 1 hour
    const killBonus = totalKills * 10;
    const waveBonus = currentWave * 100;
    const hourBonus = 1000;
    const totalAward = killBonus + waveBonus + hourBonus;

    setEarnedCoins(totalAward);
    addGameCoins(totalAward, `+${totalAward} SC - 1-Hour Turf War Survived!`, 'wave_complete');
    playSuccessSound();
    confetti({ particleCount: 150, spread: 90 });
    onToast(`1-HOUR SURVIVED! +${totalAward} Street Coins!`);
  };

  // Player died
  const handlePlayerDied = () => {
    setIsGameOver(true);
    const killBonus = totalKills * 10;
    const waveBonus = Math.max(0, (currentWave - 1) * 100);
    const totalAward = killBonus + waveBonus;
    setEarnedCoins(totalAward);
    if (totalAward > 0) {
      addGameCoins(totalAward, `+${totalAward} SC - Turf War Wave ${currentWave} Reached`, 'wave_complete');
    }
    playPunchSound();
  };

  // Fire bullet
  const fireBullet = (me: PlayerState, angle: number) => {
    if (me.ammo <= 0) {
      triggerReload();
      return;
    }
    me.ammo -= 1;
    const speed = 14;
    const isAttacker = me.role === 'attacker';
    const baseDamage = isAttacker ? 42 : 28;

    const bulletId = `b_${myPlayerId.current}_${Date.now()}_${Math.random()}`;
    const newBullet: Bullet = {
      id: bulletId,
      playerId: me.id,
      x: me.x + Math.cos(angle) * 24,
      y: me.y + Math.sin(angle) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: baseDamage,
      color: isAttacker ? '#F87171' : '#60A5FA',
      life: 65,
      radius: isAttacker ? 4.5 : 3.5,
    };

    bulletsRef.current.push(newBullet);

    // Attacker role spreads an extra mini flare bullet
    if (isAttacker) {
      const spreadAngle = angle + (Math.random() * 0.2 - 0.1);
      bulletsRef.current.push({
        id: bulletId + '_s',
        playerId: me.id,
        x: me.x + Math.cos(spreadAngle) * 20,
        y: me.y + Math.sin(spreadAngle) * 20,
        vx: Math.cos(spreadAngle) * (speed * 0.95),
        vy: Math.sin(spreadAngle) * (speed * 0.95),
        damage: 18,
        color: '#FBBF24',
        life: 50,
        radius: 3,
      });
    }

    if (soundEnabled) {
      playShootSound();
    }

    // Sync bullet to network
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'BULLET_SPAWN',
        playerId: me.id,
        bullet: newBullet,
      });
    }
  };

  // Main 60fps Game Loop
  useEffect(() => {
    if (!inGame || isGameOver || isHourVictory) return;

    let animId: number;

    const loop = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const me = playersRef.current.get(myPlayerId.current);
      if (me && me.isAlive) {
        // --- 1. MOVEMENT UPDATE ---
        let moveX = 0;
        let moveY = 0;
        const keys = keysRef.current;

        if (keys['w'] || keys['arrowup']) moveY -= 1;
        if (keys['s'] || keys['arrowdown']) moveY += 1;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;

        // Add joystick vector
        if (joystickPosRef.current.active) {
          moveX += joystickPosRef.current.x;
          moveY += joystickPosRef.current.y;
        }

        const len = Math.hypot(moveX, moveY);
        const speed = me.role === 'attacker' ? 4.2 : 3.6;

        if (len > 0.05) {
          me.vx = (moveX / Math.max(1, len)) * speed;
          me.vy = (moveY / Math.max(1, len)) * speed;
          me.x = Math.max(30, Math.min(MAP_WIDTH - 30, me.x + me.vx));
          me.y = Math.max(30, Math.min(MAP_HEIGHT - 30, me.y + me.vy));
        } else {
          me.vx = 0;
          me.vy = 0;
        }

        // Aiming angle
        if (touchAimRef.current.active) {
          me.angle = Math.atan2(touchAimRef.current.y, touchAimRef.current.x);
        } else if (len > 0.1) {
          me.angle = Math.atan2(me.vy, me.vx);
        }

        // Reload update
        if (me.isReloading) {
          me.reloadProgress += 0.035;
          if (me.reloadProgress >= 1) {
            me.ammo = me.maxAmmo;
            me.isReloading = false;
            me.reloadProgress = 0;
          }
        }

        // Shooting
        if (isShootingRef.current && timestamp - lastShootTimeRef.current > 180) {
          if (!me.isReloading) {
            fireBullet(me, me.angle);
            lastShootTimeRef.current = timestamp;
          }
        }

        // Defender health/armor regeneration perk
        if (me.role === 'defender' && timestamp % 60 < 2) {
          if (me.armor < me.maxArmor) me.armor = Math.min(me.maxArmor, me.armor + 1);
          if (me.hp < me.maxHp) me.hp = Math.min(me.maxHp, me.hp + 0.5);
        }

        // Camera follow me
        cameraRef.current.x = me.x - canvas.width / 2;
        cameraRef.current.y = me.y - canvas.height / 2;
        // Clamp camera
        cameraRef.current.x = Math.max(0, Math.min(MAP_WIDTH - canvas.width, cameraRef.current.x));
        cameraRef.current.y = Math.max(0, Math.min(MAP_HEIGHT - canvas.height, cameraRef.current.y));
      }

      // --- 2. UPDATE BULLETS ---
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life -= 1;

        // Check bullet hit on enemies
        let hit = false;
        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
          const e = enemiesRef.current[j];
          const dist = Math.hypot(b.x - e.x, b.y - e.y);
          if (dist < e.radius + b.radius) {
            hit = true;
            e.hp -= b.damage;

            // Floating damage number
            floatingTextsRef.current.push({
              id: Math.random().toString(),
              text: `-${b.damage}`,
              x: e.x + (Math.random() * 20 - 10),
              y: e.y - 15,
              color: '#F87171',
              alpha: 1,
              vy: -1.2,
            });

            // Splatter particles
            for (let p = 0; p < 4; p++) {
              particlesRef.current.push({
                x: e.x,
                y: e.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 18,
                maxLife: 18,
                color: '#EF4444',
                size: Math.random() * 3 + 2,
              });
            }

            // Enemy killed?
            if (e.hp <= 0) {
              enemiesRef.current.splice(j, 1);
              setWaveEnemiesRemaining(enemiesRef.current.length);

              // Update killer stats
              const killer = playersRef.current.get(b.playerId);
              if (killer) {
                killer.kills += 1;
                killer.score += 50;
                if (killer.isMe) {
                  setTotalKills((k) => k + 1);
                  playCoinSound();
                }
              }

              // Death burst particles
              for (let p = 0; p < 12; p++) {
                particlesRef.current.push({
                  x: e.x,
                  y: e.y,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  life: 25,
                  maxLife: 25,
                  color: e.color,
                  size: Math.random() * 5 + 3,
                });
              }
            }
            break;
          }
        }

        if (hit || b.life <= 0 || b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) {
          bulletsRef.current.splice(i, 1);
        }
      }

      // --- 3. HOST UPDATES ENEMIES & WAVES ---
      if (isHost && !waveSpawningRef.current) {
        // If all enemies cleared, advance wave infinitely!
        if (enemiesRef.current.length === 0) {
          const nextWave = currentWave + 1;
          setCurrentWave(nextWave);
          spawnUnlimitedWave(nextWave);

          // Broadcast next wave
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.postMessage({
              type: 'WAVE_ADVANCE',
              wave: nextWave,
            });
          }

          floatingTextsRef.current.push({
            id: Math.random().toString(),
            text: `WAVE ${nextWave} - UNLIMITED!`,
            x: MAP_WIDTH / 2,
            y: MAP_HEIGHT / 2,
            color: '#FBBF24',
            alpha: 1.5,
            vy: -0.5,
          });
        }

        // AI Enemy pathfinding towards closest player
        enemiesRef.current.forEach((enemy) => {
          let closestPlayer: PlayerState | null = null;
          let minDist = 999999;

          playersRef.current.forEach((player) => {
            if (player.isAlive) {
              const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
              if (d < minDist) {
                minDist = d;
                closestPlayer = player;
              }
            }
          });

          if (closestPlayer) {
            const target: PlayerState = closestPlayer;
            const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            enemy.vx = Math.cos(angle) * enemy.speed;
            enemy.vy = Math.sin(angle) * enemy.speed;
            enemy.x += enemy.vx;
            enemy.y += enemy.vy;

            // Attack player if in melee reach
            if (minDist < enemy.radius + 18) {
              if (Date.now() - enemy.lastAttack > 900) {
                enemy.lastAttack = Date.now();
                // Apply damage (absorbed by armor first)
                if (target.armor > 0) {
                  const absorbed = Math.min(target.armor, enemy.damage);
                  target.armor -= absorbed;
                  const leftover = enemy.damage - absorbed;
                  target.hp = Math.max(0, target.hp - leftover);
                } else {
                  target.hp = Math.max(0, target.hp - enemy.damage);
                }

                // Check death
                if (target.hp <= 0 && target.isAlive) {
                  target.isAlive = false;
                  if (target.isMe) {
                    handlePlayerDied();
                  }
                }
              }
            }
          }
        });

        // Periodic sync of enemies
        if (timestamp - lastSyncTimeRef.current > 120 && broadcastChannelRef.current) {
          lastSyncTimeRef.current = timestamp;
          broadcastChannelRef.current.postMessage({
            type: 'ENEMY_SYNC',
            enemies: enemiesRef.current,
            wave: currentWave,
          });
        }
      }

      // Sync my player state across network
      if (me && timestamp - lastSyncTimeRef.current > 60 && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'PLAYER_SYNC',
          id: me.id,
          name: me.name,
          role: me.role,
          x: me.x,
          y: me.y,
          angle: me.angle,
          hp: me.hp,
          armor: me.armor,
          kills: me.kills,
          isFiring: isShootingRef.current,
          isAlive: me.isAlive,
        });
      }

      // --- 4. RENDER FRAME ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

      // Draw map background (Dark asphalt & grid lines)
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Grid / street block lines
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      for (let x = 0; x < MAP_WIDTH; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < MAP_HEIGHT; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Turf Zones
      turfZonesRef.current.forEach((zone) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
        ctx.fillStyle = zone.color + '22';
        ctx.fill();
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Zone label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name, zone.x, zone.y - zone.radius - 8);
        ctx.restore();
      });

      // Draw Enemies
      enemiesRef.current.forEach((e) => {
        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.type === 'bus') {
          // Armored Syndicate Bus
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(-38, -20, 76, 40);
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(-35, -18, 70, 36);
          ctx.fillStyle = '#111827';
          ctx.fillRect(-20, -14, 40, 28);
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(32, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Regular thug or enforcer
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Gun direction
          const angle = Math.atan2(e.vy, e.vx);
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * (e.radius + 8), Math.sin(angle) * (e.radius + 8));
          ctx.stroke();
        }

        // Enemy Health Bar
        const barW = e.radius * 2 + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-barW / 2, -e.radius - 12, barW, 5);
        ctx.fillStyle = '#EF4444';
        const hpPct = Math.max(0, e.hp / e.maxHp);
        ctx.fillRect(-barW / 2, -e.radius - 12, barW * hpPct, 5);

        ctx.restore();
      });

      // Draw Bullets
      bulletsRef.current.forEach((b) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      // Draw Players (Co-op Teammates & Me)
      playersRef.current.forEach((player) => {
        if (!player.isAlive) return;

        ctx.save();
        ctx.translate(player.x, player.y);

        // Role aura
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fillStyle = player.role === 'attacker' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
        ctx.fill();

        // Player body
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.strokeStyle = player.isMe ? '#FBBF24' : '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Gun direction
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(player.angle) * 26, Math.sin(player.angle) * 26);
        ctx.stroke();

        // Floating name & role
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${player.name} (${player.role.toUpperCase()})`,
          0,
          -30
        );

        // Health & Armor bars
        const barW = 36;
        // Armor bar (blue)
        if (player.maxArmor > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(-barW / 2, -26, barW, 3);
          ctx.fillStyle = '#3B82F6';
          ctx.fillRect(-barW / 2, -26, barW * (player.armor / player.maxArmor), 3);
        }
        // Health bar (green)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(-barW / 2, -22, barW, 4);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(-barW / 2, -22, barW * (player.hp / player.maxHp), 4);

        ctx.restore();
      });

      // Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Floating Texts
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.alpha -= 0.02;
        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore(); // Restore camera translation

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame, isGameOver, isHourVictory, isHost, currentWave, soundEnabled]);

  // Touch joystick handler
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxR = rect.width / 2;
    joystickPosRef.current = {
      x: dx / Math.max(dist, maxR),
      y: dy / Math.max(dist, maxR),
      active: true,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxR = rect.width / 2;
    joystickPosRef.current = {
      x: dx / Math.max(dist, maxR),
      y: dy / Math.max(dist, maxR),
      active: true,
    };
  };

  const handleTouchEnd = () => {
    joystickPosRef.current = { x: 0, y: 0, active: false };
  };

  // Format MM:SS for match timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render Lobby screen if not in match yet
  if (!inGame) {
    return (
      <TurfWarLobby
        onBack={onBack}
        onStartMatch={handleStartMatch}
        currentCoins={currentCoins}
        initialRoomCode={initialRoomCode}
        onToast={onToast}
      />
    );
  }

  const me = playersRef.current.get(myPlayerId.current);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none font-sans text-white">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 1200}
        height={typeof window !== 'undefined' ? window.innerHeight : 800}
        className="w-full h-full block"
      />

      {/* TOP HUD BAR */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent flex items-center justify-between z-20 pointer-events-none">
        {/* Left: Back / Room code / Sound */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 backdrop-blur transition-all"
            title="Leave Match"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60 backdrop-blur">
            <span className="text-xs text-slate-400 block font-mono">ROOM CODE</span>
            <span className="text-sm font-black text-amber-400 font-mono tracking-wider">{roomCode}</span>
          </div>
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
        </div>

        {/* Center: 1 HOUR MATCH TIMER + WAVE UNLIMITED */}
        <div className="flex flex-col items-center pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-4 py-1.5 rounded-2xl shadow-lg shadow-amber-500/10 backdrop-blur">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-300">
              MATCH TIME: <span className="font-mono text-base font-black text-white">{formatTime(matchTimeRemaining)}</span> remaining
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-800 border border-slate-600 text-cyan-300">
              Role: {myRole}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="bg-red-500/20 text-red-400 text-xs font-black px-3 py-0.5 rounded-full border border-red-500/40 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> WAVE: {currentWave} - UNLIMITED
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Enemies: {waveEnemiesRemaining}
            </span>
          </div>
        </div>

        {/* Right: Kills & Coin Payout preview */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60 flex items-center gap-2">
            <Skull className="w-4 h-4 text-red-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Kills</span>
              <span className="text-sm font-black text-white font-mono">{totalKills}</span>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-black text-amber-300 font-mono">
              {totalKills * 10 + currentWave * 100} SC
            </span>
          </div>
        </div>
      </div>

      {/* PLAYER HEALTH & AMMO HUD (BOTTOM-LEFT / BOTTOM-CENTER) */}
      {me && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex flex-col gap-1.5 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/60 backdrop-blur w-64 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1 text-red-400">
              <Heart className="w-3.5 h-3.5 fill-red-500" /> HP
            </span>
            <span className="font-mono text-slate-200">
              {Math.round(me.hp)} / {me.maxHp}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-100"
              style={{ width: `${Math.max(0, (me.hp / me.maxHp) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-bold mt-1">
            <span className="flex items-center gap-1 text-blue-400">
              <Shield className="w-3.5 h-3.5 fill-blue-500" /> ARMOR
            </span>
            <span className="font-mono text-slate-200">
              {Math.round(me.armor)} / {me.maxArmor}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-100"
              style={{ width: `${Math.max(0, (me.armor / me.maxArmor) * 100)}%` }}
            />
          </div>

          {/* Ammo & Reloading */}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              AMMO: <span className="font-black text-amber-400">{me.ammo}/{me.maxAmmo}</span>
            </span>
            {me.isReloading && (
              <span className="text-xs text-amber-400 font-bold animate-pulse flex items-center gap-1">
                <RotateCcw className="w-3 h-3 animate-spin" /> Reloading...
              </span>
            )}
          </div>
        </div>
      )}

      {/* MOBILE TOUCH CONTROLS (JOYSTICK ON LEFT, SHOOT/RELOAD ON RIGHT) */}
      <div className="md:hidden">
        {/* Virtual Joystick */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute bottom-6 left-6 w-32 h-32 rounded-full bg-slate-900/60 border-2 border-slate-600/50 backdrop-blur z-30 flex items-center justify-center touch-none"
        >
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 transition-transform"
            style={{
              transform: `translate(${joystickPosRef.current.x * 35}px, ${joystickPosRef.current.y * 35}px)`,
            }}
          />
        </div>

        {/* Shoot & Reload buttons */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-30 pointer-events-auto">
          <button
            onClick={triggerReload}
            className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-600 flex items-center justify-center active:scale-95 shadow-lg"
          >
            <RotateCcw className="w-6 h-6 text-amber-400" />
          </button>
          <button
            onTouchStart={() => (isShootingRef.current = true)}
            onTouchEnd={() => (isShootingRef.current = false)}
            onMouseDown={() => (isShootingRef.current = true)}
            onMouseUp={() => (isShootingRef.current = false)}
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 border-2 border-red-300 flex items-center justify-center shadow-xl shadow-red-500/40 active:scale-95"
          >
            <Crosshair className="w-9 h-9 text-white animate-pulse" />
          </button>
        </div>
      </div>

      {/* 1-HOUR SURVIVAL VICTORY MODAL */}
      {isHourVictory && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl shadow-amber-500/20">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-white">1-HOUR MATCH COMPLETED!</h2>
            <p className="text-sm text-slate-300 mt-1">
              You held your gang territory against infinite enemy waves!
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Waves Survived:</span>
                <span className="font-bold text-amber-400 font-mono">Wave {currentWave}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Kills:</span>
                <span className="font-bold text-red-400 font-mono">{totalKills}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">1-Hour Survival Bonus:</span>
                <span className="font-bold text-emerald-400 font-mono">+1,000 SC</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-base text-amber-300">
                <span>Total Coins Earned:</span>
                <span>+{earnedCoins} SC</span>
              </div>
            </div>

            <button
              onClick={onBack}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-base hover:brightness-110 shadow-lg shadow-amber-500/30 transition-all"
            >
              Collect Rewards & Return
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER (DIED) MODAL - AS SPECIFIED: "You Died - Wave X reached" */}
      {isGameOver && !isHourVictory && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-red-500/60 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl shadow-red-500/20">
            <Skull className="w-16 h-16 text-red-500 mx-auto mb-3 animate-pulse" />
            <h2 className="text-2xl font-black text-white">YOU DIED</h2>
            <p className="text-base text-amber-400 font-bold mt-1">
              Wave {currentWave} reached - UNLIMITED
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Time Survived:</span>
                <span className="font-mono text-slate-200">
                  {formatTime(MATCH_DURATION_SECONDS - matchTimeRemaining)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Enemies Defeated:</span>
                <span className="font-mono text-red-400 font-bold">{totalKills}</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-base text-amber-300">
                <span>Street Coins Rewarded:</span>
                <span>+{earnedCoins} SC</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsGameOver(false);
                  initMyPlayer(myRole);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-600 transition-all"
              >
                Respawn & Rejoin
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white font-bold hover:brightness-110 shadow-lg shadow-red-500/30 transition-all"
              >
                Exit Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TurfWarMultiplayer;
