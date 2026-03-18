import SettingsStorage from 'expo-settings-storage';

import { classifySecureStorageError } from './secureStorageErrors';

export type SecureStoreAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

export const SECURE_STORAGE_INVALIDATED_ERROR_MESSAGE =
  'SECURE_STORAGE_AUTH_INVALIDATED: Protected key material became unreadable and was cleared';

export function createExpoSecureStoreAdapter(): SecureStoreAdapter {
  return {
    async getItem(key: string) {
      return SettingsStorage.getItem(key);
    },
    async setItem(key: string, value: string) {
      await SettingsStorage.setItem(key, value);
    },
    async deleteItem(key: string) {
      await SettingsStorage.deleteItem(key);
    },
  };
}

export function createInMemorySecureStoreAdapter(initialData: Record<string, string> = {}): SecureStoreAdapter {
  const store = new Map<string, string>(Object.entries(initialData));

  return {
    async getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key: string, value: string) {
      store.set(key, value);
    },
    async deleteItem(key: string) {
      store.delete(key);
    },
  };
}

export async function readSecureStoreItemOrClearOnInvalidation(
  adapter: SecureStoreAdapter,
  key: string,
  invalidatedMessage = SECURE_STORAGE_INVALIDATED_ERROR_MESSAGE
): Promise<string | null> {
  try {
    return await adapter.getItem(key);
  } catch (error) {
    const classification = classifySecureStorageError(error);

    if (classification.isInvalidated) {
      await adapter.deleteItem(key);
      throw new Error(invalidatedMessage);
    }

    throw error;
  }
}
