import * as SecureStore from 'expo-secure-store';

import type { PermissionCheckResult } from '@/app/onboarding/bluetoothPermission';
import { getSecureStorageCapabilities } from '@/app/security/secureStorageCapabilities';
import { setSecureStorageMode } from '@/app/security/secureStorage';

const PROBE_KEY = 'comrades.onboarding.secure-store.probe.v1';
const PROBE_VALUE = 'ok';

const PROBE_AUTH_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock your device to verify secure storage access for Comrades.',
};

export async function probeSecureStoreReadiness(): Promise<PermissionCheckResult> {
  const capabilities = await getSecureStorageCapabilities();

  if (!capabilities.secureStoreAvailable) {
    await setSecureStorageMode('defer-sensitive-persistence');
    return {
      status: 'blocked',
      errorMessage: 'Secure key storage is unavailable on this device.',
    };
  }

  if (capabilities.recommendedMode === 'secure-store-without-auth') {
    await setSecureStorageMode('secure-store-without-auth');
    return {
      status: 'granted',
      errorMessage:
        'Secure lock screen / biometrics are not configured. Continuing with secure storage without OS authentication prompts.',
    };
  }

  await setSecureStorageMode('authenticated-secure-store');

  try {
    await SecureStore.setItemAsync(PROBE_KEY, PROBE_VALUE, PROBE_AUTH_OPTIONS);
    const value = await SecureStore.getItemAsync(PROBE_KEY, PROBE_AUTH_OPTIONS);
    await SecureStore.deleteItemAsync(PROBE_KEY);

    if (value !== PROBE_VALUE) {
      return {
        status: 'blocked',
        errorMessage: 'Secure key storage probe failed. Please retry.',
      };
    }

    return { status: 'granted' };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    if (message.includes('not available') || message.includes('unavailable')) {
      return {
        status: 'blocked',
        errorMessage: 'Secure key storage is unavailable on this device.',
      };
    }

    if (
      message.includes('cancel') ||
      message.includes('canceled') ||
      message.includes('cancelled') ||
      message.includes('denied') ||
      message.includes('not authenticated') ||
      message.includes('authentication') ||
      message.includes('biometric') ||
      message.includes('passcode')
    ) {
      return {
        status: 'denied',
        errorMessage: 'Secure key storage permission was denied by the OS.',
      };
    }

    return {
      status: 'denied',
      errorMessage: 'Secure key storage permission was denied by the OS.',
    };
  }
}
