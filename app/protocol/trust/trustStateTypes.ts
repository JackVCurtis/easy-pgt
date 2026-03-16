import type { DurableRecord } from '@/app/protocol/records';

export type TrustState = 'CLAIMED' | 'TENTATIVE' | 'VERIFIED' | 'CONFLICTED' | 'REVOKED';

export interface TrustResolutionInput {
  validatedRecords: DurableRecord[];
}

export interface TrustResolutionResult {
  bindingHash: string;
  trustState: TrustState;
  evidence: {
    endorsements?: string[];
    revocations?: string[];
    conflicts?: string[];
  };
}
