/**
 * Команда — единица действия, которую можно вызвать шорткатом.
 *
 * `scope` определяет, в каком контексте команда активна. Активные scope
 * образуют стек: `global` всегда внизу, дальше — контекст экрана/модалки.
 * Команда из более глубокого scope имеет приоритет.
 */
export type CommandScope =
  | 'global'
  | 'todo'
  | 'daily'
  | 'rpg'
  | 'rpg.calendar'
  | 'settings.recording'
  | 'modal'
  | (string & {});

export interface Command {
  /** Уникальный идентификатор, например `tab.rpg` или `calendar.nextDay`. */
  id: string;
  /** Человекочитаемое название для настроек/отладки. */
  title: string;
  /** Комбинация в формате `mod+shift+k`. */
  shortcut?: string;
  scope: CommandScope;
  /** Дополнительное условие доступности команды. */
  when?: () => boolean;
  run: (event?: KeyboardEvent) => void;
}
