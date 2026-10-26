'use client';

import React, { useState } from 'react';
import { NavTab } from '@/types/game';
import { Sofa, Wallet, ListChecks, Tv, Backpack, Sparkles, Beaker, Check, ExternalLink } from 'lucide-react';
import { KNOWN_HUSTLE_COMPOUNDS, HustleCompound } from '@/lib/science';

interface TabPlaceholderProps {
  tab: NavTab;
}

export function TabPlaceholder({ tab }: TabPlaceholderProps) {
  const [selectedCompound, setSelectedCompound] = useState<HustleCompound | null>(null);
  const [copiedSmiles, setCopiedSmiles] = useState(false);

  const metaMap: Partial<Record<
    NavTab,
    { title: string; subtitle: string; icon: React.ElementType; prom: string }
  >> = {
    CRIB: {
      title: 'Hustler Safehouse & Crib',
      subtitle: 'Luxury penthouses, safe deposit vaults & trophy rooms',
      icon: Sofa,
      prom: 'Coming in Prom 3',
    },
    BANK: {
      title: 'Underground Street Bank',
      subtitle: 'Staking yields, liquidity pools & money laundering rackets',
      icon: Wallet,
      prom: 'Coming in Prom 4',
    },
    TASKS: {
      title: 'Syndicate Bounties & Tasks',
      subtitle: 'Daily missions, partner quests & social multipliers',
      icon: ListChecks,
      prom: 'Coming in Prom 3',
    },
    WATCH: {
      title: 'Dark Cinema & Ads Vault',
      subtitle: 'Watch ads to boost energy reserves and multiply offline hustle',
      icon: Tv,
      prom: 'Coming in Prom 4',
    },
    INVENTORY: {
      title: 'Black Market & Armory',
      subtitle: 'Street weapons, bio-enhancers & contraband equipment',
      icon: Backpack,
      prom: 'Coming in Prom 3',
    },
  };

  if (tab === 'HOME' || tab === 'BANK') return null;

  const current = metaMap[tab];
  if (!current) return null;
  const Icon = current.icon;

  const handleCopySmiles = (smiles: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(smiles);
      setCopiedSmiles(true);
      setTimeout(() => setCopiedSmiles(false), 2000);
    }
  };

  return (
    <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-6">
      {/* Icon Frame */}
      <div className="relative">
        <div className="absolute -inset-3 bg-[#FFD700]/15 rounded-full blur-xl pointer-events-none" />
        <div className="relative w-20 h-20 rounded-2xl bg-[#151515] border-2 border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.15)]">
          <Icon className="w-10 h-10" />
        </div>
      </div>

      {/* Required Prom text */}
      <div className="space-y-1.5 max-w-xs">
        <div className="inline-block px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-xs font-black tracking-wider text-[#FFD700] uppercase mb-1">
          {current.prom}
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">
          {current.title}
        </h2>
        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          {current.subtitle}
        </p>
      </div>

      {/* Feature Preview Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#151515] p-4 text-left space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>Architecture Roadmap Status</span>
        </div>
        <p className="text-xs text-[#9CA3AF]">
          Core contracts and mechanics for this sector are staged for delivery in the next release prompt.
        </p>

        {/* Bioscience Skill Integration Showcase for INVENTORY or CRIB */}
        {(tab === 'INVENTORY' || tab === 'CRIB') && (
          <div className="pt-3 border-t border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#FFD700] flex items-center gap-1.5">
                <Beaker className="w-3.5 h-3.5" />
                Street Bio-Enhancement Lab (Science Preview)
              </span>
              <span className="text-[9px] font-mono text-[#9CA3AF]">PubChem Verified</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {KNOWN_HUSTLE_COMPOUNDS.map((c) => (
                <button
                  key={c.cid}
                  onClick={() => setSelectedCompound(c)}
                  type="button"
                  className={`p-2 rounded-xl text-left border transition-all ${
                    selectedCompound?.cid === c.cid
                      ? 'border-[#FFD700] bg-[#FFD700]/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-xs font-bold text-white truncate">{c.name}</div>
                  <div className="text-[10px] text-[#9CA3AF] truncate">{c.category}</div>
                </button>
              ))}
            </div>

            {selectedCompound && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs text-left">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{selectedCompound.name}</span>
                  <span className="text-[10px] font-mono text-[#FFD700]">CID: {selectedCompound.cid}</span>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  Formula: <span className="text-white font-mono">{selectedCompound.formula}</span> ({selectedCompound.molecularWeight})
                </div>
                <div className="text-[11px] text-emerald-400">
                  Effect: {selectedCompound.gameEffect}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                  <span className="text-[#9CA3AF] truncate max-w-[180px]">
                    IUPAC: {selectedCompound.iupacName}
                  </span>
                  <button
                    onClick={() => handleCopySmiles(selectedCompound.smiles)}
                    className="text-[#FFD700] hover:underline flex items-center gap-1"
                  >
                    {copiedSmiles ? <Check className="w-3 h-3 text-emerald-400" /> : <ExternalLink className="w-3 h-3" />}
                    SMILES
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
