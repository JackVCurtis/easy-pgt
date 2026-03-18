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

export const DEFAULT_CONNECTIONS: CounterpartyConnectionDto[] = [
  {
    id: 'tr-001',
    localAlias: 'Ari Kim',
    counterpartAlias: 'Northside Organizer',
    trustDepth: 1,
    handshakeStatus: 'verified',
  },
  {
    id: 'tr-002',
    localAlias: 'Mei Patel',
    counterpartAlias: 'Library Contact',
    trustDepth: 2,
    handshakeStatus: 'verified',
  },
  {
    id: 'tr-003',
    localAlias: 'Jordan Lee',
    counterpartAlias: 'Mutual Friend',
    trustDepth: 3,
    handshakeStatus: 'pending',
  },
];

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

export function getRuntimeConnections(state: AppStateDto): CounterpartyConnectionDto[] {
  return state.connections.length > 0 ? state.connections : DEFAULT_CONNECTIONS;
}
