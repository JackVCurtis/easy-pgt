import {
  addHandshakeConnection,
  getConnectionById,
  getDirectConnections,
  resetAppStateRepository,
  toCounterpartyView,
  updateConnectionDetails,
  readAppStateSnapshot,
} from '@/app/state/appState';

describe('app state repository connection workflows', () => {
  beforeEach(() => {
    resetAppStateRepository();
  });

  it('only returns direct counterparties for user-facing lists', () => {
    const counterparties = getDirectConnections().map(toCounterpartyView);

    expect(counterparties.every((counterparty) => counterparty.trustDepth === 1)).toBe(true);
  });

  it('creates handshake entries with a generated counterparty name rather than the shared local name', () => {
    const created = addHandshakeConnection({
      localSharedName: 'Taylor Morgan',
      contactInfo: 'taylor@example.com',
    });

    expect(created.counterpartAlias).toBe('Avery Shaw');
    expect(created.localAlias).toBe('Taylor Morgan');
    expect(typeof created.id).toBe('string');
    expect(typeof created.createdAtMs).toBe('number');
  });

  it('uses provided counterpart name when handshake summary includes it', () => {
    const created = addHandshakeConnection({
      localSharedName: 'Taylor Morgan',
      providedName: 'Blair Accept',
      contactInfo: 'blair.accept@example.com',
    });

    expect(created.counterpartAlias).toBe('Blair Accept');
    expect(created.contactInfo).toBe('blair.accept@example.com');
  });

  it('allows editing the saved name and optional contact info', () => {
    const created = addHandshakeConnection({
      localSharedName: 'Taylor Morgan',
    });

    const updated = updateConnectionDetails(created.id, {
      providedName: 'Robin Fox',
      contactInfo: 'Signal: @robinfox',
    });

    expect(updated?.counterpartAlias).toBe('Robin Fox');
    expect(updated?.contactInfo).toBe('Signal: @robinfox');

    const byId = getConnectionById(created.id);
    expect(byId?.counterpartAlias).toBe('Robin Fox');
  });

  it('stores state as a serialized JSON-safe snapshot', () => {
    addHandshakeConnection({
      localSharedName: 'Sam Rivers',
    });

    const snapshot = readAppStateSnapshot();
    const parsed = JSON.parse(JSON.stringify(snapshot));

    expect(parsed).toEqual(snapshot);
  });
});
