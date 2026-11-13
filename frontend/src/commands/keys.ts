import { detectMacPlatform } from '../platform/detect';

const MODIFIER_KEYS = new Set([
  'control',
  'ctrl',
  'meta',
  'cmd',
  'command',
  'alt',
  'option',
  'shift',
  'os',
]);

const CODE_ALIASES: Record<string, string> = {
  Space: 'space',
  Escape: 'escape',
  Enter: 'enter',
  NumpadEnter: 'enter',
  Backspace: 'backspace',
  Delete: 'delete',
  Tab: 'tab',
  ArrowUp: 'arrowup',
  ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft',
  ArrowRight: 'arrowright',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
};

export const isMacPlatform = detectMacPlatform;

/** Клавиша из события без модификаторов. `null` — нажаты только модификаторы. */
export const keyFromEvent = (event: KeyboardEvent): string | null => {
  const code = event.code;
  if (code) {
    if (code.startsWith('Key')) return code.slice(3).toLowerCase();
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad') && /^Numpad\d$/.test(code))
      return code.slice(6);
    if (CODE_ALIASES[code]) return CODE_ALIASES[code];
  }

  const key = (event.key || '').toLowerCase();
  if (!key || MODIFIER_KEYS.has(key)) return null;
  if (key === ' ') return 'space';
  return key;
};

/** Нормализует комбинацию: порядок `mod+alt+shift+key`, нижний регистр. */
export const normalizeCombination = (combination: string): string => {
  const parts = combination
    .toLowerCase()
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);

  const key = parts.pop() || '';
  const modifiers = new Set(parts);
  const ordered: string[] = [];

  if (
    modifiers.has('mod') ||
    modifiers.has('ctrl') ||
    modifiers.has('meta') ||
    modifiers.has('cmd') ||
    modifiers.has('command')
  ) {
    ordered.push('mod');
  }
  if (modifiers.has('alt') || modifiers.has('option')) ordered.push('alt');
  if (modifiers.has('shift')) ordered.push('shift');
  ordered.push(key === ' ' ? 'space' : key);

  return ordered.join('+');
};

/** Комбинация из события клавиатуры. `null` — событие без полезной клавиши. */
export const eventToCombination = (event: KeyboardEvent): string | null => {
  const key = keyFromEvent(event);
  if (!key) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key);

  return parts.join('+');
};

export const formatKeyPart = (
  part: string,
  isMac = isMacPlatform(),
): string => {
  switch (part) {
    case 'mod':
      return isMac ? '⌘' : 'Ctrl';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return isMac ? '⇧' : 'Shift';
    case 'space':
      return 'Space';
    case 'escape':
      return 'Esc';
    case 'arrowup':
      return '↑';
    case 'arrowdown':
      return '↓';
    case 'arrowleft':
      return '←';
    case 'arrowright':
      return '→';
    default:
      return part.toUpperCase();
  }
};

export const formatShortcut = (
  combination: string | undefined,
  isMac = isMacPlatform(),
): string => {
  if (!combination) return '';
  return normalizeCombination(combination)
    .split('+')
    .map(part => formatKeyPart(part, isMac))
    .join(' + ');
};

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  const tagName = element.tagName ? element.tagName.toUpperCase() : '';
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'PAPER-INPUT' ||
    element.isContentEditable === true
  );
};

/**
 * Ищет конфликт комбинации с уже сохранёнными шорткатами.
 * Возвращает ключ настройки, с которым конфликтует, либо `null`.
 */
export const findShortcutConflict = (
  shortcuts: object,
  combination: string,
  excludeKey?: string,
): string | null => {
  const normalized = normalizeCombination(combination);
  for (const [key, value] of Object.entries(shortcuts)) {
    if (key === excludeKey || typeof value !== 'string' || !value) continue;
    if (normalizeCombination(value) === normalized) return key;
  }
  return null;
};
