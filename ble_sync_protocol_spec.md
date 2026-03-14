# Reference Protocol Specification: BLE Sync Messages

Date: 2026-03-14

## Purpose

This document defines a **reference Bluetooth Low Energy (BLE) synchronization protocol** for a mobile application that:

- uses **NFC** for proximity-based bootstrap
- upgrades to **BLE** for larger data exchange
- uses **libsignal primitives** for authenticated encryption
- stores signed handshake records as **Merkle tree leaves**

This spec is intended to complement the handshake record specification. It focuses on the **messages exchanged after the NFC bootstrap succeeds** and after the peers have enough information to establish a BLE connection.

The design goals are:

- deterministic peer reconciliation
- bounded message sizes
- resumable sync
- clear validation rules
- platform-friendly BLE transport over a custom GATT service

This is a **reference spec**, not a standards-track wire format.

---

## Scope

This spec covers:

1. BLE service layout
2. session model
3. message framing
4. sync message types
5. Merkle reconciliation flow
6. retransmission and resumption behavior
7. validation and error handling

This spec does **not** define:

- the full NFC bootstrap format
- the libsignal handshake internals
- the full local database schema
- background sync policy

---

## High-level model

The protocol uses a hybrid architecture:

1. **NFC tap**
   - exchange bootstrap data
   - exchange BLE service identifiers
   - exchange cryptographic material sufficient to authenticate the peer

2. **BLE connection**
   - connect over a custom GATT service
   - establish an encrypted application session

3. **Sync phase**
   - compare Merkle roots
   - descend differing subtrees
   - request missing leaves
   - transfer missing handshake records
   - validate and merge
   - recompute local Merkle state

---

## Design goals

A good BLE sync protocol for this application should provide:

1. **Determinism**  
   The same peer state should produce the same sync decisions.

2. **Incrementality**  
   Peers should exchange only what is needed.

3. **Chunk safety**  
   Large payloads must be fragmented and reassembled cleanly.

4. **Resumability**  
   A dropped BLE connection should not force a full restart.

5. **Transport independence at the data model level**  
   Handshake records remain valid regardless of how they were transferred.

6. **Application-layer security**  
   BLE pairing is not trusted on its own; application messages are encrypted and authenticated above BLE.

---

## Roles

BLE itself has central and peripheral roles, but the sync protocol should not depend semantically on those platform-level roles.

Define logical protocol roles per session:

- **sync_initiator**: the device that starts the sync after BLE connection
- **sync_responder**: the device that acknowledges and participates

These roles affect message sequencing only, not record ownership.

---

## Security model

### Required assumption

All sync messages are carried inside an **authenticated encrypted application session** established after the NFC bootstrap.

That means every logical sync message should be wrapped inside application-layer confidentiality and integrity protection.

Recommended model:

- NFC bootstraps peer trust and session parameters
- libsignal or a project-equivalent authenticated session protects all sync messages
- BLE is treated as an untrusted transport

### Consequence

The protocol messages below are specified as **plaintext logical structures**, but on the wire they should be:

1. canonically serialized
2. encrypted
3. authenticated
4. then fragmented for BLE transport if needed

---

## BLE GATT service layout

Use a custom BLE GATT service, for example:

```text
MerkleSyncService
  ├─ ControlCharacteristic
  ├─ DataCharacteristic
  ├─ AckCharacteristic
  └─ StatusCharacteristic
```

### Recommended characteristic roles

### 1. `ControlCharacteristic`
Used for:

- session start
- message metadata
- small protocol control messages
- subtree requests
- errors
- completion notices

Preferred properties:

- Write
- Notify

### 2. `DataCharacteristic`
Used for:

- chunked transfer of larger payloads
- handshake records
- batched leaf hashes
- large subtree responses

Preferred properties:

- Write Without Response or Write
- Notify

### 3. `AckCharacteristic`
Used for:

- explicit chunk acknowledgments
- resumption checkpoints
- window advancement

Preferred properties:

- Notify
- Write

### 4. `StatusCharacteristic`
Used for:

- peer capabilities
- progress status
- transient sync state
- terminal session result

Preferred properties:

- Read
- Notify

### Simpler alternative

A minimal implementation may collapse this into just two characteristics:

