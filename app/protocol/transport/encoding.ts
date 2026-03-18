import {
  decodeBase64 as decodeCanonicalBase64,
  encodeBase64,
  encodeHex,
} from '../crypto/encoding';

export { encodeBase64, encodeHex };

export function decodeBase64(input: string): Uint8Array | null {
  return decodeCanonicalBase64(input);
}

export function decodeBase64WithExpectedLength(input: string, expectedLength: number): Uint8Array | null {
  return decodeCanonicalBase64(input, expectedLength);
}
