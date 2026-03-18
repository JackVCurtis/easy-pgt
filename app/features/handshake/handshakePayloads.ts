export type MockContactPayload = {
  displayName: string;
  handle: string;
  phone: string;
  email: string;
};

export type HandshakeLocalRole = 'offerer' | 'accepter';

export type ExchangedPayloadResult = {
  localSharedPayload: MockContactPayload;
  remoteReceivedPayload: MockContactPayload;
};

export const OFFERER_MOCK_CONTACT_PAYLOAD: MockContactPayload = {
  displayName: 'Alex Offer',
  handle: '@alex.offer',
  phone: '+1-415-555-0101',
  email: 'alex.offer@example.com',
};

export const ACCEPTER_MOCK_CONTACT_PAYLOAD: MockContactPayload = {
  displayName: 'Blair Accept',
  handle: '@blair.accept',
  phone: '+1-415-555-0199',
  email: 'blair.accept@example.com',
};

export function buildExchangedPayloadForRole(role: HandshakeLocalRole): ExchangedPayloadResult {
  if (role === 'offerer') {
    return {
      localSharedPayload: OFFERER_MOCK_CONTACT_PAYLOAD,
      remoteReceivedPayload: ACCEPTER_MOCK_CONTACT_PAYLOAD,
    };
  }

  return {
    localSharedPayload: ACCEPTER_MOCK_CONTACT_PAYLOAD,
    remoteReceivedPayload: OFFERER_MOCK_CONTACT_PAYLOAD,
  };
}
