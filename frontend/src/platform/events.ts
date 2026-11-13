import { isWeb } from './platform';

/**
 * Широковещательное DOM-событие для web/Tauri. На native — no-op: там
 * подписчики работают через прямые listener-API.
 */
export const dispatchWebEvent = <T>(name: string, detail: T): void => {
  if (!isWeb || typeof window === 'undefined') return;
  if (
    typeof window.dispatchEvent !== 'function' ||
    typeof CustomEvent === 'undefined'
  ) {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
};
