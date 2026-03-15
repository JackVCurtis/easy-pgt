# Record Validation Engine

This document defines the validation pipeline for durable protocol records.

## Validation phases

Validation is intentionally staged to keep behavior deterministic:

1. **Structural validation** (implemented)
   - validates record shape and required fields
   - validates field format constraints
   - validates schema version support
   - validates size limits
2. **Cryptographic validation** (implemented)
3. **Semantic validation** (future)

Structural validation runs first and short-circuits before cryptographic or semantic checks.

Cryptographic validation is exposed via `validateRecord(record, context)` and `validateRecordCryptography(record, context)`.

## Structural validation entrypoint

Use:

- `validateRecordStructure(record)` in `app/protocol/validation/validateRecordStructure.ts`

Dispatcher behavior:

1. confirm the input is an object
2. require and validate `record_type`
3. require and validate `record_version`
4. enforce `max_record_size`
5. route to record-specific structure validator

## Supported record types

Structural validators are implemented for:

- `identity_binding`
- `endorsement`
- `handshake`
- `key_rotation`
- `revocation`

## Format validators

Shared format validators are provided in `app/protocol/validation/formatValidators.ts`:

- `isValidUUID`
- `isValidTimestamp`
- `isValidPublicKey`
- `isValidSignature`
- `isValidHash`

These perform format checks only and do not perform signature verification.

## Error model

Structural validation returns:

```ts
export type StructuralValidationResult =
  | { valid: true }
  | {
      valid: false
      reason: StructuralValidationErrorCode
      field?: string
    }
```

Error codes:

- `missing_field`
- `invalid_format`
- `invalid_version`
- `field_too_large`
- `unknown_record_type`

## Size limits

Limits are centralized in `app/protocol/validation/validationLimits.ts`:

- `max_record_size`
- `max_signature_size`
- `max_public_key_size`
- `max_string_length`
