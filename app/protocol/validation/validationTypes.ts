export type StructuralValidationErrorCode =
  | 'missing_field'
  | 'invalid_format'
  | 'invalid_version'
  | 'field_too_large'
  | 'unknown_record_type';

export type StructuralValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: StructuralValidationErrorCode;
      field?: string;
    };

export type StructuralRecord = Record<string, unknown>;
