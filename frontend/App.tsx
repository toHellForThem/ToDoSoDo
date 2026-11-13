import { ShortcutProvider } from './src/commands';
import { Providers } from './src/app/Providers';
import { AppShell } from './src/app/AppShell';
import { setupPlatform } from './src/platform';

setupPlatform();

export default function App() {
  return (
    <ShortcutProvider>
      <Providers>
        <AppShell />
      </Providers>
    </ShortcutProvider>
  );
}
