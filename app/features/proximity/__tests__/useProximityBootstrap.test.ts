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

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    requestTechnology: jest.fn(async () => undefined),
    cancelTechnologyRequest: jest.fn(async () => undefined),
    getTag: jest.fn(async () => ({})),
    ndefHandler: {
      writeNdefMessage: jest.fn(async () => undefined),
    },
  },
  Ndef: {
    TNF_MIME_MEDIA: 2,
    record: jest.fn(() => ({})),
    encodeMessage: jest.fn(() => [1,2,3]),
  },
  NfcTech: {
    Ndef: 'Ndef',
  },
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

import type { ProximityBlePort, ProximityNfcPort } from '@/app/features/proximity/transport/types';

const mockCreateProximitySessionUuid = jest.mocked(createProximitySessionUuid);

function createMockNfcPort(): jest.Mocked<ProximityNfcPort> {
  return {
    writeBootstrapPayload: jest.fn(async () => undefined),
    readBootstrapPayload: jest.fn(async () => null),
    cancel: jest.fn(async () => undefined),
    cleanup: jest.fn(async () => undefined),
  };
}

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

  it('writes payload through NFC adapter during writer flow', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('hash_abc123', '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    expect(result.current.bootstrapPayload).not.toBeNull();
    expect(isValidUUID(result.current.bootstrapPayload!.session_uuid)).toBe(true);
    expect(nfc.writeBootstrapPayload).toHaveBeenCalledWith(result.current.bootstrapPayload);
  });

  it('maps permission denied errors to explicit failure reason', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    nfc.writeBootstrapPayload.mockRejectedValueOnce(new Error('permission denied by platform'));

    const { result } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('hash_abc123', '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('PERMISSION_DENIED');
  });


  it('maps NFC request timeout errors to explicit failure reason and failed status', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    nfc.readBootstrapPayload.mockRejectedValueOnce(new Error('NFC_REQUEST_TIMEOUT'));

    const { result } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.readBootstrapViaNfc(result.current.localSignerPublicKeyBase64);
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('NFC_REQUEST_TIMEOUT');
  });

  it('uses NFC read + BLE scan/connect for reader flow', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    const payload = result.current.bootstrapPayload!;
    nfc.readBootstrapPayload.mockResolvedValueOnce(payload);

    await act(async () => {
      await result.current.readBootstrapViaNfc(result.current.localSignerPublicKeyBase64);
      await result.current.startBleDiscoveryConnect();
    });

    expect(nfc.readBootstrapPayload).toHaveBeenCalled();
    expect(ble.scanForService).toHaveBeenCalledWith(payload.bluetooth_service_uuid, 10_000);
    expect(ble.connect).toHaveBeenCalledWith('device-1');
    expect(result.current.state.status).toBe('session_authenticated');
  });

  it('maps scan timeout errors to explicit failure reason', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    const { result } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.prepareWriterPayload('a'.repeat(64), '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
    });

    const payload = result.current.bootstrapPayload!;
    nfc.readBootstrapPayload.mockResolvedValueOnce(payload);
    ble.scanForService.mockRejectedValueOnce(new Error('scan timeout waiting for device'));

    await act(async () => {
      await result.current.readBootstrapViaNfc(result.current.localSignerPublicKeyBase64);
      await result.current.startBleDiscoveryConnect();
    });

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.failureReason).toBe('SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND');
  });

  it('cleans up NFC + BLE sessions on reset and unmount', async () => {
    const nfc = createMockNfcPort();
    const ble = createMockBlePort();
    const { result, unmount } = renderHook(() => useProximityBootstrap({ nfc, ble }));

    await act(async () => {
      await result.current.reset();
    });

    expect(nfc.cancel).toHaveBeenCalled();
    expect(ble.disconnect).toHaveBeenCalled();

    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(nfc.cleanup).toHaveBeenCalled();
    expect(ble.cleanup).toHaveBeenCalled();
  });
});
