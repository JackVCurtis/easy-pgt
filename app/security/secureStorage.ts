import * as SecureStore from 'expo-secure-store';

import type { SecureStorageMode } from '@/app/security/secureStorageCapabilities';

const STORAGE_MODE_KEY = 'comrades.secure-storage.mode.v1';

const AUTH_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock your device to access protected Comrades data.',
};

export type SecureStoreAdapter = {
  getItem(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItem(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

export type SecureReadResult = {
  status: 'ok' | 'invalidated';
  value: string | null;
  message?: string;
};

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

export function createExpoSecureStoreAdapter(): SecureStoreAdapter {
  return {
    async getItem(key: string, options?: SecureStore.SecureStoreOptions) {
      return SecureStore.getItemAsync(key, options);
    },
    async setItem(key: string, value: string, options?: SecureStore.SecureStoreOptions) {
      await SecureStore.setItemAsync(key, value, options);
    },
    async deleteItem(key: string) {
      await SecureStore.deleteItemAsync(key);
    },
  };
}

function isInvalidatedAuthError(message: string): boolean {
  return (
    message.includes('invalidated') ||
    message.includes('key permanently invalidated') ||
    message.includes('keystore operation failed') ||
    message.includes('authentication') ||
    message.includes('not authenticated')
  );
}

export async function setSecureStorageMode(mode: SecureStorageMode, adapter: SecureStoreAdapter = createExpoSecureStoreAdapter()) {
  await adapter.setItem(STORAGE_MODE_KEY, mode);
}

export async function getSecureStorageMode(adapter: SecureStoreAdapter = createExpoSecureStoreAdapter()): Promise<SecureStorageMode> {
  const persisted = await adapter.getItem(STORAGE_MODE_KEY);

  if (
    persisted === 'authenticated-secure-store' ||
    persisted === 'secure-store-without-auth' ||
    persisted === 'defer-sensitive-persistence'
  ) {
    return persisted;
  }

  return 'authenticated-secure-store';
}

export function createSecureValueStore(options: { adapter?: SecureStoreAdapter } = {}) {
  const adapter = options.adapter ?? createExpoSecureStoreAdapter();

  return {
    async readValue(key: string, mode: SecureStorageMode): Promise<SecureReadResult> {
      try {
        const value = await adapter.getItem(key, mode === 'authenticated-secure-store' ? AUTH_OPTIONS : undefined);
        return { status: 'ok', value };
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

        if (mode === 'authenticated-secure-store' && isInvalidatedAuthError(message)) {
          await adapter.deleteItem(key);
          return {
            status: 'invalidated',
            value: null,
            message: 'Protected secure storage was invalidated. Re-run onboarding to restore this data.',
          };
        }

        throw error;
      }
    },
  };
}

export function getSecureStoreOptionsForMode(mode: SecureStorageMode): SecureStore.SecureStoreOptions | undefined {
  return mode === 'authenticated-secure-store' ? AUTH_OPTIONS : undefined;
}
