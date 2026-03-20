export type AdvertiseMode = 'balanced' | 'lowLatency' | 'lowPower';
export type TxPowerLevel = 'high' | 'medium' | 'low' | 'ultraLow';

export type StartPeripheralOptions = {
  serviceUuid: string;
  inboundCharacteristicUuid: string;
  outboundCharacteristicUuid: string;
  deviceName?: string;
  advertiseMode?: AdvertiseMode;
  txPowerLevel?: TxPowerLevel;
  includeDeviceName?: boolean;
};

export type PeripheralState = {
  supported: boolean;
  permissionsGranted: boolean;
  advertising: boolean;
  gattServerStarted: boolean;
  connectedDeviceCount: number;
  subscribedDeviceCount: number;
  sessionReady: boolean;
};

export type SupportState = {
  bluetooth: boolean;
  ble: boolean;
  peripheralMode: boolean;
  multipleAdvertisement: boolean;
};

export type PermissionState = {
  advertise: boolean;
  connect: boolean;
};

export type HandshakeMessageEventPayload = {
  base64Payload: string;
  version: number;
  messageType: string;
  sessionId: string;
};

export type ExpoBlePeripheralModuleEvents = {
  onPeripheralStateChanged: (params: PeripheralState) => void;
  onAdvertisingStateChanged: (params: { advertising: boolean }) => void;
  onDeviceConnected: (params: { deviceId: string }) => void;
  onDeviceDisconnected: (params: { deviceId: string }) => void;
  onHandshakeMessageReceived: (params: HandshakeMessageEventPayload) => void;
  onError: (params: { code: string; message: string }) => void;
};


export type ExpoBlePeripheralViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
};
