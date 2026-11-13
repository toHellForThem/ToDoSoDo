import { useMemo } from 'react';
import { getLogicalDateStr, getLogicalDayIndex } from '../utils/date';
import { useAppStore } from '../store/appStore';

/** Логическая дата текущего момента по настройкам пользователя. */
export const useLogicalDateStr = (): string => {
  const resetTime = useAppStore(state => state.settings?.reset_time);
  const timezone = useAppStore(state => state.settings?.timezone);

  return useMemo(
    () => getLogicalDateStr(resetTime, timezone),
    [resetTime, timezone],
  );
};

/** Индекс дня недели текущей логической даты: 0 — понедельник. */
export const useLogicalDayIndex = (): number => {
  const todayStr = useLogicalDateStr();
  return useMemo(() => getLogicalDayIndex(todayStr), [todayStr]);
};
