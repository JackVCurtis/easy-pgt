# Canonical Serialization Specification (`canonical_bytes`)

This document defines deterministic serialization rules for `canonical_bytes` used by PGT records before hashing, signing, signature verification, and Merkle inclusion.

The goal is to ensure that identical logical objects always produce identical byte sequences across platforms, languages, and runtimes.

## Scope and compatibility

- Applies to durable protocol records (for example `identity_binding`, `endorsement`, `handshake`, `key_rotation`, `revocation`) and other signed protocol payloads such as NFC bootstrap payloads described in the architecture guide.
- Preserves existing protocol field names and cryptographic workflows.
- Produces byte output suitable for deterministic hashing and Merkle leaf derivation.

## Canonical object encoding

An object is serialized as the concatenation of encoded fields in **lexicographic order of field names** (byte-wise UTF-8 ordering).

Each field is encoded as:

1. `field_name_length` (`uint32`, big-endian)
2. `field_name_bytes` (UTF-8)
3. `value_length` (`uint32`, big-endian)
4. `value_bytes` (encoded using type rules below)

This pattern is repeated for each serialized field:

```text
field_name_length || field_name_bytes || value_length || value_bytes
```

No separators are used between fields; length prefixes are the delimiter mechanism.

## Field ordering rules

- Fields MUST be serialized in lexicographic order of field names.
- Nested objects MUST apply the same rule recursively.
- Runtime-specific map/dictionary insertion order MUST NOT be used.

## Primitive encoding rules

`value_bytes` MUST use the following encodings:

- **Integers**: unsigned big-endian byte sequence.
  - `0` is encoded as one byte: `0x00`.
  - Values larger than `0` MUST use the minimal-length big-endian representation (no leading `0x00`).
- **Strings**: UTF-8 bytes.
- **Byte arrays**: raw bytes.
- **Booleans**: `0x00` for `false`, `0x01` for `true`.

The enclosing `value_length` prefix always carries the number of bytes in `value_bytes`.

## Optional fields

- If an optional field is absent, it is omitted entirely from the serialized output.
- If present, it is serialized exactly as any other field.
- Ordering still follows lexicographic ordering over the set of present fields.

## Timestamp format

- All timestamp fields used for canonical serialization MUST be represented as:
  - Unix time in milliseconds since epoch.
  - `uint64` big-endian in `value_bytes`.

For example, fields such as `created_at` are canonically serialized as millisecond epoch integers at serialization time.

## Nonce format

- `nonce` MUST be a 16-byte cryptographically random value.
- Canonical encoding is the raw 16 bytes (`value_length = 16`).

## Nested object rule

For object-valued fields, `value_bytes` is the canonical serialization of that nested object using the exact same rules in this document.

## Determinism rationale

These rules guarantee:

- identical byte output for identical logical objects,
- independence from language/runtime object iteration order,
- unambiguous parsing from length-prefixed fields,
- stable inputs for `SHA256(...)`, signatures, and Merkle-tree leaf construction.

## Canonical serialization vectors

### Vector 1: identity binding record

Input object (JSON-like):

```json
{
  "created_at": 1710000000123,
  "key_epoch": 1,
  "record_type": "identity_binding",
  "record_version": 1,
  "self_signature": "sig_identity_binding_self",
  "subject_identity_public_key": "did:key:z6Mki4R3K1x",
  "subject_uuid": "6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7"
}
```

Canonical bytes (hex):

```text
0000000a637265617465645f617400000006018e23f14c7b000000096b65795f65706f636800000001010000000b7265636f72645f74797065000000106964656e746974795f62696e64696e670000000e7265636f72645f76657273696f6e00000001010000000e73656c665f7369676e6174757265000000197369675f6964656e746974795f62696e64696e675f73656c660000001b7375626a6563745f6964656e746974795f7075626c69635f6b6579000000136469643a6b65793a7a364d6b693452334b31780000000c7375626a6563745f757569640000002436663161366561662d663664362d346438632d613565302d336464663262343533316137
```

Hash example:

```text
SHA256(canonical_bytes) = e5f4ef1927f3674ec458deb28a84be974f3a08a4e8829b8f1dad909af8be3cbe
```

### Vector 2: NFC bootstrap fragment (optional field omitted)

Input object (JSON-like):

```json
{
  "session_uuid": "680a3e96-1f84-4c8b-8b39-b664b1744d43",
  "identity_binding_hash": "0x11 repeated 32 bytes",
  "nonce": "00112233445566778899aabbccddeeff",
  "timestamp_ms": 1710000000456,
  "bluetooth_service_uuid": null
}
```

Serialization note: `bluetooth_service_uuid` is absent/`null`, so it is omitted from canonical bytes.

Canonical bytes (hex):

```text
000000156964656e746974795f62696e64696e675f68617368000000201111111111111111111111111111111111111111111111111111111111111111000000056e6f6e63650000001000112233445566778899aabbccddeeff0000000c73657373696f6e5f757569640000002436383061336539362d316638342d346338622d386233392d6236363462313734346434330000000c74696d657374616d705f6d7300000006018e23f14dc8
```

Hash example:

```text
SHA256(canonical_bytes) = 170bff837005cd2ea135c3523d33acb26ce176d34aec9496497e7bb37f13c885
```
