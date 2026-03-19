import { decodeBase64, encodeBase64 } from '@/modules/protocol/transport';
import { Alert } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import type { ProximityBleDevice, ProximityBlePort } from './types';
interface SubscriptionLike {
  remove(): void;
}

const SERVICE_UUID = 'd795c8a2-5514-4b52-9f68-1fe80bd9fb52'
const HANDSHAKE_CHAR_UUID = '03ec7b33-9a44-4b72-ac4c-11f14a74a181';

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
 return new BleManager();
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

const CONTACT_INFO_CHARACTERISTIC_UUID = '563d77e6-8548-4573-aed3-4e3466b4595a';
const CONTACT_INFO_READ_TIMEOUT_MS = 10_000;
const CONTACT_INFO_READ_INTERVAL_MS = 300;

function encodeUtf8Base64(value: string): string {
  return encodeBase64(new TextEncoder().encode(value));
}

function decodeUtf8Base64(value: string): string {
  return new TextDecoder().decode(decodeBase64(value) || new ArrayBuffer());
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

    if (state === 'PoweredOff') {
      Alert.alert('"App" would like to use Bluetooth.', 'This app uses Bluetooth to connect to and share information with your .....', [
        {
          text: "Don't allow",
          onPress: () => { throw new Error('BLE_OFF_ACCESS_DENIED')},
          style: 'cancel',
        },
        { text: "Turn ON", onPress: () => { 
          manager.enable()
          return
          } },
      ]);
    }
  };

  return {
    async getLocalServiceUuid() {
      const uuid = SERVICE_UUID;
      if (!uuid) {
        throw new Error('LOCAL_SERVICE_UUID_UNAVAILABLE');
      }

      return uuid;
    },
    async startAdvertising() {
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
