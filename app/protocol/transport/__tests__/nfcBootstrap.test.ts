import nacl from 'tweetnacl';

import {
  canonicalSerializeNfcBootstrap,
  decodeNfcBootstrap,
  signNfcBootstrap,
  validateNfcBootstrap,
  validateNfcBootstrapStructure,
  verifyNfcBootstrapSignature,
  type NfcBootstrapV1,
  type SignableNfcBootstrapV1,
  encodeBase64,
} from '@/app/protocol/transport';

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

function validSignable(): SignableNfcBootstrapV1 {
  return {
    version: 1,
    session_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    identity_binding_hash: 'a'.repeat(64),
    ephemeral_public_key: toBase64(nacl.box.keyPair().publicKey),
    bluetooth_service_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    nonce: '00112233445566778899aabbccddeeff',
  };
}

describe('nfc bootstrap validation', () => {
  it('accepts a valid v1 payload', () => {
    const signer = nacl.sign.keyPair();
    const payload = signNfcBootstrap(validSignable(), signer.secretKey);

    expect(validateNfcBootstrapStructure(payload)).toEqual({ valid: true });
    expect(validateNfcBootstrap(payload, toBase64(signer.publicKey))).toEqual({ valid: true });
  });

  it('rejects missing required field', () => {
    const payload = { ...validSignable(), signature: 'x' };
    delete (payload as Partial<NfcBootstrapV1>).nonce;

    expect(validateNfcBootstrapStructure(payload)).toEqual({
      valid: false,
      reason: 'missing_field',
      field: 'nonce',
    });
  });

  it.each([
    ['session_uuid', 'not-a-uuid'],
    ['bluetooth_service_uuid', 'also-not-a-uuid'],
  ])('rejects malformed %s', (field, value) => {
    const payload = { ...validSignable(), signature: 'x' } as Record<string, unknown>;
    payload[field] = value;

    expect(validateNfcBootstrapStructure(payload)).toEqual({
      valid: false,
      reason: 'invalid_format',
      field,
    });
  });

  it('rejects malformed identity_binding_hash', () => {
    expect(
      validateNfcBootstrapStructure({ ...validSignable(), signature: 'x', identity_binding_hash: 'short' })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'identity_binding_hash',
    });
  });

  it('rejects malformed ephemeral_public_key', () => {
    expect(
      validateNfcBootstrapStructure({ ...validSignable(), signature: 'x', ephemeral_public_key: 'bad key!?' })
    ).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'ephemeral_public_key',
    });
  });

  it('rejects invalid nonce encoding', () => {
    expect(validateNfcBootstrapStructure({ ...validSignable(), signature: 'x', nonce: 'abcd' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'nonce',
    });
  });

  it('rejects unsupported version', () => {
    expect(validateNfcBootstrapStructure({ ...validSignable(), signature: 'x', version: 2 })).toEqual({
      valid: false,
      reason: 'invalid_version',
      field: 'version',
    });
  });

  it('rejects oversized payload', () => {
    expect(
      validateNfcBootstrapStructure({ ...validSignable(), signature: 'x'.repeat(17_000) })
    ).toEqual({
      valid: false,
      reason: 'field_too_large',
      field: 'payload_size',
    });
  });

  it('fails closed for parser exceptions', () => {
    const explosive = new Proxy(
      {},
      {
        has() {
          throw new Error('boom');
        },
      }
    );

    expect(decodeNfcBootstrap(explosive)).toEqual({
      valid: false,
      reason: 'validation_failure',
      field: 'bootstrap_payload',
    });
  });

  it('has stable canonical serialization', () => {
    const payload = validSignable();

    expect(canonicalSerializeNfcBootstrap(payload)).toEqual(canonicalSerializeNfcBootstrap(payload));
  });

  it('verifies valid signatures and rejects tampering', () => {
    const signer = nacl.sign.keyPair();
    const payload = signNfcBootstrap(validSignable(), signer.secretKey);

    expect(verifyNfcBootstrapSignature(payload, toBase64(signer.publicKey))).toEqual({ valid: true });

    const tampered = { ...payload, session_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7' };
    expect(verifyNfcBootstrapSignature(tampered, toBase64(signer.publicKey))).toEqual({
      valid: false,
      reason: 'invalid_signature',
      field: 'signature',
    });
  });
});
