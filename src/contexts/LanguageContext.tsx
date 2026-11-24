'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import en from '../../locales/en.json';
import pcm from '../../locales/pcm.json';
import fr from '../../locales/fr.json';
import es from '../../locales/es.json';
import ru from '../../locales/ru.json';
import pt from '../../locales/pt.json';
import id from '../../locales/id.json';
import ar from '../../locales/ar.json';
import zh from '../../locales/zh.json';
import ko from '../../locales/ko.json';
import he from '../../locales/he.json';
import fil from '../../locales/fil.json';

export type LanguageCode = 'en' | 'pcm' | 'fr' | 'es' | 'ru' | 'pt' | 'id' | 'ar' | 'zh' | 'ko' | 'he' | 'fil';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
  sublabel: string;
  isDefault?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', sublabel: 'Default', isDefault: true },
  { code: 'pcm', label: 'Pidgin', flag: '🇳🇬', sublabel: 'Naija Pidgin' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', sublabel: 'French' },
  { code: 'es', label: 'Español', flag: '🇪🇸', sublabel: 'Spanish' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', sublabel: 'Russian' },
  { code: 'pt', label: 'Português', flag: '🇵🇹', sublabel: 'Portuguese' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩', sublabel: 'Indonesian' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', sublabel: 'Arabic (right-to-left)' },
  { code: 'zh', label: '中文', flag: '🇨🇳', sublabel: 'Chinese' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', sublabel: 'Korean' },
  { code: 'he', label: 'עברית', flag: '🇮🇱', sublabel: 'Hebrew (right-to-left)' },
  { code: 'fil', label: 'Filipino', flag: '🇵🇭', sublabel: 'Filipino / Tagalog' },
];

const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en,
  pcm,
  fr,
  es,
  ru,
  pt,
  id,
  ar,
  zh,
  ko,
  he,
  fil: { ...en, ...fil },
};

/**
 * AUTO-DETECT LANGUAGE LOGIC (Per Requirements)
 * - If a player has explicitly selected a language in Settings, keep that manual preference
 * - Else auto-detect:
 *     const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
 *     const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || "en"
 *     let auto = "en" // DEFAULT FOR NIGERIA - Africa/Lagos = English
 *     if (tz contains Paris/Dakar/Abidjan/Algiers OR tgLang=="fr") auto="fr"
 *     if (tz contains Madrid/Mexico/Buenos_Aires/Bogota OR tgLang=="es") auto="es"
 *     if (tz contains Moscow OR tgLang=="ru") auto="ru"
 *     if (tz contains Jakarta OR tgLang=="id") auto="id"
 *     if (tz contains Lisbon/Sao_Paulo OR tgLang=="pt") auto="pt"
 *     else auto="en"
 * - Pidgin code is "pcm". NEVER auto-select Pidgin. Pidgin only when user manually taps it in Settings.
 * - Save to localStorage street_lang
 */
function getPlayerLanguageStorageKey(): string {
  if (typeof window === 'undefined') return 'street_lang_manual';
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number | string } } } } }).Telegram;
    const telegramId = tg?.WebApp?.initDataUnsafe?.user?.id;
    return telegramId ? `street_lang_manual:${telegramId}` : 'street_lang_manual';
  } catch {
    return 'street_lang_manual';
  }
}

function languageForCountry(countryCode: string): LanguageCode | null {
  const country = countryCode.toUpperCase();
  if (['NG'].includes(country)) return 'en';
  if (['FR','SN','CI','DZ','MA','TN','BE','CH','LU'].includes(country)) return 'fr';
  if (['ES','MX','AR','CO','PE','CL','VE','EC','BO','PY','UY','CR','PA','GT','HN','SV','NI','DO','CU'].includes(country)) return 'es';
  if (['RU','BY','KZ','KG'].includes(country)) return 'ru';
  if (['PT','BR','AO','MZ'].includes(country)) return 'pt';
  if (['ID'].includes(country)) return 'id';
  if (['SA','AE','EG','QA','KW','BH','OM','YE','JO','LB','IQ','SY','PS','LY','SD'].includes(country)) return 'ar';
  if (['CN','TW','HK','MO'].includes(country)) return 'zh';
  if (['KR'].includes(country)) return 'ko';
  if (['IL'].includes(country)) return 'he';
  if (['PH'].includes(country)) return 'fil';
  return null;
}

/**
 * Uses the browser's location permission and reverse geocoding to identify the
 * player's country. Coordinates are sent only to the reverse-geocoding provider
 * after the player grants browser location permission.
 */
async function detectLanguageFromLocation(): Promise<LanguageCode | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) return null;

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (value) => resolve(value),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  });
  if (!position) return null;

  try {
    const { latitude, longitude } = position.coords;
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json() as { countryCode?: string };
    return data.countryCode ? languageForCountry(data.countryCode) : null;
  } catch {
    return null;
  }
}

