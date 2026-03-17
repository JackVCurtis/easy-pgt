import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useOnboardingPermissions } from '@/app/onboarding/useOnboardingPermissions';
import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';

jest.mock('@/app/protocol/crypto/appDataEncryptionKey', () => ({
  getOrCreateAppDataEncryptionKey: jest.fn(),
}));

const mockGetOrCreateAppDataEncryptionKey = jest.mocked(getOrCreateAppDataEncryptionKey);

function createCameraResult(granted: boolean, canAskAgain = true) {
  return {
    granted,
    canAskAgain,
  };
}

describe('useOnboardingPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateAppDataEncryptionKey.mockResolvedValue('mock-app-data-key');
  });

  it('runs camera, bluetooth, and secure store checks in order and reports progress', async () => {
    const callOrder: string[] = [];

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(false, true),
          requestPermission: jest.fn(async () => {
            callOrder.push('camera');
            return createCameraResult(true, true);
          }),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => {
            callOrder.push('bluetooth');
            return { status: 'granted' as const };
          }),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => {
            callOrder.push('secureStore');
            return { status: 'granted' as const };
          }),
        },
        identity: {
          initializeKeypair: jest.fn(async () => {
            callOrder.push('initializing_keys');
            return { status: 'granted' as const };
          }),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.grantedCount).toBe(4);
    });

    expect(callOrder).toEqual(['camera', 'bluetooth', 'secureStore', 'initializing_keys']);
    expect(result.current.totalCount).toBe(4);
    expect(result.current.isReady).toBe(true);
    expect(result.current.terminalState).toBe('ready_to_continue');
  });

  it('marks camera as denied when permission request is rejected by OS', async () => {
    const requestPermission = jest.fn(async () => createCameraResult(false, true));

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(false, true),
          requestPermission,
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' as const })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' as const })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' as const })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.camera.status).toBe('denied');
    });

    expect(result.current.terminalState).toBe('blocked_by_permissions');
    expect(result.current.steps.camera.errorMessage).toBe('Camera permission denied by the OS.');
    expect(result.current.steps.bluetooth.status).toBe('idle');
    expect(result.current.grantedCount).toBe(0);
  });

  it('maps bluetooth unavailable and powered-off states to blocked status', async () => {
    const unavailableResult = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({
            status: 'blocked' as const,
            errorMessage: 'Bluetooth is unavailable on this device.',
          })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' as const })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' as const })),
        },
      })
    );

    await waitFor(() => {
      expect(unavailableResult.result.current.steps.bluetooth.status).toBe('blocked');
    });

    expect(unavailableResult.result.current.steps.bluetooth.errorMessage).toContain('Bluetooth access is required');
    expect(unavailableResult.result.current.terminalState).toBe('blocked_by_permissions');

    const disabledResult = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({
            status: 'blocked' as const,
            errorMessage: 'Bluetooth is turned off. Enable Bluetooth and retry.',
          })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' as const })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' as const })),
        },
      })
    );

    await waitFor(() => {
      expect(disabledResult.result.current.steps.bluetooth.status).toBe('blocked');
    });

    expect(disabledResult.result.current.steps.bluetooth.errorMessage).toContain('Bluetooth access is required');
    expect(disabledResult.result.current.terminalState).toBe('blocked_by_permissions');
  });

  it('stops on secure-store probe failure and exposes retry', async () => {
    const checkReadiness = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'blocked',
        errorMessage: 'Secure key storage probe failed. Please retry.',
      })
      .mockResolvedValueOnce({ status: 'granted' });

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness,
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.secureStore.status).toBe('blocked');
    });

    expect(result.current.terminalState).toBe('blocked_by_permissions');
    expect(result.current.steps.secureStore.errorMessage).toContain('Secure storage access is required');
    expect(result.current.steps.initializing_keys.status).toBe('idle');

    await act(async () => {
      await result.current.retryStep('secureStore');
    });

    expect(result.current.steps.secureStore.status).toBe('granted');
    expect(result.current.steps.initializing_keys.status).toBe('granted');
  });

  it('continues onboarding with fallback secure-store mode when authenticated storage is unavailable', async () => {
    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({
            status: 'granted',
            errorMessage:
              'Secure lock screen / biometrics are not configured. Continuing with secure storage without OS authentication prompts.',
          })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.steps.secureStore.status).toBe('granted');
    expect(result.current.steps.secureStore.errorMessage).toContain('secure storage without OS authentication prompts');
  });

  it('transitions to completed when key initialization succeeds', async () => {
    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.initializing_keys.status).toBe('granted');
    });

    expect(mockGetOrCreateAppDataEncryptionKey).toHaveBeenCalledTimes(1);
    expect(result.current.terminalState).toBe('ready_to_continue');
    expect(result.current.isReady).toBe(true);
  });



  it('surfaces unlock guidance when identity init fails due to authentication state', async () => {
    mockGetOrCreateAppDataEncryptionKey.mockRejectedValueOnce(new Error('Authentication required: device is locked'));

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.initializing_keys.status).toBe('denied');
    });

    expect(result.current.terminalState).toBe('blocked_by_key_init_failure');
    expect(result.current.steps.initializing_keys.errorMessage).toBe(
      'Unlock your device and approve secure storage access, then retry.'
    );
  });

  it('maps key initialization failure then recovers on retry', async () => {
    mockGetOrCreateAppDataEncryptionKey
      .mockRejectedValueOnce(new Error('Secure storage unavailable'))
      .mockResolvedValueOnce('mock-app-data-key');

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.initializing_keys.status).toBe('blocked');
    });

    expect(result.current.terminalState).toBe('blocked_by_key_init_failure');
    expect(result.current.steps.initializing_keys.errorMessage).toBe('Secure key storage is unavailable on this device.');

    await act(async () => {
      await result.current.retryStep('initializing_keys');
    });

    expect(result.current.steps.initializing_keys.status).toBe('granted');
    expect(result.current.terminalState).toBe('ready_to_continue');
    expect(mockGetOrCreateAppDataEncryptionKey).toHaveBeenCalledTimes(2);
  });

  it('surfaces recovery flow when authenticated secure-store key is invalidated', async () => {
    mockGetOrCreateAppDataEncryptionKey.mockRejectedValueOnce(
      new Error('KEY_STORAGE_AUTH_INVALIDATED: Protected key material became unreadable and was cleared')
    );

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.initializing_keys.status).toBe('blocked');
    });

    expect(result.current.steps.initializing_keys.errorMessage).toContain('no longer readable');
  });
});
