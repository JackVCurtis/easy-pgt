import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { requestDeviceAuthenticationPrompt } from '@/app/security/secureStorageContract';
import { unloadSensitiveAppState } from '@/app/state/appState';
import { hydrateSecureAppState } from '@/app/state/secureStatePersistence';

export type DeviceAuthenticationResult = {
  status: 'success' | 'failed' | 'canceled';
};

export type UnlockGateResult = {
  status: 'unlocked' | 'locked';
  reason?: 'auth_failed' | 'auth_canceled' | 'hydrate_failed';
};

export type UnlockGateOptions = {
  authenticate?: () => Promise<DeviceAuthenticationResult>;
  hydrateState?: () => Promise<void>;
  unloadState?: () => void;
};

function isCanceledAuthenticationError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('cancel') || message.includes('declined') || message.includes('dismissed');
}

export async function performDeviceAuthentication(): Promise<DeviceAuthenticationResult> {
  try {
    const promptResult = await requestDeviceAuthenticationPrompt();
    if (promptResult.status === 'canceled') {
      return { status: 'canceled' };
    }

    if (promptResult.status === 'failed') {
      return { status: 'failed' };
    }

    await getOrCreateAppDataEncryptionKey();
    return { status: 'success' };
  } catch (error) {
    if (isCanceledAuthenticationError(error)) {
      return { status: 'canceled' };
    }

    return { status: 'failed' };
  }
}

export async function unlockGate(options: UnlockGateOptions = {}): Promise<UnlockGateResult> {
  const authenticate = options.authenticate ?? performDeviceAuthentication;
  const hydrateState = options.hydrateState ?? hydrateSecureAppState;
  const unloadState = options.unloadState ?? unloadSensitiveAppState;

  const authenticationResult = await authenticate();

  if (authenticationResult.status === 'canceled') {
    unloadState();
    return { status: 'locked', reason: 'auth_canceled' };
  }

  if (authenticationResult.status === 'failed') {
    unloadState();
    return { status: 'locked', reason: 'auth_failed' };
  }

  try {
    await hydrateState();
    return { status: 'unlocked' };
  } catch (error) {
    console.warn('Secure state hydration failed during unlock gate', error);
    unloadState();
    return { status: 'locked', reason: 'hydrate_failed' };
  }
}
