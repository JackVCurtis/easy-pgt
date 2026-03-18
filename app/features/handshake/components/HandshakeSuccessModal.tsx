import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { ExchangedPayloadResult } from '@/app/features/handshake/handshakePayloads';

type HandshakeSuccessModalProps = {
  visible: boolean;
  exchangedPayload: ExchangedPayloadResult | null;
  onClose: () => void;
};

export function HandshakeSuccessModal({ visible, exchangedPayload, onClose }: HandshakeSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <ThemedText type="subtitle">Handshake Success</ThemedText>
          <ThemedText>Local shared payload</ThemedText>
          <ThemedText selectable style={styles.codeBlock}>
            {JSON.stringify(exchangedPayload?.localSharedPayload ?? null, null, 2)}
          </ThemedText>

          <ThemedText>Remote received payload</ThemedText>
          <ThemedText selectable style={styles.codeBlock}>
            {JSON.stringify(exchangedPayload?.remoteReceivedPayload ?? null, null, 2)}
          </ThemedText>

          <Pressable accessibilityRole="button" style={styles.closeButton} onPress={onClose}>
            <ThemedText type="defaultSemiBold">Close</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    padding: 8,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
