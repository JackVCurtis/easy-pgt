import type { EndorsementRecord } from '@/app/protocol/records';

import { buildTrustIndexes, deriveRecordHash } from './trustIndexes';
import type {
  EndorsementContribution,
  EndorsementSummary,
  TrustResolutionInput,
  TrustResolutionResult,
  TrustState,
} from './trustStateTypes';

const ENDORSEMENT_WEIGHT_TABLE = {
  binding_valid: {
    low: 1,
    medium: 2,
    high: 3,
  },
  binding_invalid: {
    low: -1,
    medium: -2,
    high: -3,
  },
} as const;

const TENTATIVE_SCORE_THRESHOLD = 1;
const VERIFIED_SCORE_THRESHOLD = 3;

function sortEvidence(hashes: Iterable<string>): string[] {
  return [...new Set(hashes)].sort();
}

function summarizeEndorsements(endorsements: EndorsementRecord[]): EndorsementSummary {
  const uniqueByHash = new Map<string, EndorsementRecord>();

  for (const endorsement of endorsements) {
    const endorsementHash = deriveRecordHash(endorsement);
    if (!uniqueByHash.has(endorsementHash)) {
      uniqueByHash.set(endorsementHash, endorsement);
    }
  }

  const hashedEndorsements = [...uniqueByHash.entries()].sort(([left], [right]) => left.localeCompare(right));

  const contributions: EndorsementContribution[] = hashedEndorsements.map(([endorsementHash, endorsement]) => ({
    endorsementHash,
    endorserBindingHash: endorsement.endorser_binding_hash,
    endorsementType: endorsement.endorsement_type,
    confidenceLevel: endorsement.confidence_level,
    weight: ENDORSEMENT_WEIGHT_TABLE[endorsement.endorsement_type][endorsement.confidence_level],
  }));

  const positiveScore = contributions
    .filter((contribution) => contribution.weight > 0)
    .reduce((total, contribution) => total + contribution.weight, 0);
  const negativeScore = contributions
    .filter((contribution) => contribution.weight < 0)
    .reduce((total, contribution) => total + Math.abs(contribution.weight), 0);

  return {
    positiveScore,
    negativeScore,
    netScore: positiveScore - negativeScore,
    endorsementHashes: contributions.map((contribution) => contribution.endorsementHash),
    contributions,
  };
}

function resolveSupportState(endorsementSummary: EndorsementSummary): TrustState {
  if (endorsementSummary.netScore >= VERIFIED_SCORE_THRESHOLD) {
    return 'VERIFIED';
  }

  if (endorsementSummary.netScore >= TENTATIVE_SCORE_THRESHOLD) {
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
    const endorsementSummary = summarizeEndorsements(endorsements);

    const evidence = {
      endorsements: sortEvidence(endorsementSummary.endorsementHashes),
      revocations: sortEvidence(revocations.map((revocation) => deriveRecordHash(revocation))),
      conflicts: sortEvidence(conflicts),
      endorsementSummary: {
        ...endorsementSummary,
        endorsementHashes: [...endorsementSummary.endorsementHashes],
        contributions: [...endorsementSummary.contributions],
      },
    };

    const subjectUuid = indexes.bindingsByHash.get(bindingHash)?.subject_uuid;
    const activeBindingHash = subjectUuid ? indexes.activeBindingBySubject.get(subjectUuid) : undefined;
    const isActiveBinding = activeBindingHash === bindingHash;

    const trustState: TrustState =
      revocations.length > 0
        ? 'REVOKED'
        : conflicts.length > 0
          ? 'CONFLICTED'
          : isActiveBinding
            ? resolveSupportState(endorsementSummary)
            : 'CLAIMED';

    return {
      bindingHash,
      trustState,
      evidence: {
        endorsements: evidence.endorsements,
        revocations: evidence.revocations,
        conflicts: evidence.conflicts,
        endorsementSummary: evidence.endorsementSummary,
      },
    };
  });
}

export { ENDORSEMENT_WEIGHT_TABLE, TENTATIVE_SCORE_THRESHOLD, VERIFIED_SCORE_THRESHOLD };
