import * as SecureStore from 'expo-secure-store';
import {
  createExpoSecureStoreAdapter,
  createInMemorySecureStoreAdapter,
  createSecureKeyStorage,
} from '@/app/protocol/crypto/keyStorage';
import { generateIdentityKeypair } from '@/app/protocol/crypto/crypto';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('secure key storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('round-trips identity keypairs with versioned payload shape', async () => {
    const storage = createSecureKeyStorage(createInMemorySecureStoreAdapter());
    const keypair = generateIdentityKeypair({ seed: Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1)) });

    await storage.saveIdentityKeypair({
      version: 1,
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
    });

    await expect(storage.loadIdentityKeypair()).resolves.toEqual({
      version: 1,
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
    });
  });

  it('rejects malformed stored key material and deletes keypairs', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const storage = createSecureKeyStorage(adapter);

    await adapter.setItem('pgt.identity.keypair.v1', JSON.stringify({ version: 1, publicKey: 'bad', secretKey: 'bad' }));

    await expect(storage.loadIdentityKeypair()).rejects.toThrow('KEY_STORAGE_CORRUPTED_IDENTITY_KEYPAIR: Stored identity keypair is corrupted');

    const keypair = generateIdentityKeypair({ seed: Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1)) });
    await storage.saveIdentityKeypair({ version: 1, publicKey: keypair.publicKey, secretKey: keypair.secretKey });
    await storage.deleteIdentityKeypair();

    await expect(storage.loadIdentityKeypair()).resolves.toBeNull();
  });

  it('returns contract error codes when persisted payload is malformed', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const storage = createSecureKeyStorage(adapter);

    await adapter.setItem('pgt.identity.keypair.v1', 'not-json');
    await expect(storage.loadIdentityKeypair()).rejects.toThrow(
      'KEY_STORAGE_CORRUPTED_IDENTITY_KEYPAIR: Stored identity keypair is corrupted'
    );

    await adapter.setItem('pgt.identity.keypair.v1', JSON.stringify({ version: 1, publicKey: 'bad', secretKey: 'bad' }));
    await expect(storage.loadIdentityKeypair()).rejects.toThrow(
      'KEY_STORAGE_CORRUPTED_IDENTITY_KEYPAIR: Stored identity keypair is corrupted'
    );
  });

  it('uses authenticated secure-store options for identity keypair reads and writes', async () => {
    const getItemAsync = jest.mocked(SecureStore.getItemAsync);
    const setItemAsync = jest.mocked(SecureStore.setItemAsync);

    getItemAsync.mockResolvedValueOnce(null);
    setItemAsync.mockResolvedValueOnce(undefined);

    const adapter = createExpoSecureStoreAdapter();
    await adapter.getItem('pgt.identity.keypair.v1');
    await adapter.setItem('pgt.identity.keypair.v1', 'payload');

    expect(getItemAsync).toHaveBeenCalledWith('pgt.identity.keypair.v1', {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock your device to access your Comrades identity keys.',
    });
    expect(setItemAsync).toHaveBeenCalledWith('pgt.identity.keypair.v1', 'payload', {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock your device to access your Comrades identity keys.',
    });
  });

});
