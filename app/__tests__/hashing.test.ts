import { computeLeafHash, computeRecordHash } from '@/app/crypto/hashing';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('domain-separated hashing helpers', () => {
  it('produces deterministic record hashes for identical canonical bytes', async () => {
    const canonicalBytes = new TextEncoder().encode('abc');

    const first = await computeRecordHash(canonicalBytes);
    const second = await computeRecordHash(canonicalBytes);

    expect(toHex(first)).toBe('a1f3ee508469c36640f2206ab1480fa928026bf2052b3861e0650380e2395aa0');
    expect(toHex(second)).toBe(toHex(first));
  });

  it('produces deterministic leaf hashes for identical record hashes', async () => {
    const recordHash = new Uint8Array(
      Buffer.from('a1f3ee508469c36640f2206ab1480fa928026bf2052b3861e0650380e2395aa0', 'hex'),
    );

    const first = await computeLeafHash(recordHash);
    const second = await computeLeafHash(recordHash);

    expect(toHex(first)).toBe('35dc56edb4b66318a5be7f620151abb6f605716fc2e58bc4f945dd8feddd2145');
    expect(toHex(second)).toBe(toHex(first));
  });

  it('enforces domain separation between record and leaf prefixes', async () => {
    const bytes = new TextEncoder().encode('abc');

    const recordHash = await computeRecordHash(bytes);
    const leafLikeHash = await computeLeafHash(bytes);

    expect(toHex(recordHash)).not.toBe(toHex(leafLikeHash));
    expect(toHex(leafLikeHash)).toBe('b27a6192bc31c5026b6fd946d68e9039ff57a1ac6ff1d8ac9dcfb3f5276cb65d');
  });

  it('matches canonical parity for leaf hash derivation', async () => {
    const bytes = new TextEncoder().encode('abc');

    const recordHash = await computeRecordHash(bytes);
    const leafHash = await computeLeafHash(recordHash);

    expect(toHex(leafHash)).toBe('35dc56edb4b66318a5be7f620151abb6f605716fc2e58bc4f945dd8feddd2145');
  });

  it('supports empty and large canonical byte payloads', async () => {
    const emptyBytes = new Uint8Array();
    const largeBytes = new Uint8Array(4096).fill('x'.charCodeAt(0));

    const emptyRecordHash = await computeRecordHash(emptyBytes);
    const emptyLeafHash = await computeLeafHash(emptyRecordHash);

    const largeRecordHash = await computeRecordHash(largeBytes);
    const largeLeafHash = await computeLeafHash(largeRecordHash);

    expect(toHex(emptyRecordHash)).toBe('36c4b87234ed9ca3fa30c2355d3efee021f8e48e5fc02fc93c56700190fe6298');
    expect(toHex(emptyLeafHash)).toBe('55fd24420011ffe3b9cf9e5ed9e34dd06091122a8c82e1966c2b24195dd8a35c');

    expect(toHex(largeRecordHash)).toBe('841f77091c59ac04b793fde001251e32ac359d1ee1cc6f01e84987a4e630bf39');
    expect(toHex(largeLeafHash)).toBe('d799b99cd9a34d8a44228adf89b89ed9146b6d98a5d77a8e301b6e881c5f9c19');
  });
});
