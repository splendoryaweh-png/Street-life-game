'use client';

import React from 'react';
import { X, Gamepad2, Crosshair, Users, Coins, Mic2, ShieldCheck } from 'lucide-react';

type HowToPlayModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const lessons = [
  {
    icon: Gamepad2,
    title: '1. Choose your game',
    color: 'text-[#FFD700]',
    body: 'From the Home screen, scroll to the game cards and choose the game you want to play. Read the on-screen instructions before starting a round.',
  },
  {
    icon: Crosshair,
    title: '2. Learn the controls',
    color: 'text-red-400',
    body: 'Use the movement and action controls shown inside the selected game. Depending on the game, these may control movement, aiming, shooting, driving, or riding. The controls can differ between games.',
  },
  {
    icon: Users,
    title: '3. Play with friends',
    color: 'text-cyan-400',
    body: 'Open a multiplayer mode to create a room or join an available room. If the room uses a code, enter the host’s code exactly and wait for the match to begin.',
  },
  {
    icon: Coins,
    title: '4. Earn and use Street Coins',
    color: 'text-emerald-400',
    body: 'Complete supported activities and eligible game rounds to earn Street Coins. Check your balance and the relevant game or reward screen for the current rules. Never assume every activity gives the same reward.',
  },
  {
    icon: Mic2,
    title: '5. Create in Studio',
    color: 'text-purple-400',
    body: 'Open Studio to record an audio or video freestyle. Choose the available sound and effects, review your recording, then use Post when you are happy with it.',
  },
  {
    icon: ShieldCheck,
    title: '6. Play fair and stay safe',
    color: 'text-amber-300',
    body: 'Protect your account and room codes. Rewards are subject to the rules shown in the app. Do not share passwords, payment details, or private information with other players.',
  },
];

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        className="w-full max-w-md max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#FFD700]/30 bg-[#101012] shadow-[0_0_40px_rgba(255,215,0,0.12)] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-[#151517]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFD700]">Street Life Guide</p>
            <h2 id="how-to-play-title" className="text-xl font-black text-white mt-1">How to Play</h2>
            <p className="text-xs text-gray-400 mt-1">Your quick guide to the streets.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Play"
            className="w-10 h-10 shrink-0 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-3 [WebkitOverflowScrolling:touch]">
          {lessons.map(({ icon: Icon, title, color, body }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 flex gap-3">
              <div className={`w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-gray-300 mt-1">{body}</p>
              </div>
            </article>
          ))}
          <p className="text-[10px] leading-relaxed text-gray-500 text-center px-2 pb-2">
            Game controls and reward rules may change as Street Life is updated. Follow the instructions displayed in each game.
          </p>
        </div>

        <footer className="shrink-0 p-3 border-t border-white/10 bg-[#151517]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#FFD700] text-black font-black text-sm py-3 active:scale-[0.98] transition-transform"
          >
            Got it — let’s play
          </button>
        </footer>
      </section>
    </div>
  );
}
