import { decodeBase64, encodeBase64 } from '@/modules/protocol/transport';
import bleModule from 'react-native-ble-plx';
import type { ProximityBleDevice, ProximityBlePort } from './types';
interface SubscriptionLike {
  remove(): void;
}

interface DeviceLike {
  id: string;
  name?: string | null;
  serviceUUIDs?: string[] | null;
  overflowServiceUUIDs?: string[] | null;
  discoverAllServicesAndCharacteristics(): Promise<unknown>;
  writeCharacteristicWithResponseForService?(
    serviceUuid: string,
    characteristicUuid: string,
    valueBase64: string
  ): Promise<unknown>;
  readCharacteristicForService?(
    serviceUuid: string,
    characteristicUuid: string
  ): Promise<{ value?: string | null }>;
}

type BleState = 'PoweredOn' | string;

interface BleManagerLike {
  state(): Promise<BleState>;
  onStateChange(listener: (state: BleState) => void, emitCurrentState: boolean): SubscriptionLike;
  startDeviceScan(
    uuids: string[] | null,
    options: unknown,
    listener: (error: Error | null, device: DeviceLike | null) => void
  ): void;
  stopDeviceScan(): void;
  connectToDevice(deviceId: string): Promise<DeviceLike>;
  cancelDeviceConnection(deviceId: string): Promise<void>;
  destroy(): void;
}

function createBleManager() {
 return new bleModule.BleManager();
}

function normalizeUuid(value: string): string {
  return value.toLowerCase();
}

function deviceMatchesService(device: DeviceLike, expectedServiceUuid: string): boolean {
  const expected = normalizeUuid(expectedServiceUuid);
  const allUuids = [
    ...(device.serviceUUIDs ?? []),
    ...(device.overflowServiceUUIDs ?? []),
  ].map(normalizeUuid);

  return allUuids.includes(expected);
}

function toProximityBleDevice(device: DeviceLike): ProximityBleDevice {
  return {
    id: device.id,
    name: device.name,
  };
}

const CONTACT_INFO_CHARACTERISTIC_UUID = '1f58fbb8-70f0-4df5-9a9e-c6d85ba6f0a3';
const CONTACT_INFO_READ_TIMEOUT_MS = 10_000;
const CONTACT_INFO_READ_INTERVAL_MS = 300;

function encodeUtf8Base64(value: string): string {
  return encodeBase64(new TextEncoder().encode(value));
}

function decodeUtf8Base64(value: string): string {
  return new TextDecoder().decode(decodeBase64(value) || new ArrayBuffer());
}


function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatHexAsUuid(hex: string): string {
  const normalized = hex.toLowerCase();
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

function createUuidFromDeviceIdentifier(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (isUuidLike(trimmed)) {
    return trimmed.toLowerCase();
  }

  const hexOnly = trimmed.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (hexOnly.length < 16) {
    return null;
  }

  const expandedHex = hexOnly.length >= 32 ? hexOnly.slice(0, 32) : (hexOnly + hexOnly).slice(0, 32);
  return formatHexAsUuid(expandedHex);
}

function resolveLocalServiceUuid(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constantsModule = require('expo-constants');
    const constants = constantsModule.default ?? constantsModule;

    const candidates = [
      constants?.platform?.ios?.identifierForVendor,
      constants?.platform?.android?.androidId,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') {
        continue;
      }

      const uuid = createUuidFromDeviceIdentifier(candidate);
      if (uuid) {
        return uuid;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function createBleAdapter(manager = createBleManager()): ProximityBlePort {

  let connectedDeviceId: string | undefined;
  let connectedDevice: DeviceLike | undefined;
  let stateSubscription: SubscriptionLike | null = null;

  const ensurePoweredOn = async () => {
    const state = await manager.state();
    if (state === 'PoweredOn') {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      stateSubscription?.remove();
      stateSubscription = manager.onStateChange((nextState) => {
        if (nextState === 'PoweredOn') {
          resolve();
        }
      }, true);

      setTimeout(() => {
        reject(new Error('BLE_UNAVAILABLE'));
      }, 3_000);
    });
  };

  return {
    async getLocalServiceUuid() {
      const uuid = resolveLocalServiceUuid();
      if (!uuid) {
        throw new Error('LOCAL_SERVICE_UUID_UNAVAILABLE');
      }

      return uuid;
    },
    async startAdvertising(_serviceUuid) {
      throw new Error('BLE_ADVERTISE_NOT_SUPPORTED');
    },
    async stopAdvertising() {
      return;
    },
    async scanForService(serviceUuid, timeoutMs) {
      await ensurePoweredOn();

      return await new Promise<ProximityBleDevice | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          reject(new Error('SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND'));
        }, timeoutMs);

        manager.startDeviceScan([serviceUuid], null, (error, device) => {
          if (error) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            reject(error);
            return;
          }

          if (device && deviceMatchesService(device, serviceUuid)) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            resolve(toProximityBleDevice(device));
          }
        });
      });
    },
    async connect(deviceId) {
      await ensurePoweredOn();
      const device = await manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      connectedDevice = device;
      connectedDeviceId = device.id;
      return toProximityBleDevice(device);
    },
    async exchangeContactInfo(contactInfo, serviceUuid, sessionUuid) {
      if (!connectedDevice) {
        throw new Error('BLE_NOT_CONNECTED');
      }

      if (!connectedDevice.writeCharacteristicWithResponseForService || !connectedDevice.readCharacteristicForService) {
        throw new Error('BLE_CONTACT_EXCHANGE_UNSUPPORTED');
      }

      const outboundPayload = JSON.stringify({
        session_uuid: sessionUuid,
        contact_info: contactInfo,
      });

      await connectedDevice.writeCharacteristicWithResponseForService(
        serviceUuid,
        CONTACT_INFO_CHARACTERISTIC_UUID,
        encodeUtf8Base64(outboundPayload)
      );

      const startedAt = Date.now();
      while (Date.now() - startedAt < CONTACT_INFO_READ_TIMEOUT_MS) {
        const result = await connectedDevice.readCharacteristicForService(serviceUuid, CONTACT_INFO_CHARACTERISTIC_UUID);
        if (!result.value) {
          await new Promise((resolve) => setTimeout(resolve, CONTACT_INFO_READ_INTERVAL_MS));
          continue;
        }

        try {
          const parsed = JSON.parse(decodeUtf8Base64(result.value)) as { session_uuid?: string; contact_info?: string };
          if (parsed.session_uuid === sessionUuid && typeof parsed.contact_info === 'string' && parsed.contact_info.trim().length > 0) {
            return parsed.contact_info;
          }
        } catch {
          // ignore malformed characteristic value while polling until timeout
        }

        await new Promise((resolve) => setTimeout(resolve, CONTACT_INFO_READ_INTERVAL_MS));
      }

      throw new Error('BLE_CONTACT_EXCHANGE_TIMEOUT');
    },
    async disconnect(deviceId) {
      const targetDevice = deviceId ?? connectedDeviceId;
      if (targetDevice) {
        await manager.cancelDeviceConnection(targetDevice);
      }
      connectedDeviceId = undefined;
      connectedDevice = undefined;
    },
    async cleanup() {
      manager.stopDeviceScan();
      stateSubscription?.remove();
      stateSubscription = null;
      if (connectedDeviceId) {
        await manager.cancelDeviceConnection(connectedDeviceId);
        connectedDeviceId = undefined;
      }
      connectedDevice = undefined;
      manager.destroy();
    },
  };
}
