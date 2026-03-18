import { generateSecureSessionKey } from '@/app/crypto';
import {
  createExpoSecureStoreAdapter,
  readSecureStoreItemOrClearOnInvalidation,
  type SecureStoreAdapter,
} from '@/app/security/secureStorageContract';
import { cacheAppDataEncryptionKey, getCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';

export const APP_DATA_ENCRYPTION_KEY_STORAGE_KEY = 'comrades.app-data.encryption-key.v1';

export async function getOrCreateAppDataEncryptionKey(options: { adapter?: SecureStoreAdapter } = {}): Promise<string> {
  const cached = getCachedAppDataEncryptionKey();
  if (cached) {
    return cached;
  }

  const adapter = options.adapter ?? createExpoSecureStoreAdapter();
  const existing = await readSecureStoreItemOrClearOnInvalidation(adapter, APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);

  if (existing) {
    cacheAppDataEncryptionKey(existing);
    return existing;
  }

  const generated = generateSecureSessionKey();
  await adapter.setItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, generated);
  cacheAppDataEncryptionKey(generated);

  return generated;
}
