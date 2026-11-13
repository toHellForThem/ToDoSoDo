import {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  RefObject
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  Keyboard
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getStyles } from './TodoTab.styles';
import { getStyles as getItemStyles } from '../styles/item.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { useTranslation } from '../utils/LanguageContext';
import { Todo } from '../utils/storage';
import { useAppStore } from '../store/appStore';
import { useLeftAction } from '../hooks/useLeftAction';
import { useInputFocus } from '../commands';
import { selectVisibleTodos } from '../domain/visibility';
import { SwipeableRow, type LeftActionRenderer } from '../components/SwipeableRow';
import { SelectableItem } from '../components/SelectableItem';
import { useWebPressGuard } from '../hooks/useWebPressGuard';
import { useScrollToSelected } from '../hooks/useScrollToSelected';


interface TodoItemProps {
  item: Todo;
  statusChangeTask: (
    id: string,
    amount?: number | 'reset' | 'toggle_complete',
    field?: string
  ) => void;
  deleteTodo: (id: string) => void;
  leftAction: LeftActionRenderer;
  isSelected: boolean;
}

interface TodoInputProps {
  onAdd: (task: string, progressEnd?: number) => void;
  inputRef: RefObject<TextInput | null>;
}

const TodoItem = memo(function TodoItem({
  item,
  statusChangeTask,
  deleteTodo,
  leftAction,
  isSelected
}: TodoItemProps) {
  const itemStyles = useStyles(getItemStyles);
  const { theme } = useAppTheme();

  const { handlePressIn, handlePress } = useWebPressGuard(
    useCallback(() => statusChangeTask(item.id, 1), [item.id, statusChangeTask])
  );

  const handleDelete = useCallback(() => {
    deleteTodo(item.id);
  }, [item.id, deleteTodo]);

  return (
    <SwipeableRow leftAction={leftAction} mode="toRecycle" onSwipeLeftOpen={handleDelete}>
      <SelectableItem isSelected={isSelected}>
        <TouchableOpacity
          delayPressIn={150}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 100 }}
          onPressIn={handlePressIn}
          onPress={handlePress}
          style={[itemStyles.checkbox, item.completed && itemStyles.checked]}
        >
          {item.completed && (
            <MaterialCommunityIcons
              style={{ borderRadius: theme.radius.xs, backgroundColor: theme.colors.icon.bg }}
              name={'check-bold'}
              size={20}
              color={theme.colors.icon.primary}
            />
          )}
        </TouchableOpacity>
        <Text
          style={[itemStyles.todoText, item.completed && itemStyles.completedText]}
          onPressIn={handlePressIn}
          onPress={handlePress}
        >
          {item.text}
        </Text>
      </SelectableItem>
    </SwipeableRow>
  );
});

const TodoInput = memo(function TodoInput({ onAdd, inputRef }: TodoInputProps) {
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const [task, setTask] = useState('');

  const handleKeyPress = useCallback((e: any) => {
    if (e.nativeEvent?.key === 'Escape') {
      e.stopPropagation();
      Keyboard.dismiss();
    }
  }, []);

  const handleAdd = useCallback(() => {
    if (task.trim()) {
      onAdd(task, 1);
      setTask('');
    }
  }, [task, onAdd]);

  return (
    <View style={styles.inputContainer}>
      <TextInput
        testID="todo-input"
        ref={inputRef}
        style={styles.input}
        value={task}
        onChangeText={setTask}
        placeholder={t('todo_placeholder')}
        placeholderTextColor={theme.colors.text.muted}
        cursorColor={theme.colors.primary}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
        onKeyPress={handleKeyPress}
      />
      <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
        <MaterialCommunityIcons
          style={{ borderRadius: 10, backgroundColor: theme.colors.icon.bg }}
          name={'plus-thick'}
          size={24}
          color={theme.colors.icon.primary}
        />
      </TouchableOpacity>
    </View>
  );
});

export const TodoTab = memo(function TodoTab() {
  const todoList = useAppStore(state => state.todoList);
  const onAdd = useAppStore(state => state.addTask);
  const deleteTodo = useAppStore(state => state.handleDeleteTodo);
  const statusChangeTask = useAppStore(state => state.statusChangeTask);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);
  const isActive = useAppStore(state => state.mainTab === 'todo');
  const leftAction = useLeftAction();
  const styles = useStyles(getStyles);
  const flatListRef = useRef<FlatList<Todo>>(null);
  const inputRef = useRef<TextInput>(null);

  useInputFocus('todo', () => inputRef.current?.focus(), isActive);

  const activeTodos = useMemo(
    () =>
      selectVisibleTodos(todoList, {
        mainTab: 'todo',
        rpgSubtab: 'dashboard',
        recycle: false,
        dayIndex: 0,
      }),
    [todoList]
  );

  useEffect(() => {
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      const activeInput = TextInput.State.currentlyFocusedInput();
      if (activeInput) {
        TextInput.State.blurTextInput(activeInput);
      }
    });
    return () => hideSubscription.remove();
  }, []);

  useScrollToSelected(flatListRef, activeTodos, selectedTaskId);

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <TodoItem
      item={item}
      statusChangeTask={statusChangeTask}
      deleteTodo={deleteTodo}
      leftAction={leftAction}
      isSelected={item.id === selectedTaskId}
    />
  ), [statusChangeTask, deleteTodo, leftAction, selectedTaskId]);

  return (
    <View style={styles.todoWrapper}>
      <TodoInput onAdd={onAdd} inputRef={inputRef} />
      <FlatList
        ref={flatListRef}
        data={activeTodos}
        extraData={selectedTaskId}
        bounces={false}
        overScrollMode="never"
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 10 }}
      />
    </View>
  );
});
