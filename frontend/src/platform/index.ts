export {
  isWeb,
  isNative,
  isAndroid,
  isIOS,
  getIsTauri,
  selectPlatform,
  setupPlatform,
} from './platform';
export { detectMacPlatform, detectTauri } from './detect';
export { platformStorage, getSystemLocale } from './storage';
export { openExternalUrl } from './linking';
export { dispatchWebEvent } from './events';
export { injectWebGlobalStyles, WEB_GLOBAL_STYLES } from './webStyles';
export { useKeyboardInsets, type KeyboardInsets } from './useKeyboardInsets';
