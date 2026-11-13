import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Todo } from '../../utils/storage';
import { useLeftAction } from '../../hooks/useLeftAction';
import { SwipeableRow } from '../../components/SwipeableRow';
import { SectionStyleProps } from './types';

interface DailiesEditorProps extends SectionStyleProps {
  dailies: Todo[];
  isRu: boolean;
  onBack: () => void;
  handleToggleDay: (item: Todo, idx: number) => void;
  handleChangeProgressEnd: (item: Todo, delta: number) => void;
  handleDeleteDaily: (item: Todo) => void;
  itemStyles: any;
}

/** Подэкран редактирования дней недели и цели daily-задач. */
export const DailiesEditor = ({
  dailies,
  isRu,
  onBack,
  handleToggleDay,
  handleChangeProgressEnd,
  handleDeleteDaily,
  styles,
  itemStyles,
  theme,
  t,
}: DailiesEditorProps) => {
  const leftAction = useLeftAction();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: Platform.OS === 'web' ? theme.spacing.xl : theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
          width: '100%',
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
          <View style={[styles.card, {
            flexDirection: 'row',
            alignItems: 'center',
            height: 54,
            padding: 0,
            overflow: 'hidden',
            marginBottom: theme.spacing.smd,
          }]}>
            <TouchableOpacity
              onPress={onBack}
              style={{
                height: '100%',
                width: 54,
                backgroundColor: theme.colors.icon.bg,
                borderTopLeftRadius: theme.radius.lg,
                borderBottomLeftRadius: theme.radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.icon.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text.primary, marginLeft: 16 }}>
              {isRu ? 'Редактировать Daily' : 'Edit Daily Tasks'}
            </Text>
          </View>
        </View>
        {dailies.length === 0 ? (
          <View style={{ paddingHorizontal: 20, width: '100%', maxWidth: 600 }}>
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 30, marginBottom: 0 }]}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color={theme.colors.text.muted} />
              <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 12 }}>
                {isRu ? 'Нет активных ежедневных задач' : 'No active daily tasks'}
              </Text>
            </View>
          </View>
        ) : (
          dailies.map(item => {
            const daysStr = item.days || '1111111';
            return (
              <SwipeableRow
                key={item.id}
                leftAction={leftAction}
                mode="toRecycle"
                onSwipeLeftOpen={() => handleDeleteDaily(item)}
                containerStyle={{
                  paddingTop: 2,
                  paddingBottom: 8,
                  paddingHorizontal: 20,
                  backgroundColor: 'transparent',
                  width: '100%',
                  maxWidth: 600,
                  alignSelf: 'center',
                }}
              >
                <View style={[itemStyles.todoItem, { flexDirection: 'column', alignItems: 'stretch', padding: theme.spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.text.primary,
                        paddingVertical: 6,
                      }}
                    >
                      {item.text}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity hitSlop={10} onPress={() => handleChangeProgressEnd(item, -1)}>
                        <Ionicons name="remove-circle-outline" size={22} color={theme.colors.icon.primary} />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', marginHorizontal: 10, color: theme.colors.text.primary }}>
                        {item.progressEnd || 1}
                      </Text>
                      <TouchableOpacity hitSlop={10} onPress={() => handleChangeProgressEnd(item, 1)}>
                        <Ionicons name="add-circle-outline" size={22} color={theme.colors.icon.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12 }}>
                    {t('daily_weekdays').map((day, idx) => {
                      const isSelected = daysStr[idx] === '1';
                      return (
                        <TouchableOpacity
                          key={day}
                          onPress={() => handleToggleDay(item, idx)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected ? theme.colors.primaryLight : 'transparent',
                            borderWidth: 1.5,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border.light,
                          }}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: isSelected ? theme.colors.primary : theme.colors.text.secondary
                          }}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};
