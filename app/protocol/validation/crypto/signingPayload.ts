const textEncoder = new TextEncoder();

function u32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value, false);
  return bytes;
}

function u64Bytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, value, false);
  return bytes;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function integerBytes(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('canonical serializer only supports non-negative integers');
  }

  if (value === 0) {
    return new Uint8Array([0]);
  }

  const bytes: number[] = [];
  let remainder = value;

  while (remainder > 0) {
    bytes.push(remainder & 0xff);
    remainder = Math.floor(remainder / 256);
  }

  return new Uint8Array(bytes.reverse());
}

function timestampBytes(value: string): Uint8Array {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error(`invalid timestamp value: ${value}`);
  }

  return u64Bytes(BigInt(timestamp));
}

function encodeValue(field: string, value: unknown): Uint8Array {
  if (typeof value === 'string') {
    if (field.endsWith('_at')) {
      return timestampBytes(value);
    }
    return textEncoder.encode(value);
  }

  if (typeof value === 'number') {
    return integerBytes(value);
  }

  if (typeof value === 'boolean') {
    return new Uint8Array([value ? 1 : 0]);
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return canonicalSerialize(value as Record<string, unknown>);
  }

  throw new Error(`unsupported canonical value for field: ${field}`);
}

export function canonicalSerialize(record: Record<string, unknown>): Uint8Array {
  const fields = Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8')));

  const serializedFields = fields.map(([fieldName, value]) => {
    const fieldNameBytes = textEncoder.encode(fieldName);
    const valueBytes = encodeValue(fieldName, value);

    return concat([u32Bytes(fieldNameBytes.length), fieldNameBytes, u32Bytes(valueBytes.length), valueBytes]);
  });

  return concat(serializedFields);
}

function signingPayload(record: Record<string, unknown>): Record<string, unknown> {
  switch (record.record_type) {
    case 'identity_binding': {
      const { self_signature: _selfSignature, ...payload } = record;
      return payload;
    }
    case 'endorsement': {
      const { signature: _signature, ...payload } = record;
      return payload;
    }
    case 'handshake': {
      const { signatures: _signatures, ...payload } = record;
      return payload;
    }
    case 'key_rotation': {
      const { signatures: _signatures, ...payload } = record;
      return payload;
    }
    case 'revocation': {
      const { signature: _signature, ...payload } = record;
      return payload;
    }
    default:
      return record;
  }
}

export function deriveSigningPayloadBytes(record: Record<string, unknown>): Uint8Array {
  return canonicalSerialize(signingPayload(record));
}
