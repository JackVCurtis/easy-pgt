import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AppButton } from '@/components/ui/app-button';
import { ThemedText } from '@/components/themed-text';

interface ProximityQrScannerProps {
  enabled: boolean;
  onScanned: (raw: string) => void;
  onPermissionDenied: () => void;
}

export function ProximityQrScanner({ enabled, onScanned, onPermissionDenied }: ProximityQrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);

  const request = useCallback(async () => {
    const result = await requestPermission();
    if (!result.granted) {
      onPermissionDenied();
    }
  }, [onPermissionDenied, requestPermission]);

  if (!enabled) {
    return <ThemedText>Scanner becomes active once flow is ready.</ThemedText>;
  }

  if (Platform.OS === 'web') {
    return <ThemedText>Camera QR scanning is unavailable on web preview.</ThemedText>;
  }

  if (!permission) {
    return <AppButton label="Load camera permission" onPress={() => void request()} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.block}>
        <ThemedText>Camera permission required for QR scan.</ThemedText>
        <AppButton label="Grant camera access" onPress={() => void request()} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (scanLocked || !data) {
            return;
          }
          setScanLocked(true);
          onScanned(data);
        }}
      />
      <AppButton label="Scan again" onPress={() => setScanLocked(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  camera: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
