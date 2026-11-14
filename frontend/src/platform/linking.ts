import { Linking } from 'react-native';
import { getIsTauri, isWeb } from './platform';

/**
 * Открывает внешнюю ссылку: на native — системный браузер, в web — новая
 * вкладка/окно, в Tauri — системный браузер через `tauri-plugin-opener`.
 * Ошибка пробрасывается, чтобы UI показал тост.
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!isWeb) {
    await Linking.openURL(url);
    return;
  }
  if (typeof window === 'undefined') return;

  if (getIsTauri()) {
    // В webview Tauri `window.open` блокируется, а `location.assign` увёл бы
    // приложение с локальной статики. Открываем системным браузером.
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  const opened = window.open(url, '_blank');
  if (opened) {
    opened.opener = null;
    return;
  }

  // Popup заблокирован: уводим текущую вкладку.
  window.location.assign(url);
};
