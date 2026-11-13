import { View, Text, TouchableOpacity } from 'react-native';
import { TextInput as PaperInput } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { AuthStorage, type AuthMode } from '../../utils/storage';
import { SectionStyleProps } from './types';

interface AccountSectionProps extends SectionStyleProps {
  authMode: AuthMode;
  handleLogout: () => void;
  setAuthState: (state: string) => void;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
}

/** Карточка профиля: облачный аккаунт или локальный режим. */
export const AccountSection = ({
  authMode,
  handleLogout,
  setAuthState,
  setUsername,
  setPassword,
  styles,
  theme,
  t,
}: AccountSectionProps) => {
  return (
    <View style={styles.card}>
      {authMode === 'auth' ? (
        <View style={styles.profileRow}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileTitle}>{t('set_account_title')}</Text>
            <Text style={styles.profileUsername}>
              {AuthStorage.getUsername() || t('set_default_user')}
            </Text>
            <View style={styles.syncBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.syncText}>{t('set_cloud_active')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <MaterialCommunityIcons
              name="logout"
              size={18}
              color={theme.colors.icon.primary}
            />
            <Text style={styles.logoutButtonText}>{t('set_logout')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.localProfileContainer}>
          <View style={styles.localProfileHeader}>
            <MaterialCommunityIcons
              name="cloud-off-outline"
              size={24}
              color={theme.colors.text.secondary}
            />
            <Text style={styles.cardTitle}>{t('set_profile_local')}</Text>
          </View>
          <View style={styles.authButtonsRow}>
            <TouchableOpacity
              testID="auth-login"
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
              testID="auth-register"
              style={styles.secondaryAuthButton}
              onPress={() => {
                setAuthState('register');
                setUsername('');
                setPassword('');
              }}
            >
              <Text style={styles.secondaryAuthButtonText}>
                {t('set_register')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

interface AuthFormSectionProps extends SectionStyleProps {
  authState: string;
  setAuthState: (state: string) => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isPasswordVisible: boolean;
  setPasswordVisible: (visible: boolean) => void;
  handleLogin: () => void;
  handleRegister: () => void;
}

/** Форма входа и регистрации. */
export const AuthFormSection = ({
  authState,
  setAuthState,
  username,
  setUsername,
  password,
  setPassword,
  isPasswordVisible,
  setPasswordVisible,
  handleLogin,
  handleRegister,
  styles,
  theme,
  t,
}: AuthFormSectionProps) => {
  return (
    <View style={[styles.card, styles.authCard]}>
      <TouchableOpacity
        onPress={() => setAuthState('')}
        style={styles.cornerBackButton}
        activeOpacity={0.6}
      >
        <Ionicons
          name="arrow-back"
          size={26}
          color={theme.colors.icon.primary}
        />
      </TouchableOpacity>
      <Text style={styles.authTitle}>
        {authState === 'login' ? t('set_login_title') : t('set_register')}
      </Text>
      <View style={styles.formContainer}>
        <PaperInput
          testID="auth-username"
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
          left={
            <PaperInput.Icon icon="account" color={theme.colors.icon.primary} />
          }
          placeholderTextColor={theme.colors.text.muted}
        />
        <PaperInput
          testID="auth-password"
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
          testID="auth-submit"
          onPress={authState === 'login' ? handleLogin : handleRegister}
          style={styles.submitAuthButton}
        >
          <Text style={styles.submitAuthButtonText}>
            {authState === 'login' ? t('set_login') : t('set_create_account')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            setAuthState(authState === 'login' ? 'register' : 'login')
          }
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
  );
};
