import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SecureStorageMode =
  | 'authenticated-secure-store'
  | 'secure-store-without-auth'
  | 'defer-sensitive-persistence';

export type SecureStorageCapabilities = {
  platform: 'android' | 'ios' | 'other';
  secureStoreAvailable: boolean;
  canUseBiometricAuthentication: boolean;
  recommendedMode: SecureStorageMode;
  reason?: string;
};

type SecureStoreCapabilitiesPort = {
  isAvailableAsync: () => Promise<boolean>;
  canUseBiometricAuthentication: () => Promise<boolean>;
};

interface GetSecureStorageCapabilitiesPorts {
  platform?: string;
  secureStore?: SecureStoreCapabilitiesPort;
}

function toSupportedPlatform(platform: string): SecureStorageCapabilities['platform'] {
  if (platform === 'android' || platform === 'ios') {
    return platform;
  }

  return 'other';
}

/**
 * Developer note: requireAuthentication should only be enabled when the device supports
 * authenticated secure storage and onboarding has collected user consent + remediation.
 * Irreplaceable sensitive state must always have a recovery path through onboarding.
 */
export async function getSecureStorageCapabilities(
  ports: GetSecureStorageCapabilitiesPorts = {}
): Promise<SecureStorageCapabilities> {
  const platform = toSupportedPlatform(ports.platform ?? Platform.OS);
  const secureStore = ports.secureStore ?? SecureStore;

  const secureStoreAvailable = await secureStore.isAvailableAsync();
  if (!secureStoreAvailable) {
    return {
      platform,
      secureStoreAvailable: false,
      canUseBiometricAuthentication: false,
      recommendedMode: 'defer-sensitive-persistence',
      reason: 'SecureStore is unavailable on this device.',
    };
  }

  const canUseBiometricAuthentication = platform === 'android' ? await secureStore.canUseBiometricAuthentication() : true;

  if (platform === 'android') {
    if (canUseBiometricAuthentication) {
      return {
        platform,
        secureStoreAvailable,
        canUseBiometricAuthentication,
        recommendedMode: 'authenticated-secure-store',
      };
    }

    return {
      platform,
      secureStoreAvailable,
      canUseBiometricAuthentication,
      recommendedMode: 'secure-store-without-auth',
      reason: 'Secure lock screen or biometric authentication is not configured.',
    };
  }

  return {
    platform,
    secureStoreAvailable,
    canUseBiometricAuthentication,
    recommendedMode: 'authenticated-secure-store',
  };
}
