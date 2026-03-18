import nacl from 'tweetnacl';

import { getOrCreateAppDataEncryptionKey } from '@/app/protocol/crypto/appDataEncryptionKey';
import {
  createExpoSecureStoreAdapter,
  type SecureStoreAdapter,
} from '@/app/security/secureStorage';
import { decodeBase64, encodeBase64, utf8Encode } from '@/app/utils/bytes';

import { readAppStateSnapshot, type AppStateDto } from './appState';

const APP_STATE_PERSISTENCE_PAYLOAD_VERSION = 1;
const APP_STATE_SCHEMA_VERSION = 1;
const SECRETBOX_KEY_LENGTH = 32;
const SECRETBOX_NONCE_LENGTH = 24;

export const APP_STATE_SECURE_PAYLOAD_STORAGE_KEY = 'comrades.app-state.secure-payload.v1';

export type PersistedSecureAppStatePayload = {
  payloadVersion: number;
  stateSchemaVersion: number;
  algorithm: 'xsalsa20-poly1305';
  persistedAtMs: number;
  nonce: string;
  ciphertext: string;
};

export type PersistSecureAppStateOptions = {
  adapter?: SecureStoreAdapter;
  readAppState?: () => AppStateDto | Record<string, unknown>;
  getEncryptionKey?: () => Promise<string>;
  randomBytes?: (length: number) => Uint8Array;
  now?: () => number;
};

function assertSecretboxKeyBytes(encodedKey: string): Uint8Array {
  const keyBytes = decodeBase64(encodedKey);

  if (!keyBytes || keyBytes.length !== SECRETBOX_KEY_LENGTH) {
    throw new Error('APP_STATE_ENCRYPTION_KEY_INVALID: App-data encryption key must be a 32-byte base64 value.');
  }

  return keyBytes;
}

function buildPersistedPayload(params: {
  serializedStateBytes: Uint8Array;
  keyBytes: Uint8Array;
  randomBytes: (length: number) => Uint8Array;
  now: () => number;
}): PersistedSecureAppStatePayload {
  const nonce = params.randomBytes(SECRETBOX_NONCE_LENGTH);
  const ciphertext = nacl.secretbox(params.serializedStateBytes, nonce, params.keyBytes);

  return {
    payloadVersion: APP_STATE_PERSISTENCE_PAYLOAD_VERSION,
    stateSchemaVersion: APP_STATE_SCHEMA_VERSION,
    algorithm: 'xsalsa20-poly1305',
    persistedAtMs: params.now(),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

export async function persistSecureAppState(options: PersistSecureAppStateOptions = {}): Promise<void> {
  const adapter = options.adapter ?? createExpoSecureStoreAdapter();
  const readAppState = options.readAppState ?? readAppStateSnapshot;
  const getEncryptionKey = options.getEncryptionKey ?? getOrCreateAppDataEncryptionKey;
  const randomBytes = options.randomBytes ?? nacl.randomBytes;
  const now = options.now ?? Date.now;

  const state = readAppState();
  const serializedStateBytes = utf8Encode(JSON.stringify(state));
  const keyBytes = assertSecretboxKeyBytes(await getEncryptionKey());
  const payload = buildPersistedPayload({
    serializedStateBytes,
    keyBytes,
    randomBytes,
    now,
  });

  await adapter.setItem(APP_STATE_SECURE_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
}
