import { decodeDurableRecord } from '../decode-record';
import type { DurableRecord } from '../records';
import { validateRecordStructure } from './validateRecordStructure';
import {
  type CryptographicValidationContext,
  validateRecordCryptography,
} from './validateRecordCryptography';

export type RecordValidationResult =
  | { accepted: true }
  | {
      accepted: false;
      phase: 'structural' | 'cryptographic';
      reason: string;
      field?: string;
    };

function validateCryptography(
  record: DurableRecord,
  context: CryptographicValidationContext
): RecordValidationResult {
  const cryptoResult = validateRecordCryptography(record, context);
  if (cryptoResult.valid) {
    return { accepted: true };
  }

  return {
    accepted: false,
    phase: 'cryptographic',
    reason: cryptoResult.reason,
    field: cryptoResult.field,
  };
}

export function validateRecord(
  record: unknown,
  context: CryptographicValidationContext = {}
): RecordValidationResult {
  const structureResult = validateRecordStructure(record);
  if (!structureResult.valid) {
    return {
      accepted: false,
      phase: 'structural',
      reason: structureResult.reason,
      field: structureResult.field,
    };
  }

  const decoded = decodeDurableRecord(record);
  if (!decoded.ok) {
    return {
      accepted: false,
      phase: 'structural',
      reason: decoded.code,
    };
  }

  return validateCryptography(decoded.record, context);
}
