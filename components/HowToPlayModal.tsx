'use client';

import React from 'react';
import { X, Home, Gamepad2, Users, Coins, Mic2, ShieldCheck, ClipboardList, Wallet, ShoppingBag, UserCircle, Eye, Car, RotateCcw, Camera, CheckCircle2, HelpCircle } from 'lucide-react';

type HowToPlayModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const chapters = [
  {
    id: 'start',
    icon: Home,
    title: '1. Start here: understand the Home screen',
    color: 'text-[#FFD700]',
    intro: 'The Home screen is your main dashboard. Scroll up and down to see the full page; do not assume the first screen contains everything.',
    steps: [
      'Your Street Coins balance is shown near the top. Tap the balance or its transaction shortcut to inspect your coin activity.',
      'Use the Quick Hustle Hub and the bottom navigation to open the different parts of Street Life.',
      'HOME returns to the dashboard. GAMES opens the game library. STUDIO opens freestyle tools. SHOP opens your items and upgrades. TOUGH WAR opens the war area. PROFILE contains your player details and settings.',
      'Other Home shortcuts can open TASKS, WATCH & EARN, BANK, your inventory, and other available modules. Read each screen title so you know where you are.',
      'If a screen looks cut off, scroll inside the page. On supported screens, the eye button can hide or show the top and bottom navigation bars.'
    ]
  },
  {
    id: 'games',
    icon: Gamepad2,
    title: '2. Find a game and understand game modes',
    color: 'text-red-400',
    intro: 'Open GAMES from the bottom navigation. The game library is divided into 3D Action and Mini-Games. Tap a category to see its games, then open a game card to enter it.',
    steps: [
      'Street Gang Star: enter the game hub, then choose Single Player or Multiplayer. In multiplayer, you can create an invite-code room, join a room with a code, or use Random City Match when available.',
      'Street Race: choose the race, read the on-screen instructions, then use the driving controls shown in the game. Avoid traffic and obstacles and collect road coins where available.',
      'Street Rider Delivery: follow the delivery objective and the in-game timer. Use the on-screen bike controls and reach the destination.',
      'Street Dice: choose Single Player or Multiplayer. The multiplayer lobby lets a host create a room and share its code, while other players enter that code to join.',
      'Other available mini-games include Turf War, Street Crush, Street Slot and Street Flip. Open each game and follow its own on-screen rules; controls and objectives are not identical.',
      'Some cards may say Coming Soon. Those games cannot be played until they are enabled in a future update.',
      'Use the Back button inside a game to leave the game and return to the game list. Avoid closing Telegram while a match is in progress.'
    ]
  },
  {
    id: 'multiplayer',
    icon: Users,
    title: '3. Multiplayer: create a room and invite friends',
    color: 'text-cyan-400',
    intro: 'The exact lobby differs by game. Follow the room controls shown inside the game you selected.',
    steps: [
      'Open GAMES, choose a multiplayer-capable game, and tap Multiplayer. In Street Gang Star, first open its game hub and then choose Multiplayer.',
      'To host a private room, tap Create Room. Wait for the room to be created. The room code will appear in the lobby or game header.',
      'Use the copy-code button if one is shown. Send the full code to your friend through Telegram. Make sure you send the code for the correct game.',
      'Your friend must open the same game, choose Multiplayer, type or paste the code into the Join field, and tap JOIN. Room codes must be entered correctly; remove accidental spaces.',
      'For Street Dice, players enter the code and join the lobby. The host can see the players and, where offered, add an AI player. Players use Ready if that button is shown; the host starts the match when everyone is ready.',
      'For Street Gang Star, a host can create an invite-code room. Friends enter that exact code and join the district. The game also offers Random City Match; this is different from joining a private invite-code room.',
      'Wait until the game confirms that you joined or the lobby shows the other player. Do not assume your friend has joined just because you sent the code.',
      'If the room is full, expired, missing, or belongs to another game, create a fresh room and share its new code.'
    ]
  },
  {
    id: 'rejoin',
    icon: RotateCcw,
    title: '4. If you disconnect, fail to join, or need to rejoin a room',
    color: 'text-amber-300',
    intro: 'A room code is not a guarantee that a room will remain available forever. Rejoining also depends on the particular game and whether its room is still active.',
    steps: [
      'First check your internet connection. Return to the same game and open its Multiplayer screen again.',
      'If the game shows a Rejoin or Continue option, use it. Street Dice saves room-rejoin information on the device and may restore the previous room automatically when you reopen its multiplayer screen.',
      'If no room is restored, ask the host whether the original room is still open. Ask them to send the current code again, then enter it in the Join field.',
      'If the code is rejected, check capital letters and numbers, confirm you selected the same game, and ask whether the room is full or has ended.',
      'If the host left, the room closed, or the match cannot be recovered, create a new room and invite everyone again. You may need to start a new match.',
      'If the screen freezes, wait briefly, then use the in-game Back button and reopen the mode. If it keeps happening, close and reopen the Telegram Mini App and try again.',
      'Do not repeatedly tap Create Room while the first request is still processing. Give the game a moment to respond.'
    ]
  },
  {
    id: 'controls',
    icon: Car,
    title: '5. Controls, objectives, and finishing a match',
    color: 'text-orange-400',
    intro: 'Controls depend on the game and the device. Read the control hints inside the game before you begin.',
    steps: [
      'On phones, use the virtual joystick, direction buttons, or action buttons displayed on the screen. Keep your finger on the intended control and release it when you want to stop.',
      'In Street Gang Star, the on-screen joystick moves your character. Use the displayed shoot, jump, reload, cover, run, car and team controls when available. The keyboard shortcuts are for compatible keyboards, not required on a phone.',
      'In racing and riding games, use the driving controls shown on screen to steer, accelerate or brake. Follow the mission objective and timer displayed in that game.',
      'In Street Dice, take turns rolling and select a token when the game allows a move. Follow the turn and move prompts; an invalid token cannot be moved.',
      'In other mini-games, read the rules displayed before playing. Do not assume that a control from one game works in another.',
      'When the round ends, read the result or reward message before leaving. If a reward does not appear, check your balance and transaction history before trying the same action again.'
    ]
  },
  {
    id: 'coins',
    icon: Coins,
    title: '6. Street Coins, rewards, and daily activities',
    color: 'text-emerald-400',
    intro: 'Street Coins are the in-app game currency. The amount and eligibility for a reward depend on the activity and the rules currently displayed in that feature.',
    steps: [
      'Check your Street Coins balance on Home. Use the transaction history shortcut to review recorded activity.',
      'Open WATCH & EARN from the Home shortcuts. Tap the watch button and allow the sponsored video to finish. A skipped, failed, or unavailable ad does not qualify for its reward.',
      'Daily rewards and task rewards have their own requirements. Read the requirement and status before tapping Claim.',
      'Some activities have daily limits, cooldowns, or eligibility conditions. If a limit message appears, follow the reset information shown in that screen.',
      'Do not assume that every game, video, task, or Studio post pays coins. Only rely on a reward that the app confirms.'
    ]
  },
  {
    id: 'tasks',
    icon: ClipboardList,
    title: '7. TASKS: complete an activity and submit it for review',
    color: 'text-sky-300',
    intro: 'Some tasks require you to do something outside the game and then ask the Street Life team to verify it. Completing the activity and submitting proof are separate steps.',
    steps: [
      'Open TASKS from the Home screen or Quick Hustle Hub. Find the task you want to complete and read its full instructions, reward, limits, and proof requirements.',
      'Tap the task action button and complete the requested activity. For example, join the official channel or group, follow the specified social account, invite a friend, reach a game milestone, or post the requested promotion.',
      'Return to the same task in Street Life. If the task asks for proof, prepare the exact evidence requested. Take a clear screenshot that shows the completed action; for a video promotion, use the required public video link and a screenshot showing its views and likes if requested.',
      'For tasks that use a preparation step, tap the task button to mark that you are ready to submit. The button may then change to Submit for review.',
      'Tap Submit for review once, and wait for the app to confirm that the submission was sent. Keep the app open while it processes. Do not keep tapping the button.',
      'For the Status promotion task, upload the screenshot of the status post first, then submit the proof. The task has a daily posting limit shown on its card.',
      'For the video promotion task, post on one of the platforms accepted by the task instructions (TikTok, YouTube or Facebook). Instagram is not accepted for that task. Submit the video link and the requested screenshot evidence.',
      'After submission, check the task status. Pending Review means the team has not decided yet. Approved or Verified means it was accepted. Rejected means read the feedback and submit corrected proof if the task allows it.',
      'Do not claim the same task repeatedly while it is pending. Some rewards are credited only after server verification and admin approval.'
    ]
  },
  {
    id: 'studio',
    icon: Mic2,
    title: '8. STUDIO: record an audio freestyle',
    color: 'text-purple-400',
    intro: 'Studio lets you choose a beat, record vocals, listen to the result, and post a mix. Some Studio features require an active Studio rental or an unlocked level.',
    steps: [
      'Open STUDIO from the bottom navigation. Check the Studio access or rent notice if recording or beat testing is locked.',
      'Browse the beat list. Tap a beat to select it, then use Preview or Play to listen before recording. Some beats unlock at higher Studio levels.',
      'Use the Beat Volume and Voice Volume sliders to balance the instrumental and your voice independently.',
      'Allow microphone access when your phone asks. If you deny permission, recording may not work; open your phone or browser settings and allow microphone access for Telegram.',
      'Tap Record and perform your freestyle. Follow the timer and minimum/maximum duration shown on the recording panel. Tap Stop when finished.',
      'Tap Preview Mix and listen carefully. If you are not happy with it, record again if you still have a daily recording available.',
      'When you are satisfied, tap Post Mix or Post. Wait for the success or error message. A successful post is sent through the app’s configured Telegram posting flow.',
      'Studio recording limits are shared by the supported audio/video recording tools and can depend on your Studio level. The counter on screen shows your available recordings.'
    ]
  },
  {
    id: 'video',
    icon: Camera,
    title: '9. STUDIO: record a video freestyle',
    color: 'text-pink-300',
    intro: 'Video Freestyle uses your phone camera. Camera and microphone permission must be enabled for Telegram.',
    steps: [
      'Open STUDIO and enter the Video Freestyle or camera recording area. Tap Enable Camera when prompted.',
      'If iPhone or Telegram asks for camera or microphone access, choose Allow. If you previously blocked access, change the permission in iPhone Settings for the browser or Telegram app you use.',
      'Use Flip to switch between the front and rear camera when your device supports it. Camera switching may be unavailable while recording.',
      'Choose a filter such as Normal, Warm, B&W, Cool or Vintage. Scroll the camera screen vertically if you cannot see all the controls; the action buttons are above the filter row.',
      'Tap Record to start and Stop to finish. Use Preview to watch the recording before posting.',
      'Tap Post only when you are happy with the result. Wait for the app’s confirmation. If upload fails, check your connection and try again when the recording is still available.',
      'Tap Close to leave the camera view. Do not close the camera while a recording is still in progress.'
    ]
  },
  {
    id: 'shop',
    icon: ShoppingBag,
    title: '10. SHOP, inventory, upgrades, and your items',
    color: 'text-yellow-300',
    intro: 'Open SHOP from the bottom navigation to browse available items and upgrades. The screen may show categories such as clothes, houses, vehicles, phones, food, Studio upgrades and filters.',
    steps: [
      'Tap a category and select an item to see its details and price. Check the Street Coin cost before buying.',
      'Tap Buy or the purchase action and wait for the confirmation. Do not tap repeatedly if the balance is still updating.',
      'Owned items can be equipped from the item card or inventory action. An owned item is not necessarily equipped until you choose Equip.',
      'Some items are consumables, rentals, permanent purchases, or upgrades. Read the item description and expiry details before confirming.',
      'If you cannot afford an item, earn more Street Coins through eligible activities or choose an item within your balance.'
    ]
  },
  {
    id: 'bank',
    icon: Wallet,
    title: '11. BANK, wallet, conversions, and withdrawal information',
    color: 'text-emerald-300',
    intro: 'The Bank screen contains balance, converter, withdrawal, history and other available sections. Availability and requirements can change.',
    steps: [
      'Open BANK from the Home shortcuts. Use the tabs to view your balance, converter, withdrawal section and history.',
      'Before converting coins, check the selected currency, rate and amount shown in the confirmation area.',
      'Before making a withdrawal request, read the minimum amount, supported method, network, wallet/address instructions, availability date and status shown in the app.',
      'Enter only an address that belongs to you and matches the selected network or method. A wrong address or network can cause loss of funds.',
      'A submitted request is not the same as a completed payment. Check the withdrawal history and the status shown there. Never treat an estimate or a pending request as money already received.'
    ]
  },
  {
    id: 'profile',
    icon: UserCircle,
    title: '12. PROFILE, invite links, language, and support',
    color: 'text-indigo-300',
    intro: 'Your Profile screen shows your Telegram identity and player information, plus settings and help options.',
    steps: [
      'Open PROFILE from the bottom navigation. Check that the displayed Telegram name and account information are yours.',
      'Use the invite code or referral link controls to copy your personal invitation. Share the link with a friend; they should open it and complete the joining steps.',
      'Use Settings to change the available app preferences, including language where offered.',
      'Use the Support option when you need help. When reporting a problem, explain which screen and button you used, what you expected, and what happened.',
      'Keep your Telegram account secure. Do not share login codes, passwords, private wallet keys or sensitive account information.'
    ]
  },
  {
    id: 'troubleshoot',
    icon: HelpCircle,
    title: '13. Common problems and what to do',
    color: 'text-amber-200',
    intro: 'Try these steps before repeating a purchase, submission, or room action.',
    steps: [
      'A button does not respond: wait a few seconds, check your connection, scroll to make sure the button is fully visible, and try once more.',
      'A game does not load: return to GAMES, reopen it, and if needed close and reopen the Telegram Mini App.',
      'A friend cannot join: confirm both players opened the same multiplayer game, check the code character by character, and ask the host whether the room is still active.',
      'A room was lost: use Rejoin if the game offers it. Otherwise ask the host for the current code or create a new room.',
      'Camera or microphone is not working: check Telegram/iPhone permissions, close other apps using the camera, then reopen Studio.',
      'A task submission is pending: wait for review and check its status later. Do not submit duplicates while the first request is pending.',
      'A reward or purchase is unclear: check the balance and transaction history, then contact Support with the screen name and approximate time. Never share a password or secret key.'
    ]
  },
  {
    id: 'fairplay',
    icon: ShieldCheck,
    title: '14. Play fairly and keep your account safe',
    color: 'text-emerald-200',
    intro: 'Help keep Street Life enjoyable and protect your progress.',
    steps: [
      'Do not cheat, exploit bugs, impersonate another player, or harass people in rooms or chats.',
      'Only share room codes with people you want to invite. Do not post private information in public chats.',
      'Use only official in-app instructions for rewards, tasks and payments. No one should ask you for your Telegram login code or wallet recovery phrase.',
      'If something looks wrong, stop and contact Support rather than trying to exploit it.'
    ]
  }
];


