'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Flag, Trophy, Clock, ChevronsUp, ArrowLeft, Volume2, VolumeX, ShieldAlert, Zap, Gauge } from 'lucide-react';
import { StreetRaceLobby, RaceCarSkin, RaceLobbyPlayer, RACE_CARS } from './StreetRaceLobby';
import { HIGHWAY_LENGTH, generateHighwayMarkers, generateHighwayObstacles, renderHighwayScenery, renderRoadSegments, renderObstaclesOnRoad, renderPlayerCarBehind, renderOpponentCar, HighwayObstacle, HighwayMarker } from './StreetRaceHighway';
import { playCoinSound, playSuccessSound, playPunchSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import confetti from 'canvas-confetti';

interface RacerState { id: string; name: string; carSkin: RaceCarSkin; y: number; laneOffset: number; speed: number; nitro: number; isNitro: boolean; isBraking: boolean; isCrashed: boolean; crashTimer: number; isFinished: boolean; rank: number; isMe: boolean; }
interface OvertakeAlert { id: string; text: string; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }

export const StreetRaceMultiplayer: React.FC<{ onBack: () => void; onToast: (msg: string) => void; currentCoins: number; initialRoomCode?: string; }> = ({ onBack, onToast, currentCoins, initialRoomCode }) => {
  const [inRace, setInRace] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [myCarSkin, setMyCarSkin] = useState<RaceCarSkin>(RACE_CARS[0]);
  const myRacerId = useRef('racer_' + Math.random().toString(36).substring(2, 6));
  const [raceTime, setRaceTime] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [myRank, setMyRank] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashRemain, setCrashRemain] = useState(0);
  const [overtakeAlerts, setOvertakeAlerts] = useState<OvertakeAlert[]>([]);
  const [earnedCoins, setEarnedCoins] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const racersRef = useRef<Map<string, RacerState>>(new Map());
  const obstaclesRef = useRef<HighwayObstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{[k:string]:boolean}>({});
  const steeringInputRef = useRef(0);
  const isAccelRef = useRef(false);
  const isBrakeRef = useRef(false);
  const isNitroRef = useRef(false);
  const passedSet = useRef<Set<string>>(new Set());

  // ROUND STEERING
  const [wheelRot, setWheelRot] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startAngle = useRef(0);
  const startRot = useRef(0);
  const getAngle = (cx:number, cy:number, x:number, y:number) => Math.atan2(y-cy, x-cx)*180/Math.PI;
  
  const wheelStart = (x:number, y:number) => {
    if(!wheelRef.current) return;
    dragging.current = true;
    const r = wheelRef.current.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    startAngle.current = getAngle(cx,cy,x,y);
    startRot.current = wheelRot;
  };
  const wheelMove = (x:number, y:number) => {
    if(!dragging.current || !wheelRef.current) return;
    const r = wheelRef.current.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const cur = getAngle(cx,cy,x,y);
    let rot = startRot.current + (cur - startAngle.current);
    rot = Math.max(-120, Math.min(120, rot));
    setWheelRot(rot);
    steeringInputRef.current = rot / 45; // FIX: more sensitive 1:1
  };
  const wheelEnd = () => {
    dragging.current = false;
    const id = setInterval(() => {
      setWheelRot(p => {
        if(Math.abs(p) < 3){ clearInterval(id); steeringInputRef.current = 0; return 0; }
        const n = p * 0.8;
        steeringInputRef.current = n / 45;
        return n;
      });
    }, 16);
  };

  const handleStartRace = (code:string, host:boolean, car:RaceCarSkin) => {
    setRoomCode(code); setMyCarSkin(car); setInRace(true);
    obstaclesRef.current = generateHighwayObstacles();
    racersRef.current.set(myRacerId.current, { id: myRacerId.current, name: 'You', carSkin: car, y:0, laneOffset:0, speed:0, nitro:100, isNitro:false, isBraking:false, isCrashed:false, crashTimer:0, isFinished:false, rank:1, isMe:true });
    const botNames = ['Shadow Viper','Neon Phantom','Apex Striker'];
    for(let b=1;b<4;b++){ const botId=`bot_${b}`; const skin=RACE_CARS[b%RACE_CARS.length]; racersRef.current.set(botId,{ id:botId, name:botNames[b-1], carSkin:skin, y:b*40, laneOffset:b===1?-0.6:0.6, speed:0, nitro:100, isNitro:false, isBraking:false, isCrashed:false, crashTimer:0, isFinished:false, rank:b+1, isMe:false }); }
    onToast('7KM Race Started! Hold GAS!');
  };

  useEffect(() => {
    const kd = (e:KeyboardEvent)=>{ keysRef.current[e.key.toLowerCase()]=true; if(e.key===' '||e.key==='Shift') isNitroRef.current=true; };
    const ku = (e:KeyboardEvent)=>{ keysRef.current[e.key.toLowerCase()]=false; if(e.key===' '||e.key==='Shift') isNitroRef.current=false; };
    window.addEventListener('keydown',kd); window.addEventListener('keyup',ku);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  },[]);
  useEffect(()=>{ if(!inRace||isFinished) return; const i=setInterval(()=>setRaceTime(t=>t+1),1000); return()=>clearInterval(i); },[inRace,isFinished]);

  const formatTime = (s:number)=> `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // MAIN LOOP - FIXED
  useEffect(()=>{
    if(!inRace) return;
    let anim:number;
    const loop = ()=>{
      const canvas=canvasRef.current; if(!canvas){ anim=requestAnimationFrame(loop); return; }
      const ctx=canvas.getContext('2d'); if(!ctx){ anim=requestAnimationFrame(loop); return; }
      const me=racersRef.current.get(myRacerId.current);
      if(me && !me.isFinished){
        // STEERING LOGIC - FIXED TO MOVE EVEN WHEN SLOW
        let steer = steeringInputRef.current;
        if(keysRef.current['a']||keysRef.current['arrowleft']) steer -= 1;
        if(keysRef.current['d']||keysRef.current['arrowright']) steer += 1;

        const isAccelerating = keysRef.current['w']||keysRef.current['arrowup']||isAccelRef.current;
        const isBraking = keysRef.current['s']||keysRef.current['arrowdown']||isBrakeRef.current;
        const wantsNitro = isNitroRef.current && me.nitro > 0;

        me.isBraking = isBraking; me.isNitro = wantsNitro;

        if(me.isCrashed){
          me.crashTimer -= 0.016; setCrashRemain(Math.ceil(me.crashTimer));
          me.speed = Math.max(0, me.speed - 4);
          if(me.crashTimer<=0){ me.isCrashed=false; setIsCrashed(false); }
        }else{
          // SPEED - GAS MUST HOLD
          const maxSpeed = wantsNitro ? me.carSkin.topSpeed + 30 : me.carSkin.topSpeed;
          if(isAccelerating){
            me.speed = Math.min(maxSpeed, me.speed + (wantsNitro ? 2.2 : 1.4));
          }else if(isBraking){
            me.speed = Math.max(0, me.speed - 3);
          }else{
            me.speed = Math.max(0, me.speed - 0.6);
          }
          // NITRO
          if(wantsNitro && isAccelerating){ me.nitro=Math.max(0,me.nitro-0.8); setNitro(Math.round(me.nitro)); }
          else if(!wantsNitro && me.nitro<100){ me.nitro=Math.min(100,me.nitro+0.15); setNitro(Math.round(me.nitro)); }

          // STEERING - CAR MUST MOVE LEFT/RIGHT
          if(me.speed > 1){
            const sens = 0.08 + (me.speed/200)*0.04; // FIXED: always steer, more when fast
            me.laneOffset += steer * sens;
          }
          // CLAMP - NO GREEN GRASS ENTER
          me.laneOffset = Math.max(-0.85, Math.min(0.85, me.laneOffset));

          // MOVE FORWARD
          me.y += (me.speed/3.6)*12*0.016;
          setDistanceKm(Math.min(7, +(me.y/10000).toFixed(2)));
          setSpeedKmh(Math.round(me.speed));

          if(me.y >= HIGHWAY_LENGTH){ me.isFinished=true; setIsFinished(true); const reward=me.rank===1?500:me.rank===2?300:100; setEarnedCoins(reward); addGameCoins(reward,'race','race_reward'); playSuccessSound(); confetti({particleCount:150,spread:80}); }

          // COLLISION WITH CONES - NOW WORKS
          for(let i=0;i<obstaclesRef.current.length;i++){
            const obs=obstaclesRef.current[i];
            if(Math.abs(obs.y-me.y)<40 && Math.abs(obs.laneOffset-me.laneOffset)<0.32){
              me.isCrashed=true; me.crashTimer=2; me.speed=0; setIsCrashed(true); playPunchSound();
              particlesRef.current.push({x:canvas.width/2, y:canvas.height*0.8, vx:(Math.random()-0.5)*4, vy:-Math.random()*4, life:20, color:'#f87171', size:6});
              obstaclesRef.current.splice(i,1); break;
            }
          }
        }
      }
      // BOTS
      racersRef.current.forEach(r=>{ if(r.isMe||r.isFinished) return; const target=130+Math.sin(r.y*0.001)*20; if(r.speed<target) r.speed+=0.6; else r.speed-=0.4; r.y+=(r.speed/3.6)*12*0.016; r.laneOffset+=Math.sin(Date.now()*0.001+r.y*0.01)*0.005; if(r.y>=HIGHWAY_LENGTH) r.isFinished=true; });
      const sorted=Array.from(racersRef.current.values()).sort((a,b)=>b.y-a.y); sorted.forEach((r,i)=>{ r.rank=i+1; if(r.isMe) setMyRank(i+1); });

      // RENDER
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(me){
        // FIX: Draw scenery with smaller green so road bigger
        renderHighwayScenery(ctx, canvas.width, canvas.height, me.y, me.laneOffset*150);
        renderRoadSegments(ctx, canvas.width, canvas.height, me.y, me.laneOffset*150);
        renderObstaclesOnRoad(ctx, obstaclesRef.current, me.y, me.laneOffset*150, canvas.width, canvas.height);
        racersRef.current.forEach(opp=>{ if(!opp.isMe) renderOpponentCar(ctx, me.y, me.laneOffset*150, opp.y, opp.laneOffset, opp.name, opp.carSkin.color, canvas.width, canvas.height); });
        // Car bigger and higher
        renderPlayerCarBehind(ctx, canvas.width/2, canvas.height*0.78, steeringInputRef.current, me.isBraking, me.isNitro, me.isCrashed, me.carSkin.color);
      }
      anim=requestAnimationFrame(loop);
    };
    anim=requestAnimationFrame(loop); return()=>cancelAnimationFrame(anim);
  },[inRace,isFinished]);

  if(!inRace) return <StreetRaceLobby onBack={onBack} onStartRace={handleStartRace} currentCoins={currentCoins} initialRoomCode={initialRoomCode} onToast={onToast} />;
  
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden text-white select-none">
      <canvas ref={canvasRef} width={typeof window!== 'undefined'?window.innerWidth:1200} height={typeof window!== 'undefined'?window.innerHeight:800} className="w-full h-full block" />
      
      {/* TOP HUD - BACK NOW */}
      <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/90 to-transparent flex justify-between z-20">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-900 border border-slate-700"><ArrowLeft className="w-4 h-4"/></button>
        <div className="bg-black/80 border border-amber-500/30 px-3 py-1 rounded-xl flex gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1"><Flag className="w-3 h-3 text-red-400"/>{distanceKm}/7km</span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400"/>{formatTime(raceTime)}</span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1"><Gauge className="w-3 h-3 text-emerald-400"/>{speedKmh}km/h</span>
          <span className="text-amber-400 ml-1">#{myRank}</span>
        </div>
        <div className="bg-black/70 px-2 py-1 rounded-full border border-cyan-500/40 flex items-center gap-1"><Zap className="w-3 h-3 text-cyan-400"/><div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-400" style={{width:`${nitro}%`}}/></div></div>
      </div>

      {isCrashed && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-red-600 px-4 py-1 rounded-full font-black text-xs animate-pulse">CRASH! {crashRemain}s</div>}

      {/* CONTROLS - GAS DOWN, STOP ON TOP, STEERING ROUND LEFT */}
      <div className="absolute bottom-4 left-3 z-30">
        <div ref={wheelRef} onTouchStart={e=>{e.preventDefault(); wheelStart(e.touches[0].clientX, e.touches[0].clientY);}} onTouchMove={e=>{e.preventDefault(); wheelMove(e.touches[0].clientX, e.touches[0].clientY);}} onTouchEnd={e=>{e.preventDefault(); wheelEnd();}} onMouseDown={e=>wheelStart(e.clientX,e.clientY)} onMouseMove={e=>{if(dragging.current) wheelMove(e.clientX,e.clientY);}} onMouseUp={wheelEnd} className="w-[125px] h-[125px] rounded-full bg-gradient-to-br from-slate-600 to-slate-900 border-[5px] border-slate-400 shadow-2xl flex items-center justify-center" style={{touchAction:'none'}}>
          <div className="w-[100px] h-[100px] rounded-full border border-slate-400 relative flex items-center justify-center" style={{transform:`rotate(${wheelRot}deg)`}}>
            <div className="w-8 h-8 rounded-full bg-slate-800 border"/><div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-5 bg-amber-400 rounded-full"/><div className="absolute w-full h-0.5 bg-slate-500 top-1/2"/><div className="absolute h-full w-0.5 bg-slate-500 left-1/2"/>
          </div>
        </div>
        <div className="text-center text-[8px] font-black tracking-widest text-slate-500 mt-1">STEERING</div>
      </div>

      <div className="absolute bottom-4 right-3 z-30 flex flex-col items-center gap-2">
        <button onTouchStart={e=>{e.preventDefault(); isNitroRef.current=true;}} onTouchEnd={e=>{e.preventDefault(); isNitroRef.current=false;}} className="w-11 h-11 rounded-xl bg-cyan-900 border border-cyan-400 flex flex-col items-center justify-center active:scale-90"><Zap className="w-4 h-4 text-cyan-300 fill-cyan-400"/><span className="text-[7px] font-black text-cyan-200">NITRO</span></button>
        <button onTouchStart={e=>{e.preventDefault(); isBrakeRef.current=true;}} onTouchEnd={e=>{e.preventDefault(); isBrakeRef.current=false;}} className="w-14 h-11 rounded-xl bg-rose-900 border border-rose-500 flex items-center justify-center font-black text-[11px] text-white active:scale-90">STOP</button>
        <button onTouchStart={e=>{e.preventDefault(); isAccelRef.current=true;}} onTouchEnd={e=>{e.preventDefault(); isAccelRef.current=false;}} className="w-[76px] h-[76px] rounded-[20px] bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-emerald-100 flex flex-col items-center justify-center text-black active:scale-90 shadow-xl shadow-emerald-500/30"><ChevronsUp className="w-7 h-7"/><span className="text-xs font-black">GAS</span></button>
      </div>

      {isFinished && <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 w-full max-w-sm text-center"><Trophy className="w-14 h-14 text-amber-400 mx-auto"/><h2 className="text-xl font-black mt-2">FINISH! #{myRank}</h2><p className="text-sm text-slate-400">+{earnedCoins} SC</p><button onClick={onBack} className="w-full mt-4 py-3 rounded-xl bg-amber-400 text-black font-black">Collect</button></div></div>}
    </div>
  );
};
export default StreetRaceMultiplayer;
