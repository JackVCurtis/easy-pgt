import { revocationReasonCodeSchema } from '../../records';
import { isValidHash, isValidSignature } from '../formatValidators';
import { VALIDATION_LIMITS } from '../validationLimits';
import type { StructuralRecord, StructuralValidationResult } from '../validationTypes';
import { enforceStringMaxSize, invalid, requireFields } from './shared';

const REQUIRED_FIELDS = [
  'record_type',
  'record_version',
  'signer_binding_hash',
  'target_record_hash',
  'reason_code',
  'signature',
] as const;

export function validateRevocationStructure(record: StructuralRecord): StructuralValidationResult {
  const missingField = requireFields(record, REQUIRED_FIELDS);
  if (missingField) return missingField;

  if (!isValidHash(record.signer_binding_hash)) return invalid('invalid_format', 'signer_binding_hash');
  if (!isValidHash(record.target_record_hash)) return invalid('invalid_format', 'target_record_hash');
  if (!revocationReasonCodeSchema.safeParse(record.reason_code).success) return invalid('invalid_format', 'reason_code');
  if (!isValidSignature(record.signature)) return invalid('invalid_format', 'signature');

  const signatureSize = enforceStringMaxSize(record.signature, 'signature', VALIDATION_LIMITS.max_signature_size);
  if (signatureSize) return signatureSize;

  return { valid: true };
}
