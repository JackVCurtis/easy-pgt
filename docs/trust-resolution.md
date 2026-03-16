# Trust Resolution Engine

The trust resolution engine derives local trust state from **validated protocol records** already accepted into the local append-only log.

## Inputs

`resolveTrustStates` accepts:

- `validatedRecords: DurableRecord[]`

The caller is responsible for passing records that already passed the validation pipeline boundary. Rejected records are not considered input evidence.

## Trust states

Each identity binding is classified into exactly one state:

- `CLAIMED`: binding exists with no endorsements, conflicts, or revocations.
- `TENTATIVE`: at least one low/medium confidence `binding_valid` endorsement and no conflicts or revocations.
- `VERIFIED`: at least one high confidence `binding_valid` endorsement and no conflicts or revocations.
- `CONFLICTED`: competing local evidence exists (for example multiple bindings for the same UUID, or contradictory endorsement evidence).
- `REVOKED`: revocation targets the binding hash.

## Evidence indexing

The engine deterministically builds in-memory indexes:

- `bindingHash -> binding`
- `bindingHash -> endorsements[]`
- `bindingHash -> revocations[]`
- `subjectUuid -> bindingHashes[]` (for UUID-level conflicts)
- `bindingHash -> conflicts[]`

Record hashes are deterministically derived from canonical record bytes (`canonicalSerialize`) and SHA-256. Hashes are represented as `hash_<hex>`.

## Conflict detection rules

A binding is marked conflicted when any of the following are present:

1. More than one identity binding exists for the same `subject_uuid`.
2. Endorsements for the same subject binding include both `binding_valid` and `binding_invalid` evidence.

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

Evidence arrays are sorted for stable deterministic output.

## Examples

- **CLAIMED**: one `identity_binding`, no supporting records.
- **TENTATIVE**: one `identity_binding` + low confidence `binding_valid` endorsement.
- **VERIFIED**: one `identity_binding` + high confidence `binding_valid` endorsement.
- **CONFLICTED**: two `identity_binding` records with the same `subject_uuid`.
- **REVOKED**: binding has endorsements, but a revocation targets the binding hash.
