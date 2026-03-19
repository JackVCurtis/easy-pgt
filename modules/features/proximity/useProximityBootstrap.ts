import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  createPendingBootstrapSession,
  decodeQrBootstrapScan,
  deriveSessionConfirmation,
  deriveSessionContext,
  encodeBase64,
  encodeQrBootstrapForDisplay,
  signQrBootstrap,
  validateBleDiscoveryMatch,
  validateQrBootstrap,
  validateSessionConfirmation,
  type PendingBootstrapSession,
  type QrBootstrapV1,
  type SignableQrBootstrapV1,
} from '@/modules/protocol/transport';

import {
  createProximityLocalKeysProvider,
  createProximityNonceHex,
} from './proximityKeys';
import { proximitySessionReducer } from './proximityState';
import { createProximitySessionUuid } from './proximityUuid';
import { createBleAdapter } from './transport/bleAdapter';
import type { ProximityBlePort } from './transport/types';

type ProximityRole = 'writer' | 'reader';

interface UseProximityBootstrapPorts {
  ble?: ProximityBlePort;
}

export interface ProximityDiagnosticEvent {
  source: 'qr' | 'ble' | 'session' | 'system';
  action: string;
  detail: string;
  at: string;
}

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

export function useProximityBootstrap(ports: UseProximityBootstrapPorts = {}) {
  const [state, dispatch] = useReducer(proximitySessionReducer, { status: 'idle' as const });
  const [getLocalKeys] = useState(() => createProximityLocalKeysProvider());
  const [localSignerPublicKeyBase64, setLocalSignerPublicKeyBase64] = useState('');
  const [bootstrapPayload, setBootstrapPayload] = useState<QrBootstrapV1 | null>(null);
  const [bootstrapDisplayString, setBootstrapDisplayString] = useState<string>('');
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [diagnosticEvents, setDiagnosticEvents] = useState<ProximityDiagnosticEvent[]>([]);
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

  const prepareWriterPayload = async (identityBindingHash: string) => {
    dispatch({ type: 'set_status', status: 'bootstrap_preparing' });
    pushDiagnosticEvent({ source: 'qr', action: 'generate_start', detail: 'Preparing signed QR bootstrap payload.' });
      const localServiceUuid = await blePort.getLocalServiceUuid();
      const signable: SignableQrBootstrapV1 = {
        version: 1,
        session_uuid: createProximitySessionUuid(),
        identity_binding_hash: identityBindingHash,
        ephemeral_public_key: toBase64(ensureLocalKeys().ephemeral.publicKey),
        bluetooth_service_uuid: localServiceUuid,
        nonce: createProximityNonceHex(),
      };

      const signed = signQrBootstrap(signable, ensureLocalKeys().signer.secretKey);
      setBootstrapPayload(signed);
      setBootstrapDisplayString(encodeQrBootstrapForDisplay(signed));
      setDiagnostic('Bootstrap payload generated and ready for QR scan.');
      pushDiagnosticEvent({ source: 'qr', action: 'generate_success', detail: 'Payload encoded for QR display.' });
      dispatch({ type: 'set_status', status: 'bootstrap_ready' });
  };

  const ingestScannedBootstrap = async (scannedPayload: string, expectedSignerPublicKey: string): Promise<boolean> => {
    dispatch({ type: 'set_status', status: 'bootstrap_scanned' });
    pushDiagnosticEvent({ source: 'qr', action: 'scan_start', detail: 'QR payload scanned; decoding and validating.' });

      const decoded = decodeQrBootstrapScan(scannedPayload);
      if (!decoded.valid) {
        const reason = `${decoded.reason}:${decoded.field}`;
        setDiagnostic(`Bootstrap decode failed: ${reason}`);
        pushDiagnosticEvent({ source: 'qr', action: 'scan_invalid', detail: reason });
        dispatch({ type: 'failed', reason });
        return false;
      }

      const signerPublicKey = expectedSignerPublicKey || toBase64(ensureLocalKeys().signer.publicKey);
      const validation = validateQrBootstrap(decoded.payload, signerPublicKey);
      if (!validation.valid) {
        const reason = `${validation.reason}:${validation.field}`;
        setDiagnostic(`Bootstrap validation failed: ${reason}`);
        pushDiagnosticEvent({ source: 'qr', action: 'scan_invalid', detail: reason });
        dispatch({ type: 'failed', reason });
        return false;
      }

      const pending = createPendingBootstrapSession(decoded.payload);
      pendingSessionRef.current = pending;
      setDiagnostic('QR bootstrap validated. Ready for BLE discovery/connect.');
      pushDiagnosticEvent({ source: 'qr', action: 'scan_valid', detail: 'Signed QR payload validated and staged.' });
      dispatch({ type: 'set_status', status: 'bootstrap_validated' });
      return true;
  };

  const handleCameraPermissionDenied = () => {
    setDiagnostic('Camera permission denied. QR scan cannot proceed.');
    pushDiagnosticEvent({ source: 'qr', action: 'camera_permission_denied', detail: 'Fail-closed before BLE auth progression.' });
    dispatch({ type: 'failed', reason: 'CAMERA_PERMISSION_DENIED' });
  };

  const startBleDiscoveryConnect = async () => {
    const pending = pendingSessionRef.current;
    if (!pending) {
      setDiagnostic('Cannot start BLE flow before QR bootstrap validation.');
      dispatch({ type: 'failed', reason: 'BOOTSTRAP_NOT_VALIDATED' });
      return;
    }

    dispatch({ type: 'set_status', status: 'ble_scanning' });
    pushDiagnosticEvent({ source: 'ble', action: 'scan_start', detail: 'Scanning for matching BLE service UUID.' });

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

      setDiagnostic('Session authenticated and bound to QR bootstrap data.');
      pushDiagnosticEvent({ source: 'session', action: 'authenticated', detail: `Device ${connectedDevice.id} authenticated.` });      dispatch({ type: 'set_status', status: 'session_authenticated' });
  };

  const exchangeContactInfoOverBle = async (contactInfo: string): Promise<string> => {
    const pending = pendingSessionRef.current;
    if (!pending || !connectedDeviceIdRef.current) {
      throw new Error('BLE_CONTACT_EXCHANGE_REQUIRES_AUTHENTICATED_SESSION');
    }

    const trimmedContactInfo = contactInfo.trim();
    if (!trimmedContactInfo) {
      throw new Error('BLE_CONTACT_INFO_EMPTY');
    }

    pushDiagnosticEvent({ source: 'ble', action: 'contact_exchange_start', detail: 'Exchanging contact payload over BLE.' });
    const receivedContactInfo = await blePort.exchangeContactInfo(
      trimmedContactInfo,
      pending.bluetoothServiceUuid,
      pending.sessionUuid
    );
    pushDiagnosticEvent({ source: 'ble', action: 'contact_exchange_complete', detail: 'Received remote contact payload over BLE.' });

    return receivedContactInfo;
  };

  const releaseSessions = useCallback(async () => {
    await blePort.stopAdvertising();
    await blePort.disconnect(connectedDeviceIdRef.current);
    connectedDeviceIdRef.current = undefined;
    pendingSessionRef.current = null;
    pushDiagnosticEvent({ source: 'system', action: 'session_reset', detail: 'Cancelled BLE in-flight operations.' });
  }, [blePort]);

  const reset = async () => {
    await releaseSessions();
    setBootstrapPayload(null);
    setBootstrapDisplayString('');
    setDiagnostic('');
    setDiagnosticEvents([]);
    dispatch({ type: 'reset' });
  };

  useEffect(() => {
    return () => {
      releaseSessions()
        .catch(() => undefined)
        .finally(() => {
          blePort.cleanup().catch(() => undefined);
        });
    };
  }, [releaseSessions, blePort]);

  return {
    state,
    roleOptions: ['writer', 'reader'] as ProximityRole[],
    bootstrapPayload,
    bootstrapDisplayString,
    diagnostic,
    diagnosticEvents,
    localSignerPublicKeyBase64,
    prepareWriterPayload,
    ingestScannedBootstrap,
    handleCameraPermissionDenied,
    startBleDiscoveryConnect,
    exchangeContactInfoOverBle,
    reset,
  };
}
