const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Int16Array(256).fill(-1);

for (let index = 0; index < BASE64_TABLE.length; index += 1) {
  BASE64_LOOKUP[BASE64_TABLE.charCodeAt(index)] = index;
}

export function utf8Encode(str: string): Uint8Array {
  return textEncoder.encode(str);
}

export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

export function utf8ByteLength(str: string): number {
  return utf8Encode(str).length;
}

export function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const minLength = Math.min(left.length, right.length);

  for (let index = 0; index < minLength; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return left.length - right.length;
}

function normalizeBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;

  return padding === 0 ? normalized : `${normalized}${'='.repeat(4 - padding)}`;
}

export function encodeBase64(bytes: Uint8Array): string {
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    output += BASE64_TABLE[first >> 2];
    output += BASE64_TABLE[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    output += second === undefined ? '=' : BASE64_TABLE[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? '=' : BASE64_TABLE[third & 0x3f];
  }

  return output;
}

export function decodeBase64(input: string): Uint8Array | null {
  if (!input) {
    return null;
  }

  const normalized = normalizeBase64(input);
  if (normalized.length % 4 !== 0) {
    return null;
  }

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((normalized.length / 4) * 3 - padding);

  let outIndex = 0;
  for (let index = 0; index < normalized.length; index += 4) {
    const c1 = normalized.charCodeAt(index);
    const c2 = normalized.charCodeAt(index + 1);
    const c3 = normalized.charAt(index + 2);
    const c4 = normalized.charAt(index + 3);

    const v1 = BASE64_LOOKUP[c1];
    const v2 = BASE64_LOOKUP[c2];
    const v3 = c3 === '=' ? 0 : BASE64_LOOKUP[c3.charCodeAt(0)];
    const v4 = c4 === '=' ? 0 : BASE64_LOOKUP[c4.charCodeAt(0)];

    if (v1 < 0 || v2 < 0 || (c3 !== '=' && v3 < 0) || (c4 !== '=' && v4 < 0)) {
      return null;
    }

    const triplet = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;

    output[outIndex] = (triplet >> 16) & 0xff;
    outIndex += 1;

    if (c3 !== '=') {
      output[outIndex] = (triplet >> 8) & 0xff;
      outIndex += 1;
    }

    if (c4 !== '=') {
      output[outIndex] = triplet & 0xff;
      outIndex += 1;
    }
  }

  return output;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('hex string must have an even length');
  }

  const output = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    output[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return output;
}
