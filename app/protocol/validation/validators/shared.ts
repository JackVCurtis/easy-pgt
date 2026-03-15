import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';

export function invalid(reason: StructuralValidationResult['reason'], field?: string): StructuralValidationResult {
  return field ? { valid: false, reason, field } : { valid: false, reason };
}

export function requireFields(record: StructuralRecord, fields: readonly string[]): StructuralValidationResult | null {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(record, field) || record[field] === undefined || record[field] === null) {
      return invalid('missing_field', field);
    }
  }

  return null;
}

export function enforceStringMaxSize(value: unknown, field: string, max = VALIDATION_LIMITS.max_string_length): StructuralValidationResult | null {
  if (typeof value !== 'string') {
    return invalid('invalid_format', field);
  }

  if (value.length > max) {
    return invalid('field_too_large', field);
  }

  return null;
}

export function enforceObject(value: unknown, field: string): StructuralValidationResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid('invalid_format', field);
  }

  return null;
}
