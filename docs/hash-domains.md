# Hash Domain Separation for Canonical Records

PGT uses domain-separated SHA-256 helpers to prevent collisions between cryptographic contexts.

## Record hash domain

For every durable canonical record byte payload (`canonical_record_bytes`), compute:

- `record_hash = SHA256("record_hash_v1" || canonical_record_bytes)`

This namespace ensures a record hash cannot be confused with hashes produced for other protocol objects.

## Merkle leaf hash domain

Merkle leaves are derived from the record hash with a second namespace:

- `leaf_hash = SHA256("merkle_leaf_v1" || record_hash)`

This second hash domain isolates Merkle tree leaf identity from raw record identity.

## Why two domains?

Using different prefixes isolates collision domains:

- Record hashing and Merkle leaf hashing cannot accidentally alias the same digest context.
- Future protocol hash use-cases can introduce additional versioned prefixes without changing canonical serialization rules.
- Domain labels are explicit, stable protocol constants for cross-device deterministic behavior.

## Canonical implementation and usage

`app/protocol/crypto/hash.ts` is the single source of truth for protocol hash-domain behavior (`record_hash_v1`, `merkle_leaf_v1`).

- Protocol code should import hashing helpers from `@/app/protocol/crypto/hash`.
- `app/crypto/hashing.ts` is kept only as a deprecated compatibility shim for non-protocol/UI callers.
- Prefer the synchronous helpers (`computeRecordHash`, `computeLeafHash`) for protocol paths; async wrappers exist only for compatibility with older call sites.
