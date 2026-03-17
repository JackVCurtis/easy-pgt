import type { EndorsementRecord } from '@/app/protocol/records';
import {
  deriveSharedSecret,
  generateEphemeralKeypair,
  generateIdentityKeypair,
  signRecord,
  verifySignature,
} from '@/app/protocol/crypto/crypto';

const identitySeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const ephemeralSecret = Uint8Array.from(Array.from({ length: 32 }, (_, index) => 255 - index));

const fixtureRecord: EndorsementRecord = {
  record_type: 'endorsement',
  record_version: 1,
  endorser_binding_hash: 'hash_endorser',
  subject_binding_hash: 'hash_subject',
  endorsement_type: 'binding_valid',
  signature: 'placeholder',
};

describe('protocol crypto wrapper', () => {
  it('generates deterministic identity keypair encodings from seed fixtures', () => {
    const keypair = generateIdentityKeypair({ seed: identitySeed });

    expect(keypair.publicKey).toBe('ebVWLo/mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ=');
    expect(keypair.secretKey).toBe(
      'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyB5tVYuj+ZU+UB4sRLoqYunkB+FOuaVvtfg45ELrQSWZA=='
    );
  });

  it('generates deterministic ephemeral keypair encodings from secret fixture', () => {
    const keypair = generateEphemeralKeypair({ secretKey: ephemeralSecret });

    expect(keypair.publicKey).toBe('Pry2khSTRNxU5YFgz5C+2e6h3RToHI6R3lV699ev2RU=');
    expect(keypair.secretKey).toBe('//79/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eA=');
  });

  it('signs canonical bytes deterministically regardless of object insertion order', () => {
    const keypair = generateIdentityKeypair({ seed: identitySeed });

    const signatureA = signRecord(fixtureRecord, keypair.secretKey);

    const insertionOrderVariant = {
      subject_binding_hash: fixtureRecord.subject_binding_hash,
      record_version: fixtureRecord.record_version,
      endorsement_type: fixtureRecord.endorsement_type,
      record_type: fixtureRecord.record_type,
      signature: fixtureRecord.signature,
      endorser_binding_hash: fixtureRecord.endorser_binding_hash,
    } as EndorsementRecord;

    const signatureB = signRecord(insertionOrderVariant, keypair.secretKey);

    expect(signatureA).toBe('y/ZxiT9mMprF0mccwZTOhLEfCRE3goC0ATwGWX0B9uv58PjctDUn9d7rlMwDh7VYpivZXgzPe6iI6+g8KEVlBg==');
    expect(signatureA).toBe(signatureB);
  });

  it('verifies valid signatures and fails closed for malformed or mutated inputs', () => {
    const signer = generateIdentityKeypair({ seed: identitySeed });
    const wrongSigner = generateIdentityKeypair({ seed: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 33)) });

    const signature = signRecord(fixtureRecord, signer.secretKey);

    expect(verifySignature(fixtureRecord, signature, signer.publicKey)).toBe(true);
    expect(
      verifySignature(
        {
          ...fixtureRecord,
          endorsement_type: 'binding_invalid',
        },
        signature,
        signer.publicKey
      )
    ).toBe(false);
    expect(verifySignature(fixtureRecord, signature, wrongSigner.publicKey)).toBe(false);
    expect(verifySignature(fixtureRecord, 'not-a-valid-signature', signer.publicKey)).toBe(false);
    expect(verifySignature(fixtureRecord, signature, 'not-a-valid-public-key')).toBe(false);
  });

  it('throws coded errors for malformed secret keys when signing', () => {
    expect(() => signRecord(fixtureRecord, 'not-a-valid-secret-key')).toThrow(
      'CRYPTO_INVALID_ED25519_SECRET_KEY: Invalid Ed25519 secret key encoding'
    );
  });

  it('returns false for malformed signature input during verification', () => {
    const signer = generateIdentityKeypair({ seed: identitySeed });

    expect(verifySignature(fixtureRecord, 'not-a-valid-signature', signer.publicKey)).toBe(false);
  });

  it('derives identical shared secrets for opposite peers and fixed fixtures', () => {
    const participantA = generateEphemeralKeypair({
      secretKey: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 11)),
    });
    const participantB = generateEphemeralKeypair({
      secretKey: Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 99)),
    });

    const sharedAB = deriveSharedSecret(participantA.secretKey, participantB.publicKey);
    const sharedBA = deriveSharedSecret(participantB.secretKey, participantA.publicKey);

    expect(sharedAB.sharedSecret).toBe('iuvrg/7SnOmXuj9xJCXUxF55BOVSHrHlEMAa0VDWfFI=');
    expect(sharedAB.sharedSecret).toBe(sharedBA.sharedSecret);
  });
});
