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


## Error Contract (Function-by-Function)

| Module | Function | Malformed Input Behavior | `false` Return Behavior | Expected Error Message / Code |
| --- | --- | --- | --- | --- |
| `crypto.ts` | `generateIdentityKeypair(options)` | Throws when `options.seed` length is not 32 bytes. | Never returns `false`. | `CRYPTO_INVALID_IDENTITY_SEED_LENGTH: Identity seed must be 32 bytes` |
| `crypto.ts` | `generateEphemeralKeypair(options)` | Throws when `options.secretKey` length is not 32 bytes. | Never returns `false`. | `CRYPTO_INVALID_EPHEMERAL_SECRET_KEY_LENGTH: Ephemeral secret key must be 32 bytes` |
| `crypto.ts` | `signRecord(record, signerSecretKey)` | Throws on malformed/incorrect-length base64 secret key input. | Never returns `false`. | `CRYPTO_INVALID_ED25519_SECRET_KEY: Invalid Ed25519 secret key encoding` |
| `crypto.ts` | `verifySignature(recordOrBytes, signature, signerPublicKey)` | Does not throw for malformed signature or malformed public key encoding. | Returns `false` for malformed signature and malformed public key, and for cryptographic verification failure. | N/A (boolean failure contract) |
| `crypto.ts` | `deriveSharedSecret(localSecretKey, peerPublicKey)` | Throws on malformed local secret key or peer public key encoding. | Never returns `false`. | `CRYPTO_INVALID_CURVE25519_SECRET_KEY: Invalid Curve25519 secret key encoding`; `CRYPTO_INVALID_PUBLIC_KEY_ENCODING: Invalid public key encoding` |
| `crypto.ts` | `decodeSignatureStrict(signature)` | Throws on malformed signature encoding. | Never returns `false`. | `CRYPTO_INVALID_SIGNATURE_ENCODING: Invalid signature encoding` |
| `keyStorage.ts` | `loadIdentityKeypair()` | Throws when stored JSON is malformed or stored keypair shape/keys are corrupted. | Returns `null` only when no value exists in storage. | `KEY_STORAGE_CORRUPTED_IDENTITY_KEYPAIR: Stored identity keypair is corrupted` |
| `keyStorage.ts` | `saveIdentityKeypair(keypair)` | Throws when caller-provided keypair shape/keys are malformed or mismatched. | Never returns `false`. | `KEY_STORAGE_CORRUPTED_IDENTITY_KEYPAIR: Stored identity keypair is corrupted` |
| `keyStorage.ts` | `deleteIdentityKeypair()` | No malformed-input contract (no caller payload). | Never returns `false`. | N/A |

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

## Hashing source of truth

Protocol hashing lives in `app/protocol/crypto/hash.ts`.

- Use `computeRecordHash` and `computeLeafHash` directly for protocol code paths (synchronous/deterministic API).
- Compatibility async wrappers (`computeRecordHashAsync`, `computeLeafHashAsync`) are provided for migration only and should not be preferred in new protocol code.
- `app/crypto/hashing.ts` is deprecated and should be treated as a non-protocol compatibility layer.
