import bs58 from 'bs58';

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);
const BASE64_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

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

function normalizeBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;

  if (padding === 0) {
    return normalized;
  }

  return `${normalized}${'='.repeat(4 - padding)}`;
}

export function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function decodeBase64(input: string, expectedLength: number): Uint8Array | null {
  if (!input || input.length === 0) {
    return null;
  }

  const normalized = normalizeBase64(input);
  if (!BASE64_ALPHABET.test(normalized)) {
    return null;
  }

  try {
    const decoded = new Uint8Array(Buffer.from(normalized, 'base64'));
    if (decoded.length !== expectedLength) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
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
