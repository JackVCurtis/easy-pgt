import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { unlockGate } from '@/app/security/unlockGate';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';

export default function LockScreen() {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => {
        subscription.remove();
      };
    }, [])
  );

  const onRetry = async () => {
    setIsRetrying(true);
    setErrorMessage(null);

    const result = await unlockGate();

    if (result.status === 'unlocked') {
      router.replace('/handshake');
      return;
    }

    setErrorMessage('Unlock was canceled or failed. Keep app state locked until authentication succeeds.');
    setIsRetrying(false);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">App Locked</ThemedText>
      <ThemedText>
        Authenticate with your device security before decrypting and loading sensitive app state.
      </ThemedText>
      {errorMessage ? <ThemedText style={styles.error}>{errorMessage}</ThemedText> : null}
      <AppButton label="Retry Unlock" onPress={() => void onRetry()} loading={isRetrying} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 16,
  },
  error: {
    color: '#d13f3f',
  },
});
