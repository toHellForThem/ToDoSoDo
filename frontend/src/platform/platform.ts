import { Platform, UIManager } from 'react-native';
import { detectTauri } from './detect';

/** Текущая сборка запущена в браузере (включая webview Tauri). */
export const isWeb = Platform.OS === 'web';
export const isNative = !isWeb;
export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

/** Tauri использует web-сборку, но с нативным мостом внутри webview. */
export const isTauri = isWeb && detectTauri();

interface PlatformValues<T> {
  web?: T;
  ios?: T;
  android?: T;
  native?: T;
  default: T;
}

/**
 * Выбирает значение по текущей платформе. Держит ветвления `web`/`ios`/
 * `android` в одном слое вместо `Platform.OS` по всему приложению.
 */
export const selectPlatform = <T>(values: PlatformValues<T>): T => {
  if (isWeb && values.web !== undefined) return values.web;
  if (isIOS && values.ios !== undefined) return values.ios;
  if (isAndroid && values.android !== undefined) return values.android;
  if (isNative && values.native !== undefined) return values.native;
  return values.default;
};

/** Включает экспериментальные layout-анимации на старом Android. */
export const setupPlatform = (): void => {
  if (isAndroid && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
};
