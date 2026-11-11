import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
  Dispatch,
  SetStateAction
} from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { getStyles } from '../styles/item.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { socket } from '../utils/socket';
import { request } from '../utils/protocol';
import { Todo } from '../utils/storage'


interface RecycleItemProps {
  item: Todo;
  deleteTodo: (id: string) => void;
  leftAction: (prog: any, drag: any, mode: string) => ReactNode;
  setTodoList: Dispatch<SetStateAction<Todo[]>>;
  isSelected: boolean;
}

interface RecycleTabProps {
  todoList: Todo[];
  deleteTodo: (id: string) => void;
  leftAction: (prog: any, drag: any, mode: string) => ReactNode;
  setTodoList: Dispatch<SetStateAction<Todo[]>>;
  context: string;
  rpgSubtab?: string;
  selectedTaskId: string | null;
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

  const renderLeft = useCallback((prog: any, drag: any) => {
    return leftAction(prog, drag, 'hardDelete')
  }, [leftAction]);

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
      socket.emit('client:sync_todo', request(updated));
    }
  }, [socket, item.id, setTodoList]);

  return (
    <Swipeable
      friction={1.6}
      leftThreshold={70}
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
        styles.todoItem,
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
      </View>
    </Swipeable>
  );
});

export const RecycleTab = memo(({
  todoList,
  deleteTodo,
  leftAction,
  setTodoList,
  context,
  rpgSubtab,
  selectedTaskId
}: RecycleTabProps) => {
  const flatListRef = useRef<FlatList<Todo>>(null);

  const activeTodos = useMemo(() => {
    return todoList.filter(item => {
      if (!item.deleted) return false;

      if (context === 'rpg') {
        if (rpgSubtab === 'habits') {
          return item.type === 'habit';
        }
        if (rpgSubtab === 'piggy_bank') {
          return item.type === 'piggy_bank';
        }
        if (rpgSubtab === 'tv_shows') {
          return item.type === 'tv_show' || item.type === 'movie';
        }
        return item.type === 'habit' || item.type === 'piggy_bank' || item.type === 'tv_show' || item.type === 'movie';
      }

      return item.type === context;
    });
  }, [todoList, context, rpgSubtab]);

  useEffect(() => {
    if (!selectedTaskId || !flatListRef.current) return;
    const index = activeTodos.findIndex(item => item.id === selectedTaskId);
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
        } catch (innerErr) {
          console.log('Scroll to selected recycled item failed:', innerErr);
        }
      }
    }
  }, [selectedTaskId, activeTodos]);

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <RecycleItem
      setTodoList={setTodoList}
      item={item}
      deleteTodo={deleteTodo}
      leftAction={leftAction}
      isSelected={item.id === selectedTaskId}
    />
  ), [deleteTodo, leftAction, selectedTaskId]);

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

