import { useEffect, useReducer, useRef, useState } from 'react';

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
import { createBleAdapter } from './transport/bleAdapter';
import { createNfcAdapter } from './transport/nfcAdapter';
import type { ProximityBlePort, ProximityNfcPort } from './transport/types';

type ProximityRole = 'writer' | 'reader';

interface UseProximityBootstrapPorts {
  nfc?: ProximityNfcPort;
  ble?: ProximityBlePort;
}

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

function mapAsyncRuntimeError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (message.includes('permission')) {
    return 'PERMISSION_DENIED';
  }

  if (message.includes('nfc') && (message.includes('unavailable') || message.includes('disabled'))) {
    return 'NFC_UNAVAILABLE_OR_DISABLED';
  }

  if (message.includes('ble') && (message.includes('unavailable') || message.includes('disabled'))) {
    return 'BLE_UNAVAILABLE_OR_DISABLED';
  }

  if (message.includes('timeout') || message.includes('not_found') || message.includes('no device')) {
    return 'SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND';
  }

  return 'PROXIMITY_RUNTIME_FAILURE';
}

export function useProximityBootstrap(ports: UseProximityBootstrapPorts = {}) {
  const [state, dispatch] = useReducer(proximitySessionReducer, { status: 'idle' as const });
  const [getLocalKeys] = useState(() => createProximityLocalKeysProvider());
  const [bootstrapPayload, setBootstrapPayload] = useState<NfcBootstrapV1 | null>(null);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [localSignerPublicKeyBase64, setLocalSignerPublicKeyBase64] = useState('');
  const [nfcPort] = useState(() => ports.nfc ?? createNfcAdapter());
  const [blePort] = useState(() => ports.ble ?? createBleAdapter());
  const connectedDeviceIdRef = useRef<string | undefined>(undefined);

  const ensureLocalKeys = () => {
    const localKeys = getLocalKeys();

    if (!localSignerPublicKeyBase64) {
      setLocalSignerPublicKeyBase64(toBase64(localKeys.signer.publicKey));
    }

    return localKeys;
  };

  const failWithMappedError = (error: unknown, prefix: string) => {
    const reason = mapAsyncRuntimeError(error);
    setDiagnostic(`${prefix} (${reason}). Please retry.`);
    dispatch({ type: 'failed', reason });

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`${prefix}:`, error);
    }
  };

  const prepareWriterPayload = async (identityBindingHash: string, bluetoothServiceUuid: string) => {
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
      await nfcPort.writeBootstrapPayload(signed);
      setBootstrapPayload(signed);
      setDiagnostic('Bootstrap payload generated and handed off over NFC.');
      dispatch({ type: 'set_status', status: 'nfc_ready' });
    } catch (error) {
      setBootstrapPayload(null);
      failWithMappedError(error, 'Bootstrap payload generation failed');
    }
  };

  const readerReceivePayload = async (payload: unknown, expectedSignerPublicKey: string) => {
    dispatch({ type: 'set_status', status: 'nfc_received' });

    try {
      const receivedPayload = payload ?? (await nfcPort.readBootstrapPayload()) ?? {};
      const validation = validateNfcBootstrap(receivedPayload, expectedSignerPublicKey);
      if (!validation.valid) {
        setDiagnostic(`Bootstrap validation failed: ${validation.reason}:${validation.field}`);
        dispatch({ type: 'failed', reason: `${validation.reason}:${validation.field}` });
        return;
      }

      const pending = createPendingBootstrapSession(receivedPayload as NfcBootstrapV1);
      dispatch({ type: 'set_status', status: 'bootstrap_validated' });
      dispatch({ type: 'set_status', status: 'ble_scanning' });

      const discoveredDevice = await blePort.scanForService(pending.bluetoothServiceUuid, 10_000);
      if (!discoveredDevice) {
        setDiagnostic('BLE discovery mismatch: SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND');
        dispatch({ type: 'failed', reason: 'SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND' });
        return;
      }

      const discovery = validateBleDiscoveryMatch(pending, pending.bluetoothServiceUuid);
      if (!discovery.valid) {
        setDiagnostic(`BLE discovery mismatch: ${discovery.reason}`);
        dispatch({ type: 'failed', reason: discovery.reason });
        return;
      }

      dispatch({ type: 'set_status', status: 'ble_connecting' });
      const connectedDevice = await blePort.connect(discoveredDevice.id);
      connectedDeviceIdRef.current = connectedDevice.id;
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
    } catch (error) {
      failWithMappedError(error, 'Reader flow failed');
    }
  };

  const releaseSessions = async () => {
    await nfcPort.cancel();
    await blePort.stopAdvertising();
    await blePort.disconnect(connectedDeviceIdRef.current);
    connectedDeviceIdRef.current = undefined;
  };

  const reset = async () => {
    await releaseSessions();
    setBootstrapPayload(null);
    setDiagnostic('');
    dispatch({ type: 'reset' });
  };

  useEffect(() => {
    return () => {
      releaseSessions()
        .catch(() => undefined)
        .finally(() => {
          nfcPort.cleanup().catch(() => undefined);
          blePort.cleanup().catch(() => undefined);
        });
    };
  }, [blePort, nfcPort]);

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
