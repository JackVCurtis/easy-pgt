import {
  deleteIdentityKeypair,
  getOrCreateIdentityKeypair,
  loadIdentityKeypair,
  rotateIdentityKeypair,
} from '@/app/protocol/crypto/identityKeyManager';
import { createInMemorySecureStoreAdapter, createSecureKeyStorage } from '@/app/protocol/crypto/keyStorage';

describe('identity key manager', () => {
  it('creates an identity keypair on first run', async () => {
    const storage = createSecureKeyStorage(createInMemorySecureStoreAdapter());

    const created = await getOrCreateIdentityKeypair({ storage });

    expect(created.version).toBe(1);
    expect(typeof created.publicKey).toBe('string');
    expect(typeof created.secretKey).toBe('string');

    await expect(loadIdentityKeypair({ storage })).resolves.toEqual(created);
  });

  it('returns stable key material across reloads', async () => {
    const storage = createSecureKeyStorage(createInMemorySecureStoreAdapter());

    const first = await getOrCreateIdentityKeypair({ storage });
    const second = await getOrCreateIdentityKeypair({ storage });

    expect(second).toEqual(first);
    await expect(loadIdentityKeypair({ storage })).resolves.toEqual(first);
  });

  it('surfaces corruption errors from storage', async () => {
    const adapter = createInMemorySecureStoreAdapter();
    const storage = createSecureKeyStorage(adapter);

    await adapter.setItem('pgt.identity.keypair.v1', 'not-json');

    await expect(loadIdentityKeypair({ storage })).rejects.toThrow('Stored identity keypair is corrupted');
  });

  it('deletes identity key material', async () => {
    const storage = createSecureKeyStorage(createInMemorySecureStoreAdapter());

    await getOrCreateIdentityKeypair({ storage });
    await deleteIdentityKeypair({ storage });

    await expect(loadIdentityKeypair({ storage })).resolves.toBeNull();
  });

  it('explicitly marks rotation as unsupported', async () => {
    await expect(rotateIdentityKeypair()).rejects.toThrow('Identity key rotation is not supported');
  });
});
