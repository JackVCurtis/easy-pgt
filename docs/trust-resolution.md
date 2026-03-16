# Trust Resolution Engine

The trust resolution engine derives local trust state from **validated protocol records** already accepted into the local append-only log.

## Inputs

`resolveTrustStates` accepts:

- `validatedRecords: DurableRecord[]`

The caller is responsible for passing records that already passed the validation pipeline boundary. Rejected records are not considered input evidence.

## Trust states

Each identity binding is classified into exactly one state:

- `CLAIMED`: binding exists with no sufficient weighted endorsement support, and no higher-precedence conflict/revocation state.
- `TENTATIVE`: weighted endorsement net score meets tentative threshold, and no conflicts or revocations apply.
- `VERIFIED`: weighted endorsement net score meets verified threshold, and no conflicts or revocations apply.
- `CONFLICTED`: competing local evidence exists (for example multiple bindings for the same UUID, or contradictory endorsements from the same endorser for the same subject binding).
- `REVOKED`: revocation targets the binding hash.

## Endorsement weighting model

Endorsement support is scored deterministically using fixed constants:

| endorsement_type  | low | medium | high |
| ----------------- | --- | ------ | ---- |
| `binding_valid`   | +1  | +2     | +3   |
| `binding_invalid` | -1  | -2     | -3   |

The engine computes, per subject binding:

- `positiveScore`: sum of positive endorsement weights
- `negativeScore`: sum of absolute negative endorsement weights
- `netScore = positiveScore - negativeScore`

Thresholds are fixed:

- `TENTATIVE` when `netScore >= 1`
- `VERIFIED` when `netScore >= 3`

Duplicate endorsement records (same canonical record hash) are deduplicated and never double-counted.

## Evidence indexing

The engine deterministically builds in-memory indexes:

- `bindingHash -> binding`
- `bindingHash -> endorsements[]`
- `bindingHash -> revocations[]`
- `subjectUuid -> bindingHashes[]` (for UUID-level conflicts)
- `bindingHash -> conflicts[]`

Record hashes are deterministically derived from canonical record bytes (`canonicalSerialize`) and SHA-256. Hashes are represented as `hash_<hex>`.

## Rotation and revocation effects

`key_rotation` records are used to derive an active binding per `subject_uuid` without mutating stored history.

- The engine builds a deterministic per-subject rotation chain from validated `key_rotation` records.
- A linear chain selects a single active binding head (`A -> B` means `B` is active and `A` is historical evidence).
- If a subject has multiple bindings but no valid linear rotation chain, bindings remain UUID-conflicted.
- Historical bindings remain in output with their own evidence, but only the active binding can resolve to `TENTATIVE` or `VERIFIED`.
- `revocation` records targeting a binding hash always force `REVOKED`, regardless of endorsement score or active status.

## Conflict detection rules

A binding is marked conflicted when any of the following are present:

1. More than one identity binding exists for the same `subject_uuid`.
2. The same endorser binding publishes both `binding_valid` and `binding_invalid` endorsements for the same `subject_binding_hash`.

Conflicts are returned in `evidence.conflicts` for explainability.

## Deterministic precedence

State derivation uses this strict priority order:

1. `REVOKED`
2. `CONFLICTED`
3. `VERIFIED`
4. `TENTATIVE`
5. `CLAIMED`

This ensures identical input records always yield identical output states.

## Explainability model

For each binding, the result includes:

- `bindingHash`
- `trustState`
- `evidence` with record hashes used in the decision:
  - `endorsements[]`
  - `revocations[]`
  - `conflicts[]`
  - `endorsementSummary`
    - `positiveScore`
    - `negativeScore`
    - `netScore`
    - `endorsementHashes[]`
    - `contributions[]` (per-endorsement deterministic contribution breakdown)

Evidence arrays and contribution lists are sorted for stable deterministic output.

## Examples

- **CLAIMED**: one `identity_binding`, no supporting records.
- **TENTATIVE**: one `identity_binding` + low confidence `binding_valid` endorsement.
- **VERIFIED**: one `identity_binding` + weighted endorsements summing to net score 3 or greater.
- **CONFLICTED**: two `identity_binding` records with the same `subject_uuid`.
- **REVOKED**: binding has endorsements, but a revocation targets the binding hash.
