import type { PermissionCheckResult } from '@/app/onboarding/bluetoothPermission';
import { classifySecureStorageError } from '@/app/security/secureStorageErrors';

export function mapIdentityInitializationFailure(error: unknown): PermissionCheckResult {
  const classification = classifySecureStorageError(error);
  const { message } = classification;

  if (message.includes('corrupt')) {
    return {
      status: 'blocked',
      errorMessage: 'Stored keypair appears corrupted. Retry initialization.',
    };
  }

  if (classification.isInvalidated) {
    return {
      status: 'blocked',
      errorMessage:
        'Protected key material is no longer readable (for example after biometric changes). Re-run onboarding key setup.',
    };
  }

  if (classification.isAuthenticationRelated) {
    return {
      status: 'denied',
      errorMessage: 'Unlock your device and approve secure storage access, then retry.',
    };
  }

  if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
    return {
      status: 'denied',
      errorMessage: 'OS denied secure key operations. Review permissions and retry.',
    };
  }

  if (message.includes('not available') || message.includes('unavailable')) {
    return {
      status: 'blocked',
      errorMessage: 'Secure key storage is unavailable on this device.',
    };
  }

  return {
    status: 'blocked',
    errorMessage: 'Unable to initialize secure identity keys. Please retry.',
  };
}
