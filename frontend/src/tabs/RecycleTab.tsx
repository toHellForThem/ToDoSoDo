import {
  memo,
  useCallback,
  useMemo,
  useRef,
  Dispatch,
  SetStateAction
} from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStyles } from '../styles/item.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { send } from '../sync';
import { ClientEvent } from '../contract/events';
import { Todo } from '../utils/storage'
import { useAppStore } from '../store/appStore';
import { useLeftAction } from '../hooks/useLeftAction';
import { selectVisibleTodos, type VisibleMainTab } from '../domain/visibility';
import { useLogicalDayIndex } from '../hooks/useLogicalDate';
import { SwipeableRow, type LeftActionRenderer } from '../components/SwipeableRow';
import { SelectableItem } from '../components/SelectableItem';
import { useScrollToSelected } from '../hooks/useScrollToSelected';


interface RecycleItemProps {
  item: Todo;
  deleteTodo: (id: string) => void;
  leftAction: LeftActionRenderer;
  setTodoList: Dispatch<SetStateAction<Todo[]>>;
  isSelected: boolean;
}

interface RecycleTabProps {
  context: string;
}

const RecycleItem = memo(({
  item,
  deleteTodo,
  leftAction,
  setTodoList,
  isSelected
}: RecycleItemProps) => {
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();

  const handleDelete = useCallback(() => {
    deleteTodo(item.id);
  }, [item.id, deleteTodo]);

  const restoreTask = useCallback(() => {
    let updated = null;
    setTodoList(prev => {
      return prev.map(todo => {
        if (todo.id === item.id) {
          updated = { ...todo, deleted: !todo.deleted, updatedAt: Date.now() };
          return updated;
        }
        return todo;
      });
    });
    if (updated) {
      send(ClientEvent.SYNC_TODO, updated);
    }
  }, [item.id, setTodoList]);

  return (
    <SwipeableRow
      leftAction={leftAction}
      mode="hardDelete"
      leftThreshold={70}
      onSwipeLeftOpen={handleDelete}
    >
      <SelectableItem isSelected={isSelected}>
        <Text style={[styles.todoText, item.completed && styles.completedText]}>
          {item.text}
        </Text>
        <TouchableOpacity
          onPress={restoreTask}
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
            name={'arrow-undo-outline'}
            size={25}
            color={theme.colors.icon.primary}
          />
        </TouchableOpacity>
      </SelectableItem>
    </SwipeableRow>
  );
});

export const RecycleTab = memo(({ context }: RecycleTabProps) => {
  const todoList = useAppStore(state => state.todoList);
  const deleteTodo = useAppStore(state => state.deleteTodo);
  const setTodoList = useAppStore(state => state.setTodoList);
  const rpgSubtab = useAppStore(state => state.rpgSubtab);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);
  const todayDayIdx = useLogicalDayIndex();
  const leftAction = useLeftAction();
  const flatListRef = useRef<FlatList<Todo>>(null);

  const activeTodos = useMemo(
    () =>
      selectVisibleTodos(todoList, {
        mainTab: context as VisibleMainTab,
        rpgSubtab,
        recycle: true,
        dayIndex: todayDayIdx,
      }),
    [todoList, context, rpgSubtab, todayDayIdx]
  );

  useScrollToSelected(flatListRef, activeTodos, selectedTaskId);

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <RecycleItem
      setTodoList={setTodoList}
      item={item}
      deleteTodo={deleteTodo}
      leftAction={leftAction}
      isSelected={item.id === selectedTaskId}
    />
  ), [deleteTodo, leftAction, selectedTaskId, setTodoList]);

  return (
    <FlatList
      ref={flatListRef}
      removeClippedSubviews={true}
      data={activeTodos}
      extraData={selectedTaskId}
      bounces={false}
      overScrollMode="never"
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={{ marginBottom: 16, paddingTop: 10 }}
    />
  );
});
