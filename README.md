# Pretty Good Trust (PGT)

Pretty Good Trust (PGT) is a mobile system for exchanging and verifying identity claims using a **proximity-bootstrapped, Merkle-synchronized trust log**.

PGT allows users to establish identity relationships in person and share those relationships across a decentralized network of devices.

The system records identity claims, endorsements, and encounters as **signed records** stored in an **append-only Merkle log**. Devices synchronize these logs directly with nearby peers.

The design emphasizes:

* local trust decisions instead of global authorities
* transparent conflict handling instead of silent overwrites
* verifiable append-only history
* efficient peer-to-peer synchronization

PGT should be thought of as:

> a proximity-bootstrapped, BLE-synchronized, append-only trust log with local identity resolution.

---

# Cryptographic Model

PGT uses **modern, deterministic cryptographic primitives implemented in JavaScript** using **TweetNaCl**.

Cryptographic operations rely on:

| Primitive                | Algorithm   | Library          |
| ------------------------ | ----------- | ---------------- |
| Identity signatures      | Ed25519     | TweetNaCl        |
| Ephemeral key exchange   | X25519      | TweetNaCl        |
| Hashing                  | SHA-256     | Expo Crypto      |
| Merkle tree hashing      | SHA-256     | Expo Crypto      |
| Secure local key storage | OS keystore | Expo SecureStore |

This design keeps the cryptographic layer **portable and deterministic across platforms**, allowing the core protocol logic to run entirely in TypeScript.

No native crypto bridge is required.

---

# Core Concepts

## Identity bindings

Each installation generates a **long-term Ed25519 identity keypair**.

A **self-signed identity binding** associates:

```
UUID → public identity key
```

UUIDs are opaque identifiers. They are not trusted by themselves and must always be interpreted through signed bindings.

The binding record includes:

* UUID
* public key
* timestamp
* signature by the identity key

---

## Handshakes

A **handshake** is a mutually signed record proving that two identities completed an in-person interaction.

Handshakes record:

* the identity bindings of both participants
* ephemeral session public keys
* each participant’s Merkle log state

Handshakes do not prove real-world identity truth. They only prove that two identities interacted.

---

## Endorsements

An **endorsement** is a signed statement that one identity marks a specific identity binding as `binding_valid` or `binding_invalid`. Endorsement records store only this signed binary direction in v1; weighting is local policy on each device.

Devices combine endorsements using **local trust policy** to determine whether a binding is:

* `CLAIMED`
* `TENTATIVE`
* `VERIFIED`
* `CONFLICTED`
* `REVOKED`

Trust decisions are always local.

---

## Merkle trust log

All durable records are stored in a deterministic **Merkle log**.

Record types include:

* identity bindings
* handshakes
* endorsements
* key rotations
* revocations

The Merkle structure provides:

* tamper detection
* append-only history
* efficient synchronization between peers

---

# Transport Model

PGT uses two local communication technologies.

---

## QR

QR is the bootstrap transport in this implementation slice and is used to prove in-person payload exchange before BLE session setup.

The bootstrap exchanges:

* identity binding hashes
* ephemeral session public keys
* a session identifier
* BLE connection hints

---

## Bluetooth Low Energy (BLE)

BLE carries the actual synchronization traffic.

During a BLE session, peers:

1. establish an authenticated encrypted channel
2. compare Merkle roots
3. reconcile differing subtrees
4. exchange missing records

---

# Repository Structure

```
README.md

docs/
  protocol_records.md
  canonical-serialization.md
  hash-domains.md
  schema-versioning.md
  qr-bootstrap.md
  manual-qr-ble-session-test.md
  crypto-layer.md
```

Recommended reading order:

1. Architecture guide
2. Protocol specification
3. Sync state machine

---

# Design Principles

PGT follows several architectural rules:

* UUID is an identifier, not an identity proof.
* Identity bindings must be self-signed.
* Conflicts must be represented, not overwritten.
* Trust decisions are local policy decisions.
* All durable evidence lives in a Merkle log.
* Transport mechanisms never define identity truth.

---

# Development Status

Current implementation focus:

* Refine UI so theoretical user experience can be demoed for viability
* Machine-readable specification for protocol data structures and transactions

Android is the initial target platform.

iOS support remains planned; this slice uses camera-based QR bootstrap and BLE session sync.

---

# Cryptographic Implementation

PGT uses a **pure JavaScript crypto stack** compatible with Expo.

| Component                   | Library          |
| --------------------------- | ---------------- |
| Key generation              | TweetNaCl        |
| Signing / verification      | TweetNaCl        |
| Diffie-Hellman session keys | TweetNaCl        |
| Hashing                     | Expo Crypto      |
| Secure key storage          | Expo SecureStore |

### Protocol crypto wrapper

```ts
import {
  generateIdentityKeypair,
  signRecord,
  verifySignature,
  generateEphemeralKeypair,
  deriveSharedSecret,
} from '@/app/protocol/crypto/crypto';
```

The wrapper signs canonical durable-record payload bytes (not JSON text), validates key/signature encodings fail-closed, and uses SecureStore-backed persistence for long-term identity keys.

