jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length: number) => Uint8Array.from({ length }, (_, index) => index & 0xff)),
  randomUUID: undefined,
}));

import * as Crypto from 'expo-crypto';

import { createProximitySessionUuid } from '@/app/features/proximity/proximityUuid';
import { isValidUUID } from '@/app/protocol/validation/formatValidators';

const originalCrypto = globalThis.crypto;

describe('createProximitySessionUuid', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: originalCrypto,
    });
    (Crypto as { randomUUID?: () => string }).randomUUID = undefined;
  });

  it('uses globalThis.crypto.randomUUID when available', () => {
    const nativeRandomUuid = jest.fn(() => '3df085f8-486f-42ac-929d-356082e4bf63');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: { randomUUID: nativeRandomUuid },
    });

    const expoRandomUuid = jest.fn(() => '8f2f8b3d-9933-47e7-bf9d-2af36f3a7791');
    (Crypto as { randomUUID?: () => string }).randomUUID = expoRandomUuid;

    const sessionUuid = createProximitySessionUuid();

    expect(sessionUuid).toBe('3df085f8-486f-42ac-929d-356082e4bf63');
    expect(nativeRandomUuid).toHaveBeenCalledTimes(1);
    expect(expoRandomUuid).not.toHaveBeenCalled();
    expect(isValidUUID(sessionUuid)).toBe(true);
  });

  it('falls back to expo-crypto randomUUID when native randomUUID is absent', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    (Crypto as { randomUUID?: () => string }).randomUUID = () => '8f2f8b3d-9933-47e7-bf9d-2af36f3a7791';

    const sessionUuid = createProximitySessionUuid();

    expect(sessionUuid).toBe('8f2f8b3d-9933-47e7-bf9d-2af36f3a7791');
    expect(isValidUUID(sessionUuid)).toBe(true);
  });

  it('builds RFC4122 v4 UUID from random bytes when randomUUID APIs are unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const randomBytes = () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const sessionUuid = createProximitySessionUuid(randomBytes);

    expect(sessionUuid).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(isValidUUID(sessionUuid)).toBe(true);
  });
});
