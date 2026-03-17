import { registerWebModule, NativeModule } from 'expo';

import { ExpoSettingsStorageModuleEvents } from './ExpoSettingsStorage.types';

class ExpoSettingsStorageModule extends NativeModule<ExpoSettingsStorageModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoSettingsStorageModule, 'ExpoSettingsStorageModule');
