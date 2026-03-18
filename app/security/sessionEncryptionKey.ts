let cachedAppDataEncryptionKey: string | null = null;

export function getCachedAppDataEncryptionKey(): string | null {
  return cachedAppDataEncryptionKey;
}

export function cacheAppDataEncryptionKey(encryptionKey: string): void {
  cachedAppDataEncryptionKey = encryptionKey;
}

export function clearCachedAppDataEncryptionKey(): void {
  cachedAppDataEncryptionKey = null;
}
