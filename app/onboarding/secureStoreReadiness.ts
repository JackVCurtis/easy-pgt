import * as SecureStore from 'expo-secure-store';

import type { PermissionCheckResult } from '@/app/onboarding/bluetoothPermission';

const PROBE_KEY = 'comrades.onboarding.secure-store.probe.v1';
const PROBE_VALUE = 'ok';

export async function probeSecureStoreReadiness(): Promise<PermissionCheckResult> {
  try {
    await SecureStore.setItemAsync(PROBE_KEY, PROBE_VALUE);
    const value = await SecureStore.getItemAsync(PROBE_KEY);
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

    return {
      status: 'denied',
      errorMessage: 'Secure key storage permission was denied by the OS.',
    };
  }
}
