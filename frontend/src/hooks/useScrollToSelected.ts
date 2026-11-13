import { RefObject, useEffect } from 'react';
import { FlatList } from 'react-native';

/**
 * Прокручивает список к выбранному элементу. Одинаково используется
 * в todo, daily и recycle-списках.
 */
export const useScrollToSelected = <T extends { id: string }>(
  listRef: RefObject<FlatList<T> | null>,
  items: T[],
  selectedId: string | null,
) => {
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const index = items.findIndex(item => item.id === selectedId);
    if (index === -1) return;

    try {
      listRef.current.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    } catch {
      try {
        listRef.current.scrollToOffset({
          offset: index * 60,
          animated: true,
        });
      } catch {
        // FlatList может не успеть измерить элемент — фолбэк уже применён.
      }
    }
  }, [selectedId, items, listRef]);
};
