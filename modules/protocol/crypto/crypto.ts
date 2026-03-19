import 'react-native-get-random-values';

import nacl from 'tweetnacl';

import type { DurableRecord } from '@/modules/protocol/records';
import { deriveSigningPayloadBytes } from '@/modules/protocol/validation/crypto/signingPayload';

import { decodeBase64, decodePublicKey, encodeBase64 } from './encoding';

const ED25519_SECRET_KEY_LENGTH = 64;
const ED25519_PUBLIC_KEY_LENGTH = 32;
const ED25519_SEED_LENGTH = 32;
const CURVE25519_SECRET_KEY_LENGTH = 32;
const CURVE25519_PUBLIC_KEY_LENGTH = 32;
const SIGNATURE_LENGTH = 64;
const SECRETBOX_KEY_LENGTH = 32;
const SECRETBOX_NONCE_LENGTH = 24;

const CRYPTO_ERROR_MESSAGES = {
  invalidEd25519SecretKey: 'CRYPTO_INVALID_ED25519_SECRET_KEY: Invalid Ed25519 secret key encoding',
  invalidCurve25519SecretKey: 'CRYPTO_INVALID_CURVE25519_SECRET_KEY: Invalid Curve25519 secret key encoding',
  invalidSignature: 'CRYPTO_INVALID_SIGNATURE_ENCODING: Invalid signature encoding',
  invalidPublicKey: 'CRYPTO_INVALID_PUBLIC_KEY_ENCODING: Invalid public key encoding',
  invalidIdentitySeed: 'CRYPTO_INVALID_IDENTITY_SEED_LENGTH: Identity seed must be 32 bytes',
  invalidEphemeralSecretLength: 'CRYPTO_INVALID_EPHEMERAL_SECRET_KEY_LENGTH: Ephemeral secret key must be 32 bytes',
  invalidSecretboxKeyLength: 'CRYPTO_INVALID_SECRETBOX_KEY_LENGTH: Secretbox key must be 32 bytes',
  invalidSecretboxNonceLength: 'CRYPTO_INVALID_SECRETBOX_NONCE_LENGTH: Secretbox nonce must be 24 bytes',
} as const;

export type EncodedIdentityKeypair = {
  publicKey: string;
  secretKey: string;
  publicKeyBytes: Uint8Array;
  secretKeyBytes: Uint8Array;
};

export type EncodedEphemeralKeypair = {
  publicKey: string;
  secretKey: string;
  publicKeyBytes: Uint8Array;
  secretKeyBytes: Uint8Array;
};

export type SigningKeypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type BoxKeypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type GenerateIdentityKeypairOptions = {
  seed?: Uint8Array;
};

export type GenerateEphemeralKeypairOptions = {
  secretKey?: Uint8Array;
};

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice();
}

function decodeIdentitySecretKey(secretKey: string): Uint8Array {
  const decoded = decodeBase64(secretKey, ED25519_SECRET_KEY_LENGTH);
  if (!decoded) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidEd25519SecretKey);
  }

  return decoded;
}

function decodeEphemeralSecretKey(secretKey: string): Uint8Array {
  const decoded = decodeBase64(secretKey, CURVE25519_SECRET_KEY_LENGTH);
  if (!decoded) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidCurve25519SecretKey);
  }

  return decoded;
}

function decodeSignature(signature: string): Uint8Array {
  const decoded = decodeBase64(signature, SIGNATURE_LENGTH);
  if (!decoded) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidSignature);
  }

  return decoded;
}

function decodePeerPublicKey(publicKey: string): Uint8Array {
  const decoded = decodePublicKey(publicKey);
  if (!decoded || decoded.length !== CURVE25519_PUBLIC_KEY_LENGTH) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidPublicKey);
  }

  return decoded;
}

function derivePayloadBytes(recordOrBytes: DurableRecord | Record<string, unknown> | Uint8Array): Uint8Array {
  if (recordOrBytes instanceof Uint8Array) {
    return cloneBytes(recordOrBytes);
  }

  return deriveSigningPayloadBytes(recordOrBytes as Record<string, unknown>);
}

function assertLength(bytes: Uint8Array, length: number, errorMessage: string): void {
  if (bytes.length !== length) {
    throw new Error(errorMessage);
  }
}

export function generateIdentityKeypair(options: GenerateIdentityKeypairOptions = {}): EncodedIdentityKeypair {
  if (options.seed && options.seed.length !== ED25519_SEED_LENGTH) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidIdentitySeed);
  }

  const keypair = options.seed ? nacl.sign.keyPair.fromSeed(options.seed) : nacl.sign.keyPair();

  return {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
    publicKeyBytes: cloneBytes(keypair.publicKey),
    secretKeyBytes: cloneBytes(keypair.secretKey),
  };
}

