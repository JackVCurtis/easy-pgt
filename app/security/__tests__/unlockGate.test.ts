import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { cacheAppDataEncryptionKey, clearCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';
import { requestDeviceAuthenticationPrompt } from '@/app/security/secureStorageContract';
import { performDeviceAuthentication, unlockGate } from '@/app/security/unlockGate';

jest.mock('@/app/protocol/crypto/appDataEncryptionKey', () => ({
  getOrCreateAppDataEncryptionKey: jest.fn(),
}));

jest.mock('@/app/security/secureStorageContract', () => ({
  requestDeviceAuthenticationPrompt: jest.fn(),
}));

const mockGetOrCreateAppDataEncryptionKey = jest.mocked(getOrCreateAppDataEncryptionKey);
const mockRequestDeviceAuthenticationPrompt = jest.mocked(requestDeviceAuthenticationPrompt);

describe('unlockGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedAppDataEncryptionKey();
    mockGetOrCreateAppDataEncryptionKey.mockResolvedValue('mock-app-data-key');
    mockRequestDeviceAuthenticationPrompt.mockResolvedValue({ status: 'success' });
  });

  afterEach(() => {
    clearCachedAppDataEncryptionKey();
  });

  it('authenticates then hydrates state into memory when auth succeeds', async () => {
    const authenticate = jest.fn().mockResolvedValue({
      status: 'success' as const,
      encryptionKey: 'session-encryption-key',
    });
    const hydrateState = jest.fn().mockResolvedValue();
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'unlocked',
    });

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledWith('session-encryption-key');
    expect(unloadState).not.toHaveBeenCalled();
  });

  it('keeps state unloaded and returns locked when auth is canceled', async () => {
    const authenticate = jest.fn().mockResolvedValue({ status: 'canceled' as const });
    const hydrateState = jest.fn();
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'locked',
      reason: 'auth_canceled',
    });

    expect(hydrateState).not.toHaveBeenCalled();
    expect(unloadState).toHaveBeenCalledTimes(1);
  });

  it('keeps state unloaded and returns locked when hydration fails after auth', async () => {
    const authenticate = jest.fn().mockResolvedValue({ status: 'success' as const });
    const hydrateState = jest.fn().mockRejectedValue(new Error('decrypt failure'));
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'locked',
      reason: 'hydrate_failed',
    });

    expect(unloadState).toHaveBeenCalledTimes(1);
  });

  it('triggers native authentication prompt before loading app data encryption key', async () => {
    await expect(performDeviceAuthentication()).resolves.toEqual({
      status: 'success',
      encryptionKey: 'mock-app-data-key',
    });

    expect(mockRequestDeviceAuthenticationPrompt).toHaveBeenCalledTimes(1);
    expect(mockGetOrCreateAppDataEncryptionKey).toHaveBeenCalledTimes(1);
  });

  it('reuses cached app-data encryption key without re-prompting device authentication', async () => {
    cacheAppDataEncryptionKey('cached-session-key');

    await expect(performDeviceAuthentication()).resolves.toEqual({
      status: 'success',
      encryptionKey: 'cached-session-key',
    });

    expect(mockRequestDeviceAuthenticationPrompt).not.toHaveBeenCalled();
    expect(mockGetOrCreateAppDataEncryptionKey).not.toHaveBeenCalled();
  });
});
