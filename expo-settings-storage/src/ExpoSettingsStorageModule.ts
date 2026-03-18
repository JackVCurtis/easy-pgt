import { requireNativeModule } from 'expo-modules-core';

type ExpoSettingsStorageModuleType = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
  authenticate(): Promise<{ status: 'success' | 'canceled' | 'failed'; message?: string }>;
};

export default requireNativeModule<ExpoSettingsStorageModuleType>('ExpoSettingsStorage');