const visualSteps: Record<string, [string, string, string, string]> = {
  start: ['HOME screen', 'Quick Hustle Hub', 'Choose a section', 'Scroll for more'],
  games: ['Tap GAMES', 'Pick a category', 'Open a game', 'Choose a mode'],
  multiplayer: ['Open Multiplayer', 'Create a room', 'Share room code', 'Friend taps JOIN'],
  rejoin: ['Reopen the game', 'Open Multiplayer', 'Try Rejoin', 'Enter fresh code'],
  controls: ['Read controls', 'Move / steer', 'Use action keys', 'Finish the round'],
  coins: ['Open WATCH & EARN', 'Finish the video', 'Check task rules', 'Confirm reward'],
  tasks: ['Open TASKS', 'Do the activity', 'Add required proof', 'Submit for review'],
  studio: ['Open STUDIO', 'Choose a beat', 'Record & preview', 'Post your mix'],
  video: ['Open Video Freestyle', 'Allow camera + mic', 'Record & preview', 'Post the video'],
  shop: ['Open SHOP', 'Choose category', 'Check item cost', 'Buy / equip'],
  bank: ['Open BANK', 'Choose a tab', 'Read requirements', 'Check request status'],
  profile: ['Open PROFILE', 'Check your details', 'Copy invite link', 'Open Settings / Help'],
  troubleshoot: ['Notice the issue', 'Check connection', 'Reopen the screen', 'Contact Support'],
  fairplay: ['Protect your login', 'Share room codes safely', 'Follow game rules', 'Report problems']
};

