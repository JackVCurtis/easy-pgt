# Semantic Validation Rules

This document defines semantic validation behavior after structural and cryptographic validation succeeds.

Semantic validation returns one of three deterministic outcomes:

- `accepted`: record is semantically consistent with the current local log state.
- `rejected`: record is invalid and should not be appended as a valid state transition.
- `conflicted`: record is structurally and cryptographically valid but semantically conflicts with existing evidence.

Conflicted records must still be retained as durable evidence and surfaced for local trust resolution.

## Inputs

Semantic validation evaluates:

- candidate `record`
- local log state indexes derived from already validated records
- optional candidate `record_hash`

No randomness, wall-clock time, network calls, or external state are used.

## Duplicate detection (`rejected`)

A candidate record is rejected as a duplicate when its `record_hash` is already present in the local log index.

Rule:

- if `candidate_record_hash ∈ known_record_hashes` → `rejected` (`duplicate_record`)

This covers replayed records observed during synchronization.

## Conflicting payload detection (`conflicted`)

### Identity binding conflicts

Identity bindings conflict when the same `subject_uuid` is associated with a different `subject_identity_public_key` than keys already observed for that UUID.

Rule:

- if UUID exists and incoming public key is not in the known key set for that UUID → `conflicted` (`conflicting_identity_binding`)

### Revocation conflicts

Revocations conflict when the same signer-target pair (`signer_binding_hash`, `target_record_hash`) appears with different revocation reasons.

Rule:

- if signer-target tuple exists and incoming `reason_code` differs from known reasons → `conflicted` (`conflicting_revocation`)

## Key rotation monotonicity (`rejected`)

Key rotations must advance a linear chain for each `subject_uuid`.

Rules:

1. Rotation must reference the current active key.
   - if `old_binding_hash` does not match active binding for subject → `rejected` (`rotation_old_key_mismatch`)
2. Rotation counter must increase by exactly one.
   - if `rotation_counter !== last_counter + 1` → `rejected` (`rotation_counter_not_monotonic`)
3. New key must not be historical.
   - if `new_binding_hash` is already in used-key history for subject → `rejected` (`rotation_reuses_historical_key`)

## Determinism guarantees

Given identical candidate record and identical local log state indexes, semantic validation returns identical outcomes across devices.
