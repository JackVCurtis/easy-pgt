import { requireNativeModule } from 'expo-modules-core';

type ExpoSettingsStorageModuleType = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
};

export default requireNativeModule<ExpoSettingsStorageModuleType>('ExpoSettingsStorage');