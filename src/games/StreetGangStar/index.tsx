'use client';

import React, { useState } from 'react';
import { Play, Users, ArrowLeft, Volume2, VolumeX, Shield, Sparkles, MapPin, Globe } from 'lucide-react';
import { StreetGangStar } from './StreetGangStar';
import { StreetGangStarMultiplayer } from './StreetGangStarMultiplayer';
import { getGangStarText, GangStarLanguage } from './language';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { playClickSound } from '@/lib/sound';

interface StreetGangStarHubProps {
  onBack: () => void;
  onToast: (msg: string) => void;
}

export function StreetGangStarHub({ onBack, onToast }: StreetGangStarHubProps) {
  const { language: gameLanguage } = useLanguage();
  const [mode, setMode] = useState<'hub' | 'single' | 'multiplayer'>('hub');
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    return gameLanguage || 'en';
  });

  const t = (key: Parameters<typeof getGangStarText>[1]) => getGangStarText(selectedLang, key);

  if (mode === 'single') {
    return (
      <StreetGangStar
        onBack={() => setMode('hub')}
        onToast={onToast}
        language={selectedLang}
        initialCountry="NG"
      />
    );
  }

  if (mode === 'multiplayer') {
    return (
      <StreetGangStarMultiplayer
        onBack={() => setMode('hub')}
        onToast={onToast}
        language={selectedLang}
        initialCountry="NG"
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#090A10] text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-[#FFD700]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
              <span>{t('game_title')}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#FFD700] text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                NEW MINI-APP
              </span>
            </h1>
            <p className="text-xs text-gray-400">Tactical 4KM Laser City Warfare • Single &amp; Multi</p>
          </div>
        </div>

        {/* Language selector toggle */}
        <div className="flex items-center gap-1.5 bg-black/60 border border-white/15 px-2.5 py-1.5 rounded-2xl">
          <Globe className="w-3.5 h-3.5 text-[#FFD700]" />
          <select
            value={selectedLang}
            onChange={(e) => {
              setSelectedLang(e.target.value);
              playClickSound();
            }}
            className="bg-transparent text-xs font-bold text-white uppercase focus:outline-none cursor-pointer"
          >
            <option value="en" className="bg-black text-white">English (EN)</option>
            <option value="pidgin" className="bg-black text-white">Naija Pidgin</option>
            <option value="fr" className="bg-black text-white">Français (FR)</option>
            <option value="ar" className="bg-black text-white">العربية (AR)</option>
            <option value="es" className="bg-black text-white">Español (ES)</option>
            <option value="pt" className="bg-black text-white">Português (PT)</option>
          </select>
        </div>
      </div>

      {/* Main Mode Selection Hub */}
      <div className="w-full max-w-md mx-auto my-auto space-y-4 py-6">
        {/* Banner Card */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#1E202E] via-[#121420] to-[#0A0B12] border-2 border-[#FFD700] p-6 shadow-[0_0_40px_rgba(255,215,0,0.25)] text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-2xl pointer-events-none" />

          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/15 border border-[#FFD700]/40 px-3 py-1 rounded-full mb-3">
            <Sparkles className="w-3 h-3" />
            STREET LIFE SPECIAL EDITION
          </span>

          <h2 className="text-2xl font-black italic uppercase text-white tracking-wide">
            STREET GANG STAR
          </h2>
          <p className="text-xs text-gray-300 mt-2 max-w-xs mx-auto leading-relaxed">
            Robbers and rival syndicates are raiding the district with motorcycles and armored buses. Save civilians, hijack cars, and rule the street!
          </p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            {/* Single Player Button */}
            <button
              onClick={() => {
                playClickSound();
                setMode('single');
              }}
              type="button"
              className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-[#FFD700] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>{t('single_player_title')}</span>
            </button>

            {/* Multiplayer Button */}
            <button
              onClick={() => {
                playClickSound();
                setMode('multiplayer');
              }}
              type="button"
              className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{t('multiplayer_title')}</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10">
            <div className="text-base font-black text-[#FFD700]">4KM</div>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Wide City Map</div>
          </div>
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10">
            <div className="text-base font-black text-emerald-400">+5 SC</div>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Per Gangster</div>
          </div>
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10">
            <div className="text-base font-black text-sky-400">LASER</div>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">No Blood Sci-Fi</div>
          </div>
        </div>
      </div>

      {/* Footer Controls Guide */}
      <div className="text-center text-[11px] text-gray-500 font-medium">
        {t('controls_guide')}
      </div>
    </div>
  );
}
