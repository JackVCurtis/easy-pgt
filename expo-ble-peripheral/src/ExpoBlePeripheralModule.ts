import { NativeModule, requireNativeModule } from 'expo';

import { ExpoBlePeripheralModuleEvents } from './ExpoBlePeripheral.types';

declare class ExpoBlePeripheralModule extends NativeModule<ExpoBlePeripheralModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoBlePeripheralModule>('ExpoBlePeripheral');
