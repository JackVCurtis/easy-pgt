import type { DurableRecord } from '@/app/protocol/records';

export type TrustState = 'CLAIMED' | 'TENTATIVE' | 'VERIFIED' | 'CONFLICTED' | 'REVOKED';

export interface TrustResolutionInput {
  validatedRecords: DurableRecord[];
}

export interface EndorsementContribution {
  endorsementHash: string;
  endorserBindingHash: string;
  endorsementType: 'binding_valid' | 'binding_invalid';
  confidenceLevel: 'low' | 'medium' | 'high';
  weight: number;
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