See `docs/crypto-layer.md` for API details and signing/elision rules.

---

# Task Breakdown

## Current UI Status (already completed)

* [x] Initialize Expo TypeScript app with shared design system, linting, and test setup.
* [x] Build tab/stack navigation for Handshake, Sign Message, and View Message Distance.
* [x] Implement reusable UI primitives and dark/light theming.
* [x] Build screen-level mock-data views for trust relationships, signed messages, and profile identity.

---

# Remaining Engineering Checklist (architecture-aligned)

## 1) Canonical record formats (highest priority)

* [x] Define versioned canonical schemas for all durable record types:

  * `identity_binding`
  * `endorsement`
  * `handshake`
  * `key_rotation`
  * `revocation`

* [x] Specify deterministic serialization rules for `canonical_bytes`
  (field order, encoding, optional fields, timestamp/nonce formats).

* [x] Add domain-separated hashing helpers:

```
record_hash = SHA256("record_hash_v1" || canonical_record_bytes)

leaf_hash = SHA256("merkle_leaf_v1" || record_hash)
```

* [x] Add schema/version migration strategy to reject unknown or malformed record versions safely.

---

## 2) Validation engine

* [x] Implement structural validation per record type
* [x] Implement cryptographic validation

Required checks:

* identity self-signatures
* handshake participant signatures
* endorsement signatures
* rotation/revocation signer checks

- [x] Implement semantic validation rules

* duplicate record detection
* conflicting payload detection
* key rotation monotonicity checks

- [x] Add auditable validation results:

```
accepted
rejected
conflicted
```

---

## 3) Trust resolution engine

* [x] Implement local trust state derivation

```
CLAIMED
TENTATIVE
VERIFIED
CONFLICTED
REVOKED
```

* [x] Implement local-policy endorsement weighting (not persisted in durable records)
* [x] Apply rotation/revocation effects without deleting history
* [x] Surface conflict sets explicitly
* [x] Provide deterministic explainable trust decisions

---

## 4) Deterministic Merkle log

* [x] Implement append-only record storage
* [x] Deterministic leaf ordering (`sort by leaf_hash`)
* [x] Reproducible Merkle root generation
* [x] Merkle proof generation and verification APIs
* [x] Subtree diff and missing-leaf discovery

Add conformance tests for:

* determinism
* tamper detection
* replay handling
* cross-device hash parity

---

## 5) Proximity bootstrap and BLE synchronization


### Native runtime requirements (QR camera/BLE)

- `expo-camera` and `react-native-ble-plx` are native modules configured through Expo config plugins in `app.json`.
- Use an Expo development build (Dev Client) or EAS/local native build after `expo prebuild`; **Expo Go is not sufficient** for full QR/BLE testing.
- After changing plugin or permission configuration, regenerate native projects (`npx expo prebuild`) and rebuild the app binary.
- BLE scan + advertise flow requires Bluetooth + location permissions on Android (including Android 12+ runtime Bluetooth permissions).

---
This stage implements the proximity session bootstrap and Merkle log synchronization using the following libraries:

- **QR scan/generation:** `expo-camera` + `react-native-qrcode-svg`
- **BLE:** `react-native-ble-plx`

QR is the bootstrap transport in this implementation slice.  
BLE carries the encrypted synchronization traffic and all synchronization messages.

---

### Bootstrap payload definition

* [x] Define and version the `QrBootstrap` payload used to initiate a synchronization session:

```
QrBootstrap {
  session_uuid
  identity_binding_hash
  ephemeral_public_key
  bluetooth_service_uuid
  nonce
  signature
}
```


The payload must be serialized deterministically and validated before use.

---

### QR bootstrap implementation (`expo-camera` + `react-native-qrcode-svg`)

* [x] Implement minimal QR bootstrap generate/scan scaffolding for manual testing using `expo-camera` and `react-native-qrcode-svg`.

Bootstrap exchange must transmit:

- `identity_binding_hash`
- `ephemeral_public_key`
- `session_uuid`
- `bluetooth_service_uuid`
- `nonce`
- `signature`

Responsibilities:

* render bootstrap payload as QR on writer device
* scan bootstrap payload with camera on reader device
* parse bootstrap payload
* verify payload signature
* bind bootstrap payload to a pending BLE session

---

### Bootstrap payload validation and hardening

* [x] Implement strict bootstrap payload validation.

Validation must include:

* explicit payload version requirement
* field presence and format validation
* UUID validation for `session_uuid`
* public key format validation
* nonce length validation
* signature verification

Reject payloads when:

* fields are missing
* version unsupported
* signature invalid
* payload exceeds size limits
* parser errors occur

Bootstrap parsing must **fail closed**.

---

### BLE discovery and connection (`react-native-ble-plx`)

* [x] Implement minimal BLE discovery/connection binding checks for manual testing with `react-native-ble-plx` integration points.

Responsibilities:

* advertise BLE service using `bluetooth_service_uuid`
* scan for the service UUID received from QR bootstrap
* connect to discovered peer device
* verify the connection matches the active bootstrap session

BLE sessions must be rejected when:

