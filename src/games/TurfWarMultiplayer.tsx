'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, Shield, Heart, Skull, Crosshair, Trophy, Coins, Crown, Zap, Volume2, VolumeX, Flame, Clock, Sparkles, Users, Bus, ArrowLeft, RotateCcw, Target, Radio, Share2, Check, AlertCircle, Award } from 'lucide-react';
import { TurfWarLobby, TurfRole, TurfLobbyPlayer } from './TurfWarLobby';
import { playShootSound, playPunchSound, playCoinSound, playSuccessSound, playClickSound, playSirenSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';

export interface TurfWarMultiplayerProps { onBack: () => void; onToast: (msg: string) => void; currentCoins: number; initialRoomCode?: string; }
interface PlayerState { id: string; name: string; role: TurfRole; x: number; y: number; vx: number; vy: number; angle: number; hp: number; maxHp: number; armor: number; maxArmor: number; kills: number; score: number; color: string; isMe: boolean; isAlive: boolean; isFiring: boolean; ammo: number; maxAmmo: number; isReloading: boolean; reloadProgress: number; hitCount: number; inTankId: string | null; insideBuildingId: string | null; }
interface Enemy { id: string; type: 'thug' | 'enforcer'; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; speed: number; damage: number; radius: number; color: string; lastAttack: number; targetPlayerId: string; hitCount: number; lastShoot: number; inTankId: string | null; }
interface Tank { id: string; x: number; y: number; angle: number; hp: number; maxHp: number; occupiedBy: string | null; occupiedByType: 'player' | 'enemy' | null; isExploded: boolean; barracksId: string; }
interface Bullet { id: string; playerId: string; x: number; y: number; vx: number; vy: number; damage: number; color: string; life: number; radius: number; isTankShell: boolean; isEnemyBullet: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; }
interface FloatingText { id: string; text: string; x: number; y: number; color: string; alpha: number; vy: number; }
interface TurfZone { id: string; name: string; x: number; y: number; radius: number; control: number; color: string; }
interface Barracks { id: string; x: number; y: number; w: number; h: number; doorX: number; doorY: number; doorW: number; }

const MATCH_DURATION_SECONDS = 3600;

export const TurfWarMultiplayer: React.FC<TurfWarMultiplayerProps> = ({ onBack, onToast, currentCoins, initialRoomCode }) => {
  const [inGame, setInGame] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [isHost, setIsHost] = useState(true);
  const [myRole, setMyRole] = useState<TurfRole>('attacker');
  const [lobbyPlayers, setLobbyPlayers] = useState<TurfLobbyPlayer[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [matchTimeRemaining, setMatchTimeRemaining] = useState(MATCH_DURATION_SECONDS);
  const [currentWave, setCurrentWave] = useState(1);
  const [waveEnemiesRemaining, setWaveEnemiesRemaining] = useState(5);
  const [totalKills, setTotalKills] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isHourVictory, setIsHourVictory] = useState(false);
  const [nearTankPrompt, setNearTankPrompt] = useState<string | null>(null);
  const myPlayerId = useRef<string>('p_' + Math.random().toString(36).substring(2, 8));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const enemiesRef = useRef<Enemy[]>([]);
  const tanksRef = useRef<Tank[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const turfZonesRef = useRef<TurfZone[]>([
    { id: 'zone_a', name: 'BARRACKS ALPHA', x: 900, y: 700, radius: 220, control: 50, color: '#10B981' },
    { id: 'zone_b', name: 'BARRACKS BRAVO (HQ)', x: 3000, y: 3000, radius: 300, control: 20, color: '#3B82F6' },
    { id: 'zone_c', name: 'BARRACKS CHARLIE', x: 5100, y: 5300, radius: 220, control: -30, color: '#F59E0B' },
  ]);
  const barracksBuildingsRef = useRef<Barracks[]>([
    { id: 'bld_a1', x: 700, y: 500, w: 240, h: 160, doorX: 800, doorY: 660, doorW: 40 },
    { id: 'bld_a2', x: 1000, y: 750, w: 220, h: 140, doorX: 1000, doorY: 800, doorW: 40 },
    { id: 'bld_b1', x: 2800, y: 2700, w: 300, h: 200, doorX: 2950, doorY: 2900, doorW: 50 },
    { id: 'bld_b2', x: 3200, y: 2800, w: 260, h: 180, doorX: 3200, doorY: 2890, doorW: 50 },
    { id: 'bld_b3', x: 2900, y: 3200, w: 280, h: 180, doorX: 3000, doorY: 3200, doorW: 50 },
    { id: 'bld_c1', x: 4900, y: 5100, w: 240, h: 160, doorX: 5000, doorY: 5260, doorW: 40 },
    { id: 'bld_c2', x: 5200, y: 5300, w: 220, h: 140, doorX: 5200, doorY: 5350, doorW: 40 },
  ]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const joystickPosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const touchAimRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const isShootingRef = useRef<boolean>(false);
  const lastShootTimeRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const waveSpawningRef = useRef<boolean>(false);
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const MAP_WIDTH = 6000;
  const MAP_HEIGHT = 6000;
  const ENEMY_SHOOT_DISTANCE = 110; // CORRECTED AS YOU TALK

  const initMyPlayer = useCallback((role: TurfRole, name = 'You') => {
    const isAttacker = role === 'attacker';
    const myState: PlayerState = {
      id: myPlayerId.current, name, role, x: 3000 + (Math.random() * 80 - 40), y: 3000 + (Math.random() * 80 - 40), vx: 0, vy: 0, angle: 0,
      hp: 100, maxHp: 100, armor: 100, maxArmor: 100, kills: 0, score: 0, color: isAttacker ? '#FACC15' : '#3B82F6',
      isMe: true, isAlive: true, isFiring: false, ammo: 30, maxAmmo: 30, isReloading: false, reloadProgress: 0, hitCount: 0, inTankId: null, insideBuildingId: null,
    };
    playersRef.current.set(myPlayerId.current, myState);
  }, []);

  const initTanks = useCallback(() => {
    const tanks: Tank[] = [];
    const barracksPos = [
      { id: 'barracks_a', cx: 900, cy: 700 },
      { id: 'barracks_b', cx: 3000, cy: 3000 },
      { id: 'barracks_c', cx: 5100, cy: 5300 },
    ];
    barracksPos.forEach(bp => {
      for (let i = 0; i < 5; i++) {
        tanks.push({
          id: `tank_${bp.id}_${i}`, x: bp.cx + (i % 3) * 90 - 90 + (Math.random()*20-10), y: bp.cy + Math.floor(i/3)*90 - 40 + (Math.random()*20-10),
          angle: -Math.PI/2 + Math.random()*0.4-0.2, hp: 15, maxHp: 15, occupiedBy: null, occupiedByType: null, isExploded: false, barracksId: bp.id,
        });
      }
    });
    tanksRef.current = tanks; // 15 TOTAL
  }, []);

  const spawnUnlimitedWave = useCallback((waveNum: number) => {
    waveSpawningRef.current = true;
    const enemyCount = waveNum * 2 + 3;
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      const side = Math.floor(Math.random() * 4); let ex = 0, ey = 0;
      if (side === 0) { ex = Math.random() * MAP_WIDTH; ey = -80; }
      else if (side === 1) { ex = MAP_WIDTH + 80; ey = Math.random() * MAP_HEIGHT; }
      else if (side === 2) { ex = Math.random() * MAP_WIDTH; ey = MAP_HEIGHT + 80; }
      else { ex = -80; ey = Math.random() * MAP_HEIGHT; }
      const isEnforcer = i % 4 === 0;
      newEnemies.push({
        id: `enemy_w${waveNum}_${i}_${Math.random()}`, type: isEnforcer ? 'enforcer' : 'thug',
        x: ex, y: ey, vx: 0, vy: 0, hp: isEnforcer ? 4 : 3, maxHp: isEnforcer ? 4 : 3,
        speed: isEnforcer ? 1.8 : 2.0, // FINAL CORRECTED SPEED
        damage: 1, radius: 18, color: isEnforcer ? '#7C3AED' : '#DC2626', lastAttack: 0, targetPlayerId: myPlayerId.current, hitCount: 0, lastShoot: 0, inTankId: null,
      });
    }
    enemiesRef.current = newEnemies; setWaveEnemiesRemaining(newEnemies.length); waveSpawningRef.current = false;
  }, []);

  const handleStartMatch = (code: string, host: boolean, role: TurfRole, players: TurfLobbyPlayer[]) => {
    setRoomCode(code); setIsHost(host); setMyRole(role); setLobbyPlayers(players); setInGame(true);
    initMyPlayer(role); initTanks();
    players.forEach((p) => {
      if (p.id !== myPlayerId.current) {
        playersRef.current.set(p.id, {
          id: p.id, name: p.name, role: p.role, x: 3000 + (Math.random() * 100 - 50), y: 3000 + (Math.random() * 100 - 50),
          vx: 0, vy: 0, angle: 0, hp: 100, maxHp: 100, armor: 100, maxArmor: 100, kills: 0, score: 0,
          color: p.role === 'attacker' ? '#FACC15' : '#3B82F6', isMe: false, isAlive: true, isFiring: false, ammo: 30, maxAmmo: 30, isReloading: false, reloadProgress: 0, hitCount: 0, inTankId: null, insideBuildingId: null,
        });
      }
    });
    if (host) { spawnUnlimitedWave(1); }
    const channelName = `turfwar_${code}`; const channel = new BroadcastChannel(channelName); broadcastChannelRef.current = channel;
    channel.onmessage = (event) => {
      const data = event.data; if (!data) return;
      if (data.type === 'PLAYER_SYNC') {
        const p = playersRef.current.get(data.id);
        if (p && !p.isMe) { p.x = data.x; p.y = data.y; p.angle = data.angle; p.hp = data.hp; p.armor = data.armor; p.kills = data.kills; p.isFiring = data.isFiring; p.isAlive = data.isAlive; (p as any).inTankId = data.inTankId; }
      } else if (data.type === 'BULLET_SPAWN') { if (data.playerId !== myPlayerId.current) { bulletsRef.current.push(data.bullet); } }
      else if (data.type === 'TANK_SYNC' && !host) { tanksRef.current = data.tanks; }
      else if (data.type === 'ENEMY_SYNC' && !host) { enemiesRef.current = data.enemies; setCurrentWave(data.wave); setWaveEnemiesRemaining(data.enemies.length); }
      else if (data.type === 'WAVE_ADVANCE') { setCurrentWave(data.wave); if (host) { spawnUnlimitedWave(data.wave); } }
      else if (data.type === 'MATCH_TICK' && !host) { setMatchTimeRemaining(data.remaining); }
    };
    onToast(`Joined Barracks: ${code}! 15 tanks, enemy 110px shoot`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'r') { triggerReload(); } if (e.key === ' ' || e.code === 'Space') { isShootingRef.current = true; } if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'e') { tryEnterExitTank(); } };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; if (e.key === ' ' || e.code === 'Space') { isShootingRef.current = false; } };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  const triggerReload = () => { const me = playersRef.current.get(myPlayerId.current); if (!me || me.isReloading || me.ammo === me.maxAmmo) return; me.isReloading = true; me.reloadProgress = 0; };
  const tryEnterExitTank = () => {
    const me = playersRef.current.get(myPlayerId.current); if (!me || !me.isAlive) return;
    if (me.inTankId) { const tank = tanksRef.current.find(t=>t.id===me.inTankId); if (tank) { tank.occupiedBy = null; tank.occupiedByType = null; } me.inTankId = null; me.x += 60; setNearTankPrompt(null); onToast('Exited Tank'); return; }
    let closest: Tank | null = null; let minD = 70;
    tanksRef.current.forEach(t=>{ if (!t.isExploded && !t.occupiedBy) { const d = Math.hypot(me.x - t.x, me.y - t.y); if (d < minD) { minD = d; closest = t; } } });
    if (closest) { (closest as Tank).occupiedBy = me.id; (closest as Tank).occupiedByType = 'player'; me.inTankId = (closest as Tank).id; me.x = (closest as Tank).x; me.y = (closest as Tank).y; setNearTankPrompt(null); onToast('Entered Tank - WASD drive'); }
  };

  useEffect(() => {
    if (!inGame || isGameOver || isHourVictory) return;
    const timer = setInterval(() => { setMatchTimeRemaining((prev) => { if (prev <= 1) { clearInterval(timer); handleMatchHourCompleted(); return 0; } if (isHost && broadcastChannelRef.current) { broadcastChannelRef.current.postMessage({ type: 'MATCH_TICK', remaining: prev - 1 }); } return prev - 1; }); }, 1000);
    return () => clearInterval(timer);
  }, [inGame, isGameOver, isHourVictory, isHost]);

  const handleMatchHourCompleted = () => { setIsHourVictory(true); const killBonus = totalKills * 10; const waveBonus = currentWave * 100; const hourBonus = 1000; const totalAward = killBonus + waveBonus + hourBonus; setEarnedCoins(totalAward); addGameCoins(totalAward, `+${totalAward} SC - Barracks Survived!`, 'wave_complete'); playSuccessSound(); confetti({ particleCount: 150, spread: 90 }); onToast(`1-HOUR SURVIVED! +${totalAward} SC!`); };
  const handlePlayerDied = () => { setIsGameOver(true); const killBonus = totalKills * 10; const waveBonus = Math.max(0, (currentWave - 1) * 100); const totalAward = killBonus + waveBonus; setEarnedCoins(totalAward); if (totalAward > 0) { addGameCoins(totalAward, `+${totalAward} SC - Wave ${currentWave}`, 'wave_complete'); } playPunchSound(); };

  const fireBullet = (me: PlayerState, angle: number) => {
    if (me.ammo <= 0) { triggerReload(); return; }
    const inTank = me.inTankId ? tanksRef.current.find(t=>t.id===me.inTankId) : null;
    if (!inTank) { me.ammo -= 1; }
    const isAttacker = me.role === 'attacker';
    const damage = inTank ? 4 : (isAttacker ? 2 : 1);
    const speed = inTank ? 18 : 16;
    const radius = inTank ? 7 : 4.5;
    const life = inTank ? 90 : 75;
    const bulletId = `b_${myPlayerId.current}_${Date.now()}_${Math.random()}`;
    const newBullet: Bullet = { id: bulletId, playerId: me.id, x: me.x + Math.cos(angle) * (inTank ? 50 : 28), y: me.y + Math.sin(angle) * (inTank ? 50 : 28), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, color: inTank ? '#FACC15' : (isAttacker ? '#FACC15' : '#60A5FA'), life, radius, isTankShell: !!inTank, isEnemyBullet: false };
    bulletsRef.current.push(newBullet);
    if (soundEnabled) { playShootSound(); }
    if (broadcastChannelRef.current) { broadcastChannelRef.current.postMessage({ type: 'BULLET_SPAWN', playerId: me.id, bullet: newBullet }); }
  };

  const drawHumanPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, shirtColor: string, helmetColor: string) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 14, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111827'; ctx.fillRect(-4, 8, 3.5, 11); ctx.fillRect(1.5, 8, 3.5, 11); ctx.fillStyle = '#000'; ctx.fillRect(-4.5, 18, 5, 2.5); ctx.fillRect(1.5, 18, 5, 2.5);
    ctx.fillStyle = shirtColor; ctx.beginPath(); (ctx as any).roundRect(-8, -7, 16, 16, 4); ctx.fill();
    ctx.fillStyle = '#FDBA74'; ctx.fillRect(-9, -3, 3, 9);
    ctx.save(); ctx.translate(6, -1); ctx.rotate(0.2); ctx.fillStyle = '#FDBA74'; ctx.fillRect(0, -2, 8, 3); ctx.fillStyle = '#1F2937'; ctx.fillRect(7, -2, 16, 3); ctx.restore();
    ctx.fillStyle = '#FDBA74'; ctx.beginPath(); ctx.arc(0, -11, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = helmetColor; ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank, isMyTank: boolean, isEnemyTank: boolean) => {
    if (tank.isExploded) { ctx.save(); ctx.translate(tank.x, tank.y); ctx.fillStyle = '#1F2937'; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.fillStyle = '#EF4444'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign='center'; ctx.fillText('💥',0,5); ctx.restore(); return; }
    ctx.save(); ctx.translate(tank.x, tank.y); ctx.rotate(tank.angle);
    ctx.fillStyle = isMyTank ? '#FACC15' : isEnemyTank ? '#EF4444' : '#334155'; ctx.strokeStyle = isMyTank ? '#FEF08A' : isEnemyTank ? '#F87171' : '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); (ctx as any).roundRect(-38, -22, 76, 44, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0F172A'; ctx.fillRect(10, -4, 46, 8);
    ctx.fillStyle = isEnemyTank ? '#EF4444' : '#FACC15'; ctx.beginPath(); ctx.arc(50,0,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0F172A'; ctx.fillRect(-38, -26, 76, 6); ctx.fillRect(-38, 20, 76, 6);
    ctx.rotate(-tank.angle); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(-30, -36, 60, 6); ctx.fillStyle = tank.hp <=5 ? '#EF4444' : '#22C55E'; ctx.fillRect(-30, -36, 60*(tank.hp/tank.maxHp), 6);
    ctx.font = 'bold 9px monospace'; ctx.fillStyle='#FFF'; ctx.textAlign='center'; ctx.fillText(`${tank.hp}/${tank.maxHp}`,0,-38);
    ctx.restore();
  };

  useEffect(() => {
    if (!inGame || isGameOver || isHourVictory) return;
    let animId: number;
    const loop = (timestamp: number) => {
      const canvas = canvasRef.current; if (!canvas) { animId = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d'); if (!ctx) { animId = requestAnimationFrame(loop); return; }
      const me = playersRef.current.get(myPlayerId.current);
      let showPrompt: string | null = null;
      if (me && me.isAlive) {
        let moveX = 0, moveY = 0; const keys = keysRef.current;
        if (keys['w'] || keys['arrowup']) moveY -= 1; if (keys['s'] || keys['arrowdown']) moveY += 1; if (keys['a'] || keys['arrowleft']) moveX -= 1; if (keys['d'] || keys['arrowright']) moveX += 1;
        if (joystickPosRef.current.active) { moveX += joystickPosRef.current.x; moveY += joystickPosRef.current.y; }
        const len = Math.hypot(moveX, moveY);
        let speed = me.role === 'attacker' ? 4.2 : 3.6;
        let currentTank: Tank | undefined = undefined;
        if (me.inTankId) { currentTank = tanksRef.current.find(t=>t.id===me.inTankId); if (currentTank && !currentTank.isExploded) { speed = 5.0; } }
        if (len > 0.05) { 
          me.vx = (moveX / Math.max(1, len)) * speed; me.vy = (moveY / Math.max(1, len)) * speed; 
          const nextX = me.x + me.vx; const nextY = me.y + me.vy; let canMove = true;
          if (!me.insideBuildingId && !me.inTankId) { for (const b of barracksBuildingsRef.current) { if (nextX > b.x && nextX < b.x + b.w && nextY > b.y && nextY < b.y + b.h) { const inDoor = nextX > b.doorX && nextX < b.doorX + b.doorW && ((nextY >= b.y + b.h - 6 && nextY <= b.y + b.h + 6)); if (!inDoor) { canMove = false; } } } }
          if (canMove) { me.x = Math.max(30, Math.min(MAP_WIDTH - 30, me.x + me.vx)); me.y = Math.max(30, Math.min(MAP_HEIGHT - 30, me.y + me.vy)); }
        } else { me.vx = 0; me.vy = 0; }
        if (touchAimRef.current.active) { me.angle = Math.atan2(touchAimRef.current.y, touchAimRef.current.x); if (currentTank) { currentTank.angle = me.angle; } } else if (len > 0.1) { me.angle = Math.atan2(me.vy, me.vx); if (currentTank) { currentTank.angle = me.angle; } }
        if (!me.inTankId) {
          if (!me.insideBuildingId) { for (const b of barracksBuildingsRef.current) { if (me.x > b.doorX && me.x < b.doorX + b.doorW && me.y > b.y + b.h - 10 && me.y < b.y + b.h + 20) { me.insideBuildingId = b.id; onToast('Entered Barracks Building'); break; } } }
          else { const b = barracksBuildingsRef.current.find(bb=>bb.id===me.insideBuildingId); if (b) { if (me.x < b.x -10 || me.x > b.x + b.w +10 || me.y < b.y -10 || me.y > b.y + b.h +30) { me.insideBuildingId = null; onToast('Exited Building'); } else { me.x = Math.max(b.x+10, Math.min(b.x+b.w-10, me.x)); me.y = Math.max(b.y+10, Math.min(b.y+b.h-10, me.y)); } } }
        }
        if (!me.inTankId) { let closestD = 70; let found=false; tanksRef.current.forEach(t=>{ if (!t.isExploded && !t.occupiedBy) { const d = Math.hypot(me.x - t.x, me.y - t.y); if (d < closestD) { found=true; closestD=d; } } }); if (found) { showPrompt = 'PRESS F TO ENTER TANK'; } } else { showPrompt = 'IN TANK - WASD DRIVE, F EXIT, SPACE FIRE'; }
        if (me.isReloading) { me.reloadProgress += 0.04; if (me.reloadProgress >= 1) { me.ammo = me.maxAmmo; me.isReloading = false; me.reloadProgress = 0; } }
        if (isShootingRef.current && timestamp - lastShootTimeRef.current > (me.inTankId ? 300 : 180)) { if (!me.isReloading || me.inTankId) { fireBullet(me, me.angle); lastShootTimeRef.current = timestamp; } }
        if (me.inTankId && currentTank) { currentTank.x = me.x; currentTank.y = me.y; }
        cameraRef.current.x = me.x - canvas.width / 2; cameraRef.current.y = me.y - canvas.height / 2;
        cameraRef.current.x = Math.max(0, Math.min(MAP_WIDTH - canvas.width, cameraRef.current.x)); cameraRef.current.y = Math.max(0, Math.min(MAP_HEIGHT - canvas.height, cameraRef.current.y));
      }
      if (showPrompt !== nearTankPrompt) { setNearTankPrompt(showPrompt); }

      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i]; b.x += b.vx; b.y += b.vy; b.life -= 1; let hit = false;
        for (const tank of tanksRef.current) {
          if (tank.isExploded) continue; const dist = Math.hypot(b.x - tank.x, b.y - tank.y);
          if (dist < 42) {
            hit = true;
            if (b.playerId !== tank.occupiedBy) {
              tank.hp -= b.damage;
              floatingTextsRef.current.push({ id: Math.random().toString(), text: `-${b.damage} TANK ${tank.hp}/${tank.maxHp}`, x: tank.x, y: tank.y - 30, color: '#FACC15', alpha: 1, vy: -1.2 });
              if (tank.hp <= 0) {
                tank.isExploded = true;
                if (tank.occupiedByType === 'enemy') { const en = enemiesRef.current.find(e=>e.id===tank.occupiedBy); if (en) { en.inTankId = null; en.x = tank.x + 60; } }
                else if (tank.occupiedByType === 'player') { const pl = playersRef.current.get(tank.occupiedBy!); if (pl) { pl.inTankId = null; pl.x += 60; } }
                tank.occupiedBy = null; tank.occupiedByType = null;
                playersRef.current.forEach(pl=>{ const d = Math.hypot(pl.x - tank.x, pl.y - tank.y); if (d < 180) { if (d < 90) { pl.hp = Math.max(1, pl.hp - 30); pl.hitCount +=1; floatingTextsRef.current.push({ id: Math.random().toString(), text: '-30 EXPLOSION', x: pl.x, y: pl.y -20, color:'#EF4444', alpha:1, vy:-1}); if (pl.isMe && pl.hp<=0) { pl.isAlive=false; handlePlayerDied(); } } else { pl.hp = Math.max(1, pl.hp - 10); } } if (pl.inTankId === tank.id) { pl.inTankId = null; } });
                for (let p = 0; p < 30; p++) { particlesRef.current.push({ x: tank.x, y: tank.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 35, maxLife: 35, color: Math.random()>0.5 ? '#FACC15' : '#EF4444', size: Math.random() * 6 + 3 }); }
                if (soundEnabled) { playSirenSound(); }
              }
            }
            break;
          }
        }
        if (!hit) {
          if (b.isEnemyBullet) {
            playersRef.current.forEach(pl=>{ if (pl.isAlive) { const dist = Math.hypot(b.x - pl.x, b.y - pl.y); if (dist < 20) { hit = true; if (pl.armor > 0) { pl.armor = Math.max(0, pl.armor - 25); } else { pl.hp = Math.max(0, pl.hp - 25); pl.hitCount +=1; } floatingTextsRef.current.push({ id: Math.random().toString(), text: `-25 ENEMY`, x: pl.x, y: pl.y -15, color:'#EF4444', alpha:1, vy:-1}); if (pl.isMe && pl.hp <=0) { pl.isAlive=false; handlePlayerDied(); } } } });
          } else {
            for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
              const e = enemiesRef.current[j]; if (e.inTankId) continue; const dist = Math.hypot(b.x - e.x, b.y - e.y);
              if (dist < e.radius + b.radius + 8) {
                hit = true; e.hitCount += 1; e.hp -= b.damage;
                floatingTextsRef.current.push({ id: Math.random().toString(), text: `HIT ${e.hitCount}/${e.maxHp}`, x: e.x, y: e.y - 20, color: '#FACC15', alpha: 1, vy: -1.2 });
                if (e.hp <= 0 || e.hitCount >= e.maxHp) {
                  enemiesRef.current.splice(j, 1); setWaveEnemiesRemaining(enemiesRef.current.length);
                  const killer = playersRef.current.get(b.playerId); if (killer) { killer.kills += 1; if (killer.isMe) { setTotalKills(k=>k+1); playCoinSound(); } }
                  for (let p = 0; p < 14; p++) { particlesRef.current.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9, life: 26, maxLife: 26, color: e.color, size: Math.random() * 5 + 3 }); }
                }
                break;
              }
            }
          }
        }
        if (hit || b.life <= 0 || b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) { bulletsRef.current.splice(i, 1); }
      }

      if (isHost && !waveSpawningRef.current) {
        if (enemiesRef.current.length === 0) { const nextWave = currentWave + 1; setCurrentWave(nextWave); spawnUnlimitedWave(nextWave); if (broadcastChannelRef.current) { broadcastChannelRef.current.postMessage({ type: 'WAVE_ADVANCE', wave: nextWave }); } }
        enemiesRef.current.forEach((enemy) => {
          if (enemy.inTankId) {
            const tank = tanksRef.current.find(t=>t.id===enemy.inTankId); if (!tank || tank.isExploded) { enemy.inTankId = null; return; }
            let closestPlayer: PlayerState | null = null; let minDist = 999999;
            playersRef.current.forEach((player) => { if (player.isAlive) { const d = Math.hypot(player.x - enemy.x, player.y - enemy.y); if (d < minDist) { minDist = d; closestPlayer = player; } } });
            if (closestPlayer) {
              const target: PlayerState = closestPlayer; const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
              enemy.vx = Math.cos(angle) * 3.5; enemy.vy = Math.sin(angle) * 3.5; enemy.x += enemy.vx; enemy.y += enemy.vy; tank.x = enemy.x; tank.y = enemy.y; tank.angle = angle;
              if (timestamp - enemy.lastShoot > 500) { enemy.lastShoot = timestamp; const bulletId = `b_enemy_tank_${enemy.id}_${Date.now()}`; const newBullet: Bullet = { id: bulletId, playerId: enemy.id, x: tank.x + Math.cos(angle) * 50, y: tank.y + Math.sin(angle) * 50, vx: Math.cos(angle) * 16, vy: Math.sin(angle) * 16, damage: 3, color: '#EF4444', life: 80, radius: 6, isTankShell: true, isEnemyBullet: true }; bulletsRef.current.push(newBullet); if (soundEnabled) { playShootSound(); } }
            }
            return;
          }
          let nearTank: Tank | null = null; let nearDist = 80;
          tanksRef.current.forEach(t=>{ if (!t.isExploded && !t.occupiedBy) { const d = Math.hypot(enemy.x - t.x, enemy.y - t.y); if (d < nearDist) { nearDist = d; nearTank = t; } } });
          if (nearTank) { (nearTank as Tank).occupiedBy = enemy.id; (nearTank as Tank).occupiedByType = 'enemy'; enemy.inTankId = (nearTank as Tank).id; enemy.x = (nearTank as Tank).x; enemy.y = (nearTank as Tank).y; return; }

          let closestPlayer: PlayerState | null = null; let minDist = 999999;
          playersRef.current.forEach((player) => { if (player.isAlive) { const d = Math.hypot(player.x - enemy.x, player.y - enemy.y); if (d < minDist) { minDist = d; closestPlayer = player; } } });
          if (closestPlayer) {
            const target: PlayerState = closestPlayer; const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            if (minDist > ENEMY_SHOOT_DISTANCE) {
              enemy.vx = Math.cos(angle) * enemy.speed; enemy.vy = Math.sin(angle) * enemy.speed; enemy.x += enemy.vx; enemy.y += enemy.vy;
            } else {
              if (timestamp - enemy.lastShoot > 900) {
                enemy.lastShoot = timestamp;
                const bulletId = `b_enemy_${enemy.id}_${Date.now()}`; const newBullet: Bullet = { id: bulletId, playerId: enemy.id, x: enemy.x + Math.cos(angle) * 20, y: enemy.y + Math.sin(angle) * 20, vx: Math.cos(angle) * 12, vy: Math.sin(angle) * 12, damage: 1, color: '#F87171', life: 70, radius: 4, isTankShell: false, isEnemyBullet: true }; bulletsRef.current.push(newBullet);
                if (soundEnabled) { playShootSound(); }
                floatingTextsRef.current.push({ id: Math.random().toString(), text: 'PEW!', x: enemy.x, y: enemy.y - 25, color: '#EF4444', alpha: 1, vy: -1 });
              }
            }
          }
        });
        if (timestamp - lastSyncTimeRef.current > 120 && broadcastChannelRef.current) { lastSyncTimeRef.current = timestamp; broadcastChannelRef.current.postMessage({ type: 'ENEMY_SYNC', enemies: enemiesRef.current, wave: currentWave }); broadcastChannelRef.current.postMessage({ type: 'TANK_SYNC', tanks: tanksRef.current }); }
      }
      if (me && timestamp - lastSyncTimeRef.current > 60 && broadcastChannelRef.current) { broadcastChannelRef.current.postMessage({ type: 'PLAYER_SYNC', id: me.id, name: me.name, role: me.role, x: me.x, y: me.y, angle: me.angle, hp: me.hp, armor: me.armor, kills: me.kills, isFiring: isShootingRef.current, isAlive: me.isAlive, inTankId: me.inTankId }); }

      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-cameraRef.current.x, -cameraRef.current.y);
      ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
      for (let x = 0; x < MAP_WIDTH; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_HEIGHT); ctx.stroke(); }
      for (let y = 0; y < MAP_HEIGHT; y += 200) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_WIDTH, y); ctx.stroke(); }

      turfZonesRef.current.forEach(zone=>{ ctx.save(); ctx.strokeStyle='#475569'; ctx.setLineDash([18,12]); ctx.lineWidth=4; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius+30, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); });
      barracksBuildingsRef.current.forEach(b=>{ const meInside = me?.insideBuildingId === b.id; ctx.save(); ctx.fillStyle = meInside ? '#1E293B' : '#334155'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.strokeRect(b.x+4, b.y+4, b.w-8, b.h-8); ctx.fillStyle = '#FACC15'; ctx.fillRect(b.doorX, b.doorY, b.doorW, 8); if (meInside) { ctx.fillStyle = '#475569'; ctx.fillRect(b.x+20, b.y+20, 40, 20); ctx.fillStyle='#94A3B8'; ctx.font='bold 10px sans-serif'; ctx.fillText('INSIDE BARRACKS', b.x+20, b.y+60); } else { ctx.fillStyle = '#1E293B'; for (let i=0;i<3;i++){ ctx.fillRect(b.x+15+i*50, b.y+15, 28, 28); } } ctx.restore(); });
      turfZonesRef.current.forEach(zone=>{ [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy])=>{ const tx = zone.x + dx*(zone.radius+50); const ty = zone.y + dy*(zone.radius+50); ctx.fillStyle='#475569'; ctx.fillRect(tx-12, ty-12, 24, 24); ctx.fillStyle='#1E293B'; ctx.beginPath(); ctx.arc(tx, ty-16, 6, 0, Math.PI*2); ctx.fill(); }); });
      turfZonesRef.current.forEach((zone) => { ctx.save(); ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fillStyle = zone.color + '18'; ctx.fill(); ctx.strokeStyle = zone.color; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(zone.name, zone.x, zone.y - zone.radius - 38); ctx.restore(); });

      tanksRef.current.forEach(t=>{ const pl = playersRef.current.get(myPlayerId.current); const isMy = pl?.inTankId === t.id; const en = enemiesRef.current.find(e=>e.inTankId===t.id); drawTank(ctx, t, !!isMy, !!en); });

      enemiesRef.current.forEach((e) => {
        if (e.inTankId) return;
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy, e.vx));
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111827'; ctx.fillRect(-3, 6, 3, 9); ctx.fillRect(1, 6, 3, 9);
        ctx.fillStyle = e.color; ctx.beginPath(); (ctx as any).roundRect(-7, -6, 14, 14, 3); ctx.fill();
        ctx.fillStyle = '#FDBA74'; ctx.beginPath(); ctx.arc(0, -10, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1F2937'; ctx.beginPath(); ctx.arc(0, -13, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1F2937'; ctx.fillRect(6, -2, 12, 2);
        ctx.rotate(-Math.atan2(e.vy, e.vx)); const barW = 30; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(-barW / 2, -22, barW, 4); ctx.fillStyle = '#FACC15'; ctx.fillRect(-barW / 2, -22, barW * (e.hp / e.maxHp), 4); ctx.restore();
      });

      bulletsRef.current.forEach((b) => { ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = b.isTankShell ? 16 : 10; ctx.fill(); ctx.restore(); });

      playersRef.current.forEach((player) => {
        if (!player.isAlive) return; if (player.inTankId) { return; }
        drawHumanPlayer(ctx, player.x, player.y, player.angle, player.color, '#FACC15');
        ctx.save(); ctx.translate(player.x, player.y); ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.fillText(`${player.name} (${player.role.toUpperCase()})`, 0, -32); const barW = 38; ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(-barW / 2, -28, barW, 3); ctx.fillStyle = '#3B82F6'; ctx.fillRect(-barW / 2, -28, barW * (player.armor / player.maxArmor), 3); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(-barW / 2, -24, barW, 4); ctx.fillStyle = '#22C55E'; ctx.fillRect(-barW / 2, -24, barW * (player.hp / player.maxHp), 4); ctx.restore();
      });

      for (let i = particlesRef.current.length - 1; i >= 0; i--) { const p = particlesRef.current[i]; p.x += p.vx; p.y += p.vy; p.life -= 1; if (p.life <= 0) { particlesRef.current.splice(i, 1); continue; } ctx.save(); ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) { const ft = floatingTextsRef.current[i]; ft.y += ft.vy; ft.alpha -= 0.02; if (ft.alpha <= 0) { floatingTextsRef.current.splice(i, 1); continue; } ctx.save(); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = ft.color; ctx.globalAlpha = Math.max(0, ft.alpha); ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); ctx.restore(); }
      ctx.restore();

      const mmSize = 62; const mmX = canvas.width - mmSize - 12; const mmY = canvas.height - mmSize - 180;
      ctx.save(); ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.beginPath(); (ctx as any).roundRect(mmX, mmY, mmSize, mmSize, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      barracksBuildingsRef.current.forEach((b) => { const bx = mmX + (b.x / MAP_WIDTH) * mmSize; const by = mmY + (b.y / MAP_HEIGHT) * mmSize; ctx.fillStyle = '#475569'; ctx.fillRect(bx, by, 2, 2); });
      tanksRef.current.forEach((t) => { if (t.isExploded) return; const tx = mmX + (t.x / MAP_WIDTH) * mmSize; const ty = mmY + (t.y / MAP_HEIGHT) * mmSize; ctx.fillStyle = t.occupiedBy ? (t.occupiedByType==='enemy'?'#EF4444':'#FACC15') : '#EAB308'; ctx.beginPath(); ctx.arc(tx, ty, 1.8, 0, Math.PI * 2); ctx.fill(); });
      enemiesRef.current.forEach((e) => { const ex = mmX + (e.x / MAP_WIDTH) * mmSize; const ey = mmY + (e.y / MAP_HEIGHT) * mmSize; ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(ex, ey, 1.2, 0, Math.PI * 2); ctx.fill(); });
      playersRef.current.forEach((pl) => { const px = mmX + (pl.x / MAP_WIDTH) * mmSize; const py = mmY + (pl.y / MAP_HEIGHT) * mmSize; ctx.fillStyle = pl.isMe ? '#FACC15' : '#38BDF8'; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'right'; ctx.fillText('RADAR 6K', mmX + mmSize - 3, mmY + mmSize - 3); ctx.restore();

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [inGame, isGameOver, isHourVictory, isHost, currentWave, soundEnabled, nearTankPrompt]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => { const touch = e.touches[0]; const rect = e.currentTarget.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const dx = touch.clientX - centerX; const dy = touch.clientY - centerY; const dist = Math.hypot(dx, dy); const maxR = rect.width / 2; joystickPosRef.current = { x: dx / Math.max(dist, maxR), y: dy / Math.max(dist, maxR), active: true }; };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => { const touch = e.touches[0]; const rect = e.currentTarget.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const dx = touch.clientX - centerX; const dy = touch.clientY - centerY; const dist = Math.hypot(dx, dy); const maxR = rect.width / 2; joystickPosRef.current = { x: dx / Math.max(dist, maxR), y: dy / Math.max(dist, maxR), active: true }; };
  const handleTouchEnd = () => { joystickPosRef.current = { x: 0, y: 0, active: false }; };
  const formatTime = (secs: number) => { const m = Math.floor(secs / 60); const s = secs % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };

  if (!inGame) { return <TurfWarLobby onBack={onBack} onStartMatch={handleStartMatch} currentCoins={currentCoins} initialRoomCode={initialRoomCode} onToast={onToast} />; }
  const me = playersRef.current.get(myPlayerId.current);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none font-sans text-white">
      <canvas ref={canvasRef} width={typeof window !== 'undefined' ? window.innerWidth : 1200} height={typeof window !== 'undefined' ? window.innerHeight : 800} className="w-full h-full block" />
      <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 backdrop-blur"><ArrowLeft className="w-5 h-5 text-white" /></button>
          <div className="bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-700/60 backdrop-blur"><span className="text-[9px] text-slate-400 block font-mono">ROOM</span><span className="text-xs font-black text-amber-400 font-mono">{roomCode}</span></div>
        </div>
        <div className="flex flex-col items-center pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-3 py-1 rounded-2xl shadow-lg backdrop-blur"><Clock className="w-3 h-3 text-amber-400 animate-pulse" /><span className="text-[10px] font-bold text-amber-300">MATCH: <span className="font-mono text-xs font-black text-white">{formatTime(matchTimeRemaining)}</span></span><span className="text-[9px] px-2 py-0.5 rounded font-bold bg-slate-800 border border-slate-600 text-cyan-300">{myRole} {me?.insideBuildingId ? '| INSIDE' : ''} {me?.inTankId ? '| TANK' : ''}</span></div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={()=>setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-slate-800/80 border border-slate-600/50">{soundEnabled ? <Volume2 className="w-4 h-4"/> : <VolumeX className="w-4 h-4"/>}</button>
          <div className="bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700/60 text-[10px] font-bold">WAVE {currentWave} | ENEMY {waveEnemiesRemaining} | KILLS {totalKills}</div>
        </div>
      </div>

      {nearTankPrompt && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black font-black px-4 py-1 rounded-full text-xs animate-pulse">{nearTankPrompt}</div>}

      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
        <div className="w-24 h-24 rounded-full bg-slate-800/40 border-2 border-slate-600/50 relative backdrop-blur" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="absolute w-8 h-8 bg-amber-400/60 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div><span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px] font-bold">MOVE</span></div>
        <div className="flex gap-2">
          <button onTouchStart={()=>{isShootingRef.current=true;}} onTouchEnd={()=>{isShootingRef.current=false;}} onMouseDown={()=>{isShootingRef.current=true;}} onMouseUp={()=>{isShootingRef.current=false;}} className="w-14 h-14 rounded-full bg-red-600/80 border-2 border-red-400 flex items-center justify-center font-black text-xs">FIRE</button>
          <button onClick={tryEnterExitTank} className="w-14 h-14 rounded-full bg-amber-500/80 border-2 border-amber-300 flex items-center justify-center font-black text-[10px]">F ENTER</button>
          <button onClick={triggerReload} className="w-12 h-12 rounded-full bg-slate-700/80 border border-slate-500 flex items-center justify-center"><RotateCcw className="w-5 h-5"/></button>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-20 w-32">
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2 backdrop-blur">
          <div className="flex justify-between text-[9px]"><span>HP</span><span>{me?.hp}/100</span></div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${me?.hp || 0}%`}}></div></div>
          <div className="flex justify-between text-[9px] mt-1"><span>ARMOR</span><span>{me?.armor}/100</span></div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${me?.armor || 0}%`}}></div></div>
          <div className="flex justify-between text-[9px] mt-1"><span>AMMO</span><span>{me?.ammo}/{me?.maxAmmo}</span></div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{width: `${((me?.ammo||0)/(me?.maxAmmo||30))*100}%`}}></div></div>
          {me?.isReloading && <div className="w-full h-1 bg-slate-800 mt-1"><div className="h-full bg-white animate-pulse" style={{width: `${(me.reloadProgress*100)}%`}}></div></div>}
        </div>
      </div>

      {(isGameOver || isHourVictory) && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 max-w-sm w-full text-center">
            <h2 className="text-2xl font-black mb-2">{isHourVictory ? 'VICTORY! 1 HOUR!' : 'WASTED!'}</h2>
            <p className="text-sm text-slate-400 mb-4">Wave {currentWave} | Kills {totalKills} | Time {formatTime(MATCH_DURATION_SECONDS - matchTimeRemaining)}</p>
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 mb-4"><span className="text-xs text-amber-300">EARNED</span><div className="text-2xl font-black text-amber-400">{earnedCoins} SC</div></div>
            <button onClick={onBack} className="w-full py-3 bg-amber-500 text-black font-black rounded-xl">BACK TO LOBBY</button>
          </div>
        </div>
      )}
    </div>
  );
};
