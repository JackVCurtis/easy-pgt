import '@testing-library/jest-native/extend-expect';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digest: jest.fn(async (_algorithm: string, data: Uint8Array) => {
    const { createHash } = require('crypto');
    const digestBuffer = createHash('sha256').update(data).digest();
    return digestBuffer.buffer.slice(
      digestBuffer.byteOffset,
      digestBuffer.byteOffset + digestBuffer.byteLength,
    );
  }),
}), { virtual: true });
