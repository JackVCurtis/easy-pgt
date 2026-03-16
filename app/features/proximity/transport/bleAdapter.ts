import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';

import type { ProximityBleDevice, ProximityBlePort } from './types';

function normalizeUuid(value: string): string {
  return value.toLowerCase();
}

function deviceMatchesService(device: Device, expectedServiceUuid: string): boolean {
  const expected = normalizeUuid(expectedServiceUuid);
  const allUuids = [
    ...(device.serviceUUIDs ?? []),
    ...(device.overflowServiceUUIDs ?? []),
  ].map(normalizeUuid);

  return allUuids.includes(expected);
}

function toProximityBleDevice(device: Device): ProximityBleDevice {
  return {
    id: device.id,
    name: device.name,
  };
}

export function createBleAdapter(manager = new BleManager()): ProximityBlePort {
  let connectedDeviceId: string | undefined;
  let stateSubscription: Subscription | null = null;

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
