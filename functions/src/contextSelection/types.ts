import type {ConversationMessage} from "../types";

export type ContextSelectionStrategy = "baseline" | "bm25";

export type ContextCandidate = ConversationMessage & {
  id: string;
  chronologicalIndex: number;
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