export function generateEphemeralKeypair(options: GenerateEphemeralKeypairOptions = {}): EncodedEphemeralKeypair {
  if (options.secretKey && options.secretKey.length !== CURVE25519_SECRET_KEY_LENGTH) {
    throw new Error(CRYPTO_ERROR_MESSAGES.invalidEphemeralSecretLength);
  }

  const keypair = options.secretKey
    ? nacl.box.keyPair.fromSecretKey(options.secretKey)
    : nacl.box.keyPair();

  return {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
    publicKeyBytes: cloneBytes(keypair.publicKey),
    secretKeyBytes: cloneBytes(keypair.secretKey),
  };
}

export function generateSigningKeypair(): SigningKeypair {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: cloneBytes(keypair.publicKey),
    secretKey: cloneBytes(keypair.secretKey),
  };
}

export function generateSigningKeypairFromSeed(seed: Uint8Array): SigningKeypair {
  assertLength(seed, ED25519_SEED_LENGTH, CRYPTO_ERROR_MESSAGES.invalidIdentitySeed);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: cloneBytes(keypair.publicKey),
    secretKey: cloneBytes(keypair.secretKey),
  };
}

export function generateBoxKeypair(): BoxKeypair {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: cloneBytes(keypair.publicKey),
    secretKey: cloneBytes(keypair.secretKey),
  };
}

export function generateBoxKeypairFromSecretKey(secretKey: Uint8Array): BoxKeypair {
  assertLength(secretKey, CURVE25519_SECRET_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidEphemeralSecretLength);
  const keypair = nacl.box.keyPair.fromSecretKey(secretKey);
  return {
    publicKey: cloneBytes(keypair.publicKey),
    secretKey: cloneBytes(keypair.secretKey),
  };
}

export function signDetached(payloadBytes: Uint8Array, secretKey: Uint8Array): Uint8Array {
  assertLength(secretKey, ED25519_SECRET_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidEd25519SecretKey);
  return nacl.sign.detached(payloadBytes, secretKey);
}

export function verifyDetached(payloadBytes: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length !== SIGNATURE_LENGTH || publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    return false;
  }

  return nacl.sign.detached.verify(payloadBytes, signature, publicKey);
}

export function scalarMultSharedSecret(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  assertLength(secretKey, CURVE25519_SECRET_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidEphemeralSecretLength);
  assertLength(publicKey, CURVE25519_PUBLIC_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidPublicKey);
  return nacl.scalarMult(secretKey, publicKey);
}

export function hashBytes(input: Uint8Array): Uint8Array {
  return nacl.hash(input);
}

export function sealSecretbox(plaintext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
  assertLength(nonce, SECRETBOX_NONCE_LENGTH, CRYPTO_ERROR_MESSAGES.invalidSecretboxNonceLength);
  assertLength(key, SECRETBOX_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidSecretboxKeyLength);
  return nacl.secretbox(plaintext, nonce, key);
}

export function openSecretbox(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
  assertLength(nonce, SECRETBOX_NONCE_LENGTH, CRYPTO_ERROR_MESSAGES.invalidSecretboxNonceLength);
  assertLength(key, SECRETBOX_KEY_LENGTH, CRYPTO_ERROR_MESSAGES.invalidSecretboxKeyLength);
  return nacl.secretbox.open(ciphertext, nonce, key);
}

export function generateRandomBytes(length: number): Uint8Array {
  return nacl.randomBytes(length);
}

export function signRecord(record: DurableRecord | Record<string, unknown>, signerSecretKey: string): string {
  const payloadBytes = deriveSigningPayloadBytes(record as Record<string, unknown>);
  const decodedSecretKey = decodeIdentitySecretKey(signerSecretKey);
  const signature = signDetached(payloadBytes, decodedSecretKey);

  return encodeBase64(signature);
}

export function verifySignature(
  recordOrBytes: DurableRecord | Record<string, unknown> | Uint8Array,
  signature: string,
  signerPublicKey: string
): boolean {
  const payloadBytes = derivePayloadBytes(recordOrBytes);

  const decodedSignature = decodeBase64(signature, SIGNATURE_LENGTH);
  if (!decodedSignature) {
    return false;
  }

  const decodedPublicKey = decodePublicKey(signerPublicKey);
  if (!decodedPublicKey || decodedPublicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    return false;
  }

  return verifyDetached(payloadBytes, decodedSignature, decodedPublicKey);
}

export type DerivedSharedSecret = {
  sharedSecret: string;
  sharedSecretBytes: Uint8Array;
};

export function deriveSharedSecret(localSecretKey: string, peerPublicKey: string): DerivedSharedSecret {
  const localSecretKeyBytes = decodeEphemeralSecretKey(localSecretKey);
  const peerPublicKeyBytes = decodePeerPublicKey(peerPublicKey);
  const sharedSecretBytes = scalarMultSharedSecret(localSecretKeyBytes, peerPublicKeyBytes);

  return {
    sharedSecret: encodeBase64(sharedSecretBytes),
    sharedSecretBytes: cloneBytes(sharedSecretBytes),
  };
}

export function decodeSignatureStrict(signature: string): Uint8Array {
  return decodeSignature(signature);
}
