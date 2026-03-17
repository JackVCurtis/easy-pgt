import { probeSecureStoreReadiness } from '@/app/onboarding/secureStoreReadiness';
import SettingsStorage from 'expo-settings-storage';

jest.mock('expo-settings-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  deleteItem: jest.fn(),
}));

describe('probeSecureStoreReadiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SettingsStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(SettingsStorage.getItem).mockResolvedValue('ok');
    jest.mocked(SettingsStorage.deleteItem).mockResolvedValue(undefined);
  });

  it('returns granted when secure settings storage probe succeeds', async () => {
    await expect(probeSecureStoreReadiness()).resolves.toEqual({ status: 'granted' });
  });

  it('returns denied when authentication is canceled by OS prompt', async () => {
    jest.mocked(SettingsStorage.setItem).mockRejectedValueOnce(new Error('Authentication canceled'));

    await expect(probeSecureStoreReadiness()).resolves.toEqual({
      status: 'denied',
      errorMessage: expect.stringContaining('permission was denied by the OS'),
    });
  });
});