```text
MerkleSyncService
  ├─ ControlCharacteristic
  └─ DataCharacteristic
```

This is easier to ship first, but may require more careful framing.

---

## MTU and fragmentation

BLE payload sizes vary by platform and negotiated MTU. Do **not** assume a large MTU.

### Recommendation

Define an application fragment size independent of the BLE MTU negotiation result.

Example:

- encrypted application frame max plaintext: 512 bytes
- fragment to fit current BLE write size
- reassemble before message decode

This keeps behavior stable across devices.

### Rule

No logical protocol message may assume it will fit in one BLE packet.

---

## Session lifecycle

A sync session has these phases:

1. **Connect**
2. **Negotiate**
3. **Authenticate / secure channel ready**
4. **Compare roots**
5. **Reconcile differences**
6. **Transfer leaves**
7. **Commit and finalize**
8. **Close**

### Session identifier

Every sync session should have a unique `session_id`.

Recommended format:

- random 128-bit identifier
- represented as UUID or 16-byte opaque binary

This ID is used for:

- chunk reassembly
- retransmission
- resume support
- debugging

---

## Canonical encoding

Pick one canonical encoding for all protocol messages.

Recommended:

- **canonical CBOR**

Acceptable alternative:

- canonical JSON

All peers in the same deployment must use the same encoding rules.

---

## Common message envelope

Every logical sync message should be wrapped in a common envelope.

### Reference envelope

```json
{
  "protocol_version": 1,
  "session_id": "uuid",
  "message_id": 1,
  "message_type": "sync_open",
  "sender_role": "initiator",
  "requires_ack": true,
  "payload": {},
  "extensions": {}
}
```

### Field definitions

#### `protocol_version`
**Type:** unsigned integer  
**Required:** yes

Version of the BLE sync protocol.

#### `session_id`
**Type:** UUID or 16-byte opaque identifier  
**Required:** yes

Unique per sync session.

#### `message_id`
**Type:** unsigned integer  
**Required:** yes

Monotonic increasing identifier scoped to the session and sender.

This supports:

- ack tracking
- duplicate suppression
- resume checkpoints

#### `message_type`
**Type:** string enum  
**Required:** yes

Identifies the payload type.

#### `sender_role`
**Type:** string enum  
**Required:** yes

Must be one of:

- `initiator`
- `responder`

#### `requires_ack`
**Type:** boolean  
**Required:** yes

Indicates whether the receiver must emit an explicit acknowledgment.

#### `payload`
**Type:** object/map  
**Required:** yes

Message-specific content.

#### `extensions`
**Type:** object/map  
**Required:** yes, may be empty

Reserved for future use.

---

## Fragment envelope

If a logical message is too large for one BLE write, fragment it.

### Reference fragment structure

```json
{
  "protocol_version": 1,
  "session_id": "uuid",
  "message_id": 42,
  "fragment_index": 0,
  "fragment_count": 3,
  "ciphertext": "base64url...",
  "fragment_checksum": "..."
}
```

### Rules

- all fragments of a message must share the same `session_id` and `message_id`
- fragments are indexed from `0`
- the receiver must not process the message until all fragments arrive and authenticate
- incomplete messages may be retained temporarily for resume or retry

### Timeout recommendation

Discard incomplete fragment sets after a bounded timeout, for example:

- 30 seconds idle timeout, or
- on session close

---

## Message types

The following message types are sufficient for a solid first implementation.

### 1. `sync_open`

Starts a logical sync session.

#### Purpose

- identifies protocol version
- advertises capabilities
- conveys the sender's current view of local state

#### Payload

```json
{
  "device_uuid": "uuid",
  "capabilities": {
    "supports_resume": true,
    "supports_batch_leaves": true,
    "supports_subtree_hashes": true,
    "max_record_bytes": 65536,
    "max_batch_count": 128
  },
  "tree_summary": {
    "root_hash": "bytes",
    "leaf_count": 1234,
    "tree_height": 11,
    "ordering_scheme": "leaf_hash_v1",
    "record_schema_version": 1
  }
}
```

#### Validation

- reject unknown mandatory ordering scheme
- reject unsupported record schema version
- do not proceed if protocol versions are incompatible

---

### 2. `sync_accept`

Acknowledges `sync_open` and confirms usable parameters.

