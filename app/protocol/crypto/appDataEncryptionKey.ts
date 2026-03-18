import { generateEphemeralKeypair } from '@/app/protocol/crypto/crypto';
import {
  createExpoSecureStoreAdapter,
  readSecureStoreItemOrClearOnInvalidation,
  type SecureStoreAdapter,
} from '@/app/security/secureStorageContract';

export const APP_DATA_ENCRYPTION_KEY_STORAGE_KEY = 'comrades.app-data.encryption-key.v1';

export async function getOrCreateAppDataEncryptionKey(options: { adapter?: SecureStoreAdapter } = {}): Promise<string> {
  const adapter = options.adapter ?? createExpoSecureStoreAdapter();
  const existing = await readSecureStoreItemOrClearOnInvalidation(adapter, APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const generated = generateEphemeralKeypair().secretKey;
  await adapter.setItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, generated);

  return generated;
}
