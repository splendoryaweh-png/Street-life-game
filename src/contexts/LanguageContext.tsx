'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import en from '../../locales/en.json';
import pcm from '../../locales/pcm.json';
import fr from '../../locales/fr.json';
import es from '../../locales/es.json';
import ru from '../../locales/ru.json';
import pt from '../../locales/pt.json';
import id from '../../locales/id.json';

export type LanguageCode = 'en' | 'pcm' | 'fr' | 'es' | 'ru' | 'pt' | 'id';

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
  { code: 'id', label: 'Indonesia', flag: '🇮🇩', sublabel: 'Bahasa Indonesia' },
];

const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en,
  pcm,
  fr,
  es,
  ru,
  pt,
  id,
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
export function detectLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';

  try {
    const saved = localStorage.getItem('street_lang');
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

  if (
    tz.includes('Paris') ||
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
    localStorage.setItem('street_lang', auto);
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

  useEffect(() => {
    const detected = detectLanguage();
    if (detected && detected !== 'en') {
      setLanguageState(detected);
    }
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('street_lang', lang);
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
