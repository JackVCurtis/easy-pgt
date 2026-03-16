# Trust Resolution

Trust resolution consumes only **validated durable records** and derives local trust state.

## States

- `CLAIMED`: binding exists with no sufficient local-policy support, and no higher-precedence conflict/revocation state.
- `TENTATIVE`: local-policy net support meets tentative threshold, and no conflicts or revocations apply.
- `VERIFIED`: local-policy net support meets verified threshold, and no conflicts or revocations apply.
- `CONFLICTED`: competing evidence exists (for example multiple bindings for one UUID, or contradictory endorsements from one endorser for one subject binding).
- `REVOKED`: one or more revocations target the binding hash.

## Evidence model

Validated endorsement records provide signed binary evidence only:

- `endorsement_type = binding_valid`
- `endorsement_type = binding_invalid`

Endorsement records do **not** carry confidence/weight in the synchronized log.

## Local policy scoring

Receiving devices assign endorsement contribution weights locally. A local policy can use any deterministic criteria (endorser reputation, encounter recency, allowlists, etc.).

- `positiveScore`: sum of positive local-policy endorsement weights
- `negativeScore`: sum of absolute negative local-policy endorsement weights
- `netScore = positiveScore - negativeScore`

Thresholds for `TENTATIVE`/`VERIFIED` are local policy settings and may differ across devices.

## Deterministic evidence handling

- Duplicate endorsements (same record hash) are deduplicated.
- Evidence arrays are deduplicated and lexicographically sorted.
- Contradictory endorsements remain deterministic conflict evidence: if the same `endorser_binding_hash` emits both `binding_valid` and `binding_invalid` for one `subject_binding_hash`, mark the subject binding `CONFLICTED`.
- Revocation precedence is unchanged: any revocation targeting a binding hash forces `REVOKED`.

## Cross-device parity

- Durable record content, canonical serialization, hashes, and Merkle reconciliation remain deterministic across devices.
- Derived trust-state parity is not guaranteed unless devices share equivalent local weighting/threshold policy.

## Explainability

`endorsementSummary.contributions[]` is a local-policy output. It must be labeled as local interpretation, not protocol-record content.
