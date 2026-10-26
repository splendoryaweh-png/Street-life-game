'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TelegramUser } from '@/types/game';
import { Coins, Wallet, Volume2, VolumeX, Gift } from 'lucide-react';
import { isSoundEnabled, toggleSound, playClickSound } from '@/lib/sound';
import { getPlayerWallet, PlayerWalletState } from '@/src/wallet/PlayerWallet';

interface TopBarProps {
  telegramUser: TelegramUser | null;
  streetCoin: number;
  onOpenProfile: () => void;
  onConnectWallet: () => void;
  onOpenTransactions?: () => void;
}

export function TopBar({
  telegramUser,
  streetCoin,
  onOpenProfile,
  onConnectWallet,
  onOpenTransactions,
}: TopBarProps) {
  const [audioActive, setAudioActive] = useState(() => isSoundEnabled());
  const [playerWallet, setPlayerWallet] = useState<PlayerWalletState>(() => getPlayerWallet());

  useEffect(() => {
    const handleWalletChange = (e: Event) => {
      const customEvent = e as CustomEvent<PlayerWalletState>;
      if (customEvent.detail) setPlayerWallet(customEvent.detail);
      else setPlayerWallet(getPlayerWallet());
    };

    window.addEventListener('streetlife_player_wallet_changed', handleWalletChange);
    window.addEventListener('storage', handleWalletChange);

    return () => {
      window.removeEventListener('streetlife_player_wallet_changed', handleWalletChange);
      window.removeEventListener('storage', handleWalletChange);
    };
  }, []);

  const handleSoundToggle = () => {
    const newState = toggleSound();
    setAudioActive(newState);
  };

  const displayName = telegramUser?.first_name || 'Hustler';
  const avatarUrl = telegramUser?.photo_url;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
        {/* Left: User Avatar + Name (Click -> Profile Modal) */}
        <button
          onClick={() => {
            playClickSound();
            onOpenProfile();
          }}
          type="button"
          aria-label="Open User Profile"
          className="flex items-center gap-2.5 p-1 -ml-1 rounded-full hover:bg-white/5 active:scale-95 transition-all text-left cursor-pointer min-h-[44px]"
        >
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-[#FFD700]/50 bg-[#151515] flex items-center justify-center shrink-0 shadow-sm shadow-[#FFD700]/20">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xs font-black text-[#FFD700] tracking-wider">
                SL
              </span>
            )}
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10 pointer-events-none" />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate max-w-[85px] leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] text-[#9CA3AF] tracking-tight">
              Hustler LVL 1
            </span>
          </div>
        </button>

        {/* Center: NOTHING */}
        <div className="flex-1" />

        {/* Right: Sound Toggle + Small Balance + TON Connect Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sound FX Toggle (Easy to click) */}
          {/* Daily Free Rewards & Fuel Link */}
          <Link
            href="/daily-free"
            onClick={() => playClickSound()}
            className="w-8 h-8 rounded-full border border-[#FFD700]/50 bg-gradient-to-tr from-[#FFD700]/20 to-amber-500/20 text-[#FFD700] flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-[0_0_10px_rgba(255,215,0,0.3)] animate-pulse"
            title="Daily Free System (Free Nitro, Coins, Power-ups)"
          >
            <Gift className="w-4 h-4 fill-[#FFD700]" />
          </Link>

          <button
            onClick={handleSoundToggle}
            type="button"
            aria-label={audioActive ? 'Mute Game Sounds' : 'Unmute Game Sounds'}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              audioActive
                ? 'bg-[#FFD700]/15 border-[#FFD700]/40 text-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.2)]'
                : 'bg-white/5 border-white/10 text-[#9CA3AF]'
            }`}
            title={audioActive ? 'Sound Effects: ON (Tap to Mute)' : 'Sound Effects: MUTED (Tap to Enable)'}
          >
            {audioActive ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => {
              playClickSound();
              onOpenTransactions?.();
            }}
            type="button"
            title="View Transactions History (Last 10)"
            className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#151515] hover:bg-white/10 border border-white/10 hover:border-[#FFD700]/50 text-xs font-medium text-white tabular-nums transition-all cursor-pointer active:scale-95"
          >
            <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>{streetCoin.toLocaleString()}</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              onConnectWallet();
            }}
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs shadow-md active:scale-95 hover:brightness-110 transition-all cursor-pointer min-h-[34px] ${
              playerWallet.connected
                ? 'bg-[#0098EA]/20 text-[#00c0f9] border border-[#0098EA]/50'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black shadow-[#FFD700]/15'
            }`}
          >
            {playerWallet.connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono whitespace-nowrap">
                  {playerWallet.address.length > 10
                    ? `${playerWallet.address.slice(0, 4)}...${playerWallet.address.slice(-3)}`
                    : playerWallet.address}
                </span>
              </>
            ) : (
              <>
                <Wallet className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Connect Wallet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
