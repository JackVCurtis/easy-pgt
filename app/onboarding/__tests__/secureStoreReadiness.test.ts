import { createSecureStoreReadinessChecker } from '@/app/onboarding/secureStoreReadiness';
import {
  authenticateForSecureStorage,
  createExpoSecureStoreAdapter,
  type SecureStorageAuthSession,
  type SecureStoreAdapter,
} from '@/app/security/secureStorageContract';

jest.mock('@/app/security/secureStorageContract', () => ({
  authenticateForSecureStorage: jest.fn(),
  createExpoSecureStoreAdapter: jest.fn(),
  assertActiveSecureStorageAuthSession: jest.fn(),
  mapSecureStorageAuthErrorToRetryable: (error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
}));

const mockCreateExpoSecureStoreAdapter = jest.mocked(createExpoSecureStoreAdapter);
const mockAuthenticateForSecureStorage = jest.mocked(authenticateForSecureStorage);

const session: SecureStorageAuthSession = {
  token: 'session-1',
  authenticatedAtMs: 1,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

function createAdapter(overrides: Partial<SecureStoreAdapter> = {}): SecureStoreAdapter {
  return {
    getItem: jest.fn(async () => 'probe-value'),
    setItem: jest.fn(async () => undefined),
    deleteItem: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('createSecureStoreReadinessChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateForSecureStorage.mockResolvedValue({ status: 'success', session });
  });

  it('returns granted when auth session and secure-store probe succeed', async () => {
    let storedValue: string | null = null;
    const adapter = createAdapter({
      setItem: jest.fn(async (_key, value) => {
        storedValue = value;
      }),
      getItem: jest.fn(async () => storedValue),
    });

    mockCreateExpoSecureStoreAdapter.mockReturnValue(adapter);

    const checkReadiness = createSecureStoreReadinessChecker();
    const result = await checkReadiness();

    expect(result).toEqual({ status: 'granted' });
    expect(mockAuthenticateForSecureStorage).toHaveBeenCalledTimes(1);
    expect(adapter.setItem).toHaveBeenCalledTimes(1);
    expect(adapter.getItem).toHaveBeenCalledTimes(1);
    expect(adapter.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('returns denied when user cancels device authentication', async () => {
    mockCreateExpoSecureStoreAdapter.mockReturnValue(createAdapter());
    mockAuthenticateForSecureStorage.mockResolvedValue({
      status: 'canceled',
      message: 'User canceled prompt',
    });

    const checkReadiness = createSecureStoreReadinessChecker();

    await expect(checkReadiness()).resolves.toEqual({
      status: 'denied',
      errorMessage: 'Device authentication was canceled. Approve secure storage access and retry.',
    });
  });

  it('returns blocked when device authentication prerequisites are unavailable', async () => {
    mockCreateExpoSecureStoreAdapter.mockReturnValue(createAdapter());
    mockAuthenticateForSecureStorage.mockResolvedValue({
      status: 'failed',
      message: 'Device authentication unavailable',
    });

    const checkReadiness = createSecureStoreReadinessChecker();

    await expect(checkReadiness()).resolves.toEqual({
      status: 'blocked',
      errorMessage: 'Secure lock screen / biometrics are not configured for protected secure storage on this device.',
    });
  });

  it('returns denied when secure store probe throws an authentication error', async () => {
    const adapter = createAdapter({
      setItem: jest.fn(async () => {
        throw new Error('Not authenticated');
      }),
    });

    mockCreateExpoSecureStoreAdapter.mockReturnValue(adapter);

    const checkReadiness = createSecureStoreReadinessChecker();

    await expect(checkReadiness()).resolves.toEqual({
      status: 'denied',
      errorMessage: 'Unlock your device and approve secure storage access, then retry.',
    });
  });
});