* service UUID does not match bootstrap
* session UUID mismatch occurs

---

### Authenticated encrypted session establishment

* [x] Implement minimal authenticated session confirmation using QR-exchanged ephemeral keys and `session_uuid` binding.

Steps:

1. derive shared secret using exchanged ephemeral keys
2. bind derived key to `session_uuid`
3. establish encryption context for all sync messages
4. authenticate peer identity binding hash

No synchronization data may flow before channel authentication completes.

---

### BLE synchronization state machine

* [ ] Implement the synchronization state machine.

Phases:

1. **root comparison**
2. **subtree reconciliation**
3. **record transfer**
4. **validation**
5. **commit**

State transitions must be deterministic.

---

### Root comparison

* [ ] Exchange Merkle roots between peers  
* [ ] Detect divergence between logs  
* [ ] Transition to subtree reconciliation when roots differ

---

### Subtree reconciliation

* [ ] Request subtree hashes  
* [ ] Identify missing leaves  
* [ ] Determine record transfer set  

Subtree comparisons must be deterministic across devices.

---

### Record transfer

* [ ] Transfer missing records in bounded batches  
* [ ] Support flow control and retransmission  
* [ ] Deduplicate records using record hash index

---

### Record validation boundary

* [ ] Validate every received record before commit.

Validation must execute:

1. structural validation  
2. cryptographic validation  
3. semantic validation  

Only records with:

```
status = accepted
```

may proceed to commit.

---

### Commit phase

* [ ] Append accepted records to the local Merkle log  
* [ ] Reject invalid records without committing them  
* [ ] Maintain append-only log semantics

Invalid or rejected records must never modify local state.

---

### Resumable synchronization

* [ ] Implement resumable sync checkpoints.

Persist:

```
session_uuid
peer_binding_hash
current_phase
transfer_cursor
last_acknowledged_record
```


Allow interrupted sessions to resume without:

* duplicate record commits
* inconsistent Merkle states

---

### Conformance and failure testing

* [ ] Add tests covering:

Bootstrap:

* valid bootstrap exchange
* malformed payload rejection
* invalid signature rejection
* unsupported version rejection

BLE session:

* encrypted channel establishment
* root comparison correctness
* subtree reconciliation correctness
* record transfer batching

Failure cases:

* interrupted sync
* checkpoint resume
* invalid record rejection
* replay protection

## 7) Cryptographic layer

### Completed in current codebase

* [x] Protocol crypto wrapper implemented in `app/protocol/crypto/crypto.ts` using TweetNaCl.
* [x] Stable API exported from `app/protocol/crypto/crypto.ts`:

```
generateIdentityKeypair(options?: { seed?: Uint8Array })
generateEphemeralKeypair(options?: { secretKey?: Uint8Array })
signRecord(record, signerSecretKey)
verifySignature(recordOrBytes, signature, signerPublicKey)
deriveSharedSecret(localSecretKey, peerPublicKey)
decodeSignatureStrict(signature)
```

* [x] Secure key storage abstraction implemented in `app/protocol/crypto/keyStorage.ts`:

```
createSecureKeyStorage(adapter?, storageKey?)
createExpoSecureStoreAdapter()
createInMemorySecureStoreAdapter(initialData?)
```

* [x] Cryptographic validation path implemented (`app/protocol/validation/validateRecordCryptography.ts`) and wired to canonical signing payload bytes from `app/protocol/validation/crypto/signingPayload.ts`.

### Remaining for production readiness

* [ ] Freeze and document API contract at package boundary:
  * single supported import/export path (re-export index) for crypto + key storage,
  * semver policy for function signatures/return shapes,
  * explicit error taxonomy for decode/length/verification failures.
* [ ] Enforce fail-closed encoding/length behavior end-to-end:
  * any invalid base64, unexpected key length, or unexpected signature length MUST produce a hard failure (`false`/typed error),
  * no coercion, truncation, auto-padding, or fallback decode paths,
  * malformed stored key material MUST never be returned as usable key state.
* [ ] Lock canonical signing payload requirements:
  * all record signatures MUST be over canonical serialized payload bytes only,
  * signature-bearing fields (`signature`, `self_signature`, `signatures`) MUST be excluded from preimage,
  * cross-platform implementations MUST reproduce byte-identical preimages for the same record.
* [ ] Add required test classes for release gates:
  * deterministic vectors: fixed seeds/secret keys => exact expected public keys/signatures/shared secrets,
  * malformed input tests: corrupt base64, wrong lengths, unknown fields/types, tampered payloads,
  * interop vectors: fixtures verified across at least one non-JS implementation and CI-checked for parity.
* [ ] Define key lifecycle requirements and verify behavior:
  * create/load/delete identity keypair semantics must be idempotent and atomic,
  * rotation must specify old/new key proof rules and state transition order,
  * delete/rotate flows must guarantee no stale key reuse after completion,
  * recovery/migration behavior must be explicit for storage corruption and schema upgrades.

---

## 8) UI completion for realistic demos

* [ ] Add validation/loading/error states
* [ ] Add conflict visualization
* [ ] Add trust explainability views
* [ ] Add sync session diagnostics

---
