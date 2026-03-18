import bs58 from 'bs58';

import { concatBytes, decodeBase64 as decodeBase64Bytes, encodeBase64 as encodeBase64Bytes, encodeHex as encodeHexBytes } from '@/app/utils/bytes';

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

function hasPrefix(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (bytes[index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}

export function encodeBase64(bytes: Uint8Array): string {
  return encodeBase64Bytes(bytes);
}

export function decodeBase64(input: string, expectedLength?: number): Uint8Array | null {
  if (!input || input.length === 0) {
    return null;
  }

  const decoded = decodeBase64Bytes(input);
  if (!decoded) {
    return null;
  }

  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    return null;
  }

  return decoded;
}

export function encodeHex(bytes: Uint8Array): string {
  return encodeHexBytes(bytes);
}

function decodeDidKeyPublicKey(input: string): Uint8Array | null {
  if (!input.startsWith('did:key:z')) {
    return null;
  }

  try {
    const multibaseBody = input.slice('did:key:z'.length);
    const decoded = new Uint8Array(bs58.decode(multibaseBody));
    if (!hasPrefix(decoded, ED25519_MULTICODEC_PREFIX)) {
      return null;
    }

    const key = decoded.slice(ED25519_MULTICODEC_PREFIX.length);
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encodeDidKeyPublicKey(publicKey: Uint8Array): string {
  return `did:key:z${bs58.encode(concatBytes([ED25519_MULTICODEC_PREFIX, publicKey]))}`;
}

export function decodePublicKey(input: string): Uint8Array | null {
  const didKey = decodeDidKeyPublicKey(input);
  if (didKey) {
    return didKey;
  }

  return decodeBase64(input, 32);
}
