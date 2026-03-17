import SettingsStorage from 'expo-settings-storage';

import { APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';

jest.mock('expo-settings-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

describe('getOrCreateAppDataEncryptionKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);
    expect(SettingsStorage.setItem).toHaveBeenCalledWith(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, key);
  });
});