function GuideIllustration({ id }: { id: string }) {
  const steps = visualSteps[id] || visualSteps.start;
  return (
    <div className="my-3 rounded-xl border border-[#FFD700]/20 bg-[#09090b] p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#FFD700]">Picture guide · follow the steps</span>
        <span className="text-[9px] text-gray-500">1 → 4</span>
      </div>
      <svg viewBox="0 0 320 100" role="img" aria-label={steps.join(', then ')} className="block w-full h-auto">
        {steps.map((step, index) => {
          const x = 3 + index * 80;
          const words = step.split(' ');
          const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [step];
          return (
            <g key={index}>
              {index < 3 && <path d={`M ${x + 69} 48 L ${x + 78} 48`} stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round" />}
              <rect x={x} y="10" width="69" height="76" rx="9" fill="#171719" stroke={index === 0 ? "#FFD700" : "#414147"} strokeWidth="1.2" />
              <circle cx={x + 12} cy="23" r="8" fill="#FFD700" />
              <text x={x + 12} y="26" textAnchor="middle" fontSize="8" fontWeight="900" fill="#111">{index + 1}</text>
              <path d={`M ${x + 12} 39 h45`} stroke="#55555d" strokeWidth="2" strokeLinecap="round" />
              <path d={`M ${x + 12} 45 h30`} stroke="#3d3d45" strokeWidth="2" strokeLinecap="round" />
              {lines.map((line, lineIndex) => <text key={lineIndex} x={x + 34.5} y={lines.length === 1 ? 66 : 61 + lineIndex * 10} textAnchor="middle" fontSize="7.2" fontWeight="700" fill="#f5f5f5">{line}</text>)}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[9px] leading-relaxed text-gray-500">Illustration of the action sequence, not a screenshot. The real button layout is shown inside the game screen.</p>
    </div>
  );
}

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
        className="w-full max-w-md max-h-[94dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#FFD700]/30 bg-[#101012] shadow-[0_0_40px_rgba(255,215,0,0.12)] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-[#151517]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFD700]">Street Life Player Handbook</p>
            <h2 id="how-to-play-title" className="text-xl font-black text-white mt-1">Complete How to Play Guide</h2>
            <p className="text-xs text-gray-400 mt-1">Step-by-step help for the whole app.</p>
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

        <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#101012]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Jump to a topic</p>
          <div className="flex gap-2 overflow-x-auto pb-1 touch-pan-x">
            {chapters.map((chapter) => (
              <a key={chapter.id} href={'#guide-' + chapter.id} className="shrink-0 rounded-full border border-white/15 bg-white/[0.05] px-3 py-2 text-[10px] font-bold text-gray-200">
                {chapter.title.split('. ')[1]}
              </a>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-3 [WebkitOverflowScrolling:touch]">
          {chapters.map(({ id, icon: Icon, title, color, intro, steps }) => (
            <article id={'guide-' + id} key={id} className="scroll-mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex items-center gap-3 mb-2">
                <div className={'w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] flex items-center justify-center ' + color}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-white">{title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-gray-300 mb-2">{intro}</p>
              <GuideIllustration id={id} />
              <ol className="space-y-2 list-decimal pl-4 marker:text-[#FFD700]">
                {steps.map((step, index) => (
                  <li key={index} className="text-xs leading-relaxed text-gray-300 pl-1">{step}</li>
                ))}
              </ol>
            </article>
          ))}
          <div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/[0.06] p-3.5">
            <div className="flex items-center gap-2 text-[#FFD700] mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <p className="text-xs font-black">Video tutorials coming later</p>
            </div>
            <p className="text-xs leading-relaxed text-gray-300">This guide is ready for video links. When you provide your tutorial links, they can be added to the matching chapters so players can read the steps and watch the demonstration.</p>
          </div>
          <p className="text-[10px] leading-relaxed text-gray-500 text-center px-2 pb-2">
            Street Life features and requirements can change with updates. Follow the latest instructions and messages displayed in each screen.
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
