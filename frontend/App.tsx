import { Platform, UIManager } from 'react-native';
import { ShortcutProvider } from './src/commands';
import { Providers } from './src/app/Providers';
import { AppShell } from './src/app/AppShell';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  return (
    <ShortcutProvider>
      <Providers>
        <AppShell />
      </Providers>
    </ShortcutProvider>
  );
}
