import { decodeBase64, decodeBase64WithExpectedLength, encodeBase64, encodeHex } from '@/app/protocol/transport';

describe('transport encoding helpers', () => {
  it('encodes and decodes base64 deterministically', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);

    const encoded = encodeBase64(bytes);
    expect(encoded).toBe('AAECA/r7/P3+/w==');
    expect(decodeBase64(encoded)).toEqual(bytes);
  });

  it('supports base64url normalization while decoding', () => {
    expect(decodeBase64('AAECA_r7_P3-_w==')).toEqual(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]));
    expect(decodeBase64('__8')).toEqual(new Uint8Array([255, 255]));
  });

  it('rejects invalid base64', () => {
    expect(decodeBase64('%notbase64%')).toBeNull();
    expect(decodeBase64('AA=A')).toBeNull();
    expect(decodeBase64('A===')).toBeNull();
    expect(decodeBase64('AAA==')).toBeNull();
  });

  it('enforces expected decoded lengths when requested', () => {
    expect(decodeBase64WithExpectedLength('AAE=', 2)).toEqual(new Uint8Array([0, 1]));
    expect(decodeBase64WithExpectedLength('AAE=', 3)).toBeNull();
  });

  it('encodes hex deterministically', () => {
    expect(encodeHex(new Uint8Array([0, 1, 16, 255]))).toBe('000110ff');
  });
});
