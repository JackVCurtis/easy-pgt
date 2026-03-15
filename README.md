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
  architecture.md
  protocol_spec.md
  sync_state_machine.md
```

Recommended reading order:

1. Architecture guide
2. Protocol specification
3. Sync state machine

---

# Development Status

Current implementation focus:

* canonical record formats
* deterministic Merkle log
* trust resolution engine
* Android NFC bootstrap
* BLE synchronization

Android is the initial target platform.

iOS support is planned with a more limited NFC role.

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

## Task Breakdown
### Android (Phase I)
1) UI Application (Expo + React Native)

    - [x] Initialize an Expo TypeScript app with a shared design system, linting, and test setup.

    - [x] Build navigation with tabs and stacks for Handshake flow, Sign Message flow, and View Message Distance flow

    - [x] Implement reusable UI primitives (buttons, cards, headers, status badges) and consistent dark/light theming.

    - [ ] Create screen-level views backed by mock data for trust relationships, signed messages, and profile identity details.

    - [ ] Add form validation, loading/error states, and empty states so all core screens are demo-ready.

2) Android Plugin (libsignal bridge)

   - [ ] Create an Android native module that exposes key generation, signing, and verification from libsignal to JavaScript.

   - [ ] Define a stable TypeScript interface and validate all JNI/bridge inputs and outputs.

   - [ ] Add instrumentation/unit tests for native crypto calls and bridge error handling.

   - [ ] Package and document plugin integration steps for local development and release builds.

3) Merkle Tree Creation and Verification

   - [ ]  Design canonical handshake leaf encoding including UUID, public key, and metadata needed for ordering.

   - [ ] Implement deterministic Merkle tree construction and root generation from local handshake records.

   - [ ]  Implement proof generation/verification APIs for checking whether a signed message identity appears in a tree.

   - [ ]  Add tests for determinism, tamper detection, duplicate handling, and cross-platform compatibility of hashes.

4) NFC File Exchange

   - [ ]  Define a compact exchange format for tree snapshots, proofs, and signature metadata with versioning.

   - [ ]  Implement NFC send/receive flows that serialize, validate, and persist exchanged trust data safely.

   - [ ]  Add conflict resolution rules for merging imported tree data with local handshakes.

### iOS (Phase II)
5) iOS Plugin (libsignal bridge)

   - [ ] Create an iOS native module that exposes key generation, signing, and verification from libsignal to JavaScript.

   - [ ]  Define matching TypeScript contracts so iOS and Android return consistent payloads.

   - [ ]  Add XCTest coverage for native crypto operations, failures, and bridge serialization.

   - [ ]  Document plugin setup for CocoaPods/Xcode and Expo prebuild workflows.
   - [ ]  Add end-to-end tests for successful exchange, corrupted payload rejection, and recovery UX.
