'use client';
import React from 'react';

export interface ProfileScreenProps {
  gameState?: any;
  activeGameState?: any;
  telegramUser?: any;
  activeTelegramUser?: any;
  isAdmin?: boolean; // <-- FIX: added
  onOpenAdmin?: () => void; // <-- FIX: added
  onOpenTransactions?: () => void; // <-- FIX: added
  onToast: (msg: string) => void;
  showToast?: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
  onBack?: () => void;
  closeAllModals?: () => void;
  setActiveTab?: (tab: any) => void;
  isChromeHidden?: boolean;
  setIsChromeHidden?: (v: boolean) => void;
  is3DGameActive?: boolean;
  setIs3DGameActive?: (v: boolean) => void;
  onGameActiveChange?: (isActive: boolean) => void;
  [key: string]: any; // <-- Allow any other props so build never fail again
}

const ProfileScreen: React.FC<ProfileScreenProps> = (props) => {
  const { 
    gameState, 
    telegramUser, 
    isAdmin = false, 
    onOpenAdmin,
    onOpenTransactions,
    onToast,
    onNavigateTab,
    onBack,
    isChromeHidden,
    setIsChromeHidden
  } = props;

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">PROFILE</h2>
          <button 
            onClick={() => setIsChromeHidden && setIsChromeHidden(!isChromeHidden)}
            className="p-2 bg-white/10 rounded-full"
          >
            {isChromeHidden ? '👁️' : '🙈'}
          </button>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-4">
          <p className="text-sm text-white/60">User</p>
          <p className="font-bold">{telegramUser?.first_name || gameState?.username || 'Player'}</p>
          {isAdmin && (
            <div className="mt-3">
              <span className="text-xs bg-red-500 px-2 py-1 rounded">ADMIN</span>
              <button 
                onClick={onOpenAdmin}
                className="ml-2 text-xs bg-[#FFD700] text-black px-3 py-1 rounded-full font-bold"
              >
                Open Admin
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => onNavigateTab && onNavigateTab('GAMES')}
          className="w-full bg-[#FFD700] text-black font-black py-3 rounded-xl"
        >
          BACK TO GAMES
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
