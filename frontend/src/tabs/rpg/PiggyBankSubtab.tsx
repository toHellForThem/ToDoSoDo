import {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
  Dispatch,
  SetStateAction,
  RefObject
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Keyboard,
  NativeSyntheticEvent,
  TextInputKeyPressEventData
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Todo } from '../../utils/storage';
import { Theme } from '../../theme/theme';
import { useTranslation } from '../../utils/LanguageContext';
import { useInputFocus } from '../../commands';


interface PiggyBankItemProps {
  item: Todo;
  inputValue: string;
  setInputValue: (id: string, text: string) => void;
  isFocused: boolean;
  onFocus: (id: string) => void;
  onBlur: (id: string) => void;
  isFlashing: boolean;
  deleteToRecycle: (id: string) => void;
  renderSwipeLeft: (prog: any, drag: any) => ReactNode;
  styles: any;
  theme: Theme;
  handleUpdatePiggy: (id: string, amount: number, isAdd: boolean) => void;
  isSelected: boolean;
}

interface PiggyGoalInputProps {
  handleSavePiggyGoal: (name: string, target: string) => void;
  styles: any;
  theme: Theme;
  inputRef: RefObject<TextInput | null>;
}

interface PiggyBankSubtabProps {
  piggyGoalItems: Todo[];
  focusedGoalId: string | null;
  setFocusedGoalId: Dispatch<SetStateAction<string | null>>;
  flashingGoalId: string | null;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
  handleSavePiggyGoal: (name: string, target: string) => void;
  handleUpdatePiggy: (id: string, amount: number, isAdd: boolean) => void;
  handleScroll: (event: any) => void;
  flatListRef: RefObject<FlatList<Todo> | null>;
  deleteToRecycle: (id: string) => void;
  renderSwipeLeft: (prog: any, drag: any) => ReactNode;
  styles: any;
  theme: Theme;
  piggyInputs: Record<string, string>;
  setPiggyInputs: Dispatch<SetStateAction<Record<string, string>>>;
  selectedTaskId: string | null;
  isActive: boolean;
}

