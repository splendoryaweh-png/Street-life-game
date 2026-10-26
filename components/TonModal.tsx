'use client';

import React from 'react';
import { X } from 'lucide-react';
import { PlayerWallet } from '@/src/wallet/PlayerWallet';

interface TonModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetCoin?: number;
  onCoinsChange?: (newCoins: number) => void;
  onToast?: (msg: string) => void;
}

export function TonModal({ isOpen, onClose, streetCoin, onCoinsChange, onToast }: TonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#14141e] border-2 border-[#0098EA]/50 p-5 shadow-2xl space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header Close */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-xs font-black uppercase tracking-wider text-cyan-400 font-mono">
            Street Life TON Portal
          </span>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close TON modal"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full Player Wallet & Locked Withdrawal Facility */}
        <PlayerWallet
          currentCoins={streetCoin}
          onCoinsChange={onCoinsChange}
          onToast={onToast}
          isOpen={isOpen}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export default TonModal;
