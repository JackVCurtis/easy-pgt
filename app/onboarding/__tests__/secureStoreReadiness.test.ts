import { createSecureStoreReadinessChecker } from '@/app/onboarding/secureStoreReadiness';
import {
  createExpoSecureStoreAdapter,
  requestDeviceAuthenticationPrompt,
  type SecureStoreAdapter,
} from '@/app/security/secureStorageContract';

jest.mock('@/app/security/secureStorageContract', () => ({
  createExpoSecureStoreAdapter: jest.fn(),
  requestDeviceAuthenticationPrompt: jest.fn(),
}));

const mockCreateExpoSecureStoreAdapter = jest.mocked(createExpoSecureStoreAdapter);
const mockRequestDeviceAuthenticationPrompt = jest.mocked(requestDeviceAuthenticationPrompt);

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
    mockRequestDeviceAuthenticationPrompt.mockResolvedValue({ status: 'success' });
  });

  it('returns granted when auth prompt and secure-store probe succeed', async () => {
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
    expect(adapter.setItem).toHaveBeenCalledTimes(1);
    expect(adapter.getItem).toHaveBeenCalledTimes(1);
    expect(adapter.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('returns denied when user cancels the device authentication prompt', async () => {
    mockCreateExpoSecureStoreAdapter.mockReturnValue(createAdapter());
    mockRequestDeviceAuthenticationPrompt.mockResolvedValue({
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
    mockRequestDeviceAuthenticationPrompt.mockResolvedValue({
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
