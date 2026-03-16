# PGT Architecture Guide

## Overview

Pretty Good Trust (PGT) is a decentralized system for exchanging identity information and trust relationships using proximity interactions.

The system combines:

* cryptographic identity keys
* signed trust records
* an append-only Merkle log
* peer-to-peer synchronization

The architecture is intentionally **log-based**, not mapping-based.

Instead of maintaining a mutable table such as:

```
uuid → public_key
```

PGT stores **signed records** and derives local identity belief from the full record history.

---

# Layered Architecture

The system consists of four logical layers.

```
Transport bootstrap layer
Secure session layer
Durable record layer
Trust resolution layer
```

Each layer has a specific responsibility.

---

# 1. Identity Layer

Each installation generates a long-term cryptographic identity keypair.

```
identity_public_key
identity_private_key
```

The system introduces an explicit record type called an **identity binding**.

### Identity Binding

An identity binding is a self-signed record associating:

```
subject_uuid
subject_identity_public_key
```

Example:

```
IdentityBindingRecord {
  subject_uuid
  subject_identity_public_key
  key_epoch
  created_at
  self_signature
}
```

This record means:

> The holder of this private key claims this UUID.

A self-signed binding proves **key possession**, not real-world identity truth.

---

# 2. Trust Layer

Because first-contact trust is inherently uncertain, PGT uses explicit **endorsement records**.

### Endorsements

An endorsement is a signed statement that an identity believes a specific binding is valid.

Example:

```
EndorsementRecord {
  endorser_binding_hash
  subject_binding_hash
  endorsement_type
  signature
}
```

Devices interpret endorsements using **local trust policy**.

---

## Local Trust States

Each device derives identity status from the available records.

Suggested states:

```
CLAIMED
TENTATIVE
VERIFIED
CONFLICTED
REVOKED
```

Example policy:

```
Bob endorsement weight: 1.0
Charlie endorsement weight: 1.0
Unknown endorsement weight: 0.0
Verification threshold: 1.5
```

Under this policy, Bob + Charlie outweigh Eve.

---

# 3. Durable Record Log

All durable evidence is stored as **signed records in an append-only Merkle log**.

Record types include:

```
identity_binding
handshake
endorsement
key_rotation
revocation
```

Each record has:

```
record_type
record_version
canonical_bytes
signatures
```

---

# Record Hashing

Each record produces a domain-separated hash.

```
record_hash =
  SHA256("record_hash_v1" || canonical_record_bytes)
```

Merkle leaves are derived from record hashes.

```
leaf_hash =
  SHA256("merkle_leaf_v1" || record_hash)
```

---

# Deterministic Ordering

To ensure convergence across devices, the Merkle log must use deterministic ordering.

Recommended rule:

```
sort leaves by leaf_hash
```

This guarantees identical Merkle trees for identical record sets.

---

# 4. Proximity Handshakes

A **handshake record** proves that two identities interacted.

Example structure:

```
HandshakeRecord {
  handshake_uuid
  participant_a_binding_hash
  participant_b_binding_hash
  participant_a_merkle_root
  participant_b_merkle_root
  ephemeral_keys
  signatures
}
```

This proves:

* both participants signed the same payload
* both identities were present
* both participants claimed specific Merkle state

Handshakes do not determine identity truth.

---

# Transport Architecture

PGT separates **bootstrap** from **synchronization**.

```
NFC → bootstrap
BLE → bulk synchronization
```

---

# NFC Bootstrap

NFC provides proximity proof and session initialization.

Example bootstrap payload:

```
NfcBootstrap {
  session_uuid
  identity_binding_hash
  ephemeral_public_key
  bluetooth_service_uuid
  nonce
  signature
}
```

Properties:

* small payload
* binds tap event to session
* prevents UUID-only identity trust

---

# BLE Synchronization

After bootstrap, peers establish a BLE connection and an encrypted session.

The sync protocol proceeds in phases.

```
1. session negotiation
2. root comparison
3. subtree reconciliation
4. record transfer
5. validation
6. commit
```

---

# Merkle Reconciliation

Synchronization uses Merkle comparison.

High-level algorithm:

```
compare roots
if equal:
    finish
else:
    descend differing subtrees
    request leaf inventory
    fetch missing records
    validate and apply
```

This minimizes bandwidth usage.

---

# Conflict Handling

The system must never silently overwrite records.

Conflicts include:

```
same UUID, different key
same handshake UUID, different payload
same endorsement UUID, different payload
```

Handling rules:

```
store both records
mark conflict set
resolve via trust policy
```

---

# Key Rotation

PGT supports legitimate key changes.

```
KeyRotationRecord {
  subject_uuid
  old_binding_hash
  new_binding_hash
  rotation_counter
  signatures
}
```

Rotation records allow devices to prefer newer keys while preserving history.

---

# Revocations

Revocation records allow identities to withdraw trust.

```
RevocationRecord {
  signer_binding_hash
  target_record_hash
  reason_code
  signature
}
```

Revocation interpretation is governed by local policy.

---

# Security Model

The architecture addresses several attack classes.

Mitigated well:

```
record tampering
record deletion
append-only history rewriting
sync tampering
duplicate replay confusion
```

Partially mitigated:

```
first-contact impersonation
sybil attacks
compromised trusted peers
```

Not solved:

```
global identity truth
metadata privacy
device compromise
```

---

# Architectural Principles

The design follows several key rules.

```
UUID is identifier, not truth.
Identity bindings are first-class records.
Endorsements are explicit evidence.
Trust is local-policy-based.
Conflicts must remain visible.
All durable evidence lives in the Merkle log.
Transport never defines identity truth.
```

---

# Implementation Roadmap

Recommended build order:

```
1. canonical record formats
2. validation engine
3. trust resolution engine
4. deterministic Merkle log
5. BLE sync protocol
6. NFC bootstrap
7. resume/checkpoint support
```

Building correctness before transport complexity reduces implementation risk.

---

# Summary

PGT should be understood as:

```
a proximity-bootstrapped,
BLE-synchronized,
append-only trust log
with local identity resolution
```

This model allows identity relationships to propagate through decentralized peer interactions while preserving transparency, auditability, and local trust control.
