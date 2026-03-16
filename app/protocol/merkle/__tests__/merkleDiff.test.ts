import type { MerkleLeaf } from '../merkleLeaf';
import { diffTrees } from '../merkleDiff';
import { buildMerkleTree } from '../merkleTree';

describe('diffTrees', () => {
  function leaf(char: string): MerkleLeaf {
    return { recordHash: char.repeat(64), leafHash: char.repeat(64) };
  }

  it('returns no missing leaves when remote tree is empty', () => {
    const local = buildMerkleTree([leaf('a')]);
    const remote = buildMerkleTree([]);

    expect(diffTrees(local, remote)).toEqual({ missingLeaves: [] });
  });

  it('returns no missing leaves when trees match exactly', () => {
    const leaves = [leaf('a'), leaf('b'), leaf('c')];
    const local = buildMerkleTree(leaves);
    const remote = buildMerkleTree(leaves);

    expect(diffTrees(local, remote)).toEqual({ missingLeaves: [] });
  });

  it('returns sorted unique missing leaves for divergent trees', () => {
    const local = buildMerkleTree([leaf('a'), leaf('b')]);
    const remote = buildMerkleTree([leaf('a'), leaf('b'), leaf('d'), leaf('c'), leaf('d')]);

    expect(diffTrees(local, remote)).toEqual({ missingLeaves: ['c'.repeat(64), 'd'.repeat(64)] });
  });
});
