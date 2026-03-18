import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { persistSecureAppState } from '@/app/state/secureStatePersistence';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function isPersistenceTriggerState(nextAppState: AppStateStatus): boolean {
  return nextAppState === 'background' || nextAppState === 'inactive';
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const persistSecureState = () => {
      void persistSecureAppState().catch((error) => {
        console.warn('Secure state persistence failed', error);
      });
    };

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (isPersistenceTriggerState(nextAppState)) {
        persistSecureState();
      }
    });

    const blurSubscription = AppState.addEventListener('blur', () => {
      persistSecureState();
    });

    return () => {
      appStateSubscription.remove();
      blurSubscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
