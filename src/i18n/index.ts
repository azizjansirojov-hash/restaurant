import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setMoneyLocale } from '../utils/money';
import { setFormatLocale } from '../utils/format';

import ru from './locales/ru.json';
import uz from './locales/uz.json';

export const LOCALE_STORAGE_KEY = '@lale/locale';
export type AppLocale = 'uz' | 'ru';

export function resolveDeviceLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode ?? 'uz';
  if (code === 'ru') return 'ru';
  if (code === 'uz') return 'uz';
  return 'uz';
}

const resources = {
  uz: { translation: uz },
  ru: { translation: ru },
};

let initPromise: Promise<void> | null = null;

export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    const lng: AppLocale =
      stored === 'uz' || stored === 'ru' ? stored : resolveDeviceLocale();

    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'uz',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
    setMoneyLocale(lng);
    setFormatLocale(lng);
    i18n.on('languageChanged', (code) => {
      if (code === 'ru' || code === 'uz') {
        setMoneyLocale(code);
        setFormatLocale(code);
      }
    });
  })();
  return initPromise;
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  setMoneyLocale(locale);
  setFormatLocale(locale);
  await i18n.changeLanguage(locale);
}

export default i18n;
