import { describe, expect, it, vi } from 'vitest';
/**
 * Реестр команд: приоритет scope, условия и фокус активного инпута.
 */

import { CommandRegistry } from '../registry';
import type { Command } from '../types';

const makeCommand = (overrides: Partial<Command> = {}): Command => ({
  id: 'cmd',
  title: 'Command',
  shortcut: 'mod+k',
  scope: 'global',
  run: vi.fn(),
  ...overrides,
});

const makeEvent = (overrides: Record<string, unknown> = {}): KeyboardEvent =>
  ({
    code: 'KeyK',
    key: 'k',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as KeyboardEvent;

describe('CommandRegistry: регистрация и scope', () => {
  it('регистрирует, заменяет и удаляет команды', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'a', title: 'A' }));
    registry.register(makeCommand({ id: 'a', title: 'A2' }));

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('a')?.title).toBe('A2');

    registry.unregister('a');
    expect(registry.get('a')).toBeUndefined();
  });

  it('сортирует активные scope по приоритету', () => {
    const registry = new CommandRegistry();
    registry.pushScope('todo');
    registry.pushScope('modal');
    registry.pushScope('rpg.calendar');

    expect(registry.getActiveScopes()).toEqual([
      'global',
      'todo',
      'rpg.calendar',
      'modal',
    ]);
  });

  it('popScope убирает последнее вхождение scope', () => {
    const registry = new CommandRegistry();
    registry.pushScope('todo');
    registry.pushScope('todo');
    registry.popScope('todo');

    expect(registry.getActiveScopes()).toEqual(['global', 'todo']);
  });
});

describe('CommandRegistry: resolve', () => {
  it('предпочитает команду более глубокого scope', () => {
    const registry = new CommandRegistry();
    registry.register(
      makeCommand({ id: 'global', scope: 'global', shortcut: 'mod+k' }),
    );
    registry.register(
      makeCommand({ id: 'todo', scope: 'todo', shortcut: 'Ctrl+K' }),
    );

    expect(registry.resolve('mod+k')?.id).toBe('global');

    registry.pushScope('todo');
    expect(registry.resolve('mod+k')?.id).toBe('todo');
  });

  it('учитывает when() и отсутствие шортката', () => {
    const registry = new CommandRegistry();
    registry.register(
      makeCommand({
        id: 'disabled',
        shortcut: 'mod+k',
        when: () => false,
      }),
    );
    expect(registry.resolve('mod+k')).toBeUndefined();

    registry.register(
      makeCommand({ id: 'no-shortcut', shortcut: undefined, scope: 'todo' }),
    );
    expect(registry.resolve('mod+j')).toBeUndefined();
  });
});

describe('CommandRegistry: handleKeyDown', () => {
  it('выполняет найденную команду и предотвращает дефолт', () => {
    const registry = new CommandRegistry();
    const command = makeCommand({ id: 'run' });
    registry.register(command);
    const event = makeEvent();

    expect(registry.handleKeyDown(event)).toBe(true);
    expect(command.run).toHaveBeenCalledWith(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('нее возвращает false без команды и не трогает default', () => {
    const registry = new CommandRegistry();
    const event = makeEvent({ code: 'KeyZ', key: 'z' });

    expect(registry.handleKeyDown(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('не перехватывает ввод, но Escape снимает фокус', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'run' }));

    const blur = vi.fn();
    const inputTarget = { tagName: 'INPUT', blur };
    expect(registry.handleKeyDown(makeEvent({ target: inputTarget }))).toBe(
      false,
    );

    const escapeEvent = makeEvent({
      code: 'Escape',
      key: 'Escape',
      ctrlKey: false,
      target: inputTarget,
    });
    expect(registry.handleKeyDown(escapeEvent)).toBe(true);
    expect(blur).toHaveBeenCalled();
  });

  it('сначала отдаёт событие capture-обработчику', () => {
    const registry = new CommandRegistry();
    const command = makeCommand({ id: 'run' });
    registry.register(command);

    registry.setCapture(() => true);
    const event = makeEvent();

    expect(registry.handleKeyDown(event)).toBe(true);
    expect(command.run).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe('CommandRegistry: фокус инпута', () => {
  it('фокусирует последний инпут активного scope', () => {
    const registry = new CommandRegistry();
    const globalFocus = vi.fn();
    const todoFocus = vi.fn();
    registry.registerInput('global', globalFocus);
    registry.registerInput('todo', todoFocus);

    expect(registry.focusActiveInput()).toBe(true);
    expect(globalFocus).toHaveBeenCalled();
    expect(todoFocus).not.toHaveBeenCalled();

    registry.pushScope('todo');
    expect(registry.focusActiveInput()).toBe(true);
    expect(todoFocus).toHaveBeenCalled();
  });

  it('returns false, когда активных инпутов нет', () => {
    const registry = new CommandRegistry();
    expect(registry.focusActiveInput()).toBe(false);
  });

  it('unsubscribe убирает регистрацию инпута', () => {
    const registry = new CommandRegistry();
    const focus = vi.fn();
    const unsubscribe = registry.registerInput('modal', focus);
    unsubscribe();

    registry.pushScope('modal');
    expect(registry.focusActiveInput()).toBe(false);
  });
});
