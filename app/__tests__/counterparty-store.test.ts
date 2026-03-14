import {
  addHandshakeCounterparty,
  getDirectCounterparties,
  resetCounterpartyStore,
  updateCounterparty,
} from '@/app/handshake/counterparty-store';

describe('counterparty store', () => {
  beforeEach(() => {
    resetCounterpartyStore();
  });

  it('only returns direct counterparties for user-facing lists', () => {
    const counterparties = getDirectCounterparties();

    expect(counterparties.every((counterparty) => counterparty.trustDepth === 1)).toBe(true);
  });

  it('creates handshake entries with a generated counterparty name rather than the shared local name', () => {
    const created = addHandshakeCounterparty({
      localSharedName: 'Taylor Morgan',
      contactInfo: 'taylor@example.com',
    });

    expect(created.providedName).toBe('Avery Shaw');
    expect(created.localSharedName).toBe('Taylor Morgan');
  });

  it('allows editing the saved name and optional contact info', () => {
    const created = addHandshakeCounterparty({
      localSharedName: 'Taylor Morgan',
      contactInfo: undefined,
    });

    const updated = updateCounterparty(created.id, {
      providedName: 'Robin Fox',
      contactInfo: 'Signal: @robinfox',
    });

    expect(updated?.providedName).toBe('Robin Fox');
    expect(updated?.contactInfo).toBe('Signal: @robinfox');
  });
});
