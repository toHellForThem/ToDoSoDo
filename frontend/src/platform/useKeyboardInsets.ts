import { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, TextInput } from 'react-native';
import { isIOS } from './platform';

export interface KeyboardInsets {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

interface UseKeyboardInsetsOptions {
  /** Снять фокус после скрытия: web-браузеры иногда оставляют его в поле. */
  blurOnHide?: boolean;
  /** Анимировать перестроение layout при появлении/скрытии клавиатуры. */
  animate?: boolean;
  onShow?: (height: number) => void;
  onHide?: () => void;
}

/**
 * Высота и видимость экранной клавиатуры. На web события клавиатуры RN Web
 * не приходят — высота остаётся 0, и вёрстка не сдвигается.
 */
export const useKeyboardInsets = (
  options: UseKeyboardInsetsOptions = {},
): KeyboardInsets => {
  const { blurOnHide = false, animate = true, onShow, onHide } = options;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const onShowRef = useRef(onShow);
  const onHideRef = useRef(onHide);

  useEffect(() => {
    onShowRef.current = onShow;
  }, [onShow]);

  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
      setKeyboardVisible(true);
      if (animate) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      onShowRef.current?.(event.endCoordinates.height);
    });

    // На iOS клавиатура анимируется раньше, чем приходит `keyboardDidHide`.
    const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      if (blurOnHide) {
        const activeInput = TextInput.State.currentlyFocusedInput();
        if (activeInput) {
          TextInput.State.blurTextInput(activeInput);
        }
      }
      if (animate) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      onHideRef.current?.();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [animate, blurOnHide]);

  return { keyboardHeight, isKeyboardVisible };
};
