const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Char(char: string): number {
  return BASE64_ALPHABET.indexOf(char);
}

export function encodeBase64(bytes: Uint8Array): string {
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;

    const triple = (a << 16) | (b << 8) | c;
    output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }

  return output;
}

function normalizeBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return padding === 0 ? normalized : `${normalized}${'='.repeat(4 - padding)}`;
}

export function decodeBase64(input: string): Uint8Array | null {
  const normalized = normalizeBase64(input);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return null;
  }

  const bytes: number[] = [];

  for (let i = 0; i < normalized.length; i += 4) {
    const c1 = normalized[i] ?? '=';
    const c2 = normalized[i + 1] ?? '=';
    const c3 = normalized[i + 2] ?? '=';
    const c4 = normalized[i + 3] ?? '=';

    const v1 = decodeBase64Char(c1);
    const v2 = decodeBase64Char(c2);
    const v3 = c3 === '=' ? 0 : decodeBase64Char(c3);
    const v4 = c4 === '=' ? 0 : decodeBase64Char(c4);

    if (v1 < 0 || v2 < 0 || (c3 !== '=' && v3 < 0) || (c4 !== '=' && v4 < 0)) {
      return null;
    }

    const triple = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;
    bytes.push((triple >> 16) & 0xff);

    if (c3 !== '=') {
      bytes.push((triple >> 8) & 0xff);
    }

    if (c4 !== '=') {
      bytes.push(triple & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

export function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
