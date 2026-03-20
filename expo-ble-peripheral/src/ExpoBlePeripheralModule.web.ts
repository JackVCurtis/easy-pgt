import { registerWebModule, NativeModule } from 'expo';

import type {
  ExpoBlePeripheralModuleEvents,
  PermissionState,
  PeripheralState,
  StartPeripheralOptions,
  SupportState,
} from './ExpoBlePeripheral.types';

class ExpoBlePeripheralModule extends NativeModule<ExpoBlePeripheralModuleEvents> {
  async isSupported(): Promise<SupportState> {
    return {
      bluetooth: false,
      ble: false,
      peripheralMode: false,
      multipleAdvertisement: false,
    };
  }

  async requestPermissions(): Promise<PermissionState> {
    return { advertise: false, connect: false };
  }

  async startPeripheral(_options: StartPeripheralOptions): Promise<void> {
    throw new Error('ERR_ANDROID_ONLY: expo-ble-peripheral only supports Android native BLE peripheral mode');
  }

  async stopPeripheral(): Promise<void> {
    return;
  }

  async sendHandshakeMessage(_base64Payload: string): Promise<void> {
    throw new Error('ERR_ANDROID_ONLY: expo-ble-peripheral only supports Android native BLE peripheral mode');
  }

  async getState(): Promise<PeripheralState> {
    return {
      supported: false,
      permissionsGranted: false,
      advertising: false,
      gattServerStarted: false,
      connectedDeviceCount: 0,
      subscribedDeviceCount: 0,
      sessionReady: false,
    };
  }
}

export default registerWebModule(ExpoBlePeripheralModule, 'ExpoBlePeripheral');
