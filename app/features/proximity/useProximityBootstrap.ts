import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  createPendingBootstrapSession,
  deriveSessionConfirmation,
  deriveSessionContext,
  signNfcBootstrap,
  validateBleDiscoveryMatch,
  validateNfcBootstrap,
  validateSessionConfirmation,
  type NfcBootstrapV1,
  type PendingBootstrapSession,
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

interface ProximityDiagnosticEvent {
  source: 'nfc' | 'ble' | 'session' | 'system';
  action: string;
  detail: string;
  at: string;
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
  const [diagnosticEvents, setDiagnosticEvents] = useState<ProximityDiagnosticEvent[]>([]);
  const [localSignerPublicKeyBase64, setLocalSignerPublicKeyBase64] = useState('');
  const [nfcPort] = useState(() => ports.nfc ?? createNfcAdapter());
  const [blePort] = useState(() => ports.ble ?? createBleAdapter());
  const pendingSessionRef = useRef<PendingBootstrapSession | null>(null);
  const connectedDeviceIdRef = useRef<string | undefined>(undefined);

  const pushDiagnosticEvent = (event: Omit<ProximityDiagnosticEvent, 'at'>) => {
    setDiagnosticEvents((previous) => [...previous, { ...event, at: new Date().toISOString() }]);
  };

  const ensureLocalKeys = () => {
    const localKeys = getLocalKeys();

    if (!localSignerPublicKeyBase64) {
      setLocalSignerPublicKeyBase64(toBase64(localKeys.signer.publicKey));
    }

    return localKeys;
  };

  const failWithMappedError = (error: unknown, prefix: string, source: ProximityDiagnosticEvent['source']) => {
    const reason = mapAsyncRuntimeError(error);
    setDiagnostic(`${prefix} (${reason}). Please retry.`);
    pushDiagnosticEvent({ source, action: prefix, detail: reason });
    dispatch({ type: 'failed', reason });

    if (__DEV__) {
      console.warn(`${prefix}:`, error);
    }
  };

