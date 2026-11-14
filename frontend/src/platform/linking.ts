import { Linking } from 'react-native';
import { getIsTauri, isWeb } from './platform';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Пропускает только безопасные схемы: защищает web-сборку от `javascript:`
 * и `data:` в `window.open`/`location.assign`.
 */
const assertSafeExternalUrl = (url: string): void => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Invalid external URL: ${url}`);
  }
  if (!SAFE_PROTOCOLS.has(protocol)) {
    throw new Error(`Blocked external URL with unsafe protocol: ${url}`);
  }
};

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

  assertSafeExternalUrl(url);

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

  // Popup заблокирован в web-сборке: уводим текущую вкладку.
  window.location.assign(url);
};
