import { describe, expect, it } from 'vitest';
/**
 * Тесты логического дня: сдвиг на `reset_time` и явный часовой пояс.
 * Все моменты времени заданы в UTC, поэтому тесты не зависят от пояса машины.
 */

import {
  getLogicalDateStr,
  getLogicalDayIndex,
  getLogicalDayStartMs,
  getNextResetMs,
  parseResetTime,
} from '../date';

describe('parseResetTime', () => {
  it('разбирает корректное время', () => {
    expect(parseResetTime('04:30')).toEqual({ hours: 4, minutes: 30 });
    expect(parseResetTime('4:05')).toEqual({ hours: 4, minutes: 5 });
  });

  it('возвращает полночь для пустого и невалидного значения', () => {
    expect(parseResetTime(undefined)).toEqual({ hours: 0, minutes: 0 });
    expect(parseResetTime('25:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseResetTime('abc')).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('getLogicalDateStr', () => {
  it('без сдвига отдаёт дату в UTC', () => {
    expect(getLogicalDateStr('00:00', 'UTC', '2026-11-13T23:30:00Z')).toBe(
      '2026-11-13',
    );
  });

  it('учитывает reset_time: до сброса дата ещё вчерашняя', () => {
    expect(getLogicalDateStr('04:00', 'UTC', '2026-11-14T03:59:00Z')).toBe(
      '2026-11-13',
    );
    expect(getLogicalDateStr('04:00', 'UTC', '2026-11-14T04:00:00Z')).toBe(
      '2026-11-14',
    );
  });

  it('учитывает часовой пояс пользователя', () => {
    // 20:00Z — это 01:00 следующего дня в Ашхабаде (UTC+5),
    // но при сбросе в 02:00 логический день ещё не сменился.
    expect(
      getLogicalDateStr('02:00', 'Asia/Ashgabat', '2026-11-12T20:00:00Z'),
    ).toBe('2026-11-12');
    expect(
      getLogicalDateStr('02:00', 'Asia/Ashgabat', '2026-11-12T21:00:00Z'),
    ).toBe('2026-11-13');
  });
});

describe('getLogicalDayIndex', () => {
  it('считает понедельник нулевым днём', () => {
    expect(getLogicalDayIndex('2024-01-01')).toBe(0);
    expect(getLogicalDayIndex('2024-01-07')).toBe(6);
  });

  it('возвращает 0 для некорректной даты', () => {
    expect(getLogicalDayIndex('bad')).toBe(0);
  });
});

describe('getNextResetMs / getLogicalDayStartMs', () => {
  it('начало дня не позже момента и следующий сброс позже', () => {
    const from = Date.parse('2026-11-13T15:00:00Z');
    const start = getLogicalDayStartMs('04:30', 'UTC', from);
    const next = getNextResetMs('04:30', 'UTC', from);

    expect(start).toBeLessThanOrEqual(from);
    expect(next).toBeGreaterThan(from);
    expect(new Date(start).toISOString()).toBe('2026-11-13T04:30:00.000Z');
    expect(new Date(next).toISOString()).toBe('2026-11-14T04:30:00.000Z');
  });

  it('до сброса началом дня считается предыдущий день', () => {
    const from = Date.parse('2026-11-13T03:00:00Z');
    expect(
      new Date(getLogicalDayStartMs('04:30', 'UTC', from)).toISOString(),
    ).toBe('2026-11-12T04:30:00.000Z');
  });
});
