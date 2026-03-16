jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn(() => ({
    state: jest.fn(async () => 'PoweredOn'),
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    destroy: jest.fn(),
  })),
}), { virtual: true });

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = (i * 17 + 23) & 0xff;
    }
    return bytes;
  }),
  randomUUID: jest.fn(() => '3df085f8-486f-42ac-929d-356082e4bf63'),
}));

jest.mock('@/app/features/proximity/proximityUuid', () => ({
  createProximitySessionUuid: jest.fn(() => '3df085f8-486f-42ac-929d-356082e4bf63'),
}));

import { act, renderHook } from '@testing-library/react-native';

import { useProximityBootstrap } from '@/app/features/proximity/useProximityBootstrap';
import { createProximitySessionUuid } from '@/app/features/proximity/proximityUuid';
import { isValidUUID } from '@/app/protocol/validation/formatValidators';

import type { ProximityBlePort } from '@/app/features/proximity/transport/types';

const mockCreateProximitySessionUuid = jest.mocked(createProximitySessionUuid);

function createMockBlePort(): jest.Mocked<ProximityBlePort> {
  return {
    startAdvertising: jest.fn(async () => undefined),
    stopAdvertising: jest.fn(async () => undefined),
    scanForService: jest.fn(async () => ({ id: 'device-1', name: 'device' })),
    connect: jest.fn(async () => ({ id: 'device-1', name: 'device' })),
    disconnect: jest.fn(async () => undefined),
    cleanup: jest.fn(async () => undefined),
  };
}

describe('useProximityBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProximitySessionUuid.mockReturnValue('3df085f8-486f-42ac-929d-356082e4bf63');
  });

  it('generates payload and QR display string during writer flow', async () => {
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    expect(result.current.bootstrapPayload).not.toBeNull();
    expect(isValidUUID(result.current.bootstrapPayload!.session_uuid)).toBe(true);
    expect(result.current.bootstrapDisplayString).toContain('session_uuid');
    expect(result.current.state.status).toBe('bootstrap_ready');
  });

  it('maps permission denied errors to explicit failure reason', async () => {
    const ble = createMockBlePort();
    ble.scanForService.mockRejectedValueOnce(new Error('permission denied by platform'));

    const { result } = renderHook(() => useProximityBootstrap({ ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    await act(async () => {
      await result.current.ingestScannedBootstrap(result.current.bootstrapDisplayString, result.current.localSignerPublicKeyBase64);
      await result.current.startBleDiscoveryConnect();
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('PERMISSION_DENIED');
  });

  it('fails closed when camera permission is denied', () => {
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ ble }));

    act(() => {
      result.current.handleCameraPermissionDenied();
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('CAMERA_PERMISSION_DENIED');
    expect(ble.scanForService).not.toHaveBeenCalled();
    expect(ble.connect).not.toHaveBeenCalled();
  });

  it('uses QR scan intake + BLE scan/connect for reader flow', async () => {
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    const payload = result.current.bootstrapPayload!;

    await act(async () => {
      await result.current.ingestScannedBootstrap(result.current.bootstrapDisplayString, result.current.localSignerPublicKeyBase64);
      await result.current.startBleDiscoveryConnect();
    });

    expect(payload.bluetooth_service_uuid).toBe('6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    expect(ble.scanForService).toHaveBeenCalledWith(payload.bluetooth_service_uuid, 10_000);
    expect(ble.connect).toHaveBeenCalledWith('device-1');
    expect(result.current.state.status).toBe('session_authenticated');
  });

  it('maps scan timeout errors to explicit failure reason', async () => {
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    await act(async () => {
      await result.current.ingestScannedBootstrap(result.current.bootstrapDisplayString, result.current.localSignerPublicKeyBase64);
    });

    ble.scanForService.mockRejectedValueOnce(new Error('scan timeout waiting for device'));

    await act(async () => {
      await result.current.startBleDiscoveryConnect();
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND');
  });

  it('cleans up BLE sessions on reset and unmount', async () => {
    const ble = createMockBlePort();
    const { result, unmount } = renderHook(() => useProximityBootstrap({ ble }));

    await act(async () => {
      await result.current.reset();
    });

    expect(ble.disconnect).toHaveBeenCalled();

    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(ble.cleanup).toHaveBeenCalled();
  });
});
