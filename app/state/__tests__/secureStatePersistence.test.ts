import nacl from 'tweetnacl';

import { createInMemorySecureStoreAdapter } from '@/app/security/secureStorage';
import { decodeBase64, encodeBase64, utf8Decode } from '@/app/utils/bytes';

import {
  APP_STATE_SECURE_PAYLOAD_STORAGE_KEY,
  hydrateSecureAppState,
  persistSecureAppState,
  type PersistedSecureAppStatePayload,
} from '../secureStatePersistence';

describe('secureStatePersistence', () => {
  it('serializes app state, encrypts it, and stores versioned payload metadata', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const keyBytes = new Uint8Array(Array.from({ length: 32 }, (_unused, index) => index + 1));
    const nonceBytes = new Uint8Array(Array.from({ length: 24 }, (_unused, index) => 255 - index));

    await persistSecureAppState({
      adapter,
      readAppState: () => ({
        connections: [{ id: 'tr-1', trustDepth: 1 }],
        featureFlags: { onboardingComplete: true },
      }),
      getEncryptionKey: async () => encodeBase64(keyBytes),
      now: () => 123456789,
      randomBytes: (length) => nonceBytes.slice(0, length),
    });

    const stored = await adapter.getItem(APP_STATE_SECURE_PAYLOAD_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!) as PersistedSecureAppStatePayload;

    expect(parsed).toMatchObject({
      payloadVersion: 1,
      stateSchemaVersion: 1,
      persistedAtMs: 123456789,
      algorithm: 'xsalsa20-poly1305',
    });

    expect(parsed.ciphertext).not.toContain('onboardingComplete');

    const ciphertextBytes = decodeBase64(parsed.ciphertext);
    const decryptedBytes = nacl.secretbox.open(ciphertextBytes!, decodeBase64(parsed.nonce)!, keyBytes);

    expect(decryptedBytes).toBeTruthy();
    expect(JSON.parse(utf8Decode(decryptedBytes!))).toEqual({
      connections: [{ id: 'tr-1', trustDepth: 1 }],
      featureFlags: { onboardingComplete: true },
    });
  });

  it('throws when onboarding app-data encryption key cannot be decoded as 32 bytes', async () => {
    const adapter = createInMemorySecureStoreAdapter();

    await expect(
      persistSecureAppState({
        adapter,
        readAppState: () => ({ ok: true }),
        getEncryptionKey: async () => 'not-valid-base64',
      })
    ).rejects.toThrow('APP_STATE_ENCRYPTION_KEY_INVALID');
  });

  it('decrypts persisted payload and hydrates state into memory', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const keyBytes = new Uint8Array(Array.from({ length: 32 }, (_unused, index) => index + 11));
    const hydrateState = jest.fn();

    await persistSecureAppState({
      adapter,
      readAppState: () => ({
        connections: [{ id: 'tr-hydrate', trustDepth: 2 }],
        messageComposer: {
          draftMessage: '',
          verificationContext: {
            status: null,
            senderDistances: [],
          },
        },
        runtimeGatekeeping: {
          hasCompletedOnboarding: true,
          hasGeneratedIdentity: true,
          hasGrantedBluetoothPermission: true,
          hasGrantedCameraPermission: true,
          isDeviceSecurityConfigured: true,
        },
      }),
      getEncryptionKey: async () => encodeBase64(keyBytes),
      randomBytes: (length) => nacl.randomBytes(length),
    });

    await hydrateSecureAppState({
      adapter,
      getEncryptionKey: async () => encodeBase64(keyBytes),
      hydrateState,
    });

    expect(hydrateState).toHaveBeenCalledWith({
      connections: [{ id: 'tr-hydrate', trustDepth: 2 }],
      messageComposer: {
        draftMessage: '',
        verificationContext: {
          status: null,
          senderDistances: [],
        },
      },
      runtimeGatekeeping: {
        hasCompletedOnboarding: true,
        hasGeneratedIdentity: true,
        hasGrantedBluetoothPermission: true,
        hasGrantedCameraPermission: true,
        isDeviceSecurityConfigured: true,
      },
    });
  });

  it('hydrates with caller-provided encryption key without re-reading secure storage key material', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const keyBytes = new Uint8Array(Array.from({ length: 32 }, (_unused, index) => index + 31));
    const hydrateState = jest.fn();
    const getEncryptionKey = jest.fn(async () => {
      throw new Error('should not be called');
    });

    await persistSecureAppState({
      adapter,
      readAppState: () => ({
        connections: [],
        messageComposer: {
          draftMessage: 'cached-key-test',
          verificationContext: {
            status: null,
            senderDistances: [],
          },
        },
        runtimeGatekeeping: {
          hasCompletedOnboarding: true,
          hasGeneratedIdentity: true,
          hasGrantedBluetoothPermission: true,
          hasGrantedCameraPermission: true,
          isDeviceSecurityConfigured: true,
        },
      }),
      getEncryptionKey: async () => encodeBase64(keyBytes),
      randomBytes: (length) => nacl.randomBytes(length),
    });

    await hydrateSecureAppState({
      adapter,
      encryptionKey: encodeBase64(keyBytes),
      getEncryptionKey,
      hydrateState,
    });

    expect(getEncryptionKey).not.toHaveBeenCalled();
    expect(hydrateState).toHaveBeenCalled();
  });
});
