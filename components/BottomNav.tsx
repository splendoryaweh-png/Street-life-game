'use client';

import React from 'react';
import { NavTab } from '@/types/game';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Mic2, Gamepad2, ShoppingBag, Swords, User, Home } from 'lucide-react';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useLanguage();
  const tabs: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'STUDIO', label: t('nav_studio', 'STUDIO'), icon: Mic2 },
    { id: 'GAMES', label: t('nav_games', 'GAMES'), icon: Gamepad2 },
    { id: 'SHOP', label: t('nav_shop', 'SHOP'), icon: ShoppingBag },
    { id: 'WAR', label: t('nav_war', 'TOUGH WAR'), icon: Swords },
    { id: 'PROFILE', label: t('nav_profile', 'PROFILE'), icon: User },
    { id: 'HOME', label: t('nav_home', 'HOME'), icon: Home },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-black border-t border-white/10 select-none pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto grid grid-cols-6 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'GAMES' && activeTab === 'CRIB') ||
            (tab.id === 'SHOP' && (activeTab === 'INVENTORY' || activeTab === 'BANK'));

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              type="button"
              className={`flex flex-col items-center justify-center py-2 px-0.5 min-h-[54px] transition-all relative cursor-pointer touch-manipulation ${
                isActive
                  ? 'text-[#FFD700]'
                  : 'text-gray-400 hover:text-white/90 active:scale-95'
              }`}
            >
              {/* Active gold ambient pill glow */}
              {isActive && (
                <div className="absolute top-0 w-8 h-1 bg-[#FFD700] rounded-full shadow-[0_0_10px_#FFD700]" />
              )}

              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] text-[#FFD700]' : ''
                }`}
              />

              <span
                className={`text-[8.5px] font-extrabold tracking-tight mt-1 whitespace-nowrap ${
                  isActive ? 'text-[#FFD700] font-black' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
