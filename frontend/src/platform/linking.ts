import { Linking } from 'react-native';
import { isTauri, isWeb } from './platform';

/**
 * Открывает внешнюю ссылку: на native — системный браузер, в web/Tauri —
 * новая вкладка/окно. Ошибка пробрасывается, чтобы UI показал тост.
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!isWeb) {
    await Linking.openURL(url);
    return;
  }
  if (typeof window === 'undefined') return;

  const opened = window.open(url, '_blank');
  if (opened) {
    opened.opener = null;
    return;
  }

  // Popup заблокирован: в браузере уводим текущую вкладку, но в Tauri это
  // сломало бы приложение — отдаём ошибку наверх.
  if (isTauri) {
    throw new Error(`Unable to open external URL: ${url}`);
  }
  window.location.assign(url);
};
