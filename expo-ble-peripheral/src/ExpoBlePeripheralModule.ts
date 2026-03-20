import { NativeModule, requireNativeModule } from 'expo';

import type {
  ExpoBlePeripheralModuleEvents,
  PermissionState,
  PeripheralState,
  StartPeripheralOptions,
  SupportState,
} from './ExpoBlePeripheral.types';
import { validateStartPeripheralOptions } from './validation';

declare class ExpoBlePeripheralModule extends NativeModule<ExpoBlePeripheralModuleEvents> {
  isSupported(): Promise<SupportState>;
  requestPermissions(): Promise<PermissionState>;
  startPeripheral(options: StartPeripheralOptions): Promise<void>;
  stopPeripheral(): Promise<void>;
  sendHandshakeMessage(base64Payload: string): Promise<void>;
  getState(): Promise<PeripheralState>;
}

const nativeModule = requireNativeModule<ExpoBlePeripheralModule>('ExpoBlePeripheral');

export async function startPeripheral(options: StartPeripheralOptions): Promise<void> {
  validateStartPeripheralOptions(options);
  await nativeModule.startPeripheral(options);
}

export default {
  addListener: nativeModule.addListener.bind(nativeModule),
  removeListener: nativeModule.removeListener.bind(nativeModule),
  isSupported: nativeModule.isSupported.bind(nativeModule),
  requestPermissions: nativeModule.requestPermissions.bind(nativeModule),
  startPeripheral,
  stopPeripheral: nativeModule.stopPeripheral.bind(nativeModule),
  sendHandshakeMessage: nativeModule.sendHandshakeMessage.bind(nativeModule),
  getState: nativeModule.getState.bind(nativeModule),
};
