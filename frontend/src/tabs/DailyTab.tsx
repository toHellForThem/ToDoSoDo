import {
  useState,
  useEffect,
  useCallback,
  memo,
  useMemo,
  useRef,
  ReactNode,
  SetStateAction,
  Dispatch,
  RefObject
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  Keyboard,
  LayoutAnimation,
  Platform,
  GestureResponderEvent,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { getStyles } from './DailyTab.styles';
import { getStyles as getItemStyles } from '../styles/item.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { FillProgress } from '../components/FillProgress';
import { useTranslation } from '../utils/LanguageContext';
import { Todo, TodoType } from '../utils/storage'
import { useAppStore } from '../store/appStore';
import { useInputFocus } from '../commands';
import { useLeftAction } from '../hooks/useLeftAction';
import { selectVisibleTodos } from '../domain/visibility';
import { useLogicalDayIndex } from '../hooks/useLogicalDate';
import { useDailyStats } from '../hooks/useDailyStats';


interface DailyItemProps {
  item: Todo,
  statusChangeTask: (
    id: string,
    amount?: number | 'reset' | 'toggle_complete',
    field?: string
  ) => void;
  deleteTodo: (id: string) => void;
  leftAction: (prog: any, drag: any, mode: string) => ReactNode;
  isSelected: boolean;
}

interface DailyInputProps {
  onAdd: (
    task: string,
    progressEnd?: number,
    type?: TodoType,
    progressNow?: number | string,
    contribution?: number,
    days?: string
  ) => void;
  dailyDays: string;
  setDailyDays: Dispatch<SetStateAction<string>>;
  dailyProgressEnd: number;
  setDailyProgressEnd: Dispatch<SetStateAction<number>>;
  isWideScreen: boolean;
  inputRef: RefObject<TextInput | null>;
}

const DailyItem = memo(({
  item,
  statusChangeTask,
  deleteTodo,
  leftAction,
  isSelected
}: DailyItemProps) => {
  const styles = useStyles(getStyles);
  const itemStyles = useStyles(getItemStyles);
  const { theme } = useAppTheme();

  const startX = useRef(0);
  const startY = useRef(0);

  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      startX.current = e.nativeEvent.pageX || 0;
      startY.current = e.nativeEvent.pageY || 0;
    }
  }, []);

  const handlePress = useCallback((e: GestureResponderEvent) => {
    if (Platform.OS === 'web' && e) {
      const endX = e.nativeEvent.pageX || 0;
      const endY = e.nativeEvent.pageY || 0;
      const dist = Math.sqrt(Math.pow(endX - startX.current, 2) + Math.pow(endY - startY.current, 2));
      if (dist > 8) return;
    }
    statusChangeTask(item.id);
  }, [item.id, statusChangeTask]);

  const handleDelete = useCallback(() => {
    deleteTodo(item.id);
  }, [item.id, deleteTodo]);

  const renderLeft = useCallback((prog: any, drag: any) => {
    return leftAction(prog, drag, 'toRecycle');
  }, [leftAction]);

  return (
    <Swipeable
      friction={1.6}
      leftThreshold={78}
      overshootLeft={true}
      renderLeftActions={renderLeft}
      onSwipeableLeftOpen={handleDelete}
      containerStyle={{
        paddingTop: 2,
        paddingBottom: 8,
        paddingHorizontal: 20,
        backgroundColor: 'transparent',
      }}
      activeOffsetX={[-15, 15]}
      failOffsetY={[-15, 15]}
    >
      <View style={[
        itemStyles.todoItem,
        isSelected && { backgroundColor: theme.colors.icon.bg }
      ]}>
        {isSelected && (
          <View style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: theme.colors.primary,
            zIndex: 10,
          }} />
        )}
        <FillProgress
          progressNow={Number(item.progressNow)}
          progressEnd={Number(item.progressEnd)}
        />
        <Text
          style={[
            itemStyles.todoText,
            { backgroundColor: 'transparent' },
            item.completed && styles.completedTextDaily
          ]}
          onPressIn={handlePressIn}
          onPress={handlePress}
        >
          {item.text}
        </Text>
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPress={handlePress}
          style={{
            marginLeft: 'auto',
            alignSelf: 'stretch',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.icon.bg,
            borderBottomRightRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            width: 50,
          }}
        >
          <Ionicons
            style={{
              alignItems: 'center'
            }}
            name={item.completed ? 'flash-sharp' : 'flash-outline'}
            size={25}
            color={theme.colors.icon.primary}
          />
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
});