const PiggyBankItem = memo(({
  item,
  inputValue,
  setInputValue,
  isFocused,
  onFocus,
  onBlur,
  isFlashing,
  deleteToRecycle,
  renderSwipeLeft,
  styles,
  theme,
  handleUpdatePiggy,
  isSelected,
}: PiggyBankItemProps) => {
  const handleKeyPress = useCallback((e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent?.key === 'Escape') {
      e.stopPropagation();
      Keyboard.dismiss();
    }
  }, []);

  const handleSwipeOpen = useCallback(() => {
    deleteToRecycle(item.id);
  }, [item.id, deleteToRecycle]);

  const renderSwipe = useCallback((prog: any, drag: any) => {
    return renderSwipeLeft(prog, drag);
  }, [renderSwipeLeft]);

  const handleFocus = useCallback(() => {
    onFocus(item.id);
  }, [item.id, onFocus]);

  const handleInputBlur = useCallback(() => {
    onBlur(item.id);
  }, [item.id, onBlur]);

  const handleTextChange = useCallback((text: string) => {
    const filtered = text.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
    setInputValue(item.id, filtered);
  }, [item.id, setInputValue]);

  const handleSubmit = useCallback(() => {
    const inputVal = parseInt(inputValue, 10) || 0;
    if (inputVal !== 0) {
      handleUpdatePiggy(item.id, inputVal, true);
      setInputValue(item.id, '');
    }
  }, [item.id, inputValue, handleUpdatePiggy, setInputValue]);

  const isCompleted = (item.progressNow || 0) >= item.progressEnd;
  const progressPercent = isCompleted
    ? 100
    : Math.max(0, Math.min(99, Math.floor(((Number(item.progressNow) || 0) / Number(item.progressEnd)) * 100)));

  return (
    <Swipeable
      friction={1.6}
      leftThreshold={78}
      overshootLeft={true}
      renderLeftActions={renderSwipe}
      onSwipeableLeftOpen={handleSwipeOpen}
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
        styles.piggyCardCompact,
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
        <View style={styles.piggyCardHeader}>
          <Text style={styles.piggyTitleText}>
            {item.text}
          </Text>
          <View style={styles.piggyCardProgressBarTrack}>
            <View style={[
              styles.piggyCardProgressBarFill,
              { width: `${progressPercent}%` }
            ]} />
          </View>
        </View>
        <View>
          <View style={styles.piggyRowOne}>
            <View style={styles.piggyLeftColumnCompact}>
              <View style={styles.piggyTargetBadge}>
                <Text style={styles.piggyTargetTextCompact} numberOfLines={1} adjustsFontSizeToFit={true}>
                  {item.progressEnd}
                </Text>
              </View>
              <View style={styles.piggyVerticalDivider} />
            </View>
            <View style={styles.piggyCenterColumnCompact}>
              <View style={[
                styles.piggyCurrentContainerCompact,
                isCompleted && styles.piggyCurrentContainerCompactCompleted,
                isFlashing && { borderColor: theme.colors.icon.primary }
              ]}>
                <Text style={[
                  styles.piggyCurrentTextCompact,
                  (isCompleted || isFlashing) && { color: theme.colors.icon.primary }
                ]} numberOfLines={1} adjustsFontSizeToFit={true}>
                  {item.progressNow || 0}
                </Text>
              </View>
            </View>
            <View style={styles.piggyRightColumnCompact}>
              <TextInput
                style={[
                  styles.piggyInputCompact,
                  isFocused && styles.piggyInputCompactFocused,
                  isCompleted && { backgroundColor: theme.colors.icon.bg },
                  isFlashing && { borderColor: theme.colors.icon.primary }
                ]}
                placeholder=""
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                cursorColor={theme.colors.icon.primary}
                selectionColor={theme.colors.icon.primary}
                value={inputValue}
                onChangeText={handleTextChange}
                onFocus={handleFocus}
                onBlur={handleInputBlur}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                onKeyPress={handleKeyPress}
              />
              {!inputValue && !isFocused && (
                <View style={styles.piggyInputCoinsPlaceholder} pointerEvents="none">
                  {isCompleted ? (
                    <>
                      <MaterialIcons name="add-shopping-cart" size={22} color={theme.colors.icon.primary} style={{ marginRight: 2 }} />
                      <MaterialIcons name="store" size={27} color={theme.colors.icon.primary} />
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="plus" size={12} color={theme.colors.icon.bg} style={{ marginRight: 4 }} />
                      <FontAwesome5 name="coins" size={18} color={theme.colors.icon.bg} />
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  );
});

const PiggyGoalInput = memo(({
  handleSavePiggyGoal,
  styles,
  theme,
  inputRef,
}: PiggyGoalInputProps) => {
  const [piggyGoal, setPiggyGoal] = useState('');
  const [piggyTarget, setPiggyTarget] = useState('');
  const targetInputRef = useRef<TextInput>(null);
  const { t } = useTranslation();

  const handleKeyPress = useCallback((e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent?.key === 'Escape') {
      e.stopPropagation();
      Keyboard.dismiss();
    }
  }, []);

  const handleSaveGoal = useCallback(() => {
    if (!piggyGoal.trim() || !piggyTarget.trim()) return;
    handleSavePiggyGoal(piggyGoal, piggyTarget);
    setPiggyGoal('');
    setPiggyTarget('');
  }, [piggyGoal, piggyTarget, handleSavePiggyGoal]);

  return (
    <View style={styles.piggyInputRowContainer}>
      <View style={styles.piggyInputColumn}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { flex: 0, width: '100%', marginBottom: 0 }]}
          placeholder={t('rpg_piggy_title_placeholder')}
          placeholderTextColor="#94A3B8"
          cursorColor={theme.colors.icon.primary}
          selectionColor={theme.colors.icon.primary}
          value={piggyGoal}
          onChangeText={setPiggyGoal}
          onSubmitEditing={() => targetInputRef.current?.focus()}
          returnKeyType="next"
          blurOnSubmit={false}
          onKeyPress={handleKeyPress}
        />
        <TextInput
          ref={targetInputRef}
          style={[styles.input, { flex: 0, width: '100%', marginBottom: 0 }]}
          placeholder={t('rpg_piggy_target_placeholder')}
          placeholderTextColor="#94A3B8"
          cursorColor={theme.colors.icon.primary}
          selectionColor={theme.colors.icon.primary}
          keyboardType="numeric"
          value={piggyTarget}
          onChangeText={setPiggyTarget}
          onSubmitEditing={handleSaveGoal}
          returnKeyType="done"
          onKeyPress={handleKeyPress}
        />
      </View>
      <TouchableOpacity style={styles.piggyCreateRightButton} onPress={handleSaveGoal}>
        <Text style={styles.piggyCreateRightButtonText}>{t('rpg_piggy_create')}</Text>
      </TouchableOpacity>
    </View>
  );
});

