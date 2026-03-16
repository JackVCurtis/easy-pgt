import { z } from 'zod';

const recordVersionSchema = z.literal(1);

const baseRecordSchema = z.object({
  record_version: recordVersionSchema,
});

const signaturePairSchema = z.object({
  participant_a: z.string(),
  participant_b: z.string(),
});

const keyRotationSignaturesSchema = z.object({
  old_key: z.string(),
  new_key: z.string(),
});

export const endorsementTypeSchema = z.enum(['binding_valid', 'binding_invalid']);

export const revocationReasonCodeSchema = z.enum([
  'key_compromised',
  'superseded',
  'consent_withdrawn',
  'other',
]);

export const identityBindingSchema = baseRecordSchema.extend({
  record_type: z.literal('identity_binding'),
  subject_uuid: z.string(),
  subject_identity_public_key: z.string(),
  key_epoch: z.number().int().nonnegative(),
  created_at: z.string(),
  self_signature: z.string(),
});

export const endorsementSchema = baseRecordSchema.extend({
  record_type: z.literal('endorsement'),
  endorser_binding_hash: z.string(),
  subject_binding_hash: z.string(),
  endorsement_type: endorsementTypeSchema,
  signature: z.string(),
}).strict();

export const handshakeSchema = baseRecordSchema.extend({
  record_type: z.literal('handshake'),
  handshake_uuid: z.string(),
  participant_a_binding_hash: z.string(),
  participant_b_binding_hash: z.string(),
  participant_a_merkle_root: z.string(),
  participant_b_merkle_root: z.string(),
  ephemeral_keys: signaturePairSchema,
  signatures: signaturePairSchema,
});

export const keyRotationSchema = baseRecordSchema.extend({
  record_type: z.literal('key_rotation'),
  subject_uuid: z.string(),
  old_binding_hash: z.string(),
  new_binding_hash: z.string(),
  rotation_counter: z.number().int().nonnegative(),
  signatures: keyRotationSignaturesSchema,
});

export const revocationSchema = baseRecordSchema.extend({
  record_type: z.literal('revocation'),
  signer_binding_hash: z.string(),
  target_record_hash: z.string(),
  reason_code: revocationReasonCodeSchema,
  signature: z.string(),
});

export const durableRecordSchema = z.discriminatedUnion('record_type', [
  identityBindingSchema,
  endorsementSchema,
  handshakeSchema,
  keyRotationSchema,
  revocationSchema,
]);

export type IdentityBindingRecord = z.infer<typeof identityBindingSchema>;
export type EndorsementRecord = z.infer<typeof endorsementSchema>;
export type HandshakeRecord = z.infer<typeof handshakeSchema>;
export type KeyRotationRecord = z.infer<typeof keyRotationSchema>;
export type RevocationRecord = z.infer<typeof revocationSchema>;
export type DurableRecord = z.infer<typeof durableRecordSchema>;
