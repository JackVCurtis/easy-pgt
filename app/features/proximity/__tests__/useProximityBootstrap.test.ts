import { act, renderHook } from '@testing-library/react-native';

import { useProximityBootstrap } from '@/app/features/proximity/useProximityBootstrap';

const mockSignNfcBootstrap = jest.fn();

jest.mock('@/app/protocol/transport', () => {
  const actual = jest.requireActual('@/app/protocol/transport');

  return {
    ...actual,
    signNfcBootstrap: (...args: unknown[]) => mockSignNfcBootstrap(...args),
  };
});

jest.mock('@/app/features/proximity/proximityKeys', () => ({
  createProximityLocalKeysProvider: () => () => ({
    signer: {
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(64).fill(2),
    },
    ephemeral: {
      publicKey: new Uint8Array(32).fill(3),
      secretKey: new Uint8Array(32).fill(4),
    },
  }),
  createProximityNonceHex: () => '00112233445566778899aabbccddeeff',
}));

describe('useProximityBootstrap prepareWriterPayload error handling', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSignNfcBootstrap.mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('handles signing failures without throwing and transitions to failed state', () => {
    mockSignNfcBootstrap.mockImplementation(() => {
      throw new Error('signing exploded');
    });

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = (i * 17 + 23) & 0xff;
    }
    return bytes;
  }),
  randomUUID: jest.fn(() => '3df085f8-486f-42ac-929d-356082e4bf63'),
}));

import { act, renderHook } from '@testing-library/react-native';

import { useProximityBootstrap } from '@/app/features/proximity/useProximityBootstrap';
import { isValidUUID } from '@/app/protocol/validation/formatValidators';

describe('useProximityBootstrap', () => {
  it('does not throw during payload generation', () => {
    const { result } = renderHook(() => useProximityBootstrap());

    expect(() => {
      act(() => {
        result.current.prepareWriterPayload('identity-hash', 'ble-service-uuid');
      });
    }).not.toThrow();

    expect(result.current.state).toEqual({
      status: 'failed',
      failureReason: 'prepare_payload_failed',
    });
    expect(result.current.bootstrapPayload).toBeNull();
    expect(result.current.diagnostic).toBe(
      'PROX_BOOTSTRAP_PREPARE_FAILED: Unable to generate NFC bootstrap payload.',
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useProximityBootstrap] prepareWriterPayload failed',
      expect.any(Error),
    );
        result.current.prepareWriterPayload('hash_abc123', '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7');
      });
    }).not.toThrow();

    expect(result.current.bootstrapPayload).not.toBeNull();
    expect(isValidUUID(result.current.bootstrapPayload!.session_uuid)).toBe(true);
  });
});
