import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { ThemedText } from '@/components/themed-text';
import type { ProximitySessionState } from '@/app/features/proximity/proximityState';
import { ProximityQrDisplay } from '@/app/features/proximity/components/ProximityQrDisplay';
import { ProximityQrScanner } from '@/app/features/proximity/components/ProximityQrScanner';
import { useProximityBootstrap } from '@/app/features/proximity/useProximityBootstrap';

const IDENTITY_BINDING_HASH = '7f4f2f2a6a63c8bd4f07bd55f0a4a8a3e274eb45857ec5b5ef5ec66c700cf6ad';

type HandshakeEntryMode = 'idle' | 'offer' | 'accept';

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

export function HandshakeContainer() {
  const [mode, setMode] = useState<HandshakeEntryMode>('idle');
  const {
    state,
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

  const isWorking = useMemo(
    () => ['bootstrap_preparing', 'bootstrap_scanned', 'ble_scanning', 'ble_connecting', 'session_authenticating'].includes(state.status),
    [state.status]
  );
  const isHandshakeComplete = state.status === 'session_authenticated';

  const failureMessage = getFailureMessage(state);

  const beginOffer = async () => {
    setMode('offer');
    await prepareWriterPayload(IDENTITY_BINDING_HASH);
  };

  const beginAccept = async () => {
    setMode('accept');
    await reset();
  };

  const restart = async () => {
    await reset();
    setMode('idle');
  };

  return (
    <View style={styles.container}>
      {mode === 'idle' ? (
        <View style={styles.flowSection}>
          <AppButton label="Offer Hand" onPress={() => void beginOffer()} disabled={isWorking} />
          <AppButton label="Accept Handshake" onPress={() => void beginAccept()} disabled={isWorking} />
        </View>
      ) : null}

      {mode === 'offer' ? (
        <View style={styles.flowSection}>
          <ThemedText type="defaultSemiBold">Offer Hand</ThemedText>
          <ThemedText>Have the other person scan this QR to start proximity bootstrap.</ThemedText>
          <ProximityQrDisplay value={bootstrapDisplayString} />
          <AppButton label="Back" onPress={() => void restart()} disabled={isWorking} />
        </View>
      ) : null}

      {mode === 'accept' ? (
        <View style={styles.flowSection}>
          <ThemedText type="defaultSemiBold">Accept Handshake</ThemedText>
          <ThemedText>Scan the other person’s QR. BLE discovery/connect starts automatically after validation.</ThemedText>
          <ProximityQrScanner
            enabled={!isWorking}
            onPermissionDenied={handleCameraPermissionDenied}
            onScanned={async (scannedRaw) => {
              const expectedSignerPublicKey = localSignerPublicKeyBase64;
              const didValidateBootstrap = await ingestScannedBootstrap(scannedRaw, expectedSignerPublicKey);

              // BLE authentication is the current completion boundary for handshake orchestration.
              if (didValidateBootstrap) {
                // Merkle log sync is intentionally out-of-scope for this refactor; do not trigger any sync stage here.
                void startBleDiscoveryConnect();
              }
            }}
          />
          <AppButton label="Back" onPress={() => void restart()} disabled={isWorking} />
        </View>
      ) : null}

      <View style={styles.previewSection}>
        <ThemedText type="defaultSemiBold">Diagnostics</ThemedText>
        {failureMessage ? <ThemedText style={styles.error}>Failure: {failureMessage}</ThemedText> : null}
        {diagnostic ? (
          <ThemedText>{diagnostic}</ThemedText>
        ) : (
          <ThemedText>Handshake diagnostics will appear here once a handshake is initiated.</ThemedText>
        )}
        {isHandshakeComplete ? <ThemedText type="defaultSemiBold">Handshake complete: BLE session authenticated.</ThemedText> : null}
        <ThemedText>Status: {state.status}</ThemedText>
        {diagnosticEvents.slice(-4).map((event) => (
          <ThemedText key={`${event.at}-${event.source}-${event.action}`} selectable>
            {event.at} [{event.source}] {event.action}: {event.detail}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 8,
  },
  flowSection: {
    gap: 12,
  },
  previewSection: {
    gap: 8,
    paddingTop: 8,
  },
  error: {
    color: '#d64545',
  },
});
