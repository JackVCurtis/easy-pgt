import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { cacheAppDataEncryptionKey, clearCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';
import {
  authenticateForSecureStorage,
  clearActiveSecureStorageAuthSession,
  type SecureStorageAuthSession,
} from '@/app/security/secureStorageContract';
import { performDeviceAuthentication, unlockGate } from '@/app/security/unlockGate';

jest.mock('@/app/protocol/crypto/appDataEncryptionKey', () => ({
  getOrCreateAppDataEncryptionKey: jest.fn(),
}));

jest.mock('@/app/security/secureStorageContract', () => ({
  authenticateForSecureStorage: jest.fn(),
  mapSecureStorageAuthErrorToRetryable: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  clearActiveSecureStorageAuthSession: jest.fn(),
}));

const mockGetOrCreateAppDataEncryptionKey = jest.mocked(getOrCreateAppDataEncryptionKey);
const mockAuthenticateForSecureStorage = jest.mocked(authenticateForSecureStorage);

const authSession: SecureStorageAuthSession = {
  token: 'auth-session-token',
  authenticatedAtMs: 1,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

describe('unlockGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedAppDataEncryptionKey();
    clearActiveSecureStorageAuthSession();
    mockGetOrCreateAppDataEncryptionKey.mockResolvedValue('mock-app-data-key');
    mockAuthenticateForSecureStorage.mockResolvedValue({ status: 'success', session: authSession });
  });

  afterEach(() => {
    clearCachedAppDataEncryptionKey();
    clearActiveSecureStorageAuthSession();
  });

  it('authenticates then hydrates state into memory when auth succeeds', async () => {
    const authenticate = jest.fn().mockResolvedValue({
      status: 'success' as const,
      encryptionKey: 'session-encryption-key',
      authSession,
    });
    const hydrateState = jest.fn().mockResolvedValue(undefined);
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'unlocked',
    });

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledWith({
      encryptionKey: 'session-encryption-key',
      authSession,
    });
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
    const authenticate = jest.fn().mockResolvedValue({ status: 'success' as const, authSession });
    const hydrateState = jest.fn().mockRejectedValue(new Error('decrypt failure'));
    const unloadState = jest.fn();

    await expect(unlockGate({ authenticate, hydrateState, unloadState })).resolves.toEqual({
      status: 'locked',
      reason: 'hydrate_failed',
    });

    expect(unloadState).toHaveBeenCalledTimes(1);
  });

  it('creates auth session before loading app data encryption key', async () => {
    await expect(performDeviceAuthentication()).resolves.toEqual({
      status: 'success',
      encryptionKey: 'mock-app-data-key',
      authSession,
    });

    expect(mockAuthenticateForSecureStorage).toHaveBeenCalledTimes(1);
    expect(mockGetOrCreateAppDataEncryptionKey).toHaveBeenCalledWith({ authSession });
  });

  it('reuses cached app-data encryption key without secure-storage authentication', async () => {
    cacheAppDataEncryptionKey('cached-session-key');

    await expect(performDeviceAuthentication()).resolves.toEqual({
      status: 'success',
      encryptionKey: 'cached-session-key',
    });

    expect(mockAuthenticateForSecureStorage).not.toHaveBeenCalled();
    expect(mockGetOrCreateAppDataEncryptionKey).not.toHaveBeenCalled();
  });
});
