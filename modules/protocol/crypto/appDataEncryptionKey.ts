import { generateRandomBytes } from '@/modules/protocol/crypto/crypto';
import {
  createExpoSecureStoreAdapter,
  mapSecureStorageAuthErrorToRetryable,
  readSecureStoreItemOrClearOnInvalidation
} from '@/modules/security/secureStorageContract';
import { cacheAppDataEncryptionKey, getCachedAppDataEncryptionKey } from '@/modules/security/sessionEncryptionKey';
import { encodeHex } from './encoding';

export const APP_DATA_ENCRYPTION_KEY_STORAGE_KEY = 'comrades.app-data.encryption-key.v1';

export async function getOrCreateAppDataEncryptionKey(): Promise<string> {
  const cached = getCachedAppDataEncryptionKey();
  if (cached) {
    return cached;
  }

  const adapter = createExpoSecureStoreAdapter();

  let existing: string | null;

  try {
    existing = await readSecureStoreItemOrClearOnInvalidation(adapter, APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);
  } catch (error) {
    throw mapSecureStorageAuthErrorToRetryable(error);
  }

  if (existing) {
    cacheAppDataEncryptionKey(existing);
    return existing;
  }

  const generated = encodeHex(generateRandomBytes(32));

  try {
    await adapter.setItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, generated);
  } catch (error) {
    throw mapSecureStorageAuthErrorToRetryable(error);
  }

  cacheAppDataEncryptionKey(generated);

  return generated;
}
