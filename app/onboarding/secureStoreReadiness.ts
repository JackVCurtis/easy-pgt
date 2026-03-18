import type { PermissionCheckResult } from '@/app/onboarding/bluetoothPermission';
import { classifySecureStorageError } from '@/app/security/secureStorageErrors';
import {
  assertActiveSecureStorageAuthSession,
  authenticateForSecureStorage,
  createExpoSecureStoreAdapter,
  mapSecureStorageAuthErrorToRetryable,
  type SecureStorageAuthSession,
} from '@/app/security/secureStorageContract';

const SECURE_STORE_PROBE_KEY = 'comrades.onboarding.secure-store.probe';

function mapAuthenticationPromptFailure(message: string): PermissionCheckResult {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('cancel') || normalizedMessage.includes('dismiss')) {
    return {
      status: 'denied',
      errorMessage: 'Device authentication was canceled. Approve secure storage access and retry.',
    };
  }

  if (
    normalizedMessage.includes('unavailable') ||
    normalizedMessage.includes('not configured') ||
    normalizedMessage.includes('not enrolled') ||
    normalizedMessage.includes('no passcode') ||
    normalizedMessage.includes('no foreground activity')
  ) {
    return {
      status: 'blocked',
      errorMessage: 'Secure lock screen / biometrics are not configured for protected secure storage on this device.',
    };
  }

  return {
    status: 'blocked',
    errorMessage: 'Device authentication prerequisites are unavailable for protected secure storage.',
  };
}

export function createSecureStoreReadinessChecker(options: {
  authSession?: SecureStorageAuthSession;
} = {}): () => Promise<PermissionCheckResult> {
  return async () => {
    const secureStore = createExpoSecureStoreAdapter();
    const probeValue = `${Date.now()}`;

    try {
      const authResult = await authenticateForSecureStorage();

      if (authResult.status === 'canceled') {
        return {
          status: 'denied',
          errorMessage: 'Device authentication was canceled. Approve secure storage access and retry.',
        };
      }

      if (authResult.status === 'failed') {
        return mapAuthenticationPromptFailure(authResult.message ?? 'Device authentication failed');
      }

      const authSession = options.authSession ?? authResult.session;
      assertActiveSecureStorageAuthSession(authSession);

      await secureStore.setItem(SECURE_STORE_PROBE_KEY, probeValue);
      const recoveredValue = await secureStore.getItem(SECURE_STORE_PROBE_KEY);

      if (recoveredValue !== probeValue) {
        return {
          status: 'blocked',
          errorMessage: 'Protected secure storage failed the runtime probe. Please retry.',
        };
      }

      return { status: 'granted' };
    } catch (error) {
      const classification = classifySecureStorageError(error);
      const retryableAuthError = mapSecureStorageAuthErrorToRetryable(error);

      if (classification.isAuthenticationRelated || retryableAuthError.message.includes('RETRYABLE')) {
        return {
          status: 'denied',
          errorMessage: 'Unlock your device and approve secure storage access, then retry.',
        };
      }

      if (classification.isInvalidated) {
        return {
          status: 'blocked',
          errorMessage: 'Protected secure storage keys are invalidated. Reconfigure device auth and retry.',
        };
      }

      return {
        status: 'blocked',
        errorMessage: 'Secure key storage is unavailable on this device.',
      };
    } finally {
      try {
        await secureStore.deleteItem(SECURE_STORE_PROBE_KEY);
      } catch {
        // Best-effort cleanup; probe failures are reported above.
      }
    }
  };
}
