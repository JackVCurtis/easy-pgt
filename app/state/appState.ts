export type HandshakeStatusDto = 'verified' | 'pending';

export type CounterpartyConnectionDto = {
  id: string;
  localAlias: string;
  counterpartAlias: string;
  trustDepth: number;
  handshakeStatus: HandshakeStatusDto;
};

export type MessageVerificationContextDto = {
  status: string | null;
  senderDistances: string[];
};

export type MessageComposerStateDto = {
  draftMessage: string;
  verificationContext: MessageVerificationContextDto;
};

export type RuntimeGatekeepingFlagsDto = {
  hasCompletedOnboarding: boolean;
  hasGeneratedIdentity: boolean;
  hasGrantedBluetoothPermission: boolean;
  hasGrantedCameraPermission: boolean;
  isDeviceSecurityConfigured: boolean;
};

export type AppStateDto = {
  connections: CounterpartyConnectionDto[];
  messageComposer: MessageComposerStateDto;
  runtimeGatekeeping: RuntimeGatekeepingFlagsDto;
};

export const INITIAL_APP_STATE: AppStateDto = {
  connections: [],
  messageComposer: {
    draftMessage: '',
    verificationContext: {
      status: null,
      senderDistances: [],
    },
  },
  runtimeGatekeeping: {
    hasCompletedOnboarding: false,
    hasGeneratedIdentity: false,
    hasGrantedBluetoothPermission: false,
    hasGrantedCameraPermission: false,
    isDeviceSecurityConfigured: false,
  },
};