export function detectLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';

  const playerLanguageKey = getPlayerLanguageStorageKey();
  try {
    const saved = localStorage.getItem(playerLanguageKey);
    if (saved && (saved in TRANSLATIONS)) {
      return saved as LanguageCode;
    }
  } catch {}

  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {}

  let tgLang = 'en';
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } }).Telegram;
    const telegramLanguage = tg?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase();
    const browserLanguage = navigator.languages?.[0] || navigator.language || 'en';
    tgLang = telegramLanguage || browserLanguage.toLowerCase();
  } catch {}

  let auto: LanguageCode = 'en'; // DEFAULT FOR NIGERIA - Africa/Lagos = English

  if (tz === 'Africa/Lagos' || tz.startsWith('Africa/Lagos/')) {
    // Nigeria defaults to English unless the player explicitly selects another language.
    auto = 'en';
  } else if (/Seoul|Pyongyang/.test(tz)) {
    auto = 'ko';
  } else if (tz === 'Europe/Paris' || tz.startsWith('Europe/Paris/')) {
    // France starts in French even if Telegram's interface language is English.
    auto = 'fr';
  } else if (
    tz.includes('Dakar') ||
    tz.includes('Abidjan') ||
    tz.includes('Algiers') ||
    tgLang === 'fr'
  ) {
    auto = 'fr';
  } else if (
    tz.includes('Madrid') ||
    tz.includes('Mexico') ||
    tz.includes('Buenos_Aires') ||
    tz.includes('Bogota') ||
    tgLang === 'es'
  ) {
    auto = 'es';
  } else if (tz.includes('Moscow') || tgLang === 'ru') {
    auto = 'ru';
  } else if (tz.includes('Jakarta') || tgLang === 'id') {
    auto = 'id';
  } else if (tgLang === 'ar' || tgLang.startsWith('ar-') || /Cairo|Riyadh|Dubai|Kuwait|Qatar|Beirut|Amman|Baghdad|Tunis|Casablanca/.test(tz)) {
    auto = 'ar';
  } else if (tgLang === 'zh' || tgLang.startsWith('zh-') || /Shanghai|Chongqing|Hong_Kong|Macau|Taipei/.test(tz)) {
    auto = 'zh';
  } else if (tgLang === 'ko' || /Seoul|Pyongyang/.test(tz)) {
    auto = 'ko';
  } else if (tgLang === 'he' || tgLang.startsWith('he-') || /Jerusalem|Tel_Aviv/.test(tz)) {
    auto = 'he';
  } else if (tgLang === 'fil' || tgLang === 'tl' || /Manila/.test(tz)) {
    auto = 'fil';
  } else if (
    tz.includes('Lisbon') ||
    tz.includes('Sao_Paulo') ||
    tgLang === 'pt'
  ) {
    auto = 'pt';
  } else {
    auto = 'en';
  }

  // NOTE: Pidgin code is "pcm". NEVER auto-select Pidgin.
  // Pidgin only when user manually taps it in Settings.
  // Auto-detected values are deliberately NOT saved as manual preferences.
  // This allows the app to re-detect the player's current locale on the next launch.
  return auto;
}

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  languages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Apply a fast locale/time-zone fallback first, then refine it using the
    // player's country if they grant the browser location permission.
    void Promise.resolve().then(async () => {
      const detected = detectLanguage();
      if (!active) return;
      setLanguageState(detected);
      setLanguageReady(true);

      const locatedLanguage = await detectLanguageFromLocation();
      if (!active || !locatedLanguage) return;

      // A manual choice always wins, including a choice made while location
      // detection is still running.
      const manualKey = getPlayerLanguageStorageKey();
      try {
        if (localStorage.getItem(manualKey)) return;
      } catch {}
      setLanguageState(locatedLanguage);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Re-check the device/Telegram locale when a player returns to the Mini App.
    const refreshDetectedLanguage = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setLanguageState(detectLanguage());
      }
    };
    window.addEventListener('focus', refreshDetectedLanguage);
    document.addEventListener('visibilitychange', refreshDetectedLanguage);
    return () => {
      window.removeEventListener('focus', refreshDetectedLanguage);
      document.removeEventListener('visibilitychange', refreshDetectedLanguage);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' || language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(getPlayerLanguageStorageKey(), lang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
      if (activeDict && activeDict[key]) {
        return activeDict[key];
      }
      const enDict = TRANSLATIONS.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return fallback || key;
    },
    [language]
  );

  if (!languageReady) {
    return <div className="min-h-screen w-full bg-[#0A0A0A]" aria-busy="true" />;
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
