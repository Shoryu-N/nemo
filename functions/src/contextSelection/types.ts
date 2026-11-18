import type {ConversationMessage} from "../types";

export type ContextSelectionStrategy =
  | "baseline"
  | "bm25"
  | "bm25_recency"
  | "bm25_recency_mmr"
  | "bm25_mmr";

export type ContextCandidate = ConversationMessage & {
  id: string;
  chronologicalIndex: number;
  createdAtMillis: number;
};

export type ContextSelectionFallback =
  | "none"
  | "short_history"
  | "empty_query"
  | "no_positive_match"
  | "recent_backfill";

export type ScoredContextCandidate = {
  messageId: string;
  score: number;
  bm25Score?: number;
  normalizedBm25Score?: number;
  ageDays?: number;
  recencyScore?: number;
  combinedScore?: number;
  rankingPosition?: number;
  relevanceScore?: number;
  mmrSelectionIteration?: number;
  mmrEvaluatedAfterIteration?: number;
  maximumSimilarity?: number;
  maximumSimilarityMessageId?: string;
  redundancyPenalty?: number;
  mmrScore?: number;
  includedByMmr?: boolean;
  skippedForBudget?: boolean;
  includedInFinalContext?: boolean;
};

/**
 * Internal diagnostics for deterministic fictional fixtures and local tests.
 * This object must not be returned by the callable or written to production
 * logs because it contains Firestore document identifiers.
 */
export type ContextSelectionDiagnostics = {
  candidateMessageIds: string[];
  rankedCandidates: ScoredContextCandidate[];
  selectedMessageIds: string[];
  finalChronologicalMessageIds: string[];
  skippedForBudgetMessageIds: string[];
  fallback: ContextSelectionFallback;
};

export type ContextSelectionResult = {
  selectedMessages: ContextCandidate[];
  estimatedContextTokens: number;
  estimatedBaselineTokens: number;
  diagnostics: ContextSelectionDiagnostics;
};
