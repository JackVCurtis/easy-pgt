import * as Crypto from 'expo-crypto';

import type { RandomBytes } from './proximityKeys';

function createUuidV4FromRandomBytes(randomBytes: RandomBytes): string {
  const bytes = randomBytes(16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function getRandomBytes(length: number): Uint8Array {
  return Crypto.getRandomBytes(length);
}

export function createProximitySessionUuid(randomBytes: RandomBytes = getRandomBytes): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  return createUuidV4FromRandomBytes(randomBytes);
}
