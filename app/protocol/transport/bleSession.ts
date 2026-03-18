import { hashBytes, scalarMultSharedSecret } from '../crypto/crypto';
import { encodeBase64 } from '../crypto/encoding';
import type { NfcBootstrapV1 } from './nfcBootstrap.types';
import type { QrBootstrapV1 } from './qrBootstrap.types';
import { decodeBase64WithExpectedLength } from './encoding';

export interface PendingBootstrapSession {
  sessionUuid: string;
  peerIdentityBindingHash: string;
  peerEphemeralPublicKey: string;
  bluetoothServiceUuid: string;
  nonce: string;
  validatedAt: number;
}

export type SessionValidationResult =
  | { valid: true }
  | { valid: false; reason: 'service_uuid_mismatch' | 'session_uuid_mismatch' | 'identity_binding_mismatch' | 'session_confirmation_mismatch' | 'invalid_peer_key'; field: string };

const encoder = new TextEncoder();

function decodeBase64Fixed32(input: string): Uint8Array | null {
  return decodeBase64WithExpectedLength(input, 32);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createPendingBootstrapSession(payload: QrBootstrapV1 | NfcBootstrapV1): PendingBootstrapSession {
  return {
    sessionUuid: payload.session_uuid,
    peerIdentityBindingHash: payload.identity_binding_hash,
    peerEphemeralPublicKey: payload.ephemeral_public_key,
    bluetoothServiceUuid: payload.bluetooth_service_uuid,
    nonce: payload.nonce,
    validatedAt: Date.now(),
  };
}

export function validateBleDiscoveryMatch(
  pendingSession: PendingBootstrapSession,
  discoveredServiceUuid: string
): SessionValidationResult {
  return pendingSession.bluetoothServiceUuid === discoveredServiceUuid
    ? { valid: true }
    : { valid: false, reason: 'service_uuid_mismatch', field: 'bluetooth_service_uuid' };
}

export function deriveSessionContext(
  localEphemeralSecretKey: Uint8Array,
  pendingSession: PendingBootstrapSession
):
  | { valid: true; sharedSecret: Uint8Array; sessionKey: Uint8Array }
  | { valid: false; reason: 'invalid_peer_key'; field: 'peer_ephemeral_public_key' } {
  const peerPublicKey = decodeBase64Fixed32(pendingSession.peerEphemeralPublicKey);
  if (!peerPublicKey) {
    return { valid: false, reason: 'invalid_peer_key', field: 'peer_ephemeral_public_key' };
  }

  const sharedSecret = scalarMultSharedSecret(localEphemeralSecretKey, peerPublicKey);
  const sessionKey = hashBytes(concat([encoder.encode('pgt_session_v1'), sharedSecret, encoder.encode(pendingSession.sessionUuid)])).slice(0, 32);

  return {
    valid: true,
    sharedSecret,
    sessionKey,
  };
}

export function deriveSessionConfirmation(sessionKey: Uint8Array, sessionUuid: string, role: 'initiator' | 'responder'): string {
  const mac = hashBytes(concat([encoder.encode('pgt_confirm_v1'), sessionKey, encoder.encode(sessionUuid), encoder.encode(role)])).slice(0, 32);
  return encodeBase64(mac);
}

export function validateSessionConfirmation(params: {
  pendingSession: PendingBootstrapSession;
  expectedSessionKey: Uint8Array;
  receivedSessionUuid: string;
  receivedIdentityBindingHash: string;
  receivedProof: string;
  role: 'initiator' | 'responder';
}): SessionValidationResult {
  const {
    pendingSession,
    expectedSessionKey,
    receivedSessionUuid,
    receivedIdentityBindingHash,
    receivedProof,
    role,
  } = params;

  if (pendingSession.sessionUuid !== receivedSessionUuid) {
    return { valid: false, reason: 'session_uuid_mismatch', field: 'session_uuid' };
  }

  if (pendingSession.peerIdentityBindingHash !== receivedIdentityBindingHash) {
    return { valid: false, reason: 'identity_binding_mismatch', field: 'identity_binding_hash' };
  }

  const expected = deriveSessionConfirmation(expectedSessionKey, pendingSession.sessionUuid, role);
  return expected === receivedProof
    ? { valid: true }
    : { valid: false, reason: 'session_confirmation_mismatch', field: 'session_confirmation' };
}