#### Payload

```json
{
  "accepted": true,
  "capabilities": {
    "supports_resume": true,
    "supports_batch_leaves": true,
    "supports_subtree_hashes": true,
    "max_record_bytes": 65536,
    "max_batch_count": 64
  },
  "tree_summary": {
    "root_hash": "bytes",
    "leaf_count": 1200,
    "tree_height": 11,
    "ordering_scheme": "leaf_hash_v1",
    "record_schema_version": 1
  },
  "resume_token": null
}
```

#### Negotiation rule

The effective session parameters are the **intersection** of both peers' capabilities.

Example:

- if one peer supports batch size 128 and the other 64
- effective maximum batch count becomes 64

---

### 3. `sync_reject`

Used when the session cannot proceed.

#### Payload

```json
{
  "error_code": "unsupported_ordering_scheme",
  "retryable": false,
  "details": "Peer requires created_at_uuid_v1 ordering; local supports leaf_hash_v1 only."
}
```

---

### 4. `root_compare`

Used when a peer wants to explicitly restate or confirm its current Merkle summary.

This may be omitted if `sync_open` and `sync_accept` already contain sufficient tree summaries.

#### Payload

```json
{
  "root_hash": "bytes",
  "leaf_count": 1234,
  "tree_height": 11,
  "ordering_scheme": "leaf_hash_v1"
}
```

#### Rule

If both peers report the same:

- `root_hash`
- `leaf_count`
- `ordering_scheme`

then sync may terminate successfully with no further tree reconciliation.

---

### 5. `subtree_query`

Requests hash summaries for one or more tree positions.

#### Purpose

Allows recursive or batched descent into differing subtrees instead of exchanging all leaves.

#### Payload

```json
{
  "query_nodes": [
    {
      "level": 0,
      "index": 0
    }
  ]
}
```

### Tree coordinate convention

You must define one project-wide convention. Recommended:

- `level = 0` means root
- greater `level` means deeper in the tree
- `index` is zero-based within that level

This convention must be identical on all peers.

---

### 6. `subtree_reply`

Returns subtree hashes or leaf references for requested positions.

#### Payload

```json
{
  "nodes": [
    {
      "level": 0,
      "index": 0,
      "hash": "bytes",
      "leaf_span_start": 0,
      "leaf_span_end": 1233,
      "node_kind": "internal"
    }
  ]
}
```

### Optional leaf optimization

If the queried node is already a leaf or covers a tiny range, the responder may directly return:

- leaf hashes, or
- leaf identifiers

#### Example

```json
{
  "nodes": [
    {
      "level": 10,
      "index": 87,
      "node_kind": "leaf",
      "leaf_hash": "bytes",
      "handshake_uuid": "uuid"
    }
  ]
}
```

---

### 7. `leaf_inventory_query`

Requests identification of leaves in a range or under a subtree.

This is useful when hashes differ but you want a batched list of leaf hashes before requesting full records.

#### Payload

```json
{
  "range": {
    "start": 512,
    "end": 639
  },
  "include_handshake_uuid": true
}
```

---

### 8. `leaf_inventory_reply`

Returns a compact inventory of leaves.

#### Payload

```json
{
  "range": {
    "start": 512,
    "end": 639
  },
  "leaves": [
    {
      "position": 512,
      "leaf_hash": "bytes",
      "handshake_uuid": "uuid"
    }
  ]
}
```

### Use case

The receiver compares this against local leaf hashes and determines which full records are missing.

---

### 9. `record_query`

Requests one or more full handshake records.

#### Payload

```json
{
  "requested_records": [
    {
      "handshake_uuid": "uuid"
    },
    {
      "leaf_hash": "bytes"
    }
  ]
}
```

### Rule

At least one stable identifier must be provided per requested record.

Recommended preference:

1. `handshake_uuid`
2. `leaf_hash`

---

### 10. `record_reply`

Returns one or more full signed handshake records.

#### Payload

```json
{
  "records": [
    {
      "handshake_uuid": "uuid",
      "leaf_hash": "bytes",
      "record_bytes": "base64url..."
    }
  ]
}
```

### Rules

- `record_bytes` must contain the canonical full signed handshake record representation
- the receiver must fully validate each record before merge
- records may be batched, subject to negotiated limits

