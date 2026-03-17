import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useOnboardingPermissions } from '@/app/onboarding/useOnboardingPermissions';

function createCameraResult(granted: boolean, canAskAgain = true) {
  return {
    granted,
    canAskAgain,
  };
}

describe('useOnboardingPermissions', () => {
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
            return { status: 'granted' };
          }),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => {
            callOrder.push('secureStore');
            return { status: 'granted' };
          }),
        },
        identity: {
          initializeKeypair: jest.fn(async () => {
            callOrder.push('initializing_keys');
            return { status: 'granted' };
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

  it('marks camera as blocked when permission cannot be requested again and exposes retry', async () => {
    const requestPermission = jest
      .fn()
      .mockResolvedValueOnce(createCameraResult(false, false))
      .mockResolvedValueOnce(createCameraResult(true, true));

    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(false, true),
          requestPermission,
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.camera.status).toBe('blocked');
    });

    expect(result.current.terminalState).toBe('blocked_by_permissions');
    expect(result.current.steps.camera.errorMessage).toContain('Camera access is required');
    expect(result.current.steps.camera.errorMessage).toContain('Settings');

    await act(async () => {
      await result.current.retryStep('camera');
    });

    expect(result.current.steps.camera.status).toBe('granted');
  });

  it('maps bluetooth permission failures to denied status with an error message', async () => {
    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({
            status: 'denied',
            errorMessage: 'Bluetooth permission denied by the OS.',
          })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.bluetooth.status).toBe('denied');
    });

    expect(result.current.terminalState).toBe('blocked_by_permissions');
    expect(result.current.steps.bluetooth.errorMessage).toBe('Bluetooth permission denied by the OS.');
    expect(result.current.steps.initializing_keys.status).toBe('idle');
    expect(result.current.grantedCount).toBe(1);
  });



  it('adds required-reason guidance for blocked bluetooth permissions', async () => {
    const { result } = renderHook(() =>
      useOnboardingPermissions({
        camera: {
          currentPermission: createCameraResult(true, true),
          requestPermission: jest.fn(async () => createCameraResult(true, true)),
        },
        bluetooth: {
          checkReadiness: jest.fn(async () => ({
            status: 'blocked',
            errorMessage: 'Bluetooth is unavailable on this device.',
          })),
        },
        secureStore: {
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        identity: {
          initializeKeypair: jest.fn(async () => ({ status: 'granted' })),
        },
      })
    );

    await waitFor(() => {
      expect(result.current.steps.bluetooth.status).toBe('blocked');
    });

    expect(result.current.steps.bluetooth.errorMessage).toContain('Bluetooth access is required');
    expect(result.current.steps.bluetooth.errorMessage).toContain('Settings');
    expect(result.current.terminalState).toBe('blocked_by_permissions');
  });

  it('maps identity initialization failures and allows retrying initialization', async () => {
    const initializeKeypair = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'blocked',
        errorMessage: 'Secure key storage is unavailable on this device.',
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
          checkReadiness: jest.fn(async () => ({ status: 'granted' })),
        },
        identity: {
          initializeKeypair,
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
  });
});
