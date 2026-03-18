import SettingsStorage from 'expo-settings-storage';

import { APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { generateSecureSessionKey } from '@/app/crypto';
import {
  SECURE_STORAGE_AUTH_SESSION_RETRYABLE_ERROR_MESSAGE,
  type SecureStorageAuthSession,
} from '@/app/security/secureStorageContract';
import { clearCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';

jest.mock('expo-settings-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/app/crypto', () => ({
  generateSecureSessionKey: jest.fn(),
}));

const mockGenerateSecureSessionKey = jest.mocked(generateSecureSessionKey);

const activeSession: SecureStorageAuthSession = {
  token: 'session-token',
  authenticatedAtMs: 10,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

describe('getOrCreateAppDataEncryptionKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedAppDataEncryptionKey();
    mockGenerateSecureSessionKey.mockReturnValue('generated-session-key');
  });

  it('returns the existing stored encryption key when present', async () => {
    jest.mocked(SettingsStorage.getItem).mockResolvedValueOnce('existing-key');

    await expect(getOrCreateAppDataEncryptionKey()).resolves.toBe('existing-key');

    expect(SettingsStorage.getItem).toHaveBeenCalledWith(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);
    expect(SettingsStorage.setItem).not.toHaveBeenCalled();
  });

  it('creates and stores an encryption key when none exists', async () => {
    jest.mocked(SettingsStorage.getItem).mockResolvedValueOnce(null);
    jest.mocked(SettingsStorage.setItem).mockResolvedValueOnce(undefined);

    const key = await getOrCreateAppDataEncryptionKey();

    expect(key).toBe('generated-session-key');
    expect(mockGenerateSecureSessionKey).toHaveBeenCalledTimes(1);
    expect(SettingsStorage.setItem).toHaveBeenCalledWith(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, key);
  });

  it('returns cached key without re-reading secure storage after first load', async () => {
    jest.mocked(SettingsStorage.getItem).mockResolvedValueOnce('existing-key');

    await expect(getOrCreateAppDataEncryptionKey()).resolves.toBe('existing-key');
    await expect(getOrCreateAppDataEncryptionKey()).resolves.toBe('existing-key');

    expect(SettingsStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('fails with retryable error when provided auth session is expired', async () => {
    const expiredSession: SecureStorageAuthSession = {
      token: 'expired-session-token',
      authenticatedAtMs: 1,
      expiresAtMs: 2,
    };

    await expect(
      getOrCreateAppDataEncryptionKey({
        authSession: expiredSession,
      })
    ).rejects.toThrow(SECURE_STORAGE_AUTH_SESSION_RETRYABLE_ERROR_MESSAGE);

    expect(SettingsStorage.getItem).not.toHaveBeenCalled();
  });

  it('uses auth session context for secure-store reads without additional prompt handling', async () => {
    jest.mocked(SettingsStorage.getItem).mockResolvedValueOnce('existing-key');

    await expect(
      getOrCreateAppDataEncryptionKey({
        authSession: activeSession,
      })
    ).resolves.toBe('existing-key');

    expect(SettingsStorage.getItem).toHaveBeenCalledWith(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);
  });
});
