// Project-local editorial infrastructure; never import this into browser code.
export interface KeywordRecord {
  query: string; cluster: string; intent: string; funnelStage: string; targetTool?: string;
  proposedContentType?: string; proposedSlug?: string; currentSoraFilesURL?: string;
  impressions?: number | null; clicks?: number | null; CTR?: number | null; averagePosition?: number | null;
  externalVolume?: number | null; externalDifficulty?: number | null;
  priority?: string; status: string; notes?: string; lastReviewed?: string;
}
export const keywordRegistry: KeywordRecord[] = [];
export interface ContentBrief {
  primaryQuery: string; searchIntent: string; userProblem: string; targetReader: string; targetTool?: string;
  existingSoraFilesPages: string[]; cannibalizationCheck: string; keyQuestions: string[];
  firstPartyEvidenceNeeded: string[]; externalEvidenceNeeded: string[]; proposedOutline: string[];
  internalLinks: string[]; differentiation: string; CTA: string; claimsRequiringVerification: string[];
}
export const contentBriefs: ContentBrief[] = [];
