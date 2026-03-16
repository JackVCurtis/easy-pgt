import nacl from 'tweetnacl';

import {
  createPendingBootstrapSession,
  deriveSessionConfirmation,
  deriveSessionContext,
  type NfcBootstrapV1,
  type PendingBootstrapSession,
  validateBleDiscoveryMatch,
  validateSessionConfirmation,
  encodeBase64,
} from '@/app/protocol/transport';

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

function payload(): NfcBootstrapV1 {
  const kp = nacl.box.keyPair();
  return {
    version: 1,
    session_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
    identity_binding_hash: 'a'.repeat(64),
    ephemeral_public_key: toBase64(kp.publicKey),
    bluetooth_service_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
    nonce: '00112233445566778899aabbccddeeff',
    signature: toBase64(new Uint8Array(64)),
  };
}

describe('BLE bootstrap session binding', () => {
  it('matches only exact service uuid', () => {
    const pending = createPendingBootstrapSession(payload());

    expect(validateBleDiscoveryMatch(pending, pending.bluetoothServiceUuid)).toEqual({ valid: true });
    expect(validateBleDiscoveryMatch(pending, 'd157e470-d0b8-40d5-8f8f-6d31268cce8e')).toEqual({
      valid: false,
      reason: 'service_uuid_mismatch',
      field: 'bluetooth_service_uuid',
    });
  });

  it('rejects session uuid mismatch', () => {
    const local = nacl.box.keyPair();
    const peer = nacl.box.keyPair();
    const pending = createPendingBootstrapSession({ ...payload(), ephemeral_public_key: toBase64(peer.publicKey) });

    const context = deriveSessionContext(local.secretKey, pending);
    expect(context.valid).toBe(true);
    if (!context.valid) {
      return;
    }

    const proof = deriveSessionConfirmation(context.sessionKey, pending.sessionUuid, 'initiator');
    expect(
      validateSessionConfirmation({
        pendingSession: pending,
        expectedSessionKey: context.sessionKey,
        receivedSessionUuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
        receivedIdentityBindingHash: pending.peerIdentityBindingHash,
        receivedProof: proof,
        role: 'initiator',
      })
    ).toEqual({ valid: false, reason: 'session_uuid_mismatch', field: 'session_uuid' });
  });

  it('fails confirmation when secrets do not match', () => {
    const local = nacl.box.keyPair();
    const peer = nacl.box.keyPair();
    const pending: PendingBootstrapSession = createPendingBootstrapSession({
      ...payload(),
      ephemeral_public_key: toBase64(peer.publicKey),
    });

    const context = deriveSessionContext(local.secretKey, pending);
    expect(context.valid).toBe(true);
    if (!context.valid) {
      return;
    }

    const wrongKey = nacl.hash(new Uint8Array([1, 2, 3])).slice(0, 32);
    const wrongProof = deriveSessionConfirmation(wrongKey, pending.sessionUuid, 'responder');

    expect(
      validateSessionConfirmation({
        pendingSession: pending,
        expectedSessionKey: context.sessionKey,
        receivedSessionUuid: pending.sessionUuid,
        receivedIdentityBindingHash: pending.peerIdentityBindingHash,
        receivedProof: wrongProof,
        role: 'responder',
      })
    ).toEqual({ valid: false, reason: 'session_confirmation_mismatch', field: 'session_confirmation' });
  });

  it('accepts success path', () => {
    const local = nacl.box.keyPair();
    const peer = nacl.box.keyPair();
    const pending = createPendingBootstrapSession({ ...payload(), ephemeral_public_key: toBase64(peer.publicKey) });

    const context = deriveSessionContext(local.secretKey, pending);
    expect(context.valid).toBe(true);
    if (!context.valid) {
      return;
    }

    const proof = deriveSessionConfirmation(context.sessionKey, pending.sessionUuid, 'responder');

    expect(
      validateSessionConfirmation({
        pendingSession: pending,
        expectedSessionKey: context.sessionKey,
        receivedSessionUuid: pending.sessionUuid,
        receivedIdentityBindingHash: pending.peerIdentityBindingHash,
        receivedProof: proof,
        role: 'responder',
      })
    ).toEqual({ valid: true });
  });
});
