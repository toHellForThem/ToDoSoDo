import { eventToCombination, isEditableTarget, normalizeCombination } from './keys';
import type { Command, CommandScope } from './types';

/**
 * Приоритет scope не зависит от порядка монтирования компонентов:
 * чем больше число, тем выше приоритет команды.
 */
const SCOPE_PRIORITY: Record<string, number> = {
  global: 0,
  todo: 10,
  daily: 10,
  rpg: 10,
  'rpg.calendar': 20,
  'settings.recording': 30,
  modal: 40,
};

interface InputRegistration {
  scope: CommandScope;
  focus: () => void;
}

/**
 * Единственный реестр команд и инпутов.
 *
 * Один глобальный `keydown`-листенер живёт в `ShortcutProvider`, а компоненты
 * только регистрируют команды. `preventDefault` вызывается лишь тогда, когда
 * команда действительно найдена (или сработал перехват записи шортката).
 */
export class CommandRegistry {
  private commands = new Map<string, Command>();
  private scopeStack: CommandScope[] = [];
  private captureHandler: ((event: KeyboardEvent) => boolean) | null = null;
  private inputs: InputRegistration[] = [];
  private listeners = new Set<() => void>();

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notify();
  }

  registerMany(commands: Command[]): void {
    commands.forEach(command => this.commands.set(command.id, command));
    this.notify();
  }

  unregister(id: string): void {
    if (this.commands.delete(id)) this.notify();
  }

  unregisterMany(ids: string[]): void {
    let changed = false;
    ids.forEach(id => {
      if (this.commands.delete(id)) changed = true;
    });
    if (changed) this.notify();
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  pushScope(scope: CommandScope): void {
    this.scopeStack.push(scope);
    this.notify();
  }

  popScope(scope: CommandScope): void {
    const index = this.scopeStack.lastIndexOf(scope);
    if (index !== -1) {
      this.scopeStack.splice(index, 1);
      this.notify();
    }
  }

  getActiveScopes(): CommandScope[] {
    const scopes = Array.from(new Set(['global', ...this.scopeStack]));
    return scopes.sort(
      (a, b) => (SCOPE_PRIORITY[a] ?? 10) - (SCOPE_PRIORITY[b] ?? 10)
    );
  }

  /** Перехват нажатий для записи нового шортката. */
  setCapture(handler: ((event: KeyboardEvent) => boolean) | null): void {
    this.captureHandler = handler;
  }

  registerInput(scope: CommandScope, focus: () => void): () => void {
    const registration: InputRegistration = { scope, focus };
    this.inputs.push(registration);
    return () => {
      const index = this.inputs.indexOf(registration);
      if (index !== -1) this.inputs.splice(index, 1);
    };
  }

  /** Фокусирует последний зарегистрированный инпут из активного scope. */
  focusActiveInput(): boolean {
    const activeScopes = this.getActiveScopes();
    for (let i = this.inputs.length - 1; i >= 0; i -= 1) {
      if (activeScopes.includes(this.inputs[i].scope)) {
        this.inputs[i].focus();
        return true;
      }
    }
    return false;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /** Возвращает `true`, если событие обработано. */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (this.captureHandler && this.captureHandler(event)) {
      event.preventDefault();
      return true;
    }

    const combination = eventToCombination(event);
    if (!combination) return false;

    if (isEditableTarget(event.target)) {
      if (combination === 'escape') {
        const target = event.target as HTMLElement;
        if (typeof target.blur === 'function') target.blur();
        event.preventDefault();
        return true;
      }
      return false;
    }

    const command = this.resolve(combination);
    if (!command) return false;

    event.preventDefault();
    command.run(event);
    return true;
  }

  /** Ищет команду: сначала глубокие scope, затем `global`. */
  resolve(combination: string): Command | undefined {
    const normalized = normalizeCombination(combination);
    const scopes = this.getActiveScopes();

    for (let i = scopes.length - 1; i >= 0; i -= 1) {
      const scope = scopes[i];
      for (const command of this.commands.values()) {
        if (command.scope !== scope || !command.shortcut) continue;
        if (normalizeCombination(command.shortcut) !== normalized) continue;
        if (command.when && !command.when()) continue;
        return command;
      }
    }

    return undefined;
  }
}
