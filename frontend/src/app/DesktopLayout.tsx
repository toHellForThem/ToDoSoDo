import { View, Text } from 'react-native';
import { getStyles } from '../../App.styles';
import { useStyles } from '../theme/ThemeContext';
import { useAppStore } from '../store/appStore';
import { useTranslation } from '../utils/LanguageContext';
import { TodoTab } from '../tabs/TodoTab';
import { DailyTab } from '../tabs/DailyTab';
import { RpgTab } from '../tabs/RpgTab';
import { RecycleTab } from '../tabs/RecycleTab';

type ColumnTab = 'todo' | 'daily' | 'rpg';

const renderTab = (tab: ColumnTab) => {
  if (tab === 'todo') return <TodoTab />;
  if (tab === 'daily') return <DailyTab />;
  return <RpgTab />;
};

/** Wide-layout: три колонки, активная определяется mainTab. */
export const DesktopLayout = () => {
  const mainTab = useAppStore(state => state.mainTab);
  const activeView = useAppStore(state => state.activeView);
  const handleTabChange = useAppStore(state => state.handleTabChange);
  const styles = useStyles(getStyles);
  const { t } = useTranslation();

  const renderColumn = (tab: ColumnTab, title: string) => (
    <View
      onStartShouldSetResponderCapture={() => {
        if (mainTab !== tab) handleTabChange(tab);
        return false;
      }}
      style={[styles.column, mainTab === tab && styles.activeColumn]}
    >
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle}>{title}</Text>
      </View>
      <View style={styles.columnContent}>
        {mainTab === tab && activeView === 'recycle' ? (
          <RecycleTab context={tab} />
        ) : (
          renderTab(tab)
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.dashboardContainer}>
      {renderColumn('rpg', t('desktop_rpg_title'))}
      {renderColumn('todo', t('desktop_todo_title'))}
      {renderColumn('daily', t('desktop_daily_title'))}
    </View>
  );
};
