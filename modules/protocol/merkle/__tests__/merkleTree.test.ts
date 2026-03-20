import { createHash } from 'crypto';

import { hexToBytes } from '@/modules/utils/bytes';

import type { MerkleLeaf } from '../merkleLeaf';
import { buildMerkleTree } from '../merkleTree';

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(hexToBytes(left)).update(hexToBytes(right)).digest('hex');
}

describe('buildMerkleTree', () => {
  it('returns empty tree for empty leaf input', () => {
    const tree = buildMerkleTree([]);

    expect(tree).toEqual({ leaves: [], rootHash: '', levels: [] });
  });

  it('sorts leaves before building levels', () => {
    const leaves: MerkleLeaf[] = [
      { recordHash: '1'.repeat(64), leafHash: 'f'.repeat(64) },
      { recordHash: '2'.repeat(64), leafHash: '0'.repeat(64) },
    ];

    const tree = buildMerkleTree(leaves);

    expect(tree.leaves.map((leaf) => leaf.leafHash)).toEqual(['0'.repeat(64), 'f'.repeat(64)]);
    expect(tree.levels[0]).toEqual(['0'.repeat(64), 'f'.repeat(64)]);
  });

  it('duplicates last node on odd levels and computes root deterministically', () => {
    const l1 = '1'.repeat(64);
    const l2 = '2'.repeat(64);
    const l3 = '3'.repeat(64);

    const tree = buildMerkleTree([
      { recordHash: 'a'.repeat(64), leafHash: l1 },
      { recordHash: 'b'.repeat(64), leafHash: l2 },
      { recordHash: 'c'.repeat(64), leafHash: l3 },
    ]);

    const parent1 = hashPair(l1, l2);
    const parent2 = hashPair(l3, l3);
    const expectedRoot = hashPair(parent1, parent2);

    expect(tree.levels[1]).toEqual([parent1, parent2]);
    expect(tree.rootHash).toBe(expectedRoot);
  });
});
