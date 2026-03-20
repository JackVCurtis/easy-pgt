import type { DurableRecord } from '@/modules/protocol/records';

import { createMerkleLeaf, deriveLeafHash, deriveRecordHash, sortMerkleLeaves } from '../merkleLeaf';

function makeIdentityBinding(seed: string): DurableRecord {
  return {
    record_version: 1,
    record_type: 'identity_binding',
    subject_uuid: `uuid-${seed}`,
    subject_identity_public_key: `pub-${seed}`,
    key_epoch: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    self_signature: `sig-${seed}`,
  };
}

describe('merkleLeaf helpers', () => {
  it('does not require the Node crypto module to load', () => {
    jest.resetModules();
    jest.doMock('crypto', () => {
      throw new Error('Node crypto is unavailable');
    });

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../merkleLeaf');
    }).not.toThrow();

    jest.dontMock('crypto');
  });

  it('deriveRecordHash is deterministic for the same record', () => {
    const record = makeIdentityBinding('deterministic');

    const first = deriveRecordHash(record);
    const second = deriveRecordHash(record);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deriveLeafHash is deterministic and domain-separated from record hash', () => {
    const recordHash = deriveRecordHash(makeIdentityBinding('leaf-domain'));

    const first = deriveLeafHash(recordHash);
    const second = deriveLeafHash(recordHash);

    expect(first).toBe(second);
    expect(first).not.toBe(recordHash);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('createMerkleLeaf composes recordHash and leafHash correctly', () => {
    const record = makeIdentityBinding('leaf-create');

    const leaf = createMerkleLeaf(record);

    expect(leaf.recordHash).toBe(deriveRecordHash(record));
    expect(leaf.leafHash).toBe(deriveLeafHash(leaf.recordHash));
  });

  it('sortMerkleLeaves sorts by leafHash and uses recordHash tie-breaker', () => {
    const leaves = [
      { recordHash: 'd'.repeat(64), leafHash: 'b'.repeat(64) },
      { recordHash: 'a'.repeat(64), leafHash: 'a'.repeat(64) },
      { recordHash: 'b'.repeat(64), leafHash: 'a'.repeat(64) },
    ];

    const sorted = sortMerkleLeaves(leaves);

    expect(sorted).toEqual([
      { recordHash: 'a'.repeat(64), leafHash: 'a'.repeat(64) },
      { recordHash: 'b'.repeat(64), leafHash: 'a'.repeat(64) },
      { recordHash: 'd'.repeat(64), leafHash: 'b'.repeat(64) },
    ]);
    expect(sorted).not.toBe(leaves);
  });
});
