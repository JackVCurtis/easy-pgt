import type { PermissionCheckResult } from '@/app/onboarding/bluetoothPermission';


function isSecureStoreAuthenticationError(message: string): boolean {
  return (
    message.includes('authentication') ||
    message.includes('authenticated') ||
    message.includes('not authenticated') ||
    message.includes('user canceled') ||
    message.includes('user cancelled') ||
    message.includes('cancel') ||
    message.includes('biometric') ||
    message.includes('passcode') ||
    message.includes('device locked') ||
    message.includes('interaction not allowed')
  );
}

export function mapIdentityInitializationFailure(error: unknown): PermissionCheckResult {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (message.includes('corrupt')) {
    return {
      status: 'blocked',
      errorMessage: 'Stored keypair appears corrupted. Retry initialization.',
    };
  }

  if (message.includes('invalidated') || message.includes('unreadable and was cleared')) {
    return {
      status: 'blocked',
      errorMessage:
        'Protected key material is no longer readable (for example after biometric changes). Re-run onboarding key setup.',
    };
  }

  if (isSecureStoreAuthenticationError(message)) {
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
