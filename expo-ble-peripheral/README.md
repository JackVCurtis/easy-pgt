# expo-ble-peripheral

Android-only Expo native module for BLE peripheral/server bootstrap of an app-layer secure session.

## Scope and non-goals

This module intentionally supports **Android only** and implements only the BLE pieces needed to bootstrap a secure session:

- Advertise one custom primary service.
- Accept inbound GATT client connections.
- Receive handshake-init messages through a writable characteristic.
- Send handshake responses through a notifiable characteristic.

Out of scope:

- iOS behavior parity.
- BLE central/client implementation.
- Full data synchronization.
- Identity/authentication based on BLE connectivity or pairing.

> BLE is transport only. A connected GATT client is **not** an authenticated identity.

## Android permissions

Manifest permissions included by this module:

- `BLUETOOTH_ADVERTISE` (Android 12+) to start peripheral advertisements.
- `BLUETOOTH_CONNECT` (Android 12+) to host GATT server and notify connected peers.
- Legacy `BLUETOOTH` / `BLUETOOTH_ADMIN` (`maxSdkVersion=30`) for older Android versions.

Runtime behavior:

- `requestPermissions()` requests `BLUETOOTH_ADVERTISE` + `BLUETOOTH_CONNECT` on Android 12+.
- On Android 11 and below, those two permissions are treated as granted.

## Feature checks and failure modes

Before `startPeripheral`, call:

- `isSupported()` for adapter/LE/advertising capability.
- `requestPermissions()` for runtime permission state.

`startPeripheral` fails fast with explicit errors when:

- Bluetooth adapter is unavailable (`ERR_BLUETOOTH_UNAVAILABLE`).
- BLE is unsupported (`ERR_BLE_UNSUPPORTED`).
- Advertising is unsupported (`ERR_ADVERTISING_UNSUPPORTED`).
- Permissions are missing (`ERR_PERMISSIONS_MISSING`).
- GATT service registration/open fails (`ERR_GATT_SERVER_START_FAILED`).
- Advertising fails (`ERR_ADVERTISING_START_FAILED`).

## GATT schema

One primary service:

- **Inbound characteristic**: writable (`WRITE | WRITE_NO_RESPONSE`) for client-to-peripheral handshake messages.
- **Outbound characteristic**: notifiable (`NOTIFY`) for peripheral-to-client handshake messages.
- **CCCD descriptor** on outbound characteristic (`0x2902`) for notification subscription.

## JS API

```ts
isSupported(): Promise<{ bluetooth: boolean; ble: boolean; peripheralMode: boolean; multipleAdvertisement: boolean }>
requestPermissions(): Promise<{ advertise: boolean; connect: boolean }>
startPeripheral(options: StartPeripheralOptions): Promise<void>
stopPeripheral(): Promise<void>
sendHandshakeMessage(base64Payload: string): Promise<void>
getState(): Promise<PeripheralState>
```

### `StartPeripheralOptions`

```ts
type StartPeripheralOptions = {
  serviceUuid: string;
  inboundCharacteristicUuid: string;
  outboundCharacteristicUuid: string;
  deviceName?: string;
  advertiseMode?: 'balanced' | 'lowLatency' | 'lowPower';
  txPowerLevel?: 'high' | 'medium' | 'low' | 'ultraLow';
  includeDeviceName?: boolean;
};
```

### Events

- `onPeripheralStateChanged`
- `onAdvertisingStateChanged`
- `onDeviceConnected`
- `onDeviceDisconnected`
- `onHandshakeMessageReceived`
- `onError`

### Peripheral state model

```ts
type PeripheralState = {
  supported: boolean;
  permissionsGranted: boolean;
  advertising: boolean;
  gattServerStarted: boolean;
  connectedDeviceCount: number;
  subscribedDeviceCount: number;
  sessionReady: boolean;
};
```

## Handshake transport envelope

Handshake payloads transported over BLE must be UTF-8 JSON encoded and then base64 at the JS/native boundary:

```json
{
  "version": 1,
  "messageType": "client-init",
  "sessionId": "8e90ea8d-9a6f-4a4e-9e1f-79966f1ec9c3",
  "payload": "<base64>"
}
```

Validation constraints:

- Max encoded message size: 512 bytes.
- `version` must be positive integer.
- `messageType` must be non-empty string.
- `sessionId` must be UUID.
- `payload` must be base64 string.

Notifications are rejected until the client enables CCCD.

## Manual two-device validation

1. Launch app on Android peripheral device.
2. Call `requestPermissions()` and grant Nearby Devices permissions.
3. Call `startPeripheral(...)` with service + characteristic UUIDs.
4. On second Android device acting as GATT client, scan/discover service UUID.
5. Connect as GATT client.
6. Write CCCD to enable notifications on outbound characteristic.
7. Write a valid handshake-init envelope to inbound characteristic.
8. Confirm `onHandshakeMessageReceived` fires in peripheral app.
9. Call `sendHandshakeMessage(...)` with valid base64 envelope.
10. Verify client receives notify on outbound characteristic.
11. Disconnect client and confirm `sessionReady` resets and counts return to zero.
12. Retry start/stop/reconnect lifecycle.

Negative tests:

- Missing runtime permissions.
- Advertising unsupported hardware.
- Malformed inbound handshake envelope.
- Notify attempt before CCCD subscription (`ERR_NOTIFY_NOT_SUBSCRIBED`).
