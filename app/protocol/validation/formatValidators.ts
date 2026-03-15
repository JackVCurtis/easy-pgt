const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const DID_KEY_REGEX = /^did:key:[A-Za-z0-9]+$/;
const BASE64ISH_REGEX = /^[A-Za-z0-9+/=_-]+$/;
const HEX_HASH_REGEX = /^[a-f0-9]{64}$/i;
const HASH_ALIAS_REGEX = /^hash_[A-Za-z0-9_-]+$/;

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_REGEX.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isValidPublicKey(value: unknown): value is string {
  return typeof value === 'string' && (DID_KEY_REGEX.test(value) || BASE64ISH_REGEX.test(value));
}

export function isValidSignature(value: unknown): value is string {
  return typeof value === 'string' && BASE64ISH_REGEX.test(value);
}

export function isValidHash(value: unknown): value is string {
  return typeof value === 'string' && (HEX_HASH_REGEX.test(value) || HASH_ALIAS_REGEX.test(value));
}
