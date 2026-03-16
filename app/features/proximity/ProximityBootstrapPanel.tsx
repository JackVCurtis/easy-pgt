import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

import { useProximityBootstrap } from './useProximityBootstrap';

export function ProximityBootstrapPanel() {
  const inputBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBorderColor = useThemeColor({}, 'borderSubtle');
  const inputTextColor = useThemeColor({}, 'text');
  const { state, bootstrapPayload, diagnostic, localSignerPublicKeyBase64, prepareWriterPayload, readerReceivePayload, reset } =
    useProximityBootstrap();

  const [identityBindingHash, setIdentityBindingHash] = useState('a'.repeat(64));
  const [serviceUuid, setServiceUuid] = useState('6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
  const [payloadInput, setPayloadInput] = useState('');

  return (
    <AppCard style={styles.card}>
      <ThemedText type="subtitle">Developer NFC → BLE bootstrap test</ThemedText>
      <ThemedText>Status: {state.status}</ThemedText>
      {state.failureReason ? <ThemedText>Failure: {state.failureReason}</ThemedText> : null}
      {diagnostic ? <ThemedText>{diagnostic}</ThemedText> : null}

      <TextInput
        value={identityBindingHash}
        onChangeText={setIdentityBindingHash}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />
      <TextInput
        value={serviceUuid}
        onChangeText={setServiceUuid}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />

      <AppButton label="Writer: Generate bootstrap payload" onPress={() => {
        void prepareWriterPayload(identityBindingHash, serviceUuid);
      }} />
      {bootstrapPayload ? <ThemedText selectable>{JSON.stringify(bootstrapPayload)}</ThemedText> : null}
      <ThemedText selectable>Expected signer public key: {localSignerPublicKeyBase64}</ThemedText>

      <TextInput
        placeholder="Paste received bootstrap JSON"
        value={payloadInput}
        onChangeText={setPayloadInput}
        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
      />
      <AppButton
        label="Reader: Validate + connect + authenticate"
        onPress={() => {
          try {
            const parsed = JSON.parse(payloadInput);
            void readerReceivePayload(parsed, localSignerPublicKeyBase64);
          } catch {
            void readerReceivePayload(undefined, localSignerPublicKeyBase64);
          }
        }}
      />
      <AppButton label="Reset developer flow" onPress={() => { void reset(); }} />
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
});
