import nacl from 'tweetnacl';

import {
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
    ephemeral_public_key: toBase64(nacl.box.keyPair().publicKey),
    bluetooth_service_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    nonce: '00112233445566778899aabbccddeeff',
  };
}

describe('qr bootstrap transport', () => {
  it('creates a signed payload and validates signature', () => {
    const signer = nacl.sign.keyPair();
    const payload = signQrBootstrap(validSignable(), signer.secretKey);

    expect(validateQrBootstrap(payload, toBase64(signer.publicKey))).toEqual({ valid: true });
    expect(verifyQrBootstrapSignature(payload, toBase64(signer.publicKey))).toEqual({ valid: true });
  });

  it('encodes/decodes display string and validates decoded payload', () => {
    const signer = nacl.sign.keyPair();
    const payload = signQrBootstrap(validSignable(), signer.secretKey);

    const display = encodeQrBootstrapForDisplay(payload);
    expect(display).toBe(JSON.stringify(payload));

    const decoded = decodeQrBootstrapScan(display);
    expect(decoded.valid).toBe(true);
    if (!decoded.valid) {
      return;
    }

    expect(decoded.payload).toEqual(payload);
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

  it('enforces deterministic 16-byte nonce encoding', () => {
    expect(validateQrBootstrapStructure({ ...validSignable(), signature: 'x', nonce: 'abcd' })).toEqual({
      valid: false,
      reason: 'invalid_format',
      field: 'nonce',
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
