import { useState, useEffect } from 'react';
import { Keyboard, Platform, BackHandler, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import {
  AuthStorage,
  TodoStorage,
  RpgStorage,
  UserSettings,
  ShortcutSettings,
  Todo,
  Language,
  ThemeName,
  DEFAULT_SHORTCUTS,
  getDefaultSettings
} from '../../utils/storage';
import { socket, updateSocketUrlAndReconnect } from '../../utils/socket';
import { emitRaw, on } from '../../contract/socket';
import { ClientEvent, ServerEvent } from '../../contract/events';
import { send, setSyncMode, clear as clearSync } from '../../sync';
import { useAppTheme, useStyles } from '../../theme/ThemeContext';
import { useTranslation } from '../../utils/LanguageContext';
import { translations } from '../../utils/translations';
import { useAppStore, type MainTab } from '../../store/appStore';
import { getStyles } from '../SettingsTab.styles';
import { getStyles as getItemStyles } from '../../styles/item.styles';
import {
  eventToCombination,
  findShortcutConflict,
  formatShortcut,
  useScope,
  useShortcutRecorder,
} from '../../commands';

/**
 * Вся логика экрана настроек: авторизация, сервер, тема/язык, время сброса,
 * шорткаты и редактирование daily. Секции остаются презентационными.
 */
export const useSettingsController = () => {
  const authMode = useAppStore(state => state.authMode);
  const setAuthMode = useAppStore(state => state.setAuthMode);
  const authState = useAppStore(state => state.authState);
  const setAuthState = useAppStore(state => state.setAuthState);
  const settings = useAppStore(state => state.settings);
  const setSettings = useAppStore(state => state.setSettings);
  const setTodoList = useAppStore(state => state.setTodoList);
  const setRpgHistory = useAppStore(state => state.setRpgHistory);
  const setMainTab = useAppStore(state => state.setMainTab);
  const todoList = useAppStore(state => state.todoList);
  const editTask = useAppStore(state => state.editTask);
  const styles = useStyles(getStyles);
  const itemStyles = useStyles(getItemStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => AuthStorage.getServerUrl() || '');
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutSettings | null>(null);
  const [subView, setSubView] = useState<'dailies' | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android' && subView) {
      const handleBackPress = () => {
        setSubView(null);
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => {
        subscription.remove();
      };
    }
  }, [subView]);

  useEffect(() => {
    if (!authMode) {
      setAuthMode('local');
    }

    const handleAuthMessage = (
      data: { status: 'success' | 'error' | 'info'; message: string }
    ) => {
      if (data.status === 'success') {
        setUsername('');
        setPassword('');
      }

      Toast.show({
        type: data.status,
        text1: data.message,
        visibilityTime: 3000
      });
    };

    return on(ServerEvent.AUTH_MESSAGE, handleAuthMessage);
  }, [authMode, setAuthMode]);

  useEffect(() => {
    if ((authState === 'login' || authState === 'register') && !socket.connected) {
      socket.connect();
    }
  }, [authState]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated: UserSettings = {
      ...settings, [key]: value,
      updatedAt: Date.now()
    } as UserSettings;
    setSettings(updated);
    AuthStorage.setSettings(updated);
    // В local-режиме настройки копятся в outbox и уходят при логине.
    send(ClientEvent.UPDATE_SETTINGS, updated);
    if (key === 'main_page') {
      setMainTab(value as MainTab);
    }
  };

  const handleSaveServerUrl = () => {
    Keyboard.dismiss();
    const url = serverUrlInput.trim();
    if (!url) {
      Toast.show({
        type: 'error',
        text1: t('set_toast_url_err'),
        visibilityTime: 3000
      });
      return;
    }

    let formattedUrl = url;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'http://' + formattedUrl;
    }

    updateSocketUrlAndReconnect(formattedUrl);
    setServerUrlInput(formattedUrl);

    Toast.show({
      type: 'success',
      text1: t('set_toast_server_saved'),
      text2: t('set_toast_reconnect', { url: formattedUrl }),
      visibilityTime: 3000
    });
  };

  const handleResetServerUrl = () => {
    Keyboard.dismiss();
    updateSocketUrlAndReconnect('');
    setServerUrlInput('');

    Toast.show({
      type: 'success',
      text1: t('set_toast_server_reset'),
      text2: t('set_toast_reconnect', { url: process.env.EXPO_PUBLIC_SOCKET_URL || '' }),
      visibilityTime: 3000
    });
  };

  const handleLogin = () => {
    if (username && password) {
      Keyboard.dismiss();
      emitRaw(ClientEvent.LOGIN, { username, password });
    }
  };

  const handleRegister = () => {
    if (username && password) {
      Keyboard.dismiss();
      emitRaw(ClientEvent.REGISTER, { username, password });
    }
  };

  const handleLogout = () => {
    emitRaw(ClientEvent.LOGOUT, undefined);
    socket.auth = {};
    socket.disconnect();
    setSyncMode('local');
    clearSync();

    AuthStorage.logout();
    setAuthMode('local');
    setAuthState('');
    setUsername('');
    setPassword('');

    if (setTodoList) {
      setTodoList([]);
      TodoStorage.saveAll([]);
    }
    if (setRpgHistory) {
      setRpgHistory([]);
      RpgStorage.saveHistory([]);
    }

    const defaults = getDefaultSettings();
    setSettings(defaults);
  };

  const handleDonate = () => {
    Linking.openURL('https://www.donationalerts.com/r/tohellforthem').catch(() => {
      Toast.show({
        type: 'error',
        text1: t('set_toast_link_err'),
        visibilityTime: 2500
      });
    });
  };

  useScope('settings.recording', recordingKey !== null);

  useShortcutRecorder(recordingKey !== null, event => {
    if (!recordingKey) return false;

    if (event.key === 'Escape' || event.code === 'Escape') {
      setRecordingKey(null);
      return true;
    }

    const combination = eventToCombination(event);
    if (!combination) return false;

    const currentShortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;
    const conflict = findShortcutConflict(currentShortcuts, combination, recordingKey);
    if (conflict) {
      Toast.show({
        type: 'error',
        text1: t('set_shortcut_conflict'),
        text2: formatShortcut(combination),
        visibilityTime: 2000
      });
      return true;
    }

    updateSetting('shortcuts', {
      ...currentShortcuts,
      [recordingKey]: combination
    });
    setRecordingKey(null);

    Toast.show({
      type: 'success',
      text1: t('set_shortcut_changed'),
      text2: formatShortcut(combination),
      visibilityTime: 2000
    });
    return true;
  });

  const handleThemeChange = (newTheme: ThemeName) => {
    updateSetting('theme', newTheme);
    Toast.show({
      type: 'success',
      text1: t('set_toast_theme'),
      visibilityTime: 2000
    });
  };

  const handleLanguageChange = (newLang: Language) => {
    updateSetting('language', newLang);
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: (translations[newLang] || translations.ru).set_toast_lang,
        visibilityTime: 2000
      });
    }, 100);
  };

  const resetTimeStr = settings?.reset_time || '00:00';
  const [hStr, mStr] = resetTimeStr.split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;

  const changeHours = (delta: number) => {
    const newHours = (hours + delta + 24) % 24;
    updateSetting('reset_time', `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  };

  const changeMinutes = (delta: number) => {
    const newMinutes = (minutes + delta + 60) % 60;
    updateSetting('reset_time', `${hours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`);
  };

  const activeRpgSubtab = (settings?.rpg_subtab === 'habits' || settings?.rpg_subtab === 'piggy_bank' || settings?.rpg_subtab === 'tv_shows')
    ? settings.rpg_subtab
    : null;

  const handleToggleDay = (item: Todo, idx: number) => {
    const daysArr = (item.days || '1111111').split('');
    daysArr[idx] = daysArr[idx] === '1' ? '0' : '1';
    if (daysArr.every(x => x === '0')) return;
    const updatedDays = daysArr.join('');
    if (editTask) {
      editTask(item.id, { days: updatedDays });
    }
  };

  const handleChangeProgressEnd = (item: Todo, delta: number) => {
    const nextVal = Math.max(1, Math.min(20, (Number(item.progressEnd) || 1) + delta));
    if (editTask) {
      editTask(item.id, { progressEnd: nextVal });
    }
  };

  const handleDeleteDaily = (item: Todo) => {
    if (editTask) {
      editTask(item.id, { deleted: true });
    }
  };

  return {
    authMode,
    authState,
    setAuthState,
    settings,
    todoList,
    styles,
    itemStyles,
    theme,
    t,
    username,
    setUsername,
    password,
    setPassword,
    isPasswordVisible,
    setPasswordVisible,
    serverUrlInput,
    setServerUrlInput,
    handleSaveServerUrl,
    handleResetServerUrl,
    handleLogin,
    handleRegister,
    handleLogout,
    handleDonate,
    updateSetting,
    recordingKey,
    setRecordingKey,
    handleThemeChange,
    handleLanguageChange,
    hours,
    minutes,
    changeHours,
    changeMinutes,
    activeRpgSubtab,
    subView,
    setSubView,
    handleToggleDay,
    handleChangeProgressEnd,
    handleDeleteDaily,
  };
};
