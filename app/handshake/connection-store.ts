import { TRUST_RELATIONSHIPS } from '@/app/mock-data';

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

const INITIAL_COUNTERPARTIES: Counterparty[] = TRUST_RELATIONSHIPS.map((relationship) => ({
  id: relationship.id,
  providedName: relationship.counterpartAlias,
  localSharedName: relationship.localAlias,
  trustDepth: relationship.trustDepth,
  handshakeStatus: relationship.handshakeStatus,
  publicKey: relationship.trustDepth > 1 ? `pk-${relationship.id}` : undefined,
  relationshipUuid: relationship.trustDepth > 1 ? `uuid-${relationship.id}` : undefined,
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
