'use client';

import React from 'react';
import { RobberyToolId } from '@/types/game';
import { ROBBERY_TOOLS } from '@/lib/bank-config';
import { X, Wrench, Shield, Crosshair, Car, Users, Check, ShoppingBag, Coins, Zap, Plus } from 'lucide-react';

interface ToolsShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownedTools: RobberyToolId[];
  userCoins: number;
  onBuyTool: (toolId: RobberyToolId, price: number) => void;
  highlightToolId?: RobberyToolId | null;
}

export function ToolsShopModal({
  isOpen,
  onClose,
  ownedTools,
  userCoins,
  onBuyTool,
  highlightToolId,
}: ToolsShopModalProps) {
  if (!isOpen) return null;

  const toolList = Object.values(ROBBERY_TOOLS);

  const getToolIcon = (id: RobberyToolId) => {
    switch (id) {
      case 'crowbar':
        return Wrench;
      case 'mask':
        return Shield;
      case 'gun':
        return Crosshair;
      case 'driver':
        return Car;
      case 'full_crew':
        return Users;
      default:
        return Wrench;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-[#FFD700]/40 p-5 shadow-2xl text-left space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close Tools Shop"
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shadow-md shadow-[#FFD700]/20 shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Black Market Armory
            </h3>
            <p className="text-xs text-[#9CA3AF]">
              Equip heist gear to unlock high-tier banks
            </p>
          </div>
        </div>

        {/* Current Balance & Bonus banner */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
          <div className="flex items-center gap-1.5 text-white/90">
            <Coins className="w-4 h-4 text-[#FFD700]" />
            <span>Balance:</span>
            <span className="font-mono font-bold text-[#FFD700]">{userCoins.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Zap className="w-3 h-3" />
            <span>+10% Success / Tool</span>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="space-y-2.5">
          {toolList.map((tool) => {
            const Icon = getToolIcon(tool.id);
            const count = ownedTools.filter((id) => id === tool.id).length;
            const isOwned = count > 0;
            const canAfford = userCoins >= tool.price;
            const isHighlighted = highlightToolId === tool.id;

            return (
              <div
                key={tool.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isHighlighted && !isOwned
                    ? 'border-[#FFD700] bg-gradient-to-r from-[#FFD700]/15 via-[#1a1a1a] to-transparent shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                    : isOwned
                    ? 'border-emerald-500/30 bg-emerald-950/15'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Tool Icon with Small Count Badge */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                          isOwned
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                            : 'bg-white/5 text-[#FFD700] border border-white/10'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Small Count Badge on Top Right */}
                      <span
                        className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-mono font-black flex items-center justify-center border shadow-sm transition-transform ${
                          isOwned
                            ? 'bg-[#FFD700] text-black border-black/50 shadow-[#FFD700]/30 scale-100'
                            : 'bg-[#222] text-[#9CA3AF] border-white/10'
                        }`}
                        title={`You currently possess ${count} of this tool`}
                      >
                        x{count}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">
                          {tool.name}
                        </span>
                        {isOwned ? (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            Possessed: {count}
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#9CA3AF] bg-white/5 px-1.5 py-0.2 rounded">
                            0 in stash
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] line-clamp-1 mt-0.5">
                        {tool.description}
                      </p>
                      <span className="text-[10px] font-mono font-bold text-[#FFD700] block mt-0.5">
                        {tool.price.toLocaleString()} coins
                      </span>
                    </div>
                  </div>

                  {/* Buy / Buy More button */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {isOwned ? (
                      <button
                        onClick={() => onBuyTool(tool.id, tool.price)}
                        disabled={!canAfford}
                        type="button"
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-1 ${
                          canAfford
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 active:scale-95'
                            : 'bg-white/5 text-[#9CA3AF] cursor-not-allowed border border-white/5'
                        }`}
                        title="Purchase an additional copy of this tool"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buy More</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onBuyTool(tool.id, tool.price)}
                        disabled={!canAfford}
                        type="button"
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1 ${
                          canAfford
                            ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20 hover:brightness-110 active:scale-95'
                            : 'bg-white/5 text-[#9CA3AF] cursor-not-allowed border border-white/5'
                        }`}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Note */}
        <p className="text-[10px] text-[#9CA3AF]/80 text-center pt-1">
          Possessed tools are stored in your armory stash and boost all heist operations.
        </p>
      </div>
    </div>
  );
}
