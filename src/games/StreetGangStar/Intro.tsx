'use client';

import React, { useState } from 'react';
import { Phone, PhoneCall, ShieldAlert, ArrowRight, Play, Crosshair, MapPin, Radio } from 'lucide-react';
import { getGangStarText, GangStarLanguage } from './language';
import { playClickSound, playSuccessSound } from '@/lib/sound';

interface IntroProps {
  language: string;
  cityName: string;
  streetName: string;
  onStartGame: () => void;
  onBack?: () => void;
}

export function StreetGangStarIntro({
  language,
  cityName,
  streetName,
  onStartGame,
  onBack,
}: IntroProps) {
  const [step, setStep] = useState<number>(1);
  const totalSteps = 3;

  const t = (key: Parameters<typeof getGangStarText>[1]) => getGangStarText(language, key);

  const handleNext = () => {
    playClickSound();
    if (step < totalSteps) {
      setStep((prev) => prev + 1);
    } else {
      playSuccessSound();
      onStartGame();
    }
  };

  const getStepText = () => {
    if (step === 1) {
      return `${t('intro_call_1')} [${streetName}, ${cityName}]`;
    }
    if (step === 2) {
      return t('intro_call_2');
    }
    return t('intro_call_3');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090A0F] text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden font-sans"
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.12) 0%, transparent 60%)',
      }}
    >
      {/* TOP BAR: Street District & Caller Heads-Up */}
      <div className="w-full flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]">
            <Crosshair className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-[#FFD700] uppercase">
              DISTRICT ALERT
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-300 font-bold">
              <MapPin className="w-3.5 h-3.5 text-red-400" />
              <span>{streetName}, {cityName}</span>
            </div>
          </div>
        </div>

        {/* TOP RIGHT CORNER: PHONE CALL CIRCLE + STREET BOSS */}
        <div className="flex items-center gap-3 bg-black/80 border border-[#FFD700]/50 rounded-full pl-2 pr-4 py-1.5 shadow-[0_0_20px_rgba(255,215,0,0.25)] backdrop-blur-md">
          {/* Animated Call Circle */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-[#FFD700] to-yellow-200 p-0.5 shadow-lg">
              <div className="w-full h-full rounded-full bg-[#14151C] flex items-center justify-center overflow-hidden">
                <span className="text-xl">🕶️</span>
              </div>
            </div>
            {/* Pulsing incoming call ring */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-black" />
            </span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1">
              <span>{t('intro_boss_name')}</span>
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
              SECURE LINE ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: DIALOGUE BOX WITH AUDIO WAVE VISUALIZATION */}
      <div className="w-full max-w-xl mx-auto my-auto z-20 flex flex-col items-center">
        {/* Holographic Caller Wave Visualizer */}
        <div className="flex items-center gap-1 mb-4 h-8">
          {[14, 28, 18, 36, 22, 32, 16, 28, 38, 20, 30, 16].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-amber-500 to-[#FFD700] rounded-full transition-all duration-300"
              style={{
                height: `${h}px`,
                opacity: 0.6 + (i % 3) * 0.2,
                animation: `pulse 1s infinite alternate ${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Main Dialogue Card */}
        <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#181A24] via-[#10121A] to-[#0A0A0F] border-2 border-[#FFD700]/60 p-6 sm:p-8 shadow-[0_0_40px_rgba(255,215,0,0.2)] text-left backdrop-blur-xl">
          {/* Header pill */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#FFD700] animate-bounce" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700]">
                TRANSMISSION STEP {step} / {totalSteps}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-6 h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'bg-[#FFD700] shadow-[0_0_8px_#FFD700]' : s < step ? 'bg-amber-600' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Dialogue Body */}
          <p className="text-base sm:text-lg font-bold text-white leading-relaxed min-h-[90px] flex items-center">
            &ldquo;{getStepText()}&rdquo;
          </p>

          {/* Quick Mission Warning Pill */}
          <div className="mt-5 p-3 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center gap-2.5 text-xs text-red-200">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold">{t('mission_save')}</span>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS: NEXT / START GAME */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between gap-3 z-20 pt-4">
        {onBack ? (
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            {t('back')}
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          type="button"
          className="flex-1 max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-[#FFD700] to-yellow-400 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(255,215,0,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          {step < totalSteps ? (
            <>
              <span>{t('next')}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-black" />
              <span>{t('start_game')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
