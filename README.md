# Easy PGT (Pretty Good Trust)

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

# Core Concepts

## Identity bindings

Each installation generates a long-term cryptographic identity key.

A **self-signed identity binding** associates:

```
UUID → public identity key
```

UUIDs are opaque identifiers. They are not trusted by themselves and must always be interpreted through signed bindings.

---

## Handshakes

A **handshake** is a mutually signed record proving that two identities completed an in-person interaction.

Handshakes record:

* the identity bindings of both participants
* ephemeral session keys
* each participant’s Merkle log state

Handshakes do not prove real-world identity truth. They only prove that two identities interacted.

---

## Endorsements

An **endorsement** is a signed statement that one identity believes a specific identity binding is valid.

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

### NFC

NFC is used only to bootstrap a session and prove physical proximity.

The bootstrap exchanges:

* identity binding hashes
* ephemeral session keys
* a session identifier
* BLE connection hints

---

### Bluetooth Low Energy (BLE)

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

iOS support is planned with a more limited NFC role.

---
## Task Breakdown
### Current UI Status (already completed)
- [x] Initialize Expo TypeScript app with shared design system, linting, and test setup.
- [x] Build tab/stack navigation for Handshake, Sign Message, and View Message Distance.
- [x] Implement reusable UI primitives and dark/light theming.
- [x] Build screen-level mock-data views for trust relationships, signed messages, and profile identity.

### Remaining Engineering Checklist (architecture-aligned)

#### 1) Canonical record formats (highest priority)
- [x] Define versioned canonical schemas for all durable record types:
  - `identity_binding`
  - `endorsement`
  - `handshake`
  - `key_rotation`
  - `revocation`
- [x] Specify deterministic serialization rules for `canonical_bytes` (field order, encoding, optional fields, timestamp/nonce formats). See `docs/canonical-serialization.md`.
- [ ] Add domain-separated hashing helpers:
  - `record_hash = SHA256("record_hash_v1" || canonical_record_bytes)`
  - `leaf_hash = SHA256("merkle_leaf_v1" || record_hash)`
- [ ] Add schema/version migration strategy to reject unknown or malformed record versions safely.

#### 2) Validation engine
- [ ] Implement structural validation per record type (required fields, format constraints, size limits).
- [ ] Implement cryptographic validation (self-signatures, participant signatures, endorsement signatures, rotation/revocation signer checks).
- [ ] Implement semantic validation rules:
  - duplicate record detection
  - conflicting payload detection for same logical ID
  - key-epoch/rotation-counter monotonicity checks
- [ ] Add an auditable validation result model (`accepted`, `rejected`, `conflicted`, reason codes).

#### 3) Trust resolution engine
- [ ] Implement local trust state derivation (`CLAIMED`, `TENTATIVE`, `VERIFIED`, `CONFLICTED`, `REVOKED`).
- [ ] Implement endorsement weighting and threshold policy configuration.
- [ ] Apply key rotation and revocation effects without deleting prior history.
- [ ] Surface conflict sets explicitly (same UUID → different key, same logical record ID → different payload).
- [ ] Expose deterministic, explainable trust decisions for UI/debug tooling.

#### 4) Deterministic Merkle log
- [ ] Implement append-only record storage and immutable history model.
- [ ] Build deterministic leaf ordering (`sort by leaf_hash`) and reproducible Merkle root generation.
- [ ] Implement Merkle proof generation and verification APIs.
- [ ] Implement reconciliation helpers for subtree diffing and missing-leaf discovery.
- [ ] Add conformance tests for determinism, tamper detection, replay handling, and cross-device hash parity.

#### 5) BLE synchronization protocol
- [ ] Implement session negotiation with authenticated encryption using NFC-bootstrapped ephemeral material.
- [ ] Implement sync phases:
  1. root comparison
  2. subtree reconciliation
  3. record transfer
  4. validation
  5. commit
- [ ] Ensure invalid records never commit and always produce structured rejection events.
- [ ] Implement resumable sync checkpoints for interrupted sessions.
- [ ] Add protocol tests for divergence recovery, partial transfer resume, and replay resilience.

#### 6) NFC bootstrap
- [ ] Define and version `NfcBootstrap` payload (`session_uuid`, `identity_binding_hash`, `ephemeral_public_key`, `bluetooth_service_uuid`, `nonce`, `signature`).
- [ ] Enforce strict payload size limits and parser hardening for malformed/tampered input.
- [ ] Bind bootstrap data to subsequent BLE session negotiation.
- [ ] Add UX/state handling for tap success, timeout, mismatch, and retry/recovery.

#### 7) Mobile platform bridge work

##### Android (Phase I)
- [ ] Ship Android native crypto bridge that wraps **libsignal** cryptographic primitives for key generation, signing, and verification.
- [ ] Define exactly which libsignal APIs are used and enforce secure defaults (algorithm selection, key sizes, nonce randomness, and signature encoding).
- [ ] Finalize stable TypeScript contract and strict JNI/bridge input-output validation.
- [ ] Add unit/instrumentation tests for success/failure paths, serialization edge cases, and parity with expected libsignal behavior.
- [ ] Document build, local dev, CI, and release integration steps, including libsignal dependency/version pinning.

##### iOS (Phase II)
- [ ] Ship iOS native crypto bridge with parity to Android API and payload shapes.
- [ ] Add XCTest coverage for crypto behavior, bridging failures, and serialization fidelity.
- [ ] Document CocoaPods/Xcode + Expo prebuild setup.
- [ ] Add E2E tests for valid exchange, corrupted payload rejection, and user recovery flow.

#### 8) UI completion for realistic demos
- [ ] Add validation, loading, empty, and error states across all core screens.
- [ ] Add conflict visualization for disputed bindings/records.
- [ ] Add trust-state explainability views (why an identity is VERIFIED/CONFLICTED/etc.).
- [ ] Add sync session progress and failure diagnostics in-app.
