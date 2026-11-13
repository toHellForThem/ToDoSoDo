import { useAppStore } from '../store/appStore';
import { SettingsTab } from '../tabs/SettingsTab';
import { RecycleTab } from '../tabs/RecycleTab';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

interface NavigationProps {
  isWideScreen: boolean;
}

/**
 * Переключает основное содержимое: настройки, корзина или рабочие табы.
 * Корзина рендерится один раз для любого layout — без дублирования по колонкам.
 */
export const Navigation = ({ isWideScreen }: NavigationProps) => {
  const activeView = useAppStore(state => state.activeView);
  const mainTab = useAppStore(state => state.mainTab);

  if (activeView === 'settings') {
    return <SettingsTab />;
  }

  if (activeView === 'recycle') {
    return <RecycleTab context={mainTab} />;
  }

  return isWideScreen ? <DesktopLayout /> : <MobileLayout />;
};
