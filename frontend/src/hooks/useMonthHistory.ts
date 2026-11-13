import { useCallback, useEffect, useState } from 'react';
import {
  getMonthStatus,
  requestMonthHistory,
  subscribeMonth,
  type MonthHistoryStatus,
} from '../sync/history';

/**
 * Статус загрузки истории месяца для календаря.
 *
 * При открытии календаря/смене месяца запрашивает `client:get_month_history`.
 * В офлайне возвращает `offline` — UI показывает локальную историю.
 */
export const useMonthHistory = (month: string, enabled: boolean) => {
  const [status, setStatus] = useState<MonthHistoryStatus>(() =>
    enabled ? getMonthStatus(month) : 'idle'
  );

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    setStatus(getMonthStatus(month));
    const unsubscribe = subscribeMonth(month, setStatus);
    requestMonthHistory(month);

    return unsubscribe;
  }, [month, enabled]);

  const retry = useCallback(() => {
    requestMonthHistory(month, true);
  }, [month]);

  return { status, retry };
};
