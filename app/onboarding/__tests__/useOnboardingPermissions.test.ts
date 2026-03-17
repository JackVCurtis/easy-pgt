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
      })
    );

    await waitFor(() => {
      expect(result.current.grantedCount).toBe(3);
    });

    expect(callOrder).toEqual(['camera', 'bluetooth', 'secureStore']);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.isReady).toBe(true);
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
      })
    );

    await waitFor(() => {
      expect(result.current.steps.camera.status).toBe('blocked');
    });

    expect(result.current.steps.camera.errorMessage).toContain('Camera');

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
      })
    );

    await waitFor(() => {
      expect(result.current.steps.bluetooth.status).toBe('denied');
    });

    expect(result.current.steps.bluetooth.errorMessage).toBe('Bluetooth permission denied by the OS.');
    expect(result.current.grantedCount).toBe(2);
  });
});
