import { NativeModules } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { isAndroid, isIOS, isWeb } from './platform';

const nativeStorage = isWeb ? null : createMMKV();

/** Ключ-значение хранилище: localStorage в web, MMKV на native. */
export const platformStorage = {
  set: (key: string, value: string): void => {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    nativeStorage!.set(key, value);
  },
  get: (key: string): string | null => {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return nativeStorage ? (nativeStorage.getString(key) ?? null) : null;
  },
  remove: (key: string): void => {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    nativeStorage!.remove(key);
  },
};

/** Локаль ОС без нормализации: `ru-RU`, `en_US`, `en-US`. */
export const getSystemLocale = (): string => {
  if (isIOS) {
    const settings = NativeModules.SettingsManager?.settings;
    return settings?.AppleLocale || settings?.AppleLanguages?.[0] || '';
  }
  if (isAndroid) {
    return NativeModules.I18nManager?.localeIdentifier || '';
  }
  if (isWeb && typeof navigator !== 'undefined') {
    return navigator.language || '';
  }
  return '';
};
