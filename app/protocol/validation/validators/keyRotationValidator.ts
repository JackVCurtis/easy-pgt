import { isValidHash, isValidSignature, isValidUUID } from '../formatValidators';
import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';
import { enforceObject, enforceStringMaxSize, invalid, requireFields } from './shared';

const REQUIRED_FIELDS = [
  'record_type',
  'record_version',
  'subject_uuid',
  'old_binding_hash',
  'new_binding_hash',
  'rotation_counter',
  'signatures',
] as const;

export function validateKeyRotationStructure(record: StructuralRecord): StructuralValidationResult {
  const missingField = requireFields(record, REQUIRED_FIELDS);
  if (missingField) return missingField;

  if (!isValidUUID(record.subject_uuid)) return invalid('invalid_format', 'subject_uuid');
  if (!isValidHash(record.old_binding_hash)) return invalid('invalid_format', 'old_binding_hash');
  if (!isValidHash(record.new_binding_hash)) return invalid('invalid_format', 'new_binding_hash');
  if (typeof record.rotation_counter !== 'number' || !Number.isInteger(record.rotation_counter) || record.rotation_counter < 0) {
    return invalid('invalid_format', 'rotation_counter');
  }

  const signatureObject = enforceObject(record.signatures, 'signatures');
  if (signatureObject) return signatureObject;

  const signatures = record.signatures as StructuralRecord;
  const missingSignature = requireFields(signatures, ['old_key', 'new_key']);
  if (missingSignature) return invalid(missingSignature.reason, `signatures.${missingSignature.field}`);

  if (!isValidSignature(signatures.old_key)) return invalid('invalid_format', 'signatures.old_key');
  if (!isValidSignature(signatures.new_key)) return invalid('invalid_format', 'signatures.new_key');

  const oldSigSize = enforceStringMaxSize(signatures.old_key, 'signatures.old_key', VALIDATION_LIMITS.max_signature_size);
  if (oldSigSize) return oldSigSize;
  const newSigSize = enforceStringMaxSize(signatures.new_key, 'signatures.new_key', VALIDATION_LIMITS.max_signature_size);
  if (newSigSize) return newSigSize;

  return { valid: true };
}
