import nacl from 'tweetnacl';

import { validateRecord } from '@/app/protocol/validation/validateRecord';
import { deriveSigningPayloadBytes } from '@/app/protocol/validation/crypto/signingPayload';
import { encodeBase64 } from '@/app/utils/bytes';

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

describe('auditable validation results', () => {
  it('returns accepted for a valid signed record', () => {
    const keyPair = nacl.sign.keyPair();
    const record = {
      record_type: 'identity_binding' as const,
      record_version: 1,
      subject_uuid: 'f66f2b1a-35bc-4d44-b4fd-4a722f99d8e0',
      subject_identity_public_key: toBase64(keyPair.publicKey),
      key_epoch: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      self_signature: '',
    };

    record.self_signature = toBase64(nacl.sign.detached(deriveSigningPayloadBytes(record), keyPair.secretKey));

    expect(validateRecord(record)).toEqual({
      status: 'accepted',
      reason: 'validation_passed',
      details: {
        source: 'record_validation',
      },
    });
  });

  it('returns rejected for malformed payloads', () => {
    const malformed = {
      record_type: 'identity_binding',
      record_version: 1,
      key_epoch: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      self_signature: 'c2ln',
    };

    expect(validateRecord(malformed)).toEqual({
      status: 'rejected',
      phase: 'structural',
      reason: 'missing_field',
      field: 'subject_uuid',
      details: {
        source: 'record_validation',
      },
    });
  });

  it('returns conflicted for semantically conflicting records', () => {
    const keyPair = nacl.sign.keyPair();
    const record = {
      record_type: 'identity_binding' as const,
      record_version: 1,
      subject_uuid: '6f1a6eaf-f6d6-4d8c-a5e0-3ddf2b4531a7',
      subject_identity_public_key: toBase64(keyPair.publicKey),
      key_epoch: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      self_signature: '',
    };

    record.self_signature = toBase64(nacl.sign.detached(deriveSigningPayloadBytes(record), keyPair.secretKey));

    expect(
      validateRecord(record, {
        semantic: {
          localLogState: {
            identityBindingsBySubjectUuid: {
              [record.subject_uuid]: ['another_public_key'],
            },
          },
        },
      })
    ).toEqual({
      status: 'conflicted',
      phase: 'semantic',
      reason: 'conflicting_identity_binding',
      details: {
        source: 'record_validation',
      },
    });
  });

  it('fails safe with rejected status when unexpected exceptions occur', () => {
    const handshake = {
      record_type: 'handshake' as const,
      record_version: 1,
      handshake_uuid: '680a3e96-1f84-4c8b-8b39-b664b1744d43',
      participant_a_binding_hash: 'hash_binding_a',
      participant_b_binding_hash: 'hash_binding_b',
      participant_a_merkle_root: 'hash_a123',
      participant_b_merkle_root: 'hash_b123',
      ephemeral_keys: {
        participant_a: toBase64(nacl.sign.keyPair().publicKey),
        participant_b: toBase64(nacl.sign.keyPair().publicKey),
      },
      signatures: {
        participant_a: toBase64(nacl.randomBytes(64)),
        participant_b: toBase64(nacl.randomBytes(64)),
      },
    };

    const result = validateRecord(handshake, {
      resolvePublicKeyByBindingHash() {
        throw new Error('unexpected failure');
      },
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'validation_failure',
      details: {
        source: 'record_validation',
      },
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
