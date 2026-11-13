import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { CommandRegistry } from './registry';
import type { Command, CommandScope } from './types';

const CommandRegistryContext = createContext<CommandRegistry | null>(null);

/**
 * Один провайдер — один глобальный листенер.
 *
 * На native (iOS/Android) `window`-событий клавиатуры нет: команды и реестр
 * инпутов работают, но физическая клавиатура потребует отдельного нативного
 * моста. На web листенер ставится здесь и больше нигде.
 */
export const ShortcutProvider = ({ children }: { children: React.ReactNode }) => {
  const registry = useMemo(() => new CommandRegistry(), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      registry.handleKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [registry]);

  return (
    <CommandRegistryContext.Provider value={registry}>
      {children}
    </CommandRegistryContext.Provider>
  );
};

export const useCommandRegistry = (): CommandRegistry => {
  const registry = useContext(CommandRegistryContext);
  if (!registry) {
    throw new Error('useCommandRegistry must be used within ShortcutProvider');
  }
  return registry;
};

/** Регистрирует набор команд на время жизни компонента. */
export const useCommands = (commands: Command[]): void => {
  const registry = useCommandRegistry();

  useEffect(() => {
    registry.registerMany(commands);
    return () => {
      registry.unregisterMany(commands.map(command => command.id));
    };
  }, [registry, commands]);
};

/** Кладёт scope в стек, пока `active` истинно. */
export const useScope = (scope: CommandScope, active = true): void => {
  const registry = useCommandRegistry();

  useEffect(() => {
    if (!active) return;
    registry.pushScope(scope);
    return () => {
      registry.popScope(scope);
    };
  }, [registry, scope, active]);
};

/** Регистрирует инпут для команды `focus.activeInput`. */
export const useInputFocus = (
  scope: CommandScope,
  focus: () => void,
  active = true
): void => {
  const registry = useCommandRegistry();
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useEffect(() => {
    if (!active) return;
    return registry.registerInput(scope, () => focusRef.current());
  }, [registry, scope, active]);
};

/** Перехватывает нажатия для записи шортката в настройках. */
export const useShortcutRecorder = (
  active: boolean,
  onCapture: (event: KeyboardEvent) => boolean
): void => {
  const registry = useCommandRegistry();
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  useEffect(() => {
    if (!active) return;
    registry.setCapture(event => captureRef.current(event));
    return () => {
      registry.setCapture(null);
    };
  }, [registry, active]);
};