---

### 11. `record_ack`

Acknowledges valid record receipt and optionally reports merge status.

#### Payload

```json
{
  "accepted_records": [
    {
      "handshake_uuid": "uuid",
      "leaf_hash": "bytes"
    }
  ],
  "rejected_records": [
    {
      "handshake_uuid": "uuid",
      "reason": "invalid_signature"
    }
  ]
}
```

---

### 12. `sync_checkpoint`

Communicates resumable progress.

#### Payload

```json
{
  "phase": "record_transfer",
  "last_applied_message_id": 88,
  "last_applied_leaf_hash": "bytes",
  "resume_token": "opaque-token"
}
```

### Purpose

If the BLE link drops, peers can resume without repeating all previous work.

---

### 13. `sync_complete`

Declares sync completion from the sender's point of view.

#### Payload

```json
{
  "final_tree_summary": {
    "root_hash": "bytes",
    "leaf_count": 1250,
    "tree_height": 11,
    "ordering_scheme": "leaf_hash_v1"
  },
  "records_received": 50,
  "records_sent": 16
}
```

### Completion rule

A session is successful only if both peers eventually agree that:

- transfer is complete
- local validation is complete
- final tree state is internally consistent

---

### 14. `error`

Reports a protocol or validation problem.

#### Payload

```json
{
  "error_code": "invalid_record_schema",
  "retryable": false,
  "message_id": 91,
  "details": "Record schema version 3 is unsupported."
}
```

---

## Suggested sync flow

The following is a reference flow, not the only valid one.

### Case A: roots match

1. `sync_open`
2. `sync_accept`
3. compare tree summaries
4. if roots equal:
   - `sync_complete`
   - close session

### Case B: roots differ

1. `sync_open`
2. `sync_accept`
3. compare root summaries
4. `subtree_query(root)`
5. `subtree_reply(root children or root span)`
6. recursively descend differing branches
7. `leaf_inventory_query` on differing ranges
8. `leaf_inventory_reply`
9. `record_query` for missing leaves
10. `record_reply`
11. validate and merge records
12. recompute local Merkle state
13. exchange `sync_complete`

---

## Reconciliation strategy

Two practical strategies work well.

### Strategy 1: recursive subtree descent

Process:

1. compare root hash
2. if different, compare child hashes
3. continue until:
   - hashes match, or
   - leaf level reached

Pros:

- efficient for sparse differences

Cons:

- more round trips

### Strategy 2: mixed subtree plus range inventory

Process:

1. descend only to a threshold node size
2. switch to leaf inventory for small differing spans
3. request records only for unknown leaves

Pros:

- fewer round trips
- better for BLE latency

This is the recommended default.

---

## Recommended threshold switching rule

For example:

- if a differing subtree spans more than 256 leaves, continue subtree descent
- if it spans 256 or fewer leaves, return leaf inventory

Tune this using real device tests.

---

## Record validation rules

Every received handshake record must be validated before merge.

### Required checks

1. canonical record decoding succeeds
2. record schema version is supported
3. participant ordering is canonical
4. both signatures verify
5. `signing_payload_hash` matches recomputed value
6. `leaf_hash` matches recomputed leaf hash
7. duplicate/conflict policy is applied
8. local leaf ordering policy is preserved

### Important rule

A record must **never** be inserted into the Merkle tree before full validation succeeds.

---

## Local merge behavior

When a valid novel record is received:

1. insert into local durable store
2. update deterministic leaf ordering
3. recompute affected Merkle nodes
4. update local tree summary

### Duplicate rule

If local store already contains a canonical byte-identical record with the same `handshake_uuid`:

- ignore as duplicate
- it may still be acknowledged as already known

### Conflict rule

If same `handshake_uuid` but different content:

- reject
- quarantine
- do not insert into Merkle tree

---

## Acknowledgment and retransmission

### Message-level ack

For control messages with `requires_ack = true`, the receiver should return either:

- a transport-level ack, or
- the next semantically appropriate response message

### Chunk-level ack

For fragmented large transfers, use selective or cumulative acks.

#### Simple recommendation

Use cumulative acknowledgments:

```json
{
  "session_id": "uuid",
  "message_id": 42,
  "highest_contiguous_fragment_received": 7
}
```

