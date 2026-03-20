import { registerWebModule, NativeModule } from 'expo';

import { ExpoBlePeripheralModuleEvents } from './ExpoBlePeripheral.types';

class ExpoBlePeripheralModule extends NativeModule<ExpoBlePeripheralModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoBlePeripheralModule, 'ExpoBlePeripheralModule');
