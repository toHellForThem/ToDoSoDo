import { useAppStore } from '../store/appStore';
import { TodoTab } from '../tabs/TodoTab';
import { DailyTab } from '../tabs/DailyTab';
import { RpgTab } from '../tabs/RpgTab';

/** Mobile-layout: один активный таб. */
export const MobileLayout = () => {
  const mainTab = useAppStore(state => state.mainTab);

  if (mainTab === 'todo') return <TodoTab />;
  if (mainTab === 'daily') return <DailyTab />;
  return <RpgTab />;
};
