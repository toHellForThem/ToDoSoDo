import { useState, useEffect, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Keyboard,
  Switch,
  ScrollView,
  Linking,
  Image,
  Platform,
  TextInput,
  BackHandler
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { TextInput as PaperInput, PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getStyles } from './SettingsTab.styles';
import { getStyles as getItemStyles } from '../styles/item.styles';
import {
  AuthStorage,
  TodoStorage,
  RpgStorage,
  UserSettings,
  ShortcutSettings,
  RpgHistoryItem,
  Todo,
  DEFAULT_SHORTCUTS,
  getDefaultSettings
} from '../utils/storage';
import { socket, updateSocketUrlAndReconnect } from '../utils/socket';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { useTranslation } from '../utils/LanguageContext';


interface SettingsTabProps {
  authMode: string;
  setAuthMode: (mode: string) => void;
  authState: string;
  setAuthState: (state: string) => void;
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  setTodoList: (todoList: Todo[]) => void;
  setRpgHistory: (rpg_history: RpgHistoryItem[]) => void;
  setMainTab?: (main_tab: string) => void;
  todoList: Todo[];
  editTask: (id: string, updated_fields: Partial<Todo>) => void;
  leftAction: (prog: any, drag: any, mode: string) => ReactNode;
}

export const SettingsTab = ({
  authMode,
  setAuthMode,
  authState,
  setAuthState,
  settings,
  setSettings,
  setTodoList,
  setRpgHistory,
  setMainTab,
  todoList,
  editTask,
  leftAction
}: SettingsTabProps) => {
  const styles = useStyles(getStyles);
  const itemStyles = useStyles(getItemStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
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

  const formatShortcut = (shortcutStr: string | undefined) => {
    if (!shortcutStr) return '';
    const parts = shortcutStr.split('+');
    const formattedParts = parts.map(part => {
      const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if (part === 'mod') {
        return isMac ? '⌘' : 'Ctrl';
      }
      if (part === 'alt') {
        return isMac ? '⌥' : 'Alt';
      }
      if (part === 'shift') {
        return isMac ? '⇧' : 'Shift';
      }
      return part.toUpperCase();
    });
    return formattedParts.join(' + ');
  };

  const renderKeycaps = (shortcutStr: string | undefined, isRecording: boolean) => {
    if (isRecording) {
      return (
        <View style={[styles.keycap, styles.keycapActive]}>
          <Text style={[styles.keycapText, styles.keycapTextActive]}>
            {t('set_shortcut_press_key')}
          </Text>
        </View>
      );
    }
    if (!shortcutStr) return null;
    const parts = shortcutStr.split('+');
    return (
      <View style={styles.shortcutKeysContainer}>
        {parts.map((part, index) => {
          let text = part;
          const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          if (part === 'mod') {
            text = isMac ? '⌘' : 'Ctrl';
          } else if (part === 'alt') {
            text = isMac ? '⌥' : 'Alt';
          } else if (part === 'shift') {
            text = isMac ? '⇧' : 'Shift';
          } else {
            text = text.toUpperCase();
          }
          return (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {index > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.text.secondary, marginHorizontal: 4 }}>
                  +
                </Text>
              )}
              <View style={styles.keycap}>
                <Text style={styles.keycapText}>{text}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  useEffect(() => {
    if (!recordingKey) return;

    const handleCaptureKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const isMod = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const isShift = e.shiftKey;

      let key = e.key.toLowerCase();
      if (e.code) {
        if (e.code.startsWith('Key')) {
          key = e.code.slice(3).toLowerCase();
        } else if (e.code.startsWith('Digit')) {
          key = e.code.slice(5);
        }
      }

      if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') {
        return;
      }

      const pressedKeys = [];
      if (isMod) pressedKeys.push('mod');
      if (isAlt) pressedKeys.push('alt');
      if (isShift) pressedKeys.push('shift');
      pressedKeys.push(key);
      const combination = pressedKeys.join('+');

      const currentShortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;
      const updatedShortcuts = {
        ...currentShortcuts,
        [recordingKey]: combination
      };
      updateSetting('shortcuts', updatedShortcuts);
      setRecordingKey(null);

      Toast.show({
        type: 'success',
        text1: settings?.language === 'ru' ? 'Горячая клавиша изменена!' : 'Shortcut changed!',
        text2: `${formatShortcut(combination)}`,
        visibilityTime: 2000
      });
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', handleCaptureKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleCaptureKeyDown, true);
      };
    }
  }, [recordingKey, settings]);
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => AuthStorage.getServerUrl() || '');

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
      text1: 'Адрес сервера сохранен!',
      text2: 'Переподключение к ' + formattedUrl,
      visibilityTime: 3000
    });
  };

  const handleResetServerUrl = () => {
    Keyboard.dismiss();
    updateSocketUrlAndReconnect('');
    setServerUrlInput('');

    Toast.show({
      type: 'success',
      text1: 'Адрес сброшен по умолчанию!',
      text2: 'Переподключение к ' + (process.env.EXPO_PUBLIC_SOCKET_URL || ''),
      visibilityTime: 3000
    });
  };

  const handleDonate = () => {
    Linking.openURL('https://www.donationalerts.com/r/tohellforthem').catch(err => {
      Toast.show({
        type: 'error',
        text1: 'Не удалось открыть ссылку',
        visibilityTime: 2500
      });
    });
  };

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

    socket.on('server:auth_message', handleAuthMessage);
    return () => {
      socket.off('server:auth_message', handleAuthMessage);
    };
  }, [authMode, setAuthMode]);

  useEffect(() => {
    if ((authState === 'login' || authState === 'register') && !socket.connected) {
      socket.connect();
    }
  }, [authState]);

  const handleLogin = () => {
    if (username && password) {
      Keyboard.dismiss();
      socket.emit('client:login', { username, password });
    }
  };

  const handleRegister = () => {
    if (username && password) {
      Keyboard.dismiss();
      socket.emit('client:register', { username, password });
    }
  };

  const handleLogout = () => {
    socket.emit('client:logout');
    socket.auth = {};
    socket.disconnect();

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

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated: UserSettings = {
      ...settings, [key]: value,
      updatedAt: Date.now()
    } as UserSettings;
    setSettings(updated);
    AuthStorage.setSettings(updated);
    if (authMode === 'auth') {
      socket.emit('client:update_settings', updated);
    }
    if (key === 'main_page' && setMainTab) {
      setMainTab(value as string);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    updateSetting('theme', newTheme);
    Toast.show({
      type: 'success',
      text1: t('set_toast_theme'),
      visibilityTime: 2000
    });
  };

  const handleLanguageChange = (newLang: string) => {
    updateSetting('language', newLang);
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: newLang === 'ru' ? 'Язык успешно изменен' : 'Language changed successfully',
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

  if (subView === 'dailies') {
    const dailies = (todoList || []).filter(item => item.type === 'daily' && !item.deleted);

    return (
      <PaperProvider>
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
                  onPress={() => setSubView(null)}
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
                  {settings?.language === 'ru' ? 'Редактировать Daily' : 'Edit Daily Tasks'}
                </Text>
              </View>
            </View>
            {dailies.length === 0 ? (
              <View style={{ paddingHorizontal: 20, width: '100%', maxWidth: 600 }}>
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 30, marginBottom: 0 }]}>
                  <MaterialCommunityIcons name="calendar-blank" size={48} color={theme.colors.text.muted} />
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 12 }}>
                    {settings?.language === 'ru' ? 'Нет активных ежедневных задач' : 'No active daily tasks'}
                  </Text>
                </View>
              </View>
            ) : (
              dailies.map(item => {
                const daysStr = item.days || '1111111';
                return (
                  <Swipeable
                    key={item.id}
                    friction={1.6}
                    leftThreshold={78}
                    overshootLeft={true}
                    renderLeftActions={(prog, drag) => leftAction ? leftAction(prog, drag, 'toRecycle') : null}
                    onSwipeableLeftOpen={() => handleDeleteDaily(item)}
                    containerStyle={{
                      paddingTop: 2,
                      paddingBottom: 8,
                      paddingHorizontal: 20,
                      backgroundColor: 'transparent',
                      width: '100%',
                      maxWidth: 600,
                      alignSelf: 'center',
                    }}
                    activeOffsetX={[-15, 15]}
                    failOffsetY={[-15, 15]}
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
                  </Swipeable>
                );
              })
            )}
          </ScrollView>
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView
          contentContainerStyle={authState !== '' ? [styles.scrollContainer, { flexGrow: 1, justifyContent: 'center' }] : styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {authState === '' && (
            <View style={styles.card}>
              {authMode === 'auth' ? (
                <View style={styles.profileRow}>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileTitle}>{t('set_account_title')}</Text>
                    <Text style={styles.profileUsername}>{AuthStorage.getUsername() || t('set_default_user')}</Text>
                    <View style={styles.syncBadge}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.syncText}>{t('set_cloud_active')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <MaterialCommunityIcons name="logout" size={18} color={theme.colors.icon.primary} />
                    <Text style={styles.logoutButtonText}>{t('set_logout')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.localProfileContainer}>
                  <View style={styles.localProfileHeader}>
                    <MaterialCommunityIcons name="cloud-off-outline" size={24} color={theme.colors.text.secondary} />
                    <Text style={styles.cardTitle}>{t('set_profile_local')}</Text>
                  </View>
                  <View style={styles.authButtonsRow}>
                    <TouchableOpacity
                      style={styles.primaryAuthButton}
                      onPress={() => {
                        setAuthState('login');
                        setUsername('');
                        setPassword('');
                      }}
                    >
                      <Text style={styles.primaryAuthButtonText}>{t('set_login')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryAuthButton}
                      onPress={() => {
                        setAuthState('register');
                        setUsername('');
                        setPassword('');
                      }}
                    >
                      <Text style={styles.secondaryAuthButtonText}>{t('set_register')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="server" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_server_config')}</Text>
              </View>
              <View style={{ marginTop: 12 }}>
                <PaperInput
                  placeholder=" http://192.168.1.50:8000"
                  value={serverUrlInput}
                  onChangeText={setServerUrlInput}
                  mode="outlined"
                  outlineColor={theme.colors.border.light}
                  textColor={theme.colors.text.primary}
                  theme={{
                    roundness: theme.radius.lg,
                    colors: {
                      primary: theme.colors.icon.primary,
                    },
                  }}
                  placeholderTextColor={theme.colors.text.muted}
                  style={styles.authInput}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.primaryAuthButton, { flex: 1, height: 40, paddingVertical: 0, justifyContent: 'center' }]}
                    onPress={handleSaveServerUrl}
                  >
                    <Text style={styles.primaryAuthButtonText}>{t('set_save')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryAuthButton, { flex: 1, height: 40, paddingVertical: 0, justifyContent: 'center' }]}
                    onPress={handleResetServerUrl}
                  >
                    <Text style={styles.secondaryAuthButtonText}>{t('set_reset_btn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {authState !== '' && (
            <View style={[styles.card, styles.authCard]}>
              <TouchableOpacity
                onPress={() => setAuthState('')}
                style={styles.cornerBackButton}
                activeOpacity={0.6}
              >
                <Ionicons name="arrow-back" size={26} color={theme.colors.icon.primary} />
              </TouchableOpacity>
              <Text style={styles.authTitle}>
                {authState === 'login' ? t('set_login_title') : t('set_register')}
              </Text>
              <View style={styles.formContainer}>
                <PaperInput
                  placeholder={t('set_username_placeholder')}
                  value={username}
                  onChangeText={setUsername}
                  style={styles.authInput}
                  mode="outlined"
                  outlineColor={theme.colors.border.light}
                  textColor={theme.colors.text.primary}
                  theme={{
                    roundness: theme.radius.lg,
                    colors: {
                      primary: theme.colors.icon.primary,
                    },
                  }}
                  left={<PaperInput.Icon icon="account" color={theme.colors.icon.primary} />}
                  placeholderTextColor={theme.colors.text.muted}
                />
                <PaperInput
                  placeholder={t('set_password_placeholder')}
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  outlineColor={theme.colors.border.light}
                  textColor={theme.colors.text.primary}
                  theme={{
                    roundness: theme.radius.lg,
                    colors: {
                      primary: theme.colors.icon.primary,
                    },
                  }}
                  left={
                    <PaperInput.Icon
                      icon="lock-outline"
                      color={theme.colors.icon.primary}
                    />
                  }
                  right={
                    <PaperInput.Icon
                      icon={isPasswordVisible ? 'eye' : 'eye-off'}
                      onPress={() => setPasswordVisible(!isPasswordVisible)}
                      color={theme.colors.icon.primary}
                    />
                  }
                  secureTextEntry={!isPasswordVisible}
                  style={styles.authInput}
                  placeholderTextColor={theme.colors.text.muted}
                />
                <TouchableOpacity
                  onPress={authState === 'login' ? handleLogin : handleRegister}
                  style={styles.submitAuthButton}
                >
                  <Text style={styles.submitAuthButtonText}>
                    {authState === 'login' ? t('set_login') : t('set_create_account')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAuthState(authState === 'login' ? 'register' : 'login')}
                  style={styles.toggleAuthLink}
                >
                  <Text style={styles.toggleAuthText}>
                    {authState === 'login'
                      ? t('set_no_account')
                      : t('set_have_account')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <Ionicons name="language-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_language')}</Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    (!settings?.language || settings?.language === 'ru') && styles.segmentButtonActive
                  ]}
                  onPress={() => handleLanguageChange('ru')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      (!settings?.language || settings?.language === 'ru') && styles.segmentTextActive
                    ]}
                  >
                    {t('set_lang_ru')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.language === 'en' && styles.segmentButtonActive
                  ]}
                  onPress={() => handleLanguageChange('en')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.language === 'en' && styles.segmentTextActive
                    ]}
                  >
                    {t('set_lang_en')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_reset_time_title')}</Text>
              </View>
              <View style={styles.clockCenterContainer}>
                <View style={styles.compactClock}>
                  <View style={styles.compactClockGroup}>
                    <TouchableOpacity
                      onPress={() => changeHours(-1)}
                      style={[styles.clockControlBtn, styles.clockControlBtnLeft]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="remove" size={22} color={theme.colors.icon.primary} />
                    </TouchableOpacity>
                    <View style={styles.clockValueBg}>
                      <Text style={styles.clockValueLabel}>{t('set_hours')}</Text>
                      <Text style={styles.clockValueText}>
                        {hours.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => changeHours(1)}
                      style={[styles.clockControlBtn, styles.clockControlBtnRight]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="add" size={22} color={theme.colors.icon.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.compactSeparator}>:</Text>
                  <View style={styles.compactClockGroup}>
                    <TouchableOpacity
                      onPress={() => changeMinutes(-5)}
                      style={[styles.clockControlBtn, styles.clockControlBtnLeft]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="remove" size={22} color={theme.colors.icon.primary} />
                    </TouchableOpacity>
                    <View style={styles.clockValueBg}>
                      <Text style={styles.clockValueLabel}>{t('set_minutes')}</Text>
                      <Text style={styles.clockValueText}>
                        {minutes.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => changeMinutes(5)}
                      style={[styles.clockControlBtn, styles.clockControlBtnRight]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="add" size={22} color={theme.colors.icon.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="home-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_start_page')}</Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.main_page === 'rpg' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSetting('main_page', 'rpg')}
                >
                  <MaterialCommunityIcons
                    name="sword-cross"
                    size={16}
                    color={settings?.main_page === 'rpg' ? theme.colors.icon.primary : theme.colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.main_page === 'rpg' && styles.segmentTextActive
                    ]}
                  >
                    {t('tab_rpg')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.main_page === 'todo' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSetting('main_page', 'todo')}
                >
                  <MaterialCommunityIcons
                    name="checkbox-marked-circle-outline"
                    size={16}
                    color={settings?.main_page === 'todo' ? theme.colors.icon.primary : theme.colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.main_page === 'todo' && styles.segmentTextActive
                    ]}
                  >
                    {t('tab_todo')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.main_page === 'daily' && styles.segmentButtonActive
                  ]}
                  onPress={() => updateSetting('main_page', 'daily')}
                >
                  <MaterialCommunityIcons
                    name="calendar-check"
                    size={16}
                    color={settings?.main_page === 'daily' ? theme.colors.icon.primary : theme.colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.main_page === 'daily' && styles.segmentTextActive
                    ]}
                  >
                    {t('tab_daily')}
                  </Text>
                </TouchableOpacity>
              </View>
              {settings?.main_page === 'rpg' && (
                <View style={styles.subtabContainer}>
                  <View style={[styles.cardHeaderWithIcon, { marginTop: 10, marginBottom: 6 }]}>
                    <MaterialCommunityIcons name="layers-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.cardTitle, { fontSize: 13, color: theme.colors.text.secondary }]}>
                      {t('tab_rpg')}
                    </Text>
                  </View>
                  <View style={styles.segmentedControl}>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        activeRpgSubtab === 'habits' && styles.segmentButtonActive
                      ]}
                      onPress={() => updateSetting('rpg_subtab', 'habits')}
                    >
                      <MaterialCommunityIcons
                        name="star-circle-outline"
                        size={14}
                        color={activeRpgSubtab === 'habits' ? theme.colors.icon.primary : theme.colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          activeRpgSubtab === 'habits' && styles.segmentTextActive,
                          { fontSize: 11 }
                        ]}
                      >
                        {t('rpg_menu_habits')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        activeRpgSubtab === 'piggy_bank' && styles.segmentButtonActive
                      ]}
                      onPress={() => updateSetting('rpg_subtab', 'piggy_bank')}
                    >
                      <MaterialCommunityIcons
                        name="piggy-bank-outline"
                        size={14}
                        color={activeRpgSubtab === 'piggy_bank' ? theme.colors.icon.primary : theme.colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          activeRpgSubtab === 'piggy_bank' && styles.segmentTextActive,
                          { fontSize: 11 }
                        ]}
                      >
                        {t('rpg_menu_piggy')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        activeRpgSubtab === 'tv_shows' && styles.segmentButtonActive
                      ]}
                      onPress={() => updateSetting('rpg_subtab', 'tv_shows')}
                    >
                      <MaterialCommunityIcons
                        name="television-play"
                        size={14}
                        color={activeRpgSubtab === 'tv_shows' ? theme.colors.icon.primary : theme.colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          activeRpgSubtab === 'tv_shows' && styles.segmentTextActive,
                          { fontSize: 11 }
                        ]}
                      >
                        {t('rpg_menu_tv')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="palette-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_theme')}</Text>
              </View>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    (!settings?.theme || settings?.theme === 'default') && styles.segmentButtonActive
                  ]}
                  onPress={() => handleThemeChange('default')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      (!settings?.theme || settings?.theme === 'default') && styles.segmentTextActive
                    ]}
                  >
                    {t('set_theme_blue')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.theme === 'mint' && styles.segmentButtonActive
                  ]}
                  onPress={() => handleThemeChange('mint')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.theme === 'mint' && styles.segmentTextActive
                    ]}
                  >
                    {t('set_theme_mint')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.theme === 'pink' && styles.segmentButtonActive
                  ]}
                  onPress={() => handleThemeChange('pink')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.theme === 'pink' && styles.segmentTextActive
                    ]}
                  >
                    {t('set_theme_pink')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    settings?.theme === 'dark' && styles.segmentButtonActive
                  ]}
                  onPress={() => handleThemeChange('dark')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      settings?.theme === 'dark' && styles.segmentTextActive
                    ]}
                  >
                    {t('set_theme_dark')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <View style={styles.cardHeaderWithIcon}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{t('set_trash')}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.text.muted, marginLeft: theme.spacing.sm, marginTop: 2 }}>
                        {t('set_trash_desc')}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch
                  value={settings?.soft_delete !== false}
                  onValueChange={(val) => updateSetting('soft_delete', val)}
                  trackColor={{ false: theme.colors.border.light, true: theme.colors.primaryLight }}
                  thumbColor={settings?.soft_delete !== false ? theme.colors.primary : theme.colors.border.default}
                />
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <View style={styles.cardHeaderWithIcon}>
                    <MaterialCommunityIcons name="history" size={20} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{t('set_reset_card_title')}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.text.muted, marginLeft: theme.spacing.sm, marginTop: 2 }}>
                        {t('set_reset_auto')}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch
                  value={settings?.reset_enabled !== false}
                  onValueChange={(val) => updateSetting('reset_enabled', val)}
                  trackColor={{ false: theme.colors.border.light, true: theme.colors.primaryLight }}
                  thumbColor={settings?.reset_enabled !== false ? theme.colors.primary : theme.colors.border.default}
                />
              </View>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>
                  {settings?.language === 'ru' ? 'Настройка Daily' : 'Daily Tasks Config'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.colors.text.muted, marginLeft: theme.spacing.sm, marginTop: 4, marginBottom: 12 }}>
                {settings?.language === 'ru' ? 'Настройте дни недели и прогресс для ваших ежедневных задач' : 'Configure active weekdays and progress goals for your daily tasks'}
              </Text>
              <TouchableOpacity
                onPress={() => setSubView('dailies')}
                style={[styles.logoutButton, { marginTop: 4, paddingVertical: 10 }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-edit" size={18} color={theme.colors.icon.primary} style={{ marginRight: 6 }} />
                <Text style={styles.logoutButtonText}>
                  {settings?.language === 'ru' ? 'Редактировать Daily' : 'Edit Daily Tasks'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {authState === '' && Platform.OS === 'web' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="keyboard-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_shortcuts_title')}</Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 4, marginBottom: 12 }}>
                {t('set_shortcuts_desc')}
              </Text>
              {(Object.keys(DEFAULT_SHORTCUTS) as Array<keyof ShortcutSettings>).map((key) => (
                <View key={key} style={styles.shortcutRow}>
                  <View style={styles.shortcutInfo}>
                    <Text style={styles.shortcutTitle}>
                      {t(`set_shortcut_action_${key}`)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setRecordingKey(recordingKey === key ? null : key)}
                  >
                    {renderKeycaps(settings?.shortcuts?.[key], recordingKey === key)}
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => {
                  updateSetting('shortcuts', DEFAULT_SHORTCUTS);
                  Toast.show({
                    type: 'success',
                    text1: settings?.language === 'ru' ? 'Шорткаты сброшены' : 'Shortcuts reset',
                    visibilityTime: 2000
                  });
                }}
                style={styles.shortcutResetButton}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="restore" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.shortcutResetButtonText}>
                  {t('set_shortcuts_reset')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {authState === '' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderWithIcon}>
                <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{t('set_about')}</Text>
              </View>
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 8 }}
                />
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text.primary }}>
                  ToDoSoDo
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.text.muted, marginTop: 2, fontWeight: '600' }}>
                  {t('set_about') === 'О программе' ? 'Версия 1.0.2' : 'Version 1.0.2'}
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 10, lineHeight: 18, paddingHorizontal: 10 }}>
                  {t('set_desc')}
                </Text>
                <TouchableOpacity
                  onPress={handleDonate}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F59E0B',
                    borderRadius: theme.radius.md,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    marginTop: 14,
                    width: '100%',
                    elevation: 1,
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="heart-pulse" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('set_support_author')}
                  </Text>
                </TouchableOpacity>
                <View style={{ width: '100%', height: 1, backgroundColor: theme.colors.border.light, marginVertical: 14 }} />
                <Text style={{ fontSize: 11, color: theme.colors.text.muted, fontWeight: '500' }}>
                  Copyright © 2026 toHellForThem. All rights reserved.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
        <Toast />
      </View>
    </PaperProvider>
  );
};