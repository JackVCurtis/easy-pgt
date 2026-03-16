import type { EndorsementRecord } from '@/app/protocol/records';

import { buildTrustIndexes, deriveRecordHash } from './trustIndexes';
import type { TrustResolutionInput, TrustResolutionResult, TrustState } from './trustStateTypes';

function sortEvidence(hashes: string[] | undefined): string[] | undefined {
  if (!hashes || hashes.length === 0) {
    return undefined;
  }

  return [...hashes].sort();
}

function resolveSupportState(endorsements: EndorsementRecord[]): TrustState {
  if (endorsements.some((endorsement) => endorsement.confidence_level === 'high')) {
    return 'VERIFIED';
  }

  if (endorsements.some((endorsement) => endorsement.confidence_level === 'medium' || endorsement.confidence_level === 'low')) {
    return 'TENTATIVE';
  }

  return 'CLAIMED';
}

export function resolveTrustStates(input: TrustResolutionInput): TrustResolutionResult[] {
  const indexes = buildTrustIndexes(input.validatedRecords);

  return indexes.bindingOrder.map((bindingHash) => {
    const endorsements = indexes.endorsementsByBinding.get(bindingHash) ?? [];
    const revocations = indexes.revocationsByBinding.get(bindingHash) ?? [];
    const directConflicts = indexes.conflictsByBinding.get(bindingHash);
    const conflicts = directConflicts ? [...directConflicts] : [];

    const evidence = {
      endorsements: sortEvidence(endorsements.map((endorsement) => deriveRecordHash(endorsement))),
      revocations: sortEvidence(revocations.map((revocation) => deriveRecordHash(revocation))),
      conflicts: sortEvidence(conflicts),
    };

    const trustState: TrustState =
      revocations.length > 0
        ? 'REVOKED'
        : conflicts.length > 0
          ? 'CONFLICTED'
          : resolveSupportState(endorsements);

    return {
      bindingHash,
      trustState,
      evidence: {
        ...(evidence.endorsements ? { endorsements: evidence.endorsements } : {}),
        ...(evidence.revocations ? { revocations: evidence.revocations } : {}),
        ...(evidence.conflicts ? { conflicts: evidence.conflicts } : {}),
      },
    };
  });
}
