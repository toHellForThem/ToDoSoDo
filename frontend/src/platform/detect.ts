/** Признак macOS/iOS-браузера — для отображения клавиши ⌘ в шорткатах. */
export const detectMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
};

/** Tauri добавляет в `window` собственный мост до загрузки приложения. */
export const detectTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
};
