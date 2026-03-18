import { useMemo, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

import { ProximityQrDisplay } from './components/ProximityQrDisplay';
import { ProximityQrScanner } from './components/ProximityQrScanner';
import type { ProximitySessionState } from './proximityState';
import { useProximityBootstrap } from './useProximityBootstrap';

const FRIENDLY_FAILURE_COPY: Record<string, string> = {
  PERMISSION_DENIED: 'Permission was denied by the OS. Enable required permissions and retry.',
  CAMERA_PERMISSION_DENIED: 'Camera permission denied. QR scanning is blocked and BLE auth is fail-closed.',
  BLE_UNAVAILABLE_OR_DISABLED: 'BLE is unavailable or disabled on this device.',
  SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND: 'No matching BLE device was found before timeout.',
  DEVICE_UUID_UNAVAILABLE: 'Device BLE service UUID is unavailable, so QR generation is blocked.',
  SIGNATURE_INVALID: 'Bootstrap signature is invalid.',
  MISMATCH: 'Bootstrap and discovery data mismatch detected.',
};

function normalizeFailureReason(reason: string): string {
  const [baseReason] = reason.split(':');

  if (baseReason === 'invalid_signature' || baseReason === 'signature_decode_failed' || baseReason === 'public_key_decode_failed') {
    return 'SIGNATURE_INVALID';
  }

  if (
    ['service_uuid_mismatch', 'session_uuid_mismatch', 'identity_binding_mismatch', 'session_confirmation_mismatch'].includes(baseReason)
  ) {
    return 'MISMATCH';
  }

  return baseReason.toUpperCase();
}

function getFailureMessage(state: ProximitySessionState): string | null {
  if (!state.failureReason) {
    return null;
  }

  const normalizedReason = normalizeFailureReason(state.failureReason);
  return FRIENDLY_FAILURE_COPY[normalizedReason] ?? `Flow failed with reason: ${state.failureReason}.`;
}

export function ProximityBootstrapPanel() {
  const inputBackgroundColor = useThemeColor({}, 'surface');
  const inputBorderColor = useThemeColor({}, 'border');
  const inputTextColor = useThemeColor({}, 'text');
  const {
    state,
    bootstrapPayload,
    bootstrapDisplayString,
    diagnostic,
    diagnosticEvents,
    localSignerPublicKeyBase64,
    prepareWriterPayload,
    ingestScannedBootstrap,
    handleCameraPermissionDenied,
    startBleDiscoveryConnect,
    reset,
  } = useProximityBootstrap();

  const [identityBindingHash, setIdentityBindingHash] = useState('a'.repeat(64));

  const isWorking = useMemo(
    () => ['bootstrap_preparing', 'bootstrap_scanned', 'ble_scanning', 'ble_connecting', 'session_authenticating'].includes(state.status),
    [state.status]
  );
  const canGenerateBootstrap = state.status === 'idle' || state.status === 'bootstrap_ready' || state.status === 'failed';
  const canStartBle = state.status === 'bootstrap_validated';
  const canReset = state.status !== 'idle' || diagnosticEvents.length > 0;

  const failureMessage = getFailureMessage(state);

  return (
    <AppCard style={styles.card}>
      <ThemedText type="subtitle">Proximity bootstrap controls</ThemedText>
      <ThemedText>Status: {state.status}</ThemedText>
      {failureMessage ? <ThemedText style={styles.error}>Failure: {failureMessage}</ThemedText> : null}
      {diagnostic ? <ThemedText>{diagnostic}</ThemedText> : null}
      <ThemedText>Using device BLE service UUID.</ThemedText>

      <ThemedText>Identity binding hash</ThemedText>
      <TextInput
        value={identityBindingHash}
        onChangeText={setIdentityBindingHash}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />
      <AppButton
        label="Generate QR bootstrap"
        onPress={() => {
          void prepareWriterPayload(identityBindingHash);
        }}
        disabled={!canGenerateBootstrap || isWorking}
      />

      <ProximityQrDisplay value={bootstrapDisplayString} />

      <ProximityQrScanner
        enabled={Boolean(bootstrapDisplayString) || state.status === 'failed' || state.status === 'idle'}
        onPermissionDenied={handleCameraPermissionDenied}
        onScanned={async (raw) => {
          const didValidateBootstrap = await ingestScannedBootstrap(raw, localSignerPublicKeyBase64);
          if (didValidateBootstrap) {
            void startBleDiscoveryConnect();
          }
        }}
      />

      <AppButton
        label="Start BLE discovery/connect"
        onPress={() => {
          void startBleDiscoveryConnect();
        }}
        disabled={!canStartBle || isWorking}
      />
      <AppButton
        label="Cancel/Reset session"
        onPress={() => {
          void reset();
        }}
        disabled={!canReset || isWorking}
      />

      {__DEV__ && bootstrapPayload ? (
        <>
          <ThemedText type="defaultSemiBold">Debug bootstrap JSON preview</ThemedText>
          <ThemedText selectable>{JSON.stringify(bootstrapPayload, null, 2)}</ThemedText>
        </>
      ) : null}
      <ThemedText selectable>Expected signer public key: {localSignerPublicKeyBase64}</ThemedText>

      {diagnosticEvents.length > 0 ? (
        <>
          <ThemedText type="defaultSemiBold">Diagnostics</ThemedText>
          {diagnosticEvents.map((event) => (
            <ThemedText key={`${event.at}-${event.source}-${event.action}`} selectable>
              {event.at} [{event.source}] {event.action}: {event.detail}
            </ThemedText>
          ))}
        </>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#d64545',
  },
});
