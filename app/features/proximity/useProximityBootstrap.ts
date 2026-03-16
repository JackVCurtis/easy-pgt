import { useReducer, useState } from 'react';

import {
  createPendingBootstrapSession,
  deriveSessionConfirmation,
  deriveSessionContext,
  signNfcBootstrap,
  validateBleDiscoveryMatch,
  validateNfcBootstrap,
  validateSessionConfirmation,
  type NfcBootstrapV1,
  type SignableNfcBootstrapV1,
  encodeBase64,
} from '@/app/protocol/transport';

import {
  createProximityLocalKeysProvider,
  createProximityNonceHex,
} from './proximityKeys';
import { createProximitySessionUuid } from './proximityUuid';
import { proximitySessionReducer } from './proximityState';

type ProximityRole = 'writer' | 'reader';

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

export function useProximityBootstrap() {
  const [state, dispatch] = useReducer(proximitySessionReducer, { status: 'idle' as const });
  const [getLocalKeys] = useState(() => createProximityLocalKeysProvider());
  const [bootstrapPayload, setBootstrapPayload] = useState<NfcBootstrapV1 | null>(null);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [localSignerPublicKeyBase64, setLocalSignerPublicKeyBase64] = useState('');

  const ensureLocalKeys = () => {
    const localKeys = getLocalKeys();

    if (!localSignerPublicKeyBase64) {
      setLocalSignerPublicKeyBase64(toBase64(localKeys.signer.publicKey));
    }

    return localKeys;
  };

  const prepareWriterPayload = (identityBindingHash: string, bluetoothServiceUuid: string) => {
    dispatch({ type: 'set_status', status: 'nfc_preparing' });
    try {
      const signable: SignableNfcBootstrapV1 = {
        version: 1,
        session_uuid: createProximitySessionUuid(),
        identity_binding_hash: identityBindingHash,
        ephemeral_public_key: toBase64(ensureLocalKeys().ephemeral.publicKey),
        bluetooth_service_uuid: bluetoothServiceUuid,
        nonce: createProximityNonceHex(),
      };

      const signed = signNfcBootstrap(signable, ensureLocalKeys().signer.secretKey);
      setBootstrapPayload(signed);
      setDiagnostic('Bootstrap payload generated and ready for NFC handoff.');
      dispatch({ type: 'set_status', status: 'nfc_ready' });
    } catch (error) {
      setBootstrapPayload(null);
      setDiagnostic('PROX_BOOTSTRAP_PREPARE_FAILED: Unable to generate NFC bootstrap payload.');
      dispatch({ type: 'failed', reason: 'prepare_payload_failed' });

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.error('[useProximityBootstrap] prepareWriterPayload failed', error);
      }
    }
  };

  const readerReceivePayload = (payload: unknown, expectedSignerPublicKey: string) => {
    dispatch({ type: 'set_status', status: 'nfc_received' });
    const validation = validateNfcBootstrap(payload, expectedSignerPublicKey);
    if (!validation.valid) {
      setDiagnostic(`Bootstrap validation failed: ${validation.reason}:${validation.field}`);
      dispatch({ type: 'failed', reason: `${validation.reason}:${validation.field}` });
      return;
    }

    const pending = createPendingBootstrapSession(payload as NfcBootstrapV1);
    dispatch({ type: 'set_status', status: 'bootstrap_validated' });
    dispatch({ type: 'set_status', status: 'ble_scanning' });

    const discovery = validateBleDiscoveryMatch(pending, pending.bluetoothServiceUuid);
    if (!discovery.valid) {
      setDiagnostic(`BLE discovery mismatch: ${discovery.reason}`);
      dispatch({ type: 'failed', reason: discovery.reason });
      return;
    }

    dispatch({ type: 'set_status', status: 'ble_connecting' });
    dispatch({ type: 'set_status', status: 'ble_connected' });
    dispatch({ type: 'set_status', status: 'session_authenticating' });

    const context = deriveSessionContext(ensureLocalKeys().ephemeral.secretKey, pending);
    if (!context.valid) {
      setDiagnostic(`Session context failure: ${context.reason}`);
      dispatch({ type: 'failed', reason: context.reason });
      return;
    }

    const proof = deriveSessionConfirmation(context.sessionKey, pending.sessionUuid, 'responder');
    const confirmation = validateSessionConfirmation({
      pendingSession: pending,
      expectedSessionKey: context.sessionKey,
      receivedSessionUuid: pending.sessionUuid,
      receivedIdentityBindingHash: pending.peerIdentityBindingHash,
      receivedProof: proof,
      role: 'responder',
    });

    if (!confirmation.valid) {
      setDiagnostic(`Session confirmation failed: ${confirmation.reason}`);
      dispatch({ type: 'failed', reason: confirmation.reason });
      return;
    }

    setDiagnostic('Session authenticated and bound to NFC bootstrap data.');
    dispatch({ type: 'set_status', status: 'session_authenticated' });
  };

  const reset = () => {
    setBootstrapPayload(null);
    setDiagnostic('');
    dispatch({ type: 'reset' });
  };

  return {
    state,
    roleOptions: ['writer', 'reader'] as ProximityRole[],
    bootstrapPayload,
    diagnostic,
    localSignerPublicKeyBase64,
    prepareWriterPayload,
    readerReceivePayload,
    reset,
  };
}
