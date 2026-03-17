import { generateIdentityKeypair } from './crypto';
import { decodeBase64, decodePublicKey } from './encoding';
import { createSecureKeyStorage, type SecureKeyStorage, type StoredIdentityKeypair } from './keyStorage';

const IDENTITY_SECRET_KEY_LENGTH = 64;
const IDENTITY_SEED_LENGTH = 32;
const IDENTITY_PUBLIC_KEY_LENGTH = 32;

export type IdentityKeyManagerOptions = {
  storage?: SecureKeyStorage;
};

function assertEncodedIdentityKeypair(keypair: StoredIdentityKeypair): void {
  const secretKeyBytes = decodeBase64(keypair.secretKey, IDENTITY_SECRET_KEY_LENGTH);
  const publicKeyBytes = decodePublicKey(keypair.publicKey);

  if (!secretKeyBytes || !publicKeyBytes || publicKeyBytes.length !== IDENTITY_PUBLIC_KEY_LENGTH) {
    throw new Error('Identity keypair is corrupted');
  }

  const derivedPublicKey = generateIdentityKeypair({ seed: secretKeyBytes.slice(0, IDENTITY_SEED_LENGTH) }).publicKey;
  if (derivedPublicKey !== keypair.publicKey) {
    throw new Error('Identity keypair is corrupted');
  }
}

function resolveStorage(options: IdentityKeyManagerOptions = {}): SecureKeyStorage {
  return options.storage ?? createSecureKeyStorage();
}

export async function getOrCreateIdentityKeypair(
  options: IdentityKeyManagerOptions = {}
): Promise<StoredIdentityKeypair> {
  const storage = resolveStorage(options);
  const existing = await storage.loadIdentityKeypair();

  if (existing) {
    assertEncodedIdentityKeypair(existing);
    return existing;
  }

  const generated = generateIdentityKeypair();
  const created: StoredIdentityKeypair = {
    version: 1,
    publicKey: generated.publicKey,
    secretKey: generated.secretKey,
  };

  assertEncodedIdentityKeypair(created);
  await storage.saveIdentityKeypair(created);

  return created;
}

export async function loadIdentityKeypair(options: IdentityKeyManagerOptions = {}): Promise<StoredIdentityKeypair | null> {
  const keypair = await resolveStorage(options).loadIdentityKeypair();

  if (!keypair) {
    return null;
  }

  assertEncodedIdentityKeypair(keypair);
  return keypair;
}

export async function deleteIdentityKeypair(options: IdentityKeyManagerOptions = {}): Promise<void> {
  await resolveStorage(options).deleteIdentityKeypair();
}

export async function rotateIdentityKeypair(): Promise<never> {
  throw new Error('Identity key rotation is not supported');
}
