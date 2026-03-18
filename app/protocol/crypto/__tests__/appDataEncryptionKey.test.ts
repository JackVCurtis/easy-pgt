import SettingsStorage from 'expo-settings-storage';

import { APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import { generateSecureSessionKey } from '@/app/crypto';
import { clearCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';

jest.mock('expo-settings-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/app/crypto', () => ({
  generateSecureSessionKey: jest.fn(),
}));

const mockGenerateSecureSessionKey = jest.mocked(generateSecureSessionKey);

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
});
