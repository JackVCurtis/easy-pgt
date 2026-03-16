import * as SecureStore from 'expo-secure-store';

import { generateIdentityKeypair } from './crypto';
import { decodeBase64 } from './encoding';

const DEFAULT_IDENTITY_KEYPAIR_STORAGE_KEY = 'pgt.identity.keypair.v1';

export type StoredIdentityKeypair = {
  version: 1;
  publicKey: string;
  secretKey: string;
};

export interface SecureKeyStorage {
  loadIdentityKeypair(): Promise<StoredIdentityKeypair | null>;
  saveIdentityKeypair(keypair: StoredIdentityKeypair): Promise<void>;
  deleteIdentityKeypair(): Promise<void>;
}

export type SecureStoreAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

function assertStoredIdentityKeypair(candidate: unknown): asserts candidate is StoredIdentityKeypair {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Stored identity keypair is corrupted');
  }

  const value = candidate as Partial<StoredIdentityKeypair>;
  if (value.version !== 1 || typeof value.publicKey !== 'string' || typeof value.secretKey !== 'string') {
    throw new Error('Stored identity keypair is corrupted');
  }

  const decodedSecretKey = decodeBase64(value.secretKey, 64);
  const decodedPublicKey = decodeBase64(value.publicKey, 32);
  if (!decodedSecretKey || !decodedPublicKey) {
    throw new Error('Stored identity keypair is corrupted');
  }

  const derivedPublicKey = generateIdentityKeypair({ seed: decodedSecretKey.slice(0, 32) }).publicKey;
  if (derivedPublicKey !== value.publicKey) {
    throw new Error('Stored identity keypair is corrupted');
  }
}

export function createExpoSecureStoreAdapter(): SecureStoreAdapter {
  return {
    async getItem(key: string) {
      return SecureStore.getItemAsync(key);
    },
    async setItem(key: string, value: string) {
      await SecureStore.setItemAsync(key, value);
    },
    async deleteItem(key: string) {
      await SecureStore.deleteItemAsync(key);
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

export function createSecureKeyStorage(
  adapter: SecureStoreAdapter = createExpoSecureStoreAdapter(),
  storageKey = DEFAULT_IDENTITY_KEYPAIR_STORAGE_KEY
): SecureKeyStorage {
  return {
    async loadIdentityKeypair() {
      const raw = await adapter.getItem(storageKey);
      if (!raw) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Stored identity keypair is corrupted');
      }

      assertStoredIdentityKeypair(parsed);
      return parsed;
    },

    async saveIdentityKeypair(keypair: StoredIdentityKeypair) {
      assertStoredIdentityKeypair(keypair);
      await adapter.setItem(storageKey, JSON.stringify(keypair));
    },

    async deleteIdentityKeypair() {
      await adapter.deleteItem(storageKey);
    },
  };
}
