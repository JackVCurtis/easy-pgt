# NFC Bootstrap Payload (v1)

This document defines the minimal NFC bootstrap payload used for proximity-bootstrapped BLE session testing.

## Purpose

`NfcBootstrapV1` is a signed transport payload exchanged over NFC to bind a later BLE session to physical proximity.

## Payload fields

```ts
interface NfcBootstrapV1 {
  version: 1;
  session_uuid: string;
  identity_binding_hash: string;
  ephemeral_public_key: string;
  bluetooth_service_uuid: string;
  nonce: string;
  signature: string;
}
```

## Signing scope

The signature covers canonical bytes for all fields except `signature`:

```ts
type SignableNfcBootstrapV1 = Omit<NfcBootstrapV1, 'signature'>;
```

## Canonical serialization

Canonical serialization uses the repository canonical serializer (`canonicalSerialize`) with deterministic lexicographic field ordering and length-prefixed field/value encoding. `JSON.stringify()` is not used for signature input.

## Validation rules

Validation is fail-closed and enforces:

- object payload shape
- `version === 1`
- presence of all required fields
- UUID format for `session_uuid`
- hash format for `identity_binding_hash`
- public key format for `ephemeral_public_key`
- UUID format for `bluetooth_service_uuid`
- 16-byte nonce encoded as 32-char hex string
- signature format and detached-signature verification
- payload size limit (`VALIDATION_LIMITS.max_record_size`)

## Fail-closed behavior

Any parse/validation error rejects the payload. Parser exceptions return `validation_failure` and never produce partial acceptance.

## BLE session binding

On successful bootstrap validation, BLE discovery and session confirmation are bound to:

- expected `bluetooth_service_uuid`
- expected `session_uuid`
- expected peer `identity_binding_hash`

If any binding check fails, the session is rejected.
