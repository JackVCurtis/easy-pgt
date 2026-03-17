import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

import { __resetLocalAuthenticationCacheForTests, probeSecureStoreReadiness } from '@/app/onboarding/secureStoreReadiness';
import { getSecureStorageCapabilities } from '@/app/security/secureStorageCapabilities';
import { setSecureStorageMode } from '@/app/security/secureStorage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock('@/app/security/secureStorageCapabilities', () => ({
  getSecureStorageCapabilities: jest.fn(),
}));

jest.mock('@/app/security/secureStorage', () => ({
  setSecureStorageMode: jest.fn(async () => undefined),
}));

describe('probeSecureStoreReadiness', () => {
  const mockCapabilities = jest.mocked(getSecureStorageCapabilities);
  const mockSetStorageMode = jest.mocked(setSecureStorageMode);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('ok');
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    __resetLocalAuthenticationCacheForTests();
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true } as LocalAuthentication.LocalAuthenticationResult);
  });

  it('uses authenticated secure-store mode when Android supports biometric auth', async () => {
    mockCapabilities.mockResolvedValueOnce({
      platform: 'android',
      secureStoreAvailable: true,
      canUseBiometricAuthentication: true,
      recommendedMode: 'authenticated-secure-store',
    });

    await expect(probeSecureStoreReadiness()).resolves.toEqual({ status: 'granted' });
    expect(mockSetStorageMode).toHaveBeenCalledWith('authenticated-secure-store');
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('only prompts for local authentication once per unlock session', async () => {
    mockCapabilities.mockResolvedValue({
      platform: 'android',
      secureStoreAvailable: true,
      canUseBiometricAuthentication: true,
      recommendedMode: 'authenticated-secure-store',
    });

    await expect(probeSecureStoreReadiness()).resolves.toEqual({ status: 'granted' });
    await expect(probeSecureStoreReadiness()).resolves.toEqual({ status: 'granted' });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('returns granted with fallback guidance when authenticated Android storage is unavailable', async () => {
    mockCapabilities.mockResolvedValueOnce({
      platform: 'android',
      secureStoreAvailable: true,
      canUseBiometricAuthentication: false,
      recommendedMode: 'secure-store-without-auth',
      reason: 'Secure lock screen or biometric authentication is not configured.',
    });

    await expect(probeSecureStoreReadiness()).resolves.toEqual({
      status: 'granted',
      errorMessage:
        'Secure lock screen / biometrics are not configured. Continuing with secure storage without OS authentication prompts.',
    });

    expect(mockSetStorageMode).toHaveBeenCalledWith('secure-store-without-auth');
  });
});
