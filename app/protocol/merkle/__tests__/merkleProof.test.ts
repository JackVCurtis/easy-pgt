import type { MerkleLeaf } from '../merkleLeaf';
import { generateProof, verifyProof } from '../merkleProof';
import { buildMerkleTree } from '../merkleTree';

describe('merkleProof helpers', () => {
  it('generateProof throws for unknown leaves', () => {
    const tree = buildMerkleTree([{ recordHash: 'a'.repeat(64), leafHash: 'b'.repeat(64) }]);

    expect(() => generateProof(tree, 'c'.repeat(64))).toThrow('leaf not found');
  });

  it('generateProof returns empty path for single-leaf trees', () => {
    const leaf: MerkleLeaf = { recordHash: 'a'.repeat(64), leafHash: 'b'.repeat(64) };
    const tree = buildMerkleTree([leaf]);

    const proof = generateProof(tree, leaf.leafHash);

    expect(proof).toEqual({ leafHash: leaf.leafHash, path: [] });
  });

  it('verifyProof accepts valid proof and rejects mismatched leafHash field', () => {
    const leaves: MerkleLeaf[] = [
      { recordHash: 'a'.repeat(64), leafHash: '1'.repeat(64) },
      { recordHash: 'b'.repeat(64), leafHash: '2'.repeat(64) },
      { recordHash: 'c'.repeat(64), leafHash: '3'.repeat(64) },
    ];
    const tree = buildMerkleTree(leaves);

    const proof = generateProof(tree, '2'.repeat(64));

    expect(verifyProof('2'.repeat(64), proof, tree.rootHash)).toBe(true);
    expect(verifyProof('2'.repeat(64), { ...proof, leafHash: 'f'.repeat(64) }, tree.rootHash)).toBe(false);
  });
});
