import type { DurableRecord, EndorsementRecord } from '@/app/protocol/records';

export type TrustState = 'CLAIMED' | 'TENTATIVE' | 'VERIFIED' | 'CONFLICTED' | 'REVOKED';

export type EndorsementWeigher = (endorsement: EndorsementRecord) => number;

export interface TrustResolutionPolicy {
  endorsementWeigher: EndorsementWeigher;
  tentativeScoreThreshold: number;
  verifiedScoreThreshold: number;
}

export interface TrustResolutionInput {
  validatedRecords: DurableRecord[];
  policy?: Partial<TrustResolutionPolicy>;
}

export interface EndorsementContribution {
  endorsementHash: string;
  endorserBindingHash: string;
  endorsementType: 'binding_valid' | 'binding_invalid';
  localPolicyWeight: number;
}

export interface EndorsementSummary {
  positiveScore: number;
  negativeScore: number;
  netScore: number;
  endorsementHashes: string[];
  contributions: EndorsementContribution[];
}

export interface TrustResolutionResult {
  bindingHash: string;
  trustState: TrustState;
  evidence: {
    endorsements: string[];
    revocations: string[];
    conflicts: string[];
    endorsementSummary: EndorsementSummary;
  };
}
