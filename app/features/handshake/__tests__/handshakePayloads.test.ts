import {
  ACCEPTER_MOCK_CONTACT_PAYLOAD,
  OFFERER_MOCK_CONTACT_PAYLOAD,
  buildExchangedPayloadForRole,
} from '@/app/features/handshake/handshakePayloads';

describe('handshakePayloads', () => {
  it('builds exchanged payload with offerer as local for initiator role', () => {
    const exchanged = buildExchangedPayloadForRole('offerer');

    expect(exchanged).toEqual({
      localSharedPayload: OFFERER_MOCK_CONTACT_PAYLOAD,
      remoteReceivedPayload: ACCEPTER_MOCK_CONTACT_PAYLOAD,
    });
  });

  it('builds exchanged payload with accepter as local for scanner role', () => {
    const exchanged = buildExchangedPayloadForRole('accepter');

    expect(exchanged).toEqual({
      localSharedPayload: ACCEPTER_MOCK_CONTACT_PAYLOAD,
      remoteReceivedPayload: OFFERER_MOCK_CONTACT_PAYLOAD,
    });
  });
});
