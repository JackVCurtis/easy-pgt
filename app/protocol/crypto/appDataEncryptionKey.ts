import { generateSecureSessionKey } from '@/app/crypto';
import {
  assertActiveSecureStorageAuthSession,
  createExpoSecureStoreAdapter,
  getActiveSecureStorageAuthSession,
  mapSecureStorageAuthErrorToRetryable,
  readSecureStoreItemOrClearOnInvalidation,
  type SecureStorageAuthSession,
  type SecureStoreAdapter,
} from '@/app/security/secureStorageContract';
import { cacheAppDataEncryptionKey, getCachedAppDataEncryptionKey } from '@/app/security/sessionEncryptionKey';

export const APP_DATA_ENCRYPTION_KEY_STORAGE_KEY = 'comrades.app-data.encryption-key.v1';

export async function getOrCreateAppDataEncryptionKey(options: {
  adapter?: SecureStoreAdapter;
  authSession?: SecureStorageAuthSession;
} = {}): Promise<string> {
  const cached = getCachedAppDataEncryptionKey();
  if (cached) {
    return cached;
  }

  const adapter = options.adapter ?? createExpoSecureStoreAdapter();
  const authSession = options.authSession ?? getActiveSecureStorageAuthSession();

  if (authSession) {
    assertActiveSecureStorageAuthSession(authSession);
  }

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

  const generated = generateSecureSessionKey();

  try {
    await adapter.setItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, generated);
  } catch (error) {
    throw mapSecureStorageAuthErrorToRetryable(error);
  }

  cacheAppDataEncryptionKey(generated);

  return generated;
}
