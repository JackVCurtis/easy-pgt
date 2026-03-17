import vectors from '@/app/protocol/crypto/__fixtures__/crypto-vectors.v1.json';
import {
  deriveSharedSecret,
  generateEphemeralKeypair,
  generateIdentityKeypair,
  verifySignature,
} from '@/app/protocol/crypto/crypto';
import { hexToBytes, sha256Hex } from '@/app/protocol/crypto/hash';
import { decodeBase64 } from '@/app/utils/bytes';

function decodeFixtureBase64(input: string): Uint8Array {
  const decoded = decodeBase64(input);
  if (!decoded) {
    throw new Error(`Invalid base64 fixture: ${input}`);
  }
  return decoded;
}

describe('fixture-driven crypto vectors', () => {
  it('derives deterministic Ed25519 keypair from seed fixture', () => {
    const keypair = generateIdentityKeypair({
      seed: decodeFixtureBase64(vectors.ed25519.seedBase64),
    });

    expect(keypair.publicKey).toBe(vectors.ed25519.publicKeyBase64);
    expect(keypair.secretKey).toBe(vectors.ed25519.secretKeyBase64);
  });

  it.each(vectors.detachedSignatures)(
    'validates detached signature fixture: $name',
    ({ payloadBase64, publicKeyBase64, signatureBase64 }) => {
      expect(verifySignature(decodeFixtureBase64(payloadBase64), signatureBase64, publicKeyBase64)).toBe(true);
    }
  );

  it('derives shared secret matching X25519 fixture in both directions', () => {
    const participantA = generateEphemeralKeypair({
      secretKey: decodeFixtureBase64(vectors.x25519.participantA.secretKeyBase64),
    });
    const participantB = generateEphemeralKeypair({
      secretKey: decodeFixtureBase64(vectors.x25519.participantB.secretKeyBase64),
    });

    expect(participantA.publicKey).toBe(vectors.x25519.participantA.publicKeyBase64);
    expect(participantB.publicKey).toBe(vectors.x25519.participantB.publicKeyBase64);

    const sharedAB = deriveSharedSecret(participantA.secretKey, participantB.publicKey);
    const sharedBA = deriveSharedSecret(participantB.secretKey, participantA.publicKey);

    expect(sharedAB.sharedSecret).toBe(vectors.x25519.sharedSecretBase64);
    expect(sharedBA.sharedSecret).toBe(vectors.x25519.sharedSecretBase64);
  });

  it.each(vectors.sha256DomainSeparated)(
    'derives SHA-256 domain-separated hash fixture: $name',
    ({ domain, expectedHex, payloadBase64, payloadHex }) => {
      const payloadBytes = payloadBase64 ? decodeFixtureBase64(payloadBase64) : hexToBytes(payloadHex);
      expect(sha256Hex([domain, payloadBytes])).toBe(expectedHex);
    }
  );

  it.each(vectors.failClosed.identitySeedWrongLength)(
    'fails closed for invalid identity seed length: $name',
    ({ seedBase64, errorSubstring }) => {
      expect(() => generateIdentityKeypair({ seed: decodeFixtureBase64(seedBase64) })).toThrow(errorSubstring);
    }
  );

  it.each(vectors.failClosed.verifySignature)(
    'fails closed for invalid signature verification inputs: $name',
    ({ payloadBase64, signatureBase64, publicKeyBase64, expected }) => {
      expect(verifySignature(decodeFixtureBase64(payloadBase64), signatureBase64, publicKeyBase64)).toBe(expected);
    }
  );

  it.each(vectors.failClosed.sharedSecretDerivationThrows)(
    'fails closed for invalid shared-secret derivation inputs: $name',
    ({ localSecretKeyBase64, peerPublicKeyBase64, errorSubstring }) => {
      expect(() => deriveSharedSecret(localSecretKeyBase64, peerPublicKeyBase64)).toThrow(errorSubstring);
    }
  );

  it.each(vectors.failClosed.hexDecodeThrows)(
    'fails closed for malformed hash payload encodings: $name',
    ({ hex, errorSubstring }) => {
      expect(() => hexToBytes(hex)).toThrow(errorSubstring);
    }
  );
});
