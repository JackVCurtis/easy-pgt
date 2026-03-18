import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { getCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';
import {
  authenticateForSecureStorage,
  mapSecureStorageAuthErrorToRetryable,
  type SecureStorageAuthSession,
} from '@/app/security/secureStorageContract';
import { unloadSensitiveAppState } from '@/app/state/appState';
import { hydrateSecureAppState } from '@/app/state/secureStatePersistence';

export type DeviceAuthenticationResult = {
  status: 'success' | 'failed' | 'canceled';
  encryptionKey?: string;
  authSession?: SecureStorageAuthSession;
};

export type UnlockGateResult = {
  status: 'unlocked' | 'locked';
  reason?: 'auth_failed' | 'auth_canceled' | 'hydrate_failed';
};

export type UnlockGateOptions = {
  authenticate?: () => Promise<DeviceAuthenticationResult>;
  hydrateState?: (params: { encryptionKey?: string; authSession?: SecureStorageAuthSession }) => Promise<void>;
  unloadState?: () => void;
};

let inFlightUnlock: Promise<UnlockGateResult> | null = null;

function isCanceledAuthenticationError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('cancel') || message.includes('declined') || message.includes('dismissed');
}

export async function performDeviceAuthentication(): Promise<DeviceAuthenticationResult> {
  try {
    const cachedEncryptionKey = getCachedAppDataEncryptionKey();
    if (cachedEncryptionKey) {
      return { status: 'success', encryptionKey: cachedEncryptionKey };
    }

    const authResult = await authenticateForSecureStorage();
    if (authResult.status === 'canceled') {
      return { status: 'canceled' };
    }

    if (authResult.status === 'failed' || !authResult.session) {
      return { status: 'failed' };
    }

    const encryptionKey = await getOrCreateAppDataEncryptionKey({ authSession: authResult.session });
    return { status: 'success', encryptionKey, authSession: authResult.session };
  } catch (error) {
    const retryableError = mapSecureStorageAuthErrorToRetryable(error);

    if (isCanceledAuthenticationError(retryableError)) {
      return { status: 'canceled' };
    }

    return { status: 'failed' };
  }
}

export async function unlockGate(options: UnlockGateOptions = {}): Promise<UnlockGateResult> {
  if (inFlightUnlock) {
    return inFlightUnlock;
  }

  const authenticate = options.authenticate ?? performDeviceAuthentication;
  const hydrateState =
    options.hydrateState ??
    (async ({ encryptionKey, authSession }: { encryptionKey?: string; authSession?: SecureStorageAuthSession }) =>
      hydrateSecureAppState({ encryptionKey, authSession }));
  const unloadState = options.unloadState ?? unloadSensitiveAppState;

  inFlightUnlock = (async () => {
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
      await hydrateState({
        encryptionKey: authenticationResult.encryptionKey,
        authSession: authenticationResult.authSession,
      });
      return { status: 'unlocked' };
    } catch (error) {
      console.warn('Secure state hydration failed during unlock gate', error);
      unloadState();
      return { status: 'locked', reason: 'hydrate_failed' };
    }
  })();

  try {
    return await inFlightUnlock;
  } finally {
    inFlightUnlock = null;
  }
}

export function isUnlockInProgress(): boolean {
  return inFlightUnlock !== null;
}
