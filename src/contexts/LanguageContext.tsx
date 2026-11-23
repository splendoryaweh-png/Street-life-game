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

export type LanguageCode = 'en' | 'pcm' | 'fr' | 'es' | 'ru' | 'pt' | 'id' | 'ar' | 'zh' | 'ko' | 'he';

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
};

/**
 * AUTO-DETECT LANGUAGE LOGIC (Per Requirements)
 * - If localStorage.getItem('street_lang') exists, use it
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
  if (typeof window === 'undefined') return 'street_lang';
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number | string } } } } }).Telegram;
    const telegramId = tg?.WebApp?.initDataUnsafe?.user?.id;
    return telegramId ? `street_lang:${telegramId}` : 'street_lang';
  } catch {
    return 'street_lang';
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
    tgLang = tg?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase() || 'en';
  } catch {}

  let auto: LanguageCode = 'en'; // DEFAULT FOR NIGERIA - Africa/Lagos = English

  if (tz === 'Africa/Lagos' || tz.startsWith('Africa/Lagos/')) {
    // Nigeria starts in English even if the device/Telegram UI uses another language.
    auto = 'en';
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
  try {
    localStorage.setItem(playerLanguageKey, auto);
  } catch {}

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
    // Defer state hydration until after the effect body to avoid a synchronous cascading render.
    void Promise.resolve().then(() => {
      const detected = detectLanguage();
      setLanguageState(detected);
      setLanguageReady(true);
    });
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
