import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';

interface ProximityQrDisplayProps {
  value: string;
}

export function ProximityQrDisplay({ value }: ProximityQrDisplayProps) {
  if (!value) {
    return <ThemedText>Generate a bootstrap payload to render QR.</ThemedText>;
  }

  return (
    <View style={styles.container}>
      <QRCode value={value} size={180} />
      <ThemedText type="defaultSemiBold">QR bootstrap ready for scan</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