const DailyInput = memo(({
  onAdd,
  dailyDays,
  setDailyDays,
  dailyProgressEnd,
  setDailyProgressEnd,
  isWideScreen,
  inputRef,
}: DailyInputProps) => {
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();

  const [task, setTask] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const handleKeyPress = useCallback((e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const native = e.nativeEvent as any
    const key = native?.key || (e as any).key;
    const isCtrl = native?.ctrlKey || native?.metaKey || (e as any).ctrlKey || (e as any).metaKey;

    if (key === 'Escape') {
      e.stopPropagation();
      Keyboard.dismiss();
      return;
    }

    if (isCtrl && /^[1-9]$/.test(key)) {
      e.preventDefault();
      e.stopPropagation();
      const val = parseInt(key, 10);
      setDailyProgressEnd(val);
    }
  }, [setDailyProgressEnd]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);

      const activeInput = TextInput.State.currentlyFocusedInput();
      if (activeInput) {
        TextInput.State.blurTextInput(activeInput);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleAdd = useCallback(() => {
    if (task.trim()) {
      onAdd(task, dailyProgressEnd, 'daily', 0, 0, dailyDays);
      setTask('');
      setDailyProgressEnd(1);
      setDailyDays('1111111');
    }
  }, [task, dailyProgressEnd, dailyDays, onAdd, setDailyProgressEnd, setDailyDays]);

  return (
    <>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={task}
          onChangeText={setTask}
          placeholder={t('daily_placeholder')}
          placeholderTextColor={theme.colors.text.muted}
          cursorColor={theme.colors.primary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          onKeyPress={handleKeyPress}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <MaterialCommunityIcons name="plus-thick" size={24} color={theme.colors.icon.primary} />
        </TouchableOpacity>
      </View>
      {!isWideScreen && (
        <View
          pointerEvents={isKeyboardVisible ? 'auto' : 'none'}
          style={[styles.floatingContainer, {
            bottom: keyboardHeight - 71,
            opacity: isKeyboardVisible ? 1 : 0,
            flexDirection: 'column',
            height: 100,
            paddingVertical: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
          }]}
        >
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', width: '100%' }}>
            {t('daily_weekdays').map((day, idx) => {
              const isSelected = dailyDays[idx] === '1';
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => {
                    setDailyDays(prev => {
                      const arr = prev.split('');
                      arr[idx] = arr[idx] === '1' ? '0' : '1';
                      if (arr.every(x => x === '0')) return prev;
                      return arr.join('');
                    });
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.colors.background : 'transparent',
                    borderWidth: 1.5,
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: isSelected ? theme.colors.primary : theme.colors.text.secondary
                  }}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <TouchableOpacity hitSlop={15} onPress={() => {
              setDailyProgressEnd(dailyProgressEnd === 1 ? 1 : dailyProgressEnd - 1);
            }}>
              <Ionicons name="remove-circle-outline" size={24} color={theme.colors.icon.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginHorizontal: 15, color: theme.colors.text.primary }}>
              {dailyProgressEnd}
            </Text>
            <TouchableOpacity hitSlop={15} onPress={() => {
              setDailyProgressEnd(dailyProgressEnd === 20 ? 20 : dailyProgressEnd + 1);
            }}>
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.icon.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
});

export const DailyTab = memo(() => {
  const todoList = useAppStore(state => state.todoList);
  const onAdd = useAppStore(state => state.addTask);
  const statusChangeTask = useAppStore(state => state.statusChangeTask);
  const deleteTodo = useAppStore(state => state.handleDeleteTodo);
  const dailyDays = useAppStore(state => state.dailyDays);
  const setDailyDays = useAppStore(state => state.setDailyDays);
  const dailyProgressEnd = useAppStore(state => state.dailyProgressEnd);
  const setDailyProgressEnd = useAppStore(state => state.setDailyProgressEnd);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);
  const isActive = useAppStore(state => state.mainTab === 'daily');
  const leftAction = useLeftAction();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const styles = useStyles(getStyles);
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList<Todo>>(null);
  const inputRef = useRef<TextInput>(null);

  useInputFocus('daily', () => inputRef.current?.focus(), isActive);

  const todayDayIdx = useLogicalDayIndex();
  const stats = useDailyStats();

  const dailies = useMemo(
    () =>
      selectVisibleTodos(todoList, {
        mainTab: 'daily',
        rpgSubtab: 'dashboard',
        recycle: false,
        dayIndex: todayDayIdx,
      }),
    [todoList, todayDayIdx]
  );

  useEffect(() => {
    if (!selectedTaskId || !flatListRef.current) return;
    const index = dailies.findIndex(item => item.id === selectedTaskId);
    if (index !== -1) {
      try {
        flatListRef.current.scrollToIndex({
          index,
          viewPosition: 0.5,
          animated: true,
        });
      } catch (err) {
        try {
          flatListRef.current.scrollToOffset({
            offset: index * 60,
            animated: true,
          });
        } catch {
          // FlatList может не успеть измерить элемент — фолбэк уже применён.
        }
      }
    }
  }, [selectedTaskId, dailies]);

  const progress = useMemo(
    () => Math.round(stats.dailyProgress * 100),
    [stats.dailyProgress]
  );

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <DailyItem
      item={item}
      statusChangeTask={statusChangeTask}
      deleteTodo={deleteTodo}
      leftAction={leftAction}
      isSelected={item.id === selectedTaskId}
    />
  ), [statusChangeTask, deleteTodo, leftAction, selectedTaskId]);

  return (
    <View style={styles.todoWrapper}>
      <DailyInput
        onAdd={onAdd}
        dailyDays={dailyDays}
        setDailyDays={setDailyDays}
        dailyProgressEnd={dailyProgressEnd}
        setDailyProgressEnd={setDailyProgressEnd}
        isWideScreen={isWideScreen}
        inputRef={inputRef}
      />
      <FlatList
        ref={flatListRef}
        data={dailies}
        extraData={selectedTaskId}
        bounces={false}
        overScrollMode="never"
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 10 }}
      />
      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, progress === 100 && styles.progressTextCompleted]}>{t('daily_progress', { progress })}</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
});