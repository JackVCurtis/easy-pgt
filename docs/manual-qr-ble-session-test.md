# Manual QR → BLE Session Test (Bootstrap Slice)

This guide covers the minimal manual transport test for the current bootstrap implementation slice.

## Scope

Implemented scope is limited to:

1. generate signed QR bootstrap payload
2. scan and validate bootstrap payload
3. bind BLE discovery to bootstrap service UUID
4. run minimal session confirmation bound to `session_uuid`

Not implemented here: Merkle root compare, subtree reconciliation, record transfer, commit, resume checkpoints.

## Prerequisites

- Device with camera support for QR scanning.
- App built with React Native + Expo project configuration.
- `expo-camera` and `react-native-ble-plx` must be included in the native runtime through Expo config plugins and a native build.
- Use a Dev Client or standalone native build; **Expo Go is not sufficient** for full camera/BLE transport testing.
- If plugin config/permissions changed, run `npx expo prebuild` and rebuild before re-running this manual test.

## Developer test flow

1. Open **Handshake** tab and scroll to **Developer QR → BLE bootstrap test** panel.
2. On writer device, press **Generate QR bootstrap**. The app resolves the BLE service UUID from device/runtime state (not user input).
3. In dev mode, inspect the panel's debug bootstrap JSON and confirm `bluetooth_service_uuid` matches the device-derived value.
4. Show the generated QR code on the writer device.
5. On reader device, grant camera permission if prompted.
6. Use the in-app QR scanner to scan the writer payload.
7. Press **Start BLE discovery/connect**.
8. Confirm final status is `session_authenticated` and that scan/connect diagnostics reference the same UUID from the bootstrap payload.

## Expected success path

`idle` → `qr_preparing` → `qr_ready` → `qr_scanned` → `bootstrap_validated` → `ble_scanning` → `ble_connecting` → `ble_connected` → `session_authenticating` → `session_authenticated`

## Expected failure paths

- Tampered payload field => bootstrap validation fails before BLE auth.
- Service UUID mismatch => `failed` with `service_uuid_mismatch`.
- Device UUID unavailable during generation => `failed` with `DEVICE_UUID_UNAVAILABLE`.
- Session UUID mismatch => `failed` with `session_uuid_mismatch`.
- Session proof mismatch => `failed` with `session_confirmation_mismatch`.
- Camera permission denied => `failed` with `camera_permission_denied` before BLE progression.

## Platform/library caveats

- Android 12+ requires runtime grants for `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `BLUETOOTH_ADVERTISE`; location permission may still be required on older Android versions.
- Camera permission is required for QR scan intake.
- Expo Go may not expose all native camera/BLE plugin behavior needed for this manual slice.
- This slice provides deterministic protocol checks and developer diagnostics first; full transport productionization is a later step.
