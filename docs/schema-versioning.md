# Durable Record Schema Versioning Strategy

This document defines how durable protocol records are version-gated before they can be parsed, hashed, or committed.

## Registry location

Supported versions and parser dispatch are declared in:

- `app/protocol/versions.ts`

The registry has two coordinated maps:

1. `supportedRecordVersions`: `record_type -> supported versions[]`
2. parser registry: `(record_type, version) -> schema/parser`

Current supported versions:

- `identity_binding` -> `1`
- `endorsement` -> `1`
- `handshake` -> `1`
- `key_rotation` -> `1`
- `revocation` -> `1`

## Decode/dispatch entry point

Use `decodeDurableRecord(...)` from:

- `app/protocol/decode-record.ts`

The entry point enforces this order:

1. Validate `record_type` is known.
2. Require explicit `record_version`.
3. Validate version shape (`integer >= 1`).
4. Check whether the well-formed version is supported for that `record_type`.
5. Resolve and run the schema parser only after all version gates pass.

If any gate fails, decoding returns a structured rejection and parsing is not attempted.

## Rejection classes

`decodeDurableRecord(...)` emits deterministic structured error codes:

- `unknown_record_type`
- `missing_record_version`
- `malformed_record_version`
- `unsupported_record_version`
- `schema_parse_failure`

Important distinction:

- **Malformed version** means the `record_version` value shape is invalid (missing/null/non-integer/invalid numeric domain).
- **Unsupported version** means the version is well-formed but not present in the supported-version registry for that record type.

## Safety invariants

- No fallback to “latest supported version”.
- No implicit migration during decode.
- Unknown versions are rejected until explicitly registered.
- Version gates are evaluated before schema parsing and before any downstream canonicalization/hash/commit usage.

## Adding a new version safely

To add `v2` for a record type:

1. Add `2` to `supportedRecordVersions[record_type]`.
2. Register the v2 parser/schema in the parser registry for that same `record_type`.
3. Add tests covering:
   - v1 compatibility,
   - v2 acceptance,
   - malformed version rejection,
   - unsupported version rejection.
4. Keep unknown versions rejected until both registry entries and tests are in place.


## Prototype endorsement amendment

`endorsement` remains version `1`. In prototype stage, v1 was simplified in place to remove `confidence_level`; the active v1 shape now stores only signed endorsement direction plus signature. Unsupported/malformed versions remain fail-closed.
