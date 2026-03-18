import { createSecureStoreReadinessChecker } from '@/app/onboarding/secureStoreReadiness';
import { APP_DATA_ENCRYPTION_KEY_STORAGE_KEY } from '@/app/protocol/crypto/appDataEncryptionKey';
import { clearCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';
import { clearActiveSecureStorageAuthSession } from '@/app/security/secureStorageContract';
import { unlockGate } from '@/app/security/unlockGate';

jest.mock('expo-settings-storage', () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      deleteItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      authenticate: jest.fn(async () => ({ status: 'success' as const })),
      __reset: () => {
        store.clear();
      },
    },
  };
});

import SettingsStorage from 'expo-settings-storage';

const mockedSettingsStorage = SettingsStorage as typeof SettingsStorage & {
  authenticate: jest.Mock;
  __reset: () => void;
};

describe('onboarding + first unlock auth session integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSettingsStorage.__reset();
    clearCachedAppDataEncryptionKey();
    clearActiveSecureStorageAuthSession();
  });

  afterEach(() => {
    clearCachedAppDataEncryptionKey();
    clearActiveSecureStorageAuthSession();
  });

  it('prompts exactly once across onboarding secure-store readiness and first unlock key creation/hydration', async () => {
    const checkReadiness = createSecureStoreReadinessChecker();

    await expect(checkReadiness()).resolves.toEqual({ status: 'granted' });

    const hydrateState = jest.fn().mockResolvedValue(undefined);

    await expect(unlockGate({ hydrateState })).resolves.toEqual({ status: 'unlocked' });

    expect(hydrateState).toHaveBeenCalledTimes(1);
    expect(hydrateState).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptionKey: expect.any(String),
      })
    );

    expect(mockedSettingsStorage.authenticate).toHaveBeenCalledTimes(1);
    expect(jest.mocked(SettingsStorage.setItem)).toHaveBeenCalledWith(
      APP_DATA_ENCRYPTION_KEY_STORAGE_KEY,
      expect.any(String)
    );
  });
});
