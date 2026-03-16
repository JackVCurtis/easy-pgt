import nacl from 'tweetnacl';

import type { DurableRecord } from '@/app/protocol/records';
import { deriveSigningPayloadBytes } from '@/app/protocol/validation/crypto/signingPayload';

import { decodeBase64, decodePublicKey, encodeBase64 } from './encoding';

const ED25519_SECRET_KEY_LENGTH = 64;
const ED25519_PUBLIC_KEY_LENGTH = 32;
const ED25519_SEED_LENGTH = 32;
const CURVE25519_SECRET_KEY_LENGTH = 32;
const CURVE25519_PUBLIC_KEY_LENGTH = 32;
const SIGNATURE_LENGTH = 64;

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
    throw new Error('Invalid Ed25519 secret key encoding');
  }

  return decoded;
}

function decodeEphemeralSecretKey(secretKey: string): Uint8Array {
  const decoded = decodeBase64(secretKey, CURVE25519_SECRET_KEY_LENGTH);
  if (!decoded) {
    throw new Error('Invalid Curve25519 secret key encoding');
  }

  return decoded;
}

function decodeSignature(signature: string): Uint8Array {
  const decoded = decodeBase64(signature, SIGNATURE_LENGTH);
  if (!decoded) {
    throw new Error('Invalid signature encoding');
  }

  return decoded;
}

function decodePeerPublicKey(publicKey: string): Uint8Array {
  const decoded = decodePublicKey(publicKey);
  if (!decoded || decoded.length !== CURVE25519_PUBLIC_KEY_LENGTH) {
    throw new Error('Invalid public key encoding');
  }

  return decoded;
}

function derivePayloadBytes(recordOrBytes: DurableRecord | Record<string, unknown> | Uint8Array): Uint8Array {
  if (recordOrBytes instanceof Uint8Array) {
    return cloneBytes(recordOrBytes);
  }

  return deriveSigningPayloadBytes(recordOrBytes as Record<string, unknown>);
}

export function generateIdentityKeypair(options: GenerateIdentityKeypairOptions = {}): EncodedIdentityKeypair {
  if (options.seed && options.seed.length !== ED25519_SEED_LENGTH) {
    throw new Error('Identity seed must be 32 bytes');
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
    throw new Error('Ephemeral secret key must be 32 bytes');
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

export function signRecord(record: DurableRecord | Record<string, unknown>, signerSecretKey: string): string {
  const payloadBytes = deriveSigningPayloadBytes(record as Record<string, unknown>);
  const decodedSecretKey = decodeIdentitySecretKey(signerSecretKey);
  const signature = nacl.sign.detached(payloadBytes, decodedSecretKey);

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

  return nacl.sign.detached.verify(payloadBytes, decodedSignature, decodedPublicKey);
}

export type DerivedSharedSecret = {
  sharedSecret: string;
  sharedSecretBytes: Uint8Array;
};

export function deriveSharedSecret(localSecretKey: string, peerPublicKey: string): DerivedSharedSecret {
  const localSecretKeyBytes = decodeEphemeralSecretKey(localSecretKey);
  const peerPublicKeyBytes = decodePeerPublicKey(peerPublicKey);
  const sharedSecretBytes = nacl.scalarMult(localSecretKeyBytes, peerPublicKeyBytes);

  return {
    sharedSecret: encodeBase64(sharedSecretBytes),
    sharedSecretBytes: cloneBytes(sharedSecretBytes),
  };
}

export function decodeSignatureStrict(signature: string): Uint8Array {
  return decodeSignature(signature);
}
