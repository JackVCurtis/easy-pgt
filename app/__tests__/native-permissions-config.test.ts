import fs from 'node:fs';
import path from 'node:path';

type ExpoConfig = {
  expo?: {
    ios?: {
      infoPlist?: Record<string, unknown>;
    };
    android?: {
      permissions?: string[];
    };
    plugins?: unknown[];
  };
};

function loadExpoConfig(): ExpoConfig {
  const appJsonPath = path.resolve(__dirname, '../../app.json');
  const source = fs.readFileSync(appJsonPath, 'utf8');
  return JSON.parse(source) as ExpoConfig;
}

describe('native permission configuration', () => {
  it('declares iOS privacy usage descriptions for Bluetooth and camera access', () => {
    const config = loadExpoConfig();
    const infoPlist = config.expo?.ios?.infoPlist;

    expect(infoPlist).toEqual(
      expect.objectContaining({
        NSBluetoothAlwaysUsageDescription: expect.any(String),
        NSBluetoothPeripheralUsageDescription: expect.any(String),
        NSCameraUsageDescription: expect.any(String),
      })
    );
  });

  it('declares Android runtime permissions needed by BLE and QR handshakes', () => {
    const config = loadExpoConfig();
    const permissions = config.expo?.android?.permissions ?? [];

    expect(permissions).toEqual(
      expect.arrayContaining([
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_ADVERTISE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
      ])
    );
  });

  it('configures BLE and camera Expo config plugins', () => {
    const config = loadExpoConfig();
    const plugins = config.expo?.plugins ?? [];

    const blePlugin = plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'react-native-ble-plx'
    ) as
      | [
          string,
          {
            isBackgroundEnabled?: boolean;
            modes?: string[];
            bluetoothAlwaysPermission?: string;
          },
        ]
      | undefined;

    const cameraPlugin = plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-camera'
    ) as
      | [string, { cameraPermission?: string }]
      | undefined;

    expect(blePlugin).toBeDefined();
    expect(blePlugin?.[1]).toEqual(
      expect.objectContaining({
        isBackgroundEnabled: true,
        modes: expect.arrayContaining(['central', 'peripheral']),
        bluetoothAlwaysPermission: expect.any(String),
      })
    );

    expect(cameraPlugin).toBeDefined();
    expect(cameraPlugin?.[1]).toEqual(
      expect.objectContaining({
        cameraPermission: expect.any(String),
      })
    );
  });


  it('configures local authentication plugin for biometric prompts', () => {
    const config = loadExpoConfig();
    const plugins = config.expo?.plugins ?? [];
    const localAuthenticationPlugin = plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-local-authentication'
    ) as [string, { faceIDPermission?: string }] | undefined;

    expect(localAuthenticationPlugin).toBeDefined();
    expect(localAuthenticationPlugin?.[1].faceIDPermission).toEqual(expect.any(String));
  });
  it('configures secure storage plugin for biometric prompts', () => {
    const config = loadExpoConfig();
    const plugins = config.expo?.plugins ?? [];
    const secureStorePlugin = plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-secure-store'
    ) as [string, { faceIDPermission?: string }] | undefined;

    expect(secureStorePlugin).toBeDefined();
    expect(secureStorePlugin?.[1].faceIDPermission).toEqual(expect.any(String));
  });
});
