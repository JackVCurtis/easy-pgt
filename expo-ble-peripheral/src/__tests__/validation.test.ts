import { parseHandshakeEnvelope } from '../handshakeEnvelope';
import { validateStartPeripheralOptions } from '../validation';

describe('validateStartPeripheralOptions', () => {
  it('accepts valid options', () => {
    expect(() =>
      validateStartPeripheralOptions({
        serviceUuid: '8e90ea8d-9a6f-4a4e-9e1f-79966f1ec9c3',
        inboundCharacteristicUuid: '852f1987-e4f4-40e8-8685-f5c4f6bd86f8',
        outboundCharacteristicUuid: 'f7549c0f-c454-4cc8-84d7-4bb86189ad08',
        advertiseMode: 'balanced',
        txPowerLevel: 'medium',
      })
    ).not.toThrow();
  });

  it('rejects invalid uuid', () => {
    expect(() =>
      validateStartPeripheralOptions({
        serviceUuid: 'bad-uuid',
        inboundCharacteristicUuid: '852f1987-e4f4-40e8-8685-f5c4f6bd86f8',
        outboundCharacteristicUuid: 'f7549c0f-c454-4cc8-84d7-4bb86189ad08',
      })
    ).toThrow('ERR_INVALID_OPTIONS');
  });
});

describe('parseHandshakeEnvelope', () => {
  it('parses a valid base64 envelope', () => {
    const encoded = Buffer.from(
      JSON.stringify({
        version: 1,
        messageType: 'client-init',
        sessionId: '8e90ea8d-9a6f-4a4e-9e1f-79966f1ec9c3',
        payload: Buffer.from('hello').toString('base64'),
      }),
      'utf8'
    ).toString('base64');

    expect(parseHandshakeEnvelope(encoded).messageType).toBe('client-init');
  });

  it('rejects malformed payload', () => {
    const encoded = Buffer.from(
      JSON.stringify({
        version: 1,
        messageType: 'client-init',
        sessionId: '8e90ea8d-9a6f-4a4e-9e1f-79966f1ec9c3',
        payload: '%%%%',
      }),
      'utf8'
    ).toString('base64');

    expect(() => parseHandshakeEnvelope(encoded)).toThrow('ERR_MALFORMED_HANDSHAKE');
  });
});
