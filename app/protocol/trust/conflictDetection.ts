export function addConflictHashes(
  conflictsByBinding: Map<string, Set<string>>,
  bindingHash: string,
  hashes: Iterable<string>
): void {
  const existing = conflictsByBinding.get(bindingHash) ?? new Set<string>();
  for (const hash of hashes) {
    existing.add(hash);
  }
  conflictsByBinding.set(bindingHash, existing);
}
