import {
  generateBoxKeypair,
  generateSigningKeypair,
} from '@/app/protocol/crypto/crypto';
import { VALIDATION_LIMITS } from '@/app/protocol/validation/validationLimits';

import {
  canonicalSerializeQrBootstrap,
  createPendingBootstrapSession,
  decodeQrBootstrap,
  decodeQrBootstrapScan,
  encodeBase64,
  encodeQrBootstrapForDisplay,
  signQrBootstrap,
  validateQrBootstrap,
  validateQrBootstrapStructure,
  verifyQrBootstrapSignature,
  type QrBootstrapV1,
  type SignableQrBootstrapV1,
} from '@/app/protocol/transport';

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

function validSignable(): SignableQrBootstrapV1 {
  return {
    version: 1,
    session_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    identity_binding_hash: 'a'.repeat(64),
    ephemeral_public_key: toBase64(generateBoxKeypair().publicKey),
    bluetooth_service_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    nonce: '00112233445566778899aabbccddeeff',
  };
}

describe('qr bootstrap transport', () => {
  it('creates a valid signed QR bootstrap and validates signature', () => {
    const signer = generateSigningKeypair();
    const payload = signQrBootstrap(validSignable(), signer.secretKey);

    expect(validateQrBootstrap(payload, toBase64(signer.publicKey))).toEqual({ valid: true });
    expect(verifyQrBootstrapSignature(payload, toBase64(signer.publicKey))).toEqual({ valid: true });
  });

  it('produces deterministic canonical signing bytes', () => {
    const canonicalPayload: SignableQrBootstrapV1 = {
      version: 1,
      session_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
      identity_binding_hash: 'a'.repeat(64),
      ephemeral_public_key: 'A'.repeat(44),
      bluetooth_service_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
      nonce: '00112233445566778899aabbccddeeff',
    };

    const reorderedPayload = {
      nonce: canonicalPayload.nonce,
      bluetooth_service_uuid: canonicalPayload.bluetooth_service_uuid,
      ephemeral_public_key: canonicalPayload.ephemeral_public_key,
      identity_binding_hash: canonicalPayload.identity_binding_hash,
      session_uuid: canonicalPayload.session_uuid,
      version: canonicalPayload.version,
    } as SignableQrBootstrapV1;

    const first = canonicalSerializeQrBootstrap(canonicalPayload);
    const second = canonicalSerializeQrBootstrap(reorderedPayload);

    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('encodes QR display payload as compact JSON and supports round-trip decode', () => {
    const signer = generateSigningKeypair();
    const payload = signQrBootstrap(validSignable(), signer.secretKey);

    const display = encodeQrBootstrapForDisplay(payload);
    expect(display).toBe(JSON.stringify(payload));
    expect(display).not.toMatch(/\s/);

    const decoded = decodeQrBootstrapScan(display);
    expect(decoded.valid).toBe(true);
    if (!decoded.valid) {
      return;
    }

    expect(decoded.payload).toEqual(payload);
  });

  it('rejects missing and partial fields', () => {
    expect(validateQrBootstrapStructure({ ...validSignable() })).toEqual({
      valid: false,
      reason: 'missing_field',
      field: 'signature',
    });

    expect(validateQrBootstrapStructure({ version: 1, session_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43' })).toEqual({
      valid: false,
      reason: 'missing_field',
      field: 'identity_binding_hash',
    });
  });

  it('rejects malformed payload and unsupported version', () => {
    expect(validateQrBootstrapStructure('not-an-object')).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'bootstrap_payload',
    });

    expect(validateQrBootstrapStructure({ ...validSignable(), signature: toBase64(new Uint8Array(64)), version: 2 })).toEqual({
      valid: false,
      reason: 'invalid_version',
      field: 'version',
    });
  });

  it('rejects invalid signature and decode failures', () => {
    const signer = generateSigningKeypair();
    const payload = signQrBootstrap(validSignable(), signer.secretKey);
    const wrongSigner = generateSigningKeypair();

    expect(validateQrBootstrap(payload, toBase64(wrongSigner.publicKey))).toEqual({
      valid: false,
      reason: 'invalid_signature',
      field: 'signature',
    });

    expect(validateQrBootstrap(payload, '%%%not-base64%%%')).toEqual({
      valid: false,
      reason: 'public_key_decode_failed',
      field: 'signer_public_key',
    });

    expect(verifyQrBootstrapSignature({ ...payload, signature: '%%%not-base64%%%' }, toBase64(signer.publicKey))).toEqual({
      valid: false,
      reason: 'signature_decode_failed',
      field: 'signature',
    });
  });

  it('rejects invalid UUID/hash/public key formats', () => {
    expect(validateQrBootstrapStructure({ ...validSignable(), signature: toBase64(new Uint8Array(64)), session_uuid: 'not-a-uuid' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'session_uuid',
    });

    expect(validateQrBootstrapStructure({ ...validSignable(), signature: toBase64(new Uint8Array(64)), identity_binding_hash: 'not-a-hash' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'identity_binding_hash',
    });

    expect(validateQrBootstrapStructure({ ...validSignable(), signature: toBase64(new Uint8Array(64)), ephemeral_public_key: '' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'ephemeral_public_key',
    });

    expect(
      validateQrBootstrapStructure({
        ...validSignable(),
        signature: toBase64(new Uint8Array(64)),
        bluetooth_service_uuid: 'not-a-uuid',
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'bluetooth_service_uuid',
    });
  });

  it('enforces nonce format and payload size limits', () => {
    expect(validateQrBootstrapStructure({ ...validSignable(), signature: toBase64(new Uint8Array(64)), nonce: 'abcd' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'nonce',
    });

    expect(
      validateQrBootstrapStructure({
        ...validSignable(),
        signature: toBase64(new Uint8Array(64)),
        nonce: 'z'.repeat(32),
      })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'nonce',
    });

    expect(
      validateQrBootstrapStructure({
        ...validSignable(),
        signature: toBase64(new Uint8Array(64)),
        identity_binding_hash: 'a'.repeat(VALIDATION_LIMITS.max_record_size),
      })
    ).toEqual({
      valid: false,
      reason: 'field_too_large',
      field: 'payload_size',
    });
  });

  it('fails closed on invalid scanned input and parser exceptions', () => {
    expect(decodeQrBootstrapScan('{nope')).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'qr_payload',
    });

    const explosive = new Proxy(
      {},
      {
        has() {
          throw new Error('boom');
        },
      }
    );

    expect(decodeQrBootstrap(explosive)).toEqual({
      valid: false,
      reason: 'validation_failure',
      field: 'bootstrap_payload',
    });
  });

  it('binds BLE pending session values exactly as before', () => {
    const payload: QrBootstrapV1 = {
      ...validSignable(),
      signature: toBase64(new Uint8Array(64)),
    };

    const pending = createPendingBootstrapSession(payload);

    expect(pending.sessionUuid).toBe(payload.session_uuid);
    expect(pending.bluetoothServiceUuid).toBe(payload.bluetooth_service_uuid);
    expect(pending.peerIdentityBindingHash).toBe(payload.identity_binding_hash);
  });
});
