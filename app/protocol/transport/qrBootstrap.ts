import { signDetached, verifyDetached } from '../crypto/crypto';
import { VALIDATION_LIMITS } from '../validation/validationLimits';
import { decodePublicKey, decodeSignature } from '../validation/crypto/signatureDecoding';
import { canonicalSerialize } from '../validation/crypto/signingPayload';
import { isValidHash, isValidPublicKey, isValidSignature, isValidUUID } from '../validation/formatValidators';

import { canonicalSerializeQrBootstrap } from './qrBootstrap.serialization';
import { encodeBase64 } from './encoding';
import type {
  DecodedQrBootstrapResult,
  QrBootstrapV1,
  QrBootstrapValidationError,
  QrBootstrapValidationResult,
  SignableQrBootstrapV1,
} from './qrBootstrap.types';

const REQUIRED_FIELDS: (keyof QrBootstrapV1)[] = [
  'version',
  'session_uuid',
  'identity_binding_hash',
  'ephemeral_public_key',
  'bluetooth_service_uuid',
  'nonce',
  'signature',
];

const NONCE_HEX_REGEX = /^[a-f0-9]{32}$/i;

function invalid(reason: QrBootstrapValidationError['reason'], field: string): QrBootstrapValidationError {
  return { valid: false, reason, field };
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isValidNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE_HEX_REGEX.test(value);
}

function isPayloadSizeValid(input: Record<string, unknown>): boolean {
  return canonicalSerialize(input).length <= VALIDATION_LIMITS.max_record_size;
}

function assertStructure(input: unknown): QrBootstrapValidationResult {
  if (!isObject(input)) {
    return invalid('invalid_format', 'bootstrap_payload');
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input)) {
      return invalid('missing_field', field);
    }
  }

  if (input.version !== 1) {
    return invalid('invalid_version', 'version');
  }

  if (!isPayloadSizeValid(input)) {
    return invalid('field_too_large', 'payload_size');
  }

  if (!isValidUUID(input.session_uuid)) {
    return invalid('invalid_format', 'session_uuid');
  }

  if (!isValidHash(input.identity_binding_hash)) {
    return invalid('invalid_format', 'identity_binding_hash');
  }

  if (!isValidPublicKey(input.ephemeral_public_key)) {
    return invalid('invalid_format', 'ephemeral_public_key');
  }

  if (!isValidUUID(input.bluetooth_service_uuid)) {
    return invalid('invalid_format', 'bluetooth_service_uuid');
  }

  if (!isValidNonce(input.nonce)) {
    return invalid('invalid_format', 'nonce');
  }

  if (!isValidSignature(input.signature)) {
    return invalid('invalid_format', 'signature');
  }

  return { valid: true };
}

function signablePayload(payload: QrBootstrapV1): SignableQrBootstrapV1 {
  const { signature: _signature, ...rest } = payload;
  return rest;
}

export function validateQrBootstrapStructure(input: unknown): QrBootstrapValidationResult {
  try {
    return assertStructure(input);
  } catch {
    return invalid('validation_failure', 'bootstrap_payload');
  }
}

export function decodeQrBootstrap(input: unknown): DecodedQrBootstrapResult {
  const structure = validateQrBootstrapStructure(input);
  if (!structure.valid) {
    return structure;
  }

  return {
    valid: true,
    payload: input as QrBootstrapV1,
  };
}

export function verifyQrBootstrapSignature(
  payload: QrBootstrapV1,
  signerPublicKey: Uint8Array | string
): QrBootstrapValidationResult {
  const signature = decodeSignature(payload.signature);
  if (!signature) {
    return invalid('signature_decode_failed', 'signature');
  }

  const publicKey =
    typeof signerPublicKey === 'string' ? decodePublicKey(signerPublicKey) : signerPublicKey.length === 32 ? signerPublicKey : null;
  if (!publicKey) {
    return invalid('public_key_decode_failed', 'signer_public_key');
  }

  return verifyDetached(canonicalSerializeQrBootstrap(signablePayload(payload)), signature, publicKey)
    ? { valid: true }
    : invalid('invalid_signature', 'signature');
}

export function validateQrBootstrap(
  input: unknown,
  signerPublicKey: Uint8Array | string
): QrBootstrapValidationResult {
  const decoded = decodeQrBootstrap(input);
  if (!decoded.valid) {
    return decoded;
  }

  return verifyQrBootstrapSignature(decoded.payload, signerPublicKey);
}

export function signQrBootstrap(signable: SignableQrBootstrapV1, signerSecretKey: Uint8Array): QrBootstrapV1 {
  const signature = signDetached(canonicalSerializeQrBootstrap(signable), signerSecretKey);
  return {
    ...signable,
    signature: encodeBase64(signature),
  };
}

export function encodeQrBootstrapForDisplay(payload: QrBootstrapV1): string {
  return JSON.stringify(payload);
}

export function decodeQrBootstrapScan(scanned: string): DecodedQrBootstrapResult {
  try {
    return decodeQrBootstrap(JSON.parse(scanned));
  } catch {
    return invalid('invalid_format', 'qr_payload');
  }
}