This is easier than selective ack for a first implementation.

### Retry policy

If no ack is received within a timeout:

- retransmit the unacknowledged fragment or message
- cap retries, for example at 3 to 5 attempts
- then fail the session

---

## Resume support

If supported by both peers, resume should work at the **message boundary**, not arbitrary byte offsets.

### Resume token contents

A resume token may encode:

- session parameters
- last applied message ID
- negotiated capabilities
- checkpoint hash
- expiry

Example logical structure:

```json
{
  "session_id": "uuid",
  "last_applied_message_id": 88,
  "phase": "record_transfer",
  "checkpoint_hash": "bytes",
  "expires_at": "2026-03-14T12:45:00.000Z"
}
```

### Rule

On resume, both peers must confirm the same session checkpoint before continuing.  
Otherwise, restart sync from `sync_open`.

---

## Ordering scheme requirement

This sync protocol depends critically on all peers agreeing on the leaf ordering policy.

### Recommended values

- `leaf_hash_v1`
- `created_at_uuid_v1`

### Rule

If ordering schemes differ, the peers must not pretend their tree summaries are directly comparable.

They may:

- reject sync, or
- fall back to record-inventory reconciliation without subtree assumptions

For a first implementation, **reject** mismatched ordering schemes.

---

## Recommended message size limits

These are application-level suggestions, not BLE limits.

### Suggested defaults

- max decrypted logical message size: 64 KiB
- max record batch count: 64
- max subtree reply nodes: 128
- max leaf inventory reply entries: 256

Adjust after testing on real devices.

---

## Error codes

Recommended initial error codes:

- `unsupported_protocol_version`
- `unsupported_record_schema`
- `unsupported_ordering_scheme`
- `invalid_message`
- `invalid_fragment`
- `invalid_signature`
- `invalid_record_schema`
- `invalid_leaf_hash`
- `duplicate_conflict`
- `resume_rejected`
- `payload_too_large`
- `rate_limited`
- `internal_error`

Keep these stable once clients ship.

---

## Reference flow example

### Example session

```text
1. initiator sends sync_open(root=RA, count=1000)
2. responder sends sync_accept(root=RB, count=1012)
3. roots differ
4. initiator sends subtree_query(root)
5. responder sends subtree_reply(children hashes)
6. initiator identifies differing right subtree
7. initiator sends subtree_query(right subtree)
8. responder replies with small leaf inventory
9. initiator compares inventory and requests 12 unknown records
10. responder sends record_reply(batch 1)
11. initiator validates and merges
12. initiator sends record_ack
13. both sides recompute root
14. initiator sends sync_complete(root=RC)
15. responder sends sync_complete(root=RC)
16. session closes
```

---

## Minimal first-shipping profile

If you want a simpler v1 implementation, use this reduced protocol surface:

### Required messages

- `sync_open`
- `sync_accept`
- `subtree_query`
- `subtree_reply`
- `record_query`
- `record_reply`
- `record_ack`
- `sync_complete`
- `error`

### Defer until later

- resume tokens
- selective retransmission
- range inventory
- advanced capabilities
- multi-peer forwarding metadata

This is likely enough to validate the overall system architecture.

---

## Practical implementation guidance

For a strong first version:

1. use **canonical CBOR**
2. encrypt/authenticate every logical message above BLE
3. fragment at the application layer
4. use a mixed reconciliation strategy:
   - subtree descent for large spans
   - leaf inventory for small spans
5. require matching leaf ordering scheme
6. validate every record before merge
7. support cumulative acks before attempting more complex retransmission logic

That gives you a protocol that is:

- deterministic
- testable
- mobile-friendly
- compatible with your signed handshake-record Merkle model

---

## Summary

A solid BLE sync protocol for your application should:

- treat BLE as transport only
- protect all sync messages in an authenticated encrypted session
- compare Merkle roots first
- descend only into differing subtrees
- request full records only for unknown leaves
- enforce deterministic ordering and validation
- support fragmentation, acknowledgment, and eventual resumption

Together with the handshake record spec, this provides a coherent protocol foundation for:

- NFC-bootstrapped trust
- BLE-based state exchange
- deterministic Merkle synchronization
- signed, merge-safe handshake records
