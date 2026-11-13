import { isWeb } from './platform';

const STYLE_ELEMENT_ID = 'todosodo-web-global-styles';

/** Web-only CSS: отключаем выделение и скроллбары, оставляя их в полях. */
export const WEB_GLOBAL_STYLES = `
  body, html, * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    outline: none !important;
  }
  *::-webkit-scrollbar {
    display: none !important;
  }
  * {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  input, textarea, [contenteditable="true"] {
    user-select: text !important;
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
  }
`;

/** Инжектит web-стили один раз; на native ничего не делает. */
export const injectWebGlobalStyles = (): void => {
  if (!isWeb || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = WEB_GLOBAL_STYLES;
  document.head.appendChild(style);
};
