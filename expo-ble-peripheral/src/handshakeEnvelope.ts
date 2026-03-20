export type HandshakeEnvelope = {
  version: number;
  messageType: string;
  sessionId: string;
  payload: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export const MAX_HANDSHAKE_BYTES = 512;

export function parseHandshakeEnvelope(base64Payload: string): HandshakeEnvelope {
  const bytes = Uint8Array.from(atob(base64Payload))
  if (!bytes.length) {
    throw new Error('ERR_MALFORMED_HANDSHAKE: message is empty');
  }
  if (bytes.byteLength > MAX_HANDSHAKE_BYTES) {
    throw new Error(`ERR_HANDSHAKE_TOO_LARGE: message exceeds ${MAX_HANDSHAKE_BYTES} bytes`);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString());
  } catch {
    throw new Error('ERR_MALFORMED_HANDSHAKE: message must be valid JSON');
  }

  if (!decoded || typeof decoded !== 'object') {
    throw new Error('ERR_MALFORMED_HANDSHAKE: envelope must be an object');
  }

  const envelope = decoded as Partial<HandshakeEnvelope>;
  if (!Number.isInteger(envelope.version) || (envelope.version ?? 0) <= 0) {
    throw new Error('ERR_MALFORMED_HANDSHAKE: version must be a positive integer');
  }
  if (!envelope.messageType || typeof envelope.messageType !== 'string') {
    throw new Error('ERR_MALFORMED_HANDSHAKE: messageType is required');
  }
  if (!envelope.sessionId || typeof envelope.sessionId !== 'string' || !UUID_PATTERN.test(envelope.sessionId)) {
    throw new Error('ERR_MALFORMED_HANDSHAKE: sessionId must be a UUID');
  }
  if (!envelope.payload || typeof envelope.payload !== 'string' || !BASE64_PATTERN.test(envelope.payload)) {
    throw new Error('ERR_MALFORMED_HANDSHAKE: payload must be base64');
  }

  return envelope as HandshakeEnvelope;
}
