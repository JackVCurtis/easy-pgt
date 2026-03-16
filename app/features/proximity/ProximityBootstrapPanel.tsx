import { useMemo, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

import type { ProximitySessionState } from './proximityState';
import { useProximityBootstrap } from './useProximityBootstrap';

const FRIENDLY_FAILURE_COPY: Record<string, string> = {
  PERMISSION_DENIED: 'Permission was denied by the OS. Enable NFC/BLE permissions and retry.',
  NFC_UNAVAILABLE_OR_DISABLED: 'NFC is unavailable or disabled on this device.',
  BLE_UNAVAILABLE_OR_DISABLED: 'BLE is unavailable or disabled on this device.',
  SCAN_TIMEOUT_OR_DEVICE_NOT_FOUND: 'No matching BLE device was found before timeout.',
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
  const inputBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBorderColor = useThemeColor({}, 'borderSubtle');
  const inputTextColor = useThemeColor({}, 'text');
  const {
    state,
    bootstrapPayload,
    diagnostic,
    diagnosticEvents,
    localSignerPublicKeyBase64,
    prepareWriterPayload,
    readBootstrapViaNfc,
    startBleDiscoveryConnect,
    reset,
  } = useProximityBootstrap();

  const [identityBindingHash, setIdentityBindingHash] = useState('a'.repeat(64));
  const [serviceUuid, setServiceUuid] = useState('6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');

  const isWorking = useMemo(
    () => ['nfc_preparing', 'nfc_received', 'ble_scanning', 'ble_connecting', 'session_authenticating'].includes(state.status),
    [state.status]
  );
  const canWriteBootstrap = state.status === 'idle' || state.status === 'nfc_ready' || state.status === 'failed';
  const canReadBootstrap = state.status === 'idle' || state.status === 'nfc_ready' || state.status === 'failed';
  const canStartBle = state.status === 'bootstrap_validated';
  const canReset = state.status !== 'idle' || diagnosticEvents.length > 0;

  const failureMessage = getFailureMessage(state);

  return (
    <AppCard style={styles.card}>
      <ThemedText type="subtitle">Proximity bootstrap controls</ThemedText>
      <ThemedText>Status: {state.status}</ThemedText>
      {failureMessage ? <ThemedText style={styles.error}>Failure: {failureMessage}</ThemedText> : null}
      {diagnostic ? <ThemedText>{diagnostic}</ThemedText> : null}

      <ThemedText>Identity binding hash</ThemedText>
      <TextInput
        value={identityBindingHash}
        onChangeText={setIdentityBindingHash}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />
      <ThemedText>Service UUID</ThemedText>
      <TextInput
        value={serviceUuid}
        onChangeText={setServiceUuid}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />

      <AppButton
        label="Write bootstrap to NFC tag/device"
        onPress={() => {
          void prepareWriterPayload(identityBindingHash, serviceUuid);
        }}
        disabled={!canWriteBootstrap || isWorking}
      />
      <AppButton
        label="Read bootstrap via NFC"
        onPress={() => {
          void readBootstrapViaNfc(localSignerPublicKeyBase64);
        }}
        disabled={!canReadBootstrap || isWorking}
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
