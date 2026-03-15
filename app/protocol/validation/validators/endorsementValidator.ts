import { confidenceLevelSchema, endorsementTypeSchema } from '../../records';
import { isValidHash, isValidSignature } from '../formatValidators';
import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';
import { enforceStringMaxSize, invalid, requireFields } from './shared';

const REQUIRED_FIELDS = [
  'record_type',
  'record_version',
  'endorser_binding_hash',
  'subject_binding_hash',
  'endorsement_type',
  'confidence_level',
  'signature',
] as const;

export function validateEndorsementStructure(record: StructuralRecord): StructuralValidationResult {
  const missingField = requireFields(record, REQUIRED_FIELDS);
  if (missingField) return missingField;

  if (!isValidHash(record.endorser_binding_hash)) return invalid('invalid_format', 'endorser_binding_hash');
  if (!isValidHash(record.subject_binding_hash)) return invalid('invalid_format', 'subject_binding_hash');
  if (!endorsementTypeSchema.safeParse(record.endorsement_type).success) return invalid('invalid_format', 'endorsement_type');
  if (!confidenceLevelSchema.safeParse(record.confidence_level).success) return invalid('invalid_format', 'confidence_level');
  if (!isValidSignature(record.signature)) return invalid('invalid_format', 'signature');

  const signatureSize = enforceStringMaxSize(record.signature, 'signature', VALIDATION_LIMITS.max_signature_size);
  if (signatureSize) return signatureSize;

  return { valid: true };
}
