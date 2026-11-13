import { useCallback } from 'react';
import { renderLeftAction } from '../utils/swipe';
import { useAppTheme } from '../theme/ThemeContext';
import { useAppStore } from '../store/appStore';

/**
 * Фабрика левого swipe-действия.  Зависит от темы и настроек, поэтому
 * живёт в хуке, а не передаётся через пропсы каждого таба.
 */
export const useLeftAction = () => {
  const { theme } = useAppTheme();
  const language = useAppStore(state => state.settings?.language || 'ru');
  const softDelete = useAppStore(state => state.settings?.soft_delete !== false);

  return useCallback(
    (prog: any, drag: any, mode: string) =>
      renderLeftAction(prog, drag, mode, theme, language, softDelete),
    [theme, language, softDelete]
  );
};
