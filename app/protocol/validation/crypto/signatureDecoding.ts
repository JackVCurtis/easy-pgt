import bs58 from 'bs58';

import { decodeBase64 } from '@/app/utils/bytes';

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

function hasPrefix(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[i] !== prefix[i]) {
      return false;
    }
  }

  return true;
}

function decodeDidKeyPublicKey(input: string): Uint8Array | null {
  if (!input.startsWith('did:key:z')) {
    return null;
  }

  const multibase = input.slice('did:key:'.length);

  try {
    const decoded = bs58.decode(multibase.slice(1));
    if (!hasPrefix(decoded, ED25519_MULTICODEC_PREFIX)) {
      return null;
    }

    const key = decoded.slice(ED25519_MULTICODEC_PREFIX.length);
    return key.length === 32 ? new Uint8Array(key) : null;
  } catch {
    return null;
  }
}

export function decodePublicKey(publicKey: string): Uint8Array | null {
  const didKey = decodeDidKeyPublicKey(publicKey);
  if (didKey) {
    return didKey;
  }

  const decoded = decodeBase64(publicKey);
  return decoded && decoded.length === 32 ? decoded : null;
}

export function decodeSignature(signature: string): Uint8Array | null {
  const decoded = decodeBase64(signature);
  return decoded && decoded.length === 64 ? decoded : null;
}