export const PiggyBankSubtab = memo(({
  piggyGoalItems,
  focusedGoalId,
  setFocusedGoalId,
  flashingGoalId,
  isKeyboardVisible,
  keyboardHeight,
  handleSavePiggyGoal,
  handleUpdatePiggy,
  handleScroll,
  flatListRef,
  deleteToRecycle,
  renderSwipeLeft,
  styles,
  theme,
  piggyInputs,
  setPiggyInputs,
  selectedTaskId,
  isActive,
}: PiggyBankSubtabProps) => {
  const inputRef = useRef<TextInput>(null);
  const { t } = useTranslation();

  useInputFocus('rpg', () => inputRef.current?.focus(), isActive);

  useEffect(() => {
    if (!selectedTaskId || !flatListRef?.current) return;
    const index = piggyGoalItems.findIndex(item => item.id === selectedTaskId);
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
            offset: index * 150,
            animated: true,
          });
        } catch (innerErr) {
          console.log('Scroll to selected piggy bank item failed:', innerErr);
        }
      }
    }
  }, [selectedTaskId, piggyGoalItems, flatListRef]);

  const handleInputChange = useCallback((id: string, text: string) => {
    setPiggyInputs(prev => ({ ...prev, [id]: text }));
  }, [setPiggyInputs]);

  const handleFocus = useCallback((id: string) => {
    setFocusedGoalId(id);
  }, [setFocusedGoalId]);

  const handleBlur = useCallback((id: string) => {
    setTimeout(() => {
      setFocusedGoalId(currentId => currentId === id ? null : currentId);
    }, 200);
  }, [setFocusedGoalId]);

  const onUpdateClick = useCallback((isAdd: boolean) => {
    if (!focusedGoalId) return;
    const inputVal = parseInt(piggyInputs[focusedGoalId], 10) || 0;
    handleUpdatePiggy(focusedGoalId, inputVal, isAdd);
    setPiggyInputs(prev => ({ ...prev, [focusedGoalId]: '' }));
  }, [focusedGoalId, piggyInputs, handleUpdatePiggy, setPiggyInputs]);

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <PiggyBankItem
      item={item}
      inputValue={piggyInputs[item.id] || ''}
      setInputValue={handleInputChange}
      isFocused={focusedGoalId === item.id}
      onFocus={handleFocus}
      onBlur={handleBlur}
      isFlashing={flashingGoalId === item.id}
      deleteToRecycle={deleteToRecycle}
      renderSwipeLeft={renderSwipeLeft}
      styles={styles}
      theme={theme}
      handleUpdatePiggy={handleUpdatePiggy}
      isSelected={item.id === selectedTaskId}
    />
  ), [piggyInputs, handleInputChange, focusedGoalId, handleFocus, handleBlur, flashingGoalId, deleteToRecycle, renderSwipeLeft, styles, theme, handleUpdatePiggy, selectedTaskId]);

  return (
    <View style={styles.container}>
      <View style={{ marginTop: 10 }} />
      <PiggyGoalInput
        handleSavePiggyGoal={handleSavePiggyGoal}
        styles={styles}
        theme={theme}
        inputRef={inputRef}
      />
      <FlatList
        ref={flatListRef}
        data={piggyGoalItems}
        extraData={selectedTaskId}
        bounces={false}
        overScrollMode="never"
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: isKeyboardVisible ? keyboardHeight : 0 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={renderItem}
      />
      {isKeyboardVisible && focusedGoalId && (
        <View style={[styles.piggyFloatingContainer, {
          bottom: keyboardHeight - 71,
        }]}>
          <TouchableOpacity
            style={[styles.piggyFloatingBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' }]}
            onPress={() => onUpdateClick(false)}
          >
            <MaterialCommunityIcons name="minus" size={20} color="#EF4444" />
            <Text style={[styles.piggyFloatingBtnText, { color: '#EF4444' }]}>{t('rpg_piggy_deduct')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.piggyFloatingBtn, { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: '#34D399' }]}
            onPress={() => onUpdateClick(true)}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#34D399" />
            <Text style={[styles.piggyFloatingBtnText, { color: '#34D399' }]}>{t('rpg_piggy_deposit')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});
