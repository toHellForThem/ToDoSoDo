import { describe, expect, it } from 'vitest';
/**
 * Нормализация клавиатурных комбинаций и поиск конфликтов шорткатов.
 */

import {
  eventToCombination,
  findShortcutConflict,
  formatShortcut,
  isEditableTarget,
  keyFromEvent,
  normalizeCombination,
} from '../keys';

interface EventOverrides {
  code?: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const makeEvent = (overrides: EventOverrides): KeyboardEvent =>
  ({
    code: '',
    key: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  }) as KeyboardEvent;

describe('normalizeCombination', () => {
  it('приводит модификаторы к порядку mod+alt+shift+key', () => {
    expect(normalizeCombination('Shift+Ctrl+K')).toBe('mod+shift+k');
    expect(normalizeCombination('alt+cmd+ArrowUp')).toBe('mod+alt+arrowup');
    expect(normalizeCombination('Ctrl + Meta + a')).toBe('mod+a');
    expect(normalizeCombination('option+shift+space')).toBe('alt+shift+space');
  });

  it('убирает лишние пробелы и приводит регистр', () => {
    expect(normalizeCombination('  MOD + 1 ')).toBe('mod+1');
  });
});

describe('keyFromEvent / eventToCombination', () => {
  it('распознаёт физические коды клавиш', () => {
    expect(keyFromEvent(makeEvent({ code: 'KeyK' }))).toBe('k');
    expect(keyFromEvent(makeEvent({ code: 'Digit7' }))).toBe('7');
    expect(keyFromEvent(makeEvent({ code: 'Numpad3' }))).toBe('3');
    expect(keyFromEvent(makeEvent({ code: 'ArrowLeft' }))).toBe('arrowleft');
  });

  it('возвращает null для нажатых только модификаторов', () => {
    expect(keyFromEvent(makeEvent({ key: 'Shift' }))).toBeNull();
    expect(keyFromEvent(makeEvent({ code: '', key: '' }))).toBeNull();
  });

  it('собирает комбинацию из события', () => {
    expect(
      eventToCombination(
        makeEvent({ code: 'KeyK', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe('mod+shift+k');
    expect(eventToCombination(makeEvent({ key: ' ' }))).toBe('space');
  });
});

describe('formatShortcut', () => {
  it('использует символы для Mac и слова для остальных', () => {
    expect(formatShortcut('mod+1', true)).toBe('⌘ + 1');
    expect(formatShortcut('mod+shift+K', false)).toBe('Ctrl + Shift + K');
    expect(formatShortcut(undefined)).toBe('');
  });
});

describe('isEditableTarget', () => {
  it('определяет поля ввода и contenteditable', () => {
    expect(
      isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableTarget({ tagName: 'textarea' } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableTarget({
        tagName: 'DIV',
        isContentEditable: true,
      } as unknown as EventTarget),
    ).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(
      false,
    );
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('findShortcutConflict', () => {
  const shortcuts = {
    todo_tab: 'mod+2',
    daily_tab: 'mod+3',
    empty: '',
  };

  it('находит конфликтующую настройку', () => {
    expect(findShortcutConflict(shortcuts, 'Ctrl+3')).toBe('daily_tab');
  });

  it('игнорирует исключённый ключ, пустые значения и точные совпадения', () => {
    expect(findShortcutConflict(shortcuts, 'mod+3', 'daily_tab')).toBeNull();
    expect(findShortcutConflict(shortcuts, 'mod+9')).toBeNull();
    expect(
      findShortcutConflict({ empty: '', x: 42 } as object, 'mod+1'),
    ).toBeNull();
  });
});
