import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';

interface BackActionOptions {
  isMoodSheetActive: () => boolean;
  closeMoodSheet: () => void;
}

/**
 * Единая логика кнопки «назад»: сначала закрывает шторку настроения,
 * затем календарь, вложенные экраны и подтабы RPG.
 */
export const useBackAction = ({
  isMoodSheetActive,
  closeMoodSheet,
}: BackActionOptions) => {
  const isCalendarVisible = useAppStore(state => state.isCalendarVisible);
  const activeView = useAppStore(state => state.activeView);
  const mainTab = useAppStore(state => state.mainTab);
  const rpgSubtab = useAppStore(state => state.rpgSubtab);
  const setCalendarVisible = useAppStore(state => state.setCalendarVisible);
  const setActiveView = useAppStore(state => state.setActiveView);
  const setRpgSubtab = useAppStore(state => state.setRpgSubtab);

  return useCallback(() => {
    if (isMoodSheetActive()) {
      closeMoodSheet();
      return true;
    }

    if (isCalendarVisible) {
      setCalendarVisible(false);
      return true;
    }

    if (activeView !== 'list') {
      setActiveView('list');
      return true;
    }

    if (mainTab === 'rpg' && rpgSubtab !== 'dashboard') {
      setRpgSubtab('dashboard');
      return true;
    }

    return false;
  }, [
    isMoodSheetActive,
    closeMoodSheet,
    isCalendarVisible,
    activeView,
    mainTab,
    rpgSubtab,
    setCalendarVisible,
    setActiveView,
    setRpgSubtab,
  ]);
};