  const prepareWriterPayload = async (identityBindingHash: string, bluetoothServiceUuid: string) => {
    dispatch({ type: 'set_status', status: 'nfc_preparing' });
    pushDiagnosticEvent({ source: 'nfc', action: 'write_start', detail: 'Preparing signed bootstrap payload.' });

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
      setDiagnostic('Bootstrap payload generated and written over NFC.');
      pushDiagnosticEvent({ source: 'nfc', action: 'write_success', detail: 'Payload written to NFC target.' });
      dispatch({ type: 'set_status', status: 'nfc_ready' });
    } catch (error) {
      setBootstrapPayload(null);
      failWithMappedError(error, 'Bootstrap payload write failed', 'nfc');
    }
  };

  const readBootstrapViaNfc = async (expectedSignerPublicKey: string) => {
    dispatch({ type: 'set_status', status: 'nfc_received' });
    pushDiagnosticEvent({ source: 'nfc', action: 'read_start', detail: 'Waiting for NFC bootstrap payload.' });

    try {
      const receivedPayload = (await nfcPort.readBootstrapPayload()) ?? {};
      const validation = validateNfcBootstrap(receivedPayload, expectedSignerPublicKey);
      if (!validation.valid) {
        const reason = `${validation.reason}:${validation.field}`;
        setDiagnostic(`Bootstrap validation failed: ${reason}`);
        pushDiagnosticEvent({ source: 'nfc', action: 'read_invalid', detail: reason });
        dispatch({ type: 'failed', reason });
        return;
      }

      const pending = createPendingBootstrapSession(receivedPayload as NfcBootstrapV1);
      pendingSessionRef.current = pending;
      setDiagnostic('Bootstrap payload validated. Ready for BLE discovery/connect.');
      pushDiagnosticEvent({ source: 'nfc', action: 'read_valid', detail: 'Signed payload validated and staged.' });
      dispatch({ type: 'set_status', status: 'bootstrap_validated' });
    } catch (error) {
      failWithMappedError(error, 'Bootstrap payload read failed', 'nfc');
    }
  };

  const startBleDiscoveryConnect = async () => {
    const pending = pendingSessionRef.current;
    if (!pending) {
      setDiagnostic('Cannot start BLE flow before NFC bootstrap validation.');
      dispatch({ type: 'failed', reason: 'BOOTSTRAP_NOT_VALIDATED' });
      return;
    }

    dispatch({ type: 'set_status', status: 'ble_scanning' });
    pushDiagnosticEvent({ source: 'ble', action: 'scan_start', detail: 'Scanning for matching BLE service UUID.' });

    try {
      const discoveredDevice = await blePort.scanForService(pending.bluetoothServiceUuid, 10_000);
      if (!discoveredDevice) {
        setDiagnostic('BLE discovery failed: SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND');
        pushDiagnosticEvent({ source: 'ble', action: 'scan_timeout', detail: 'No matching device discovered before timeout.' });
        dispatch({ type: 'failed', reason: 'SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND' });
        return;
      }

      const discovery = validateBleDiscoveryMatch(pending, pending.bluetoothServiceUuid);
      if (!discovery.valid) {
        setDiagnostic(`BLE discovery mismatch: ${discovery.reason}`);
        pushDiagnosticEvent({ source: 'ble', action: 'scan_mismatch', detail: discovery.reason });
        dispatch({ type: 'failed', reason: discovery.reason });
        return;
      }

      dispatch({ type: 'set_status', status: 'ble_connecting' });
      pushDiagnosticEvent({ source: 'ble', action: 'connect_start', detail: `Connecting to device ${discoveredDevice.id}.` });
      const connectedDevice = await blePort.connect(discoveredDevice.id);
      connectedDeviceIdRef.current = connectedDevice.id;
      dispatch({ type: 'set_status', status: 'ble_connected' });
      dispatch({ type: 'set_status', status: 'session_authenticating' });

      const context = deriveSessionContext(ensureLocalKeys().ephemeral.secretKey, pending);
      if (!context.valid) {
        setDiagnostic(`Session context failure: ${context.reason}`);
        pushDiagnosticEvent({ source: 'session', action: 'context_invalid', detail: context.reason });
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
        pushDiagnosticEvent({ source: 'session', action: 'confirmation_invalid', detail: confirmation.reason });
        dispatch({ type: 'failed', reason: confirmation.reason });
        return;
      }

      setDiagnostic('Session authenticated and bound to NFC bootstrap data.');
      pushDiagnosticEvent({ source: 'session', action: 'authenticated', detail: `Device ${connectedDevice.id} authenticated.` });
      dispatch({ type: 'set_status', status: 'session_authenticated' });
    } catch (error) {
      failWithMappedError(error, 'BLE connect/auth flow failed', 'ble');
    }
  };

  const releaseSessions = useCallback(async () => {
    await nfcPort.cancel();
    await blePort.stopAdvertising();
    await blePort.disconnect(connectedDeviceIdRef.current);
    connectedDeviceIdRef.current = undefined;
    pendingSessionRef.current = null;
    pushDiagnosticEvent({ source: 'system', action: 'session_reset', detail: 'Cancelled NFC/BLE in-flight operations.' });
  }, [blePort, nfcPort]);

  const reset = async () => {
    await releaseSessions();
    setBootstrapPayload(null);
    setDiagnostic('');
    setDiagnosticEvents([]);
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
  }, [releaseSessions, blePort, nfcPort]);

  return {
    state,
    roleOptions: ['writer', 'reader'] as ProximityRole[],
    bootstrapPayload,
    diagnostic,
    diagnosticEvents,
    localSignerPublicKeyBase64,
    prepareWriterPayload,
    readBootstrapViaNfc,
    startBleDiscoveryConnect,
    reset,
  };
}
