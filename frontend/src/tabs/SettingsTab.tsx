import { View, ScrollView } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useSettingsController } from './settings/useSettingsController';
import { AccountSection, AuthFormSection } from './settings/AccountSection';
import { ServerSection } from './settings/ServerSection';
import { LanguageSection, ThemeSection } from './settings/AppearanceSection';
import {
  StartPageSection,
  TrashSection,
  ResetSection,
} from './settings/BehaviorSection';
import {
  ResetTimeSection,
  DailyConfigSection,
} from './settings/DailyConfigSection';
import { ShortcutsSection } from './settings/ShortcutsSection';
import { AboutSection } from './settings/AboutSection';
import { DailiesEditor } from './settings/DailiesEditor';
import { isWeb } from '../platform';

export const SettingsTab = () => {
  const c = useSettingsController();
  const showMain = c.authState === '';

  if (c.subView === 'dailies') {
    const dailies = (c.todoList || []).filter(
      item => item.type === 'daily' && !item.deleted,
    );

    return (
      <PaperProvider>
        <DailiesEditor
          dailies={dailies}
          onBack={() => c.setSubView(null)}
          handleToggleDay={c.handleToggleDay}
          handleChangeProgressEnd={c.handleChangeProgressEnd}
          handleDeleteDaily={c.handleDeleteDaily}
          styles={c.styles}
          itemStyles={c.itemStyles}
          theme={c.theme}
          t={c.t}
        />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <View style={{ flex: 1, backgroundColor: c.theme.colors.background }}>
        <ScrollView
          contentContainerStyle={
            c.authState !== ''
              ? [
                  c.styles.scrollContainer,
                  { flexGrow: 1, justifyContent: 'center' },
                ]
              : c.styles.scrollContainer
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {showMain && (
            <AccountSection
              authMode={c.authMode}
              handleLogout={c.handleLogout}
              setAuthState={c.setAuthState}
              setUsername={c.setUsername}
              setPassword={c.setPassword}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <ServerSection
              serverUrlInput={c.serverUrlInput}
              setServerUrlInput={c.setServerUrlInput}
              handleSaveServerUrl={c.handleSaveServerUrl}
              handleResetServerUrl={c.handleResetServerUrl}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {!showMain && (
            <AuthFormSection
              authState={c.authState}
              setAuthState={c.setAuthState}
              username={c.username}
              setUsername={c.setUsername}
              password={c.password}
              setPassword={c.setPassword}
              isPasswordVisible={c.isPasswordVisible}
              setPasswordVisible={c.setPasswordVisible}
              handleLogin={c.handleLogin}
              handleRegister={c.handleRegister}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <LanguageSection
              settings={c.settings}
              handleLanguageChange={c.handleLanguageChange}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <ResetTimeSection
              hours={c.hours}
              minutes={c.minutes}
              changeHours={c.changeHours}
              changeMinutes={c.changeMinutes}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <StartPageSection
              settings={c.settings}
              updateSetting={c.updateSetting}
              activeRpgSubtab={c.activeRpgSubtab}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <ThemeSection
              settings={c.settings}
              handleThemeChange={c.handleThemeChange}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <TrashSection
              settings={c.settings}
              updateSetting={c.updateSetting}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <ResetSection
              settings={c.settings}
              updateSetting={c.updateSetting}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <DailyConfigSection
              onEditDailies={() => c.setSubView('dailies')}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && isWeb && (
            <ShortcutsSection
              settings={c.settings}
              recordingKey={c.recordingKey}
              setRecordingKey={c.setRecordingKey}
              updateSetting={c.updateSetting}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
          {showMain && (
            <AboutSection
              handleDonate={c.handleDonate}
              styles={c.styles}
              theme={c.theme}
              t={c.t}
            />
          )}
        </ScrollView>
        <Toast />
      </View>
    </PaperProvider>
  );
};
