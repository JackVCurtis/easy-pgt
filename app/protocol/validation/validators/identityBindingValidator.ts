import { isValidPublicKey, isValidTimestamp, isValidUUID } from '../formatValidators';
import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';
import { enforceStringMaxSize, invalid, requireFields } from './shared';

const REQUIRED_FIELDS = [
  'record_type',
  'record_version',
  'subject_uuid',
  'subject_identity_public_key',
  'key_epoch',
  'created_at',
  'self_signature',
] as const;

export function validateIdentityBindingStructure(record: StructuralRecord): StructuralValidationResult {
  const missingField = requireFields(record, REQUIRED_FIELDS);
  if (missingField) return missingField;

  if (!isValidUUID(record.subject_uuid)) return invalid('invalid_format', 'subject_uuid');
  if (!isValidPublicKey(record.subject_identity_public_key)) return invalid('invalid_format', 'subject_identity_public_key');
  if (typeof record.key_epoch !== 'number' || !Number.isInteger(record.key_epoch) || record.key_epoch < 0) {
    return invalid('invalid_format', 'key_epoch');
  }
  if (!isValidTimestamp(record.created_at)) return invalid('invalid_format', 'created_at');

  const publicKeySize = enforceStringMaxSize(
    record.subject_identity_public_key,
    'subject_identity_public_key',
    VALIDATION_LIMITS.max_public_key_size
  );
  if (publicKeySize) return publicKeySize;

  const signatureSize = enforceStringMaxSize(record.self_signature, 'self_signature', VALIDATION_LIMITS.max_signature_size);
  if (signatureSize) return signatureSize;

  return { valid: true };
}
