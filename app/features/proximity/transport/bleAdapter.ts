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

function createBleManager(): BleManagerLike | null {
  try {
    // Defer requiring native modules until runtime so Jest environments without
    // native BLE bindings can still import this file safely.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bleModule = require('react-native-ble-plx');

    return new bleModule.BleManager() as BleManagerLike;
  } catch {
    return null;
  }
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

export function createBleAdapter(manager: BleManagerLike | null = createBleManager()): ProximityBlePort {
  if (!manager) {
    return {
      async startAdvertising() {
        throw new Error('BLE_UNAVAILABLE_OR_DISABLED');
      },
      async stopAdvertising() {
        return;
      },
      async scanForService() {
        throw new Error('BLE_UNAVAILABLE_OR_DISABLED');
      },
      async connect() {
        throw new Error('BLE_UNAVAILABLE_OR_DISABLED');
      },
      async disconnect() {
        return;
      },
      async cleanup() {
        return;
      },
    };
  }

  let connectedDeviceId: string | undefined;
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
      connectedDeviceId = device.id;
      return toProximityBleDevice(device);
    },
    async disconnect(deviceId) {
      const targetDevice = deviceId ?? connectedDeviceId;
      if (targetDevice) {
        await manager.cancelDeviceConnection(targetDevice);
      }
      connectedDeviceId = undefined;
    },
    async cleanup() {
      manager.stopDeviceScan();
      stateSubscription?.remove();
      stateSubscription = null;
      if (connectedDeviceId) {
        await manager.cancelDeviceConnection(connectedDeviceId);
        connectedDeviceId = undefined;
      }
      manager.destroy();
    },
  };
}
