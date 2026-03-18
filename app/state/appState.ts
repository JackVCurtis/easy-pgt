export type HandshakeStatusDto = 'verified' | 'pending';

export type CounterpartyConnectionDto = {
  id: string;
  localAlias: string;
  counterpartAlias: string;
  trustDepth: number;
  handshakeStatus: HandshakeStatusDto;
  contactInfo?: string;
  publicKey?: string;
  relationshipUuid?: string;
  createdAtMs: number;
  updatedAtMs: number;
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

const DEFAULT_CREATED_AT_MS = 1735689600000; // 2025-01-01T00:00:00.000Z

export const DEFAULT_CONNECTIONS: CounterpartyConnectionDto[] = [
  {
    id: 'tr-001',
    localAlias: 'Ari Kim',
    counterpartAlias: 'Northside Organizer',
    trustDepth: 1,
    handshakeStatus: 'verified',
    createdAtMs: DEFAULT_CREATED_AT_MS,
    updatedAtMs: DEFAULT_CREATED_AT_MS,
  },
  {
    id: 'tr-002',
    localAlias: 'Mei Patel',
    counterpartAlias: 'Library Contact',
    trustDepth: 2,
    handshakeStatus: 'verified',
    publicKey: 'pk-tr-002',
    relationshipUuid: 'uuid-tr-002',
    createdAtMs: DEFAULT_CREATED_AT_MS,
    updatedAtMs: DEFAULT_CREATED_AT_MS,
  },
  {
    id: 'tr-003',
    localAlias: 'Jordan Lee',
    counterpartAlias: 'Mutual Friend',
    trustDepth: 3,
    handshakeStatus: 'pending',
    publicKey: 'pk-tr-003',
    relationshipUuid: 'uuid-tr-003',
    createdAtMs: DEFAULT_CREATED_AT_MS,
    updatedAtMs: DEFAULT_CREATED_AT_MS,
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

const GENERATED_COUNTERPARTY_NAME = 'Avery Shaw';

export type CounterpartyView = {
  id: string;
  providedName: string;
  localSharedName: string;
  trustDepth: number;
  contactInfo?: string;
  publicKey?: string;
  relationshipUuid?: string;
  handshakeStatus: HandshakeStatusDto;
};

let serializedAppState = JSON.stringify(INITIAL_APP_STATE);

function normalizeConnections(state: AppStateDto): CounterpartyConnectionDto[] {
  return state.connections.length > 0 ? state.connections : DEFAULT_CONNECTIONS;
}

function readState(): AppStateDto {
  const parsed = JSON.parse(serializedAppState) as AppStateDto;

  return {
    ...parsed,
    connections: normalizeConnections(parsed),
  };
}

function writeState(nextState: AppStateDto): AppStateDto {
  serializedAppState = JSON.stringify(nextState);
  return readState();
}

export function readAppStateSnapshot(): AppStateDto {
  return readState();
}

export function resetAppStateRepository(): AppStateDto {
  return writeState(INITIAL_APP_STATE);
}

export function getRuntimeConnections(state: AppStateDto): CounterpartyConnectionDto[] {
  return normalizeConnections(state);
}

export function getAllConnections(): CounterpartyConnectionDto[] {
  return readState().connections;
}

export function getDirectConnections(): CounterpartyConnectionDto[] {
  return getAllConnections().filter((connection) => connection.trustDepth === 1);
}

export function getConnectionById(id: string): CounterpartyConnectionDto | undefined {
  return getDirectConnections().find((connection) => connection.id === id);
}

export function toCounterpartyView(connection: CounterpartyConnectionDto): CounterpartyView {
  return {
    id: connection.id,
    providedName: connection.counterpartAlias,
    localSharedName: connection.localAlias,
    trustDepth: connection.trustDepth,
    contactInfo: connection.contactInfo,
    publicKey: connection.publicKey,
    relationshipUuid: connection.relationshipUuid,
    handshakeStatus: connection.handshakeStatus,
  };
}

export function addHandshakeConnection({
  localSharedName,
  contactInfo,
}: {
  localSharedName: string;
  contactInfo?: string;
}): CounterpartyConnectionDto {
  const now = Date.now();
  const created: CounterpartyConnectionDto = {
    id: `tr-${now}`,
    counterpartAlias: GENERATED_COUNTERPARTY_NAME,
    localAlias: localSharedName,
    trustDepth: 1,
    handshakeStatus: 'verified',
    contactInfo,
    createdAtMs: now,
    updatedAtMs: now,
  };

  const state = readState();
  writeState({
    ...state,
    connections: [created, ...state.connections],
  });

  return created;
}

export function updateConnectionDetails(
  id: string,
  updates: {
    providedName: string;
    contactInfo?: string;
  }
): CounterpartyConnectionDto | undefined {
  const current = getConnectionById(id);

  if (!current) {
    return undefined;
  }

  const now = Date.now();
  const next: CounterpartyConnectionDto = {
    ...current,
    counterpartAlias: updates.providedName,
    contactInfo: updates.contactInfo,
    updatedAtMs: now,
  };

  const state = readState();
  writeState({
    ...state,
    connections: state.connections.map((connection) => (connection.id === id ? next : connection)),
  });

  return next;
}

export function setDraftMessage(draftMessage: string): MessageComposerStateDto {
  const state = readState();
  const messageComposer: MessageComposerStateDto = {
    ...state.messageComposer,
    draftMessage,
  };

  writeState({
    ...state,
    messageComposer,
  });

  return messageComposer;
}

export function setVerificationContext(verificationContext: MessageVerificationContextDto): MessageComposerStateDto {
  const state = readState();
  const messageComposer: MessageComposerStateDto = {
    ...state.messageComposer,
    verificationContext,
  };

  writeState({
    ...state,
    messageComposer,
  });

  return messageComposer;
}

export function getMessageComposerState(): MessageComposerStateDto {
  return readState().messageComposer;
}
