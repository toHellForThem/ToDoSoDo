/**
 * Единое определение логического дня на клиенте.
 *
 * Контракт совпадает с `backend/app/logical_day.py`: день начинается в
 * `reset_time` в часовом поясе пользователя (`timezone` из `UserSettings`),
 * а метка дня — календарная дата начала.  Формально логическая дата момента
 * — это локальная дата момента `now - reset_time`.
 *
 * Часовой пояс учитывается явно, поэтому два устройства в разных поясах
 * получают одинаковую дату, если у них синхронизирован `timezone`.
 */

export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_RESET_TIME = '00:00';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat | null => {
  if (formatterCache.has(timeZone)) {
    return formatterCache.get(timeZone) ?? null;
  }

  let formatter: Intl.DateTimeFormat | null = null;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    // Старые сборки Hermes без полного ICU: откатываемся на пояс устройства.
    formatter = null;
  }

  formatterCache.set(timeZone, formatter);
  return formatter;
};

const getZonedParts = (date: Date, timeZone: string): ZonedParts => {
  const formatter = getFormatter(timeZone);
  if (!formatter) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }

  const parts = formatter.formatToParts(date);
  const pick = (type: string): number => {
    const part = parts.find(item => item.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    // Некоторые движки возвращают "24" для полуночи.
    hour: pick('hour') % 24,
    minute: pick('minute'),
    second: pick('second'),
  };
};

export const parseResetTime = (
  value?: string | null,
): { hours: number; minutes: number } => {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(
    (value || DEFAULT_RESET_TIME).trim(),
  );
  if (!match) {
    return { hours: 0, minutes: 0 };
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return { hours: 0, minutes: 0 };
  }
  return { hours, minutes };
};

const pad = (value: number): string => String(value).padStart(2, '0');

const formatParts = (parts: ZonedParts): string =>
  `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;

const addDays = (parts: ZonedParts, delta: number): ZonedParts => {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + delta),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
};

const getOffsetMs = (timestamp: number, timeZone: string): number => {
  const whole = Math.floor(timestamp / 1000) * 1000;
  const parts = getZonedParts(new Date(whole), timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - whole;
};

/** Переводит локальные дату/время пояса в epoch-миллисекунды. */
const zonedTimeToEpoch = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): number => {
  if (!getFormatter(timeZone)) {
    return new Date(year, month - 1, day, hours, minutes).getTime();
  }

  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes);
  const firstOffset = getOffsetMs(utcGuess, timeZone);
  let result = utcGuess - firstOffset;
  const secondOffset = getOffsetMs(result, timeZone);
  if (secondOffset !== firstOffset) {
    result = utcGuess - secondOffset;
  }
  return result;
};

/** Логическая дата момента в формате `YYYY-MM-DD`. */
export const getLogicalDateStr = (
  resetTimeStr?: string | null,
  timezone?: string | null,
  customDate?: string | number | Date | null,
): string => {
  const { hours, minutes } = parseResetTime(resetTimeStr);
  const instant = new Date(customDate ?? Date.now());
  const shifted = new Date(instant.getTime() - (hours * 60 + minutes) * 60000);
  return formatParts(getZonedParts(shifted, timezone || DEFAULT_TIMEZONE));
};

/** Индекс дня недели логической даты: 0 — понедельник, 6 — воскресенье. */
export const getLogicalDayIndex = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return 0;
  }
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
};

/** Epoch-миллисекунды ближайшего будущего сброса. */
export const getNextResetMs = (
  resetTimeStr?: string | null,
  timezone?: string | null,
  from: number = Date.now(),
): number => {
  const zone = timezone || DEFAULT_TIMEZONE;
  const { hours, minutes } = parseResetTime(resetTimeStr);
  const parts = getZonedParts(new Date(from), zone);

  let candidate = zonedTimeToEpoch(
    parts.year,
    parts.month,
    parts.day,
    hours,
    minutes,
    zone,
  );
  if (candidate <= from) {
    const nextDay = addDays(parts, 1);
    candidate = zonedTimeToEpoch(
      nextDay.year,
      nextDay.month,
      nextDay.day,
      hours,
      minutes,
      zone,
    );
  }
  return candidate;
};

/** Epoch-миллисекунды начала текущего логического дня. */
export const getLogicalDayStartMs = (
  resetTimeStr?: string | null,
  timezone?: string | null,
  from: number = Date.now(),
): number => {
  const zone = timezone || DEFAULT_TIMEZONE;
  const { hours, minutes } = parseResetTime(resetTimeStr);
  const nextReset = getNextResetMs(resetTimeStr, zone, from);
  const parts = addDays(getZonedParts(new Date(nextReset), zone), -1);

  return zonedTimeToEpoch(
    parts.year,
    parts.month,
    parts.day,
    hours,
    minutes,
    zone,
  );
};
