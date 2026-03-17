import SettingsStorage from 'expo-settings-storage';

import { generateEphemeralKeypair } from '@/app/protocol/crypto/crypto';

export const APP_DATA_ENCRYPTION_KEY_STORAGE_KEY = 'comrades.app-data.encryption-key.v1';

export async function getOrCreateAppDataEncryptionKey(): Promise<string> {
  const existing = await SettingsStorage.getItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const generated = generateEphemeralKeypair().secretKey;
  await SettingsStorage.setItem(APP_DATA_ENCRYPTION_KEY_STORAGE_KEY, generated);

  return generated;
}
