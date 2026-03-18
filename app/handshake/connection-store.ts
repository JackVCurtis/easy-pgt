import {
  addHandshakeConnection,
  getConnectionById,
  getDirectConnections,
  resetAppStateRepository,
  toCounterpartyView,
  updateConnectionDetails,
  type CounterpartyView,
} from '@/app/state/appState';

export type Counterparty = CounterpartyView;

export function getDirectCounterparties(): Counterparty[] {
  return getDirectConnections().map(toCounterpartyView);
}

export function getCounterpartyById(id: string): Counterparty | undefined {
  const connection = getConnectionById(id);
  return connection ? toCounterpartyView(connection) : undefined;
}

export function addHandshakeCounterparty({
  localSharedName,
  providedName,
  contactInfo,
}: {
  localSharedName: string;
  providedName?: string;
  contactInfo?: string;
}): Counterparty {
  return toCounterpartyView(
    addHandshakeConnection({
      localSharedName,
      providedName,
      contactInfo,
    })
  );
}

export function updateCounterparty(
  id: string,
  updates: Pick<Counterparty, 'providedName' | 'contactInfo'>
): Counterparty | undefined {
  const updated = updateConnectionDetails(id, updates);
  return updated ? toCounterpartyView(updated) : undefined;
}

export function resetCounterpartyStore(): void {
  resetAppStateRepository();
}
