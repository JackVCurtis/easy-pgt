import { INITIAL_APP_STATE } from '@/app/state/appState';

export type Counterparty = {
  id: string;
  providedName: string;
  localSharedName: string;
  trustDepth: number;
  contactInfo?: string;
  publicKey?: string;
  relationshipUuid?: string;
  handshakeStatus: 'verified' | 'pending';
};

const GENERATED_COUNTERPARTY_NAME = 'Avery Shaw';

const INITIAL_COUNTERPARTIES: Counterparty[] = INITIAL_APP_STATE.connections.map((connection) => ({
  id: connection.id,
  providedName: connection.counterpartAlias,
  localSharedName: connection.localAlias,
  trustDepth: connection.trustDepth,
  handshakeStatus: connection.handshakeStatus,
  publicKey: connection.trustDepth > 1 ? `pk-${connection.id}` : undefined,
  relationshipUuid: connection.trustDepth > 1 ? `uuid-${connection.id}` : undefined,
}));

let counterpartyStore: Counterparty[] = [...INITIAL_COUNTERPARTIES];

export function getDirectCounterparties(): Counterparty[] {
  return counterpartyStore.filter((counterparty) => counterparty.trustDepth === 1);
}

export function getCounterpartyById(id: string): Counterparty | undefined {
  return getDirectCounterparties().find((counterparty) => counterparty.id === id);
}

export function addHandshakeCounterparty({
  localSharedName,
  contactInfo,
}: {
  localSharedName: string;
  contactInfo?: string;
}): Counterparty {
  const created: Counterparty = {
    id: `tr-${Date.now()}`,
    providedName: GENERATED_COUNTERPARTY_NAME,
    localSharedName,
    trustDepth: 1,
    contactInfo,
    handshakeStatus: 'verified',
  };

  counterpartyStore = [created, ...counterpartyStore];

  return created;
}

export function updateCounterparty(
  id: string,
  updates: Pick<Counterparty, 'providedName' | 'contactInfo'>
): Counterparty | undefined {
  const current = getCounterpartyById(id);

  if (!current) {
    return undefined;
  }

  const next = {
    ...current,
    providedName: updates.providedName,
    contactInfo: updates.contactInfo,
  };

  counterpartyStore = counterpartyStore.map((counterparty) =>
    counterparty.id === id ? next : counterparty
  );

  return next;
}

export function resetCounterpartyStore(): void {
  counterpartyStore = [...INITIAL_COUNTERPARTIES];
}
