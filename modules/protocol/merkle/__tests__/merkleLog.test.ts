import type { DurableRecord } from '@/modules/protocol/records';

import { ValidationStatus } from '../../validation';
import { diffTrees } from '../merkleDiff';
import { createMerkleLeaf } from '../merkleLeaf';
import { MerkleLog } from '../merkleLog';
import { verifyProof } from '../merkleProof';

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

describe('MerkleLog determinism and append behavior', () => {
  const acceptedValidator = () => ({ status: 'accepted' as ValidationStatus, reason: 'validation_passed' as const });

  it('produces identical roots for equal record sets inserted in different orders', () => {
    const records = [makeIdentityBinding('a'), makeIdentityBinding('b'), makeIdentityBinding('c')];

    const left = new MerkleLog({ validate: acceptedValidator });
    left.appendRecord(records[0]);
    left.appendRecord(records[1]);
    left.appendRecord(records[2]);

    const right = new MerkleLog({ validate: acceptedValidator });
    right.appendRecord(records[2]);
    right.appendRecord(records[0]);
    right.appendRecord(records[1]);

    expect(left.getRoot()).toBe(right.getRoot());
    expect(left.getLeafHashes()).toEqual(right.getLeafHashes());
  });

  it('rejects non-accepted validation results and leaves state unchanged', () => {
    const log = new MerkleLog({
      validate: () => ({ status: 'rejected', reason: 'invalid_signature' as const }),
    });

    expect(() => log.appendRecord(makeIdentityBinding('bad'))).toThrow('only accepted records may be appended');
    expect(log.getLeafCount()).toBe(0);
    expect(log.getRoot()).toBe('');
  });

  it('ignores duplicate record replay without changing root', () => {
    const log = new MerkleLog({ validate: acceptedValidator });
    const record = makeIdentityBinding('dup');

    log.appendRecord(record);
    const rootBeforeReplay = log.getRoot();

    log.appendRecord(record);

    expect(log.getLeafCount()).toBe(1);
    expect(log.getRoot()).toBe(rootBeforeReplay);
  });
});

describe('Merkle proofs', () => {
  const acceptedValidator = () => ({ status: 'accepted' as ValidationStatus, reason: 'validation_passed' as const });

  it('verifies valid proofs and rejects tampered proof, leaf, and root', () => {
    const records = [makeIdentityBinding('p1'), makeIdentityBinding('p2'), makeIdentityBinding('p3')];
    const log = new MerkleLog({ validate: acceptedValidator });
    records.forEach((record) => log.appendRecord(record));

    const targetLeaf = createMerkleLeaf(records[1]).leafHash;
    const proof = log.generateProof(targetLeaf);

    expect(verifyProof(targetLeaf, proof, log.getRoot())).toBe(true);

    const tamperedPath = {
      ...proof,
      path: [{ ...proof.path[0], siblingHash: proof.path[0].siblingHash.split('').reverse().join('') }, ...proof.path.slice(1)],
    };
    expect(verifyProof(targetLeaf, tamperedPath, log.getRoot())).toBe(false);

    const alteredLeaf = targetLeaf.split('').reverse().join('');
    expect(verifyProof(alteredLeaf, proof, log.getRoot())).toBe(false);

    const alteredRoot = log.getRoot().split('').reverse().join('');
    expect(verifyProof(targetLeaf, proof, alteredRoot)).toBe(false);
  });
});

describe('Merkle subtree diff', () => {
  const acceptedValidator = () => ({ status: 'accepted' as ValidationStatus, reason: 'validation_passed' as const });

  it('detects missing leaves deterministically for divergent logs', () => {
    const common = [makeIdentityBinding('d1'), makeIdentityBinding('d2')];
    const remoteOnly = [makeIdentityBinding('d3'), makeIdentityBinding('d4')];

    const local = new MerkleLog({ validate: acceptedValidator });
    common.forEach((record) => local.appendRecord(record));

    const remote = new MerkleLog({ validate: acceptedValidator });
    [...common, ...remoteOnly].forEach((record) => remote.appendRecord(record));

    const diff = diffTrees(local.exportTree(), remote.exportTree());
    const expectedMissing = remoteOnly.map((record) => createMerkleLeaf(record).leafHash).sort();

    expect(diff.missingLeaves).toEqual(expectedMissing);
  });
});
