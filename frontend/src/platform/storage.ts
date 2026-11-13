import { NativeModules } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { isAndroid, isIOS, isWeb } from './platform';

type NativeStorage = ReturnType<typeof createMMKV>;

let nativeStorage: NativeStorage | null = null;

/** MMKV создаётся при первом обращении, а не при импорте модуля. */
const getNativeStorage = (): NativeStorage => {
  if (!nativeStorage) {
    nativeStorage = createMMKV();
  }
  return nativeStorage;
};

/** Ключ-значение хранилище: localStorage в web, MMKV на native. */
export const platformStorage = {
  set: (key: string, value: string): void => {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    getNativeStorage().set(key, value);
  },
  get: (key: string): string | null => {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return getNativeStorage().getString(key) ?? null;
  },
  remove: (key: string): void => {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    getNativeStorage().remove(key);
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
