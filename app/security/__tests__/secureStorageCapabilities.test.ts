import { getSecureStorageCapabilities } from '@/app/security/secureStorageCapabilities';

describe('getSecureStorageCapabilities', () => {
  it('returns defer-sensitive-persistence when secure-store is unavailable', async () => {
    await expect(
      getSecureStorageCapabilities({
        platform: 'android',
        secureStore: {
          isAvailableAsync: jest.fn(async () => false),
          canUseBiometricAuthentication: jest.fn(async () => false),
        },
      })
    ).resolves.toMatchObject({
      platform: 'android',
      secureStoreAvailable: false,
      canUseBiometricAuthentication: false,
      recommendedMode: 'defer-sensitive-persistence',
    });
  });

  it('returns authenticated-secure-store when Android biometric auth is available', async () => {
    await expect(
      getSecureStorageCapabilities({
        platform: 'android',
        secureStore: {
          isAvailableAsync: jest.fn(async () => true),
          canUseBiometricAuthentication: jest.fn(async () => true),
        },
      })
    ).resolves.toMatchObject({
      platform: 'android',
      secureStoreAvailable: true,
      canUseBiometricAuthentication: true,
      recommendedMode: 'authenticated-secure-store',
    });
  });

  it('returns secure-store-without-auth when Android biometric auth is unavailable', async () => {
    await expect(
      getSecureStorageCapabilities({
        platform: 'android',
        secureStore: {
          isAvailableAsync: jest.fn(async () => true),
          canUseBiometricAuthentication: jest.fn(async () => false),
        },
      })
    ).resolves.toMatchObject({
      platform: 'android',
      secureStoreAvailable: true,
      canUseBiometricAuthentication: false,
      recommendedMode: 'secure-store-without-auth',
    });
  });
});
