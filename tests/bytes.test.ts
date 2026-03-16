import { createHash } from 'crypto';

import { concatBytes, hexToBytes, utf8ByteLength, utf8Decode, utf8Encode } from '@/app/utils/bytes';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('bytes utilities', () => {
  it('supports UTF-8 round-trip for multibyte strings', () => {
    const original = 'Hello 👋🏽 café';

    const encoded = utf8Encode(original);
    const decoded = utf8Decode(encoded);

    expect(decoded).toBe(original);
  });

  it('concatenates byte arrays in order', () => {
    const combined = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])]);

    expect(Array.from(combined)).toEqual([1, 2, 3, 4, 5]);
  });

  it('matches UTF-8 byte length expectations', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('preserves hashing inputs when preparing concatenated bytes', () => {
    const prefix = utf8Encode('record:v1:');
    const digestInput = concatBytes([prefix, hexToBytes('a1f3ee508469c36640f2206ab1480fa928026bf2052b3861e0650380e2395aa0')]);

    const digest = createHash('sha256').update(digestInput).digest('hex');

    expect(digest).toBe('7b88e83085dd4ad82d4514dc0e7f7b6d12a695c2b8ef6582ad76bf77aff75d16');
    expect(toHex(digestInput).startsWith(toHex(prefix))).toBe(true);
  });
});
