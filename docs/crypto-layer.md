# Crypto Layer (`app/protocol/crypto/crypto.ts`)

This module provides the stable protocol crypto API used by validation and record signing.

## Exported API

```ts
generateIdentityKeypair()
signRecord()
verifySignature()
generateEphemeralKeypair()
deriveSharedSecret()
```

## Encodings

- **Identity public keys**: base64-encoded 32-byte Ed25519 public key.
- **Identity secret keys**: base64-encoded 64-byte Ed25519 secret key.
- **Ephemeral public keys**: base64-encoded 32-byte Curve25519 public key.
- **Ephemeral secret keys**: base64-encoded 32-byte Curve25519 secret key.
- **Signatures**: base64-encoded 64-byte Ed25519 detached signatures.
- **Shared secrets**: base64-encoded 32-byte Curve25519 scalar-mult result.

The decoder utilities fail closed on malformed base64 and wrong lengths. DID key formatted Ed25519 public keys (`did:key:z...`) are also accepted where public key decode is used.

## Signing Input

`signRecord()` and `verifySignature()` sign/verify canonical bytes from the existing canonical serialization implementation:

- field ordering and scalar encodings come from `docs/canonical-serialization.md`
- signing bytes are produced by `deriveSigningPayloadBytes`

Signature fields are deterministically elided before serialization:

- `identity_binding.self_signature`
- `endorsement.signature`
- `revocation.signature`
- `handshake.signatures`
- `key_rotation.signatures`

This keeps signing and verification independent of object insertion order and raw JSON stringification.

## Shared Secret Derivation

`deriveSharedSecret(localSecretKey, peerPublicKey)` uses TweetNaCl scalar multiplication over Curve25519 keys and returns deterministic bytes/encoding.

## Secure Identity Key Storage

`app/protocol/crypto/keyStorage.ts` provides `SecureKeyStorage` and an Expo SecureStore-backed adapter.

Stored value format (versioned):

```json
{
  "version": 1,
  "publicKey": "...base64...",
  "secretKey": "...base64..."
}
```

Load and save both validate shape and key lengths. Corruption or mismatch between stored public key and secret key-derived public key is rejected.
