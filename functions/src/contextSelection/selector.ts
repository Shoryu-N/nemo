import {
  rankCandidatesByBm25,
  toScoredDiagnostics,
  tokenize,
} from "./bm25";
import type {
  ContextCandidate,
  ContextSelectionFallback,
  ContextSelectionResult,
  ContextSelectionStrategy,
} from "./types";

export const baselineMessageLimit = 20;
export const bm25CandidateLimit = 100;
export const queryMessageCount = 3;
export const estimatedCharactersPerToken = 4;

/**
 * Selects bounded conversation context without provider-specific behavior.
 */
export function selectConversationContext(
  candidates: ContextCandidate[],
  strategy: ContextSelectionStrategy,
): ContextSelectionResult {
  const chronologicalCandidates = [...candidates].sort(compareChronologically);

  if (strategy === "baseline") {
    return selectBaselineContext(chronologicalCandidates);
  }

  return selectBm25Context(chronologicalCandidates);
}

/**
 * Estimates formatted context size. This is deliberately not described as an
 * exact OpenAI token count.
 */
export function estimateContextTokens(
  candidates: ContextCandidate[],
): number {
  return candidates.reduce((total, candidate) => {
    const formattedLength = candidate.senderName.length +
      candidate.text.length + 3;

    return total + Math.max(
      1,
      Math.ceil(formattedLength / estimatedCharactersPerToken),
    );
  }, 0);
}

function selectBaselineContext(
  chronologicalCandidates: ContextCandidate[],
): ContextSelectionResult {
  const selectedMessages = chronologicalCandidates.slice(-baselineMessageLimit);
  const estimatedTokens = estimateContextTokens(selectedMessages);
  const selectedIds = selectedMessages.map(({id}) => id);

  return {
    selectedMessages,
    estimatedContextTokens: estimatedTokens,
    estimatedBaselineTokens: estimatedTokens,
    diagnostics: {
      candidateMessageIds: chronologicalCandidates.map(({id}) => id),
      rankedCandidates: [],
      selectedMessageIds: selectedIds,
      finalChronologicalMessageIds: selectedIds,
      skippedForBudgetMessageIds: [],
      fallback: "none",
    },
  };
}

function selectBm25Context(
  chronologicalCandidates: ContextCandidate[],
): ContextSelectionResult {
  const baselineMessages = chronologicalCandidates.slice(-baselineMessageLimit);
  const estimatedBaselineTokens = estimateContextTokens(baselineMessages);

  if (chronologicalCandidates.length <= baselineMessageLimit) {
    return buildFallbackResult(
      chronologicalCandidates,
      chronologicalCandidates,
      estimatedBaselineTokens,
      "short_history",
    );
  }

  const anchors = chronologicalCandidates.slice(-queryMessageCount);
  const olderCandidates = chronologicalCandidates.slice(0, -queryMessageCount);
  const queryTerms = tokenize(anchors.map(({text}) => text).join(" "));

  if (queryTerms.length === 0) {
    return buildFallbackResult(
      chronologicalCandidates,
      baselineMessages,
      estimatedBaselineTokens,
      "empty_query",
    );
  }

  const rankedCandidates = rankCandidatesByBm25(
    olderCandidates,
    queryTerms,
  );
  const positiveCandidates = rankedCandidates.filter(({score}) => score > 0);

  if (positiveCandidates.length === 0) {
    return buildFallbackResult(
      chronologicalCandidates,
      baselineMessages,
      estimatedBaselineTokens,
      "no_positive_match",
      toScoredDiagnostics(rankedCandidates),
    );
  }

  const selectedInSelectionOrder = [...anchors];
  const selectedIds = new Set(anchors.map(({id}) => id));
  const skippedForBudgetMessageIds: string[] = [];
  let remainingTokens = Math.max(
    0,
    estimatedBaselineTokens - estimateContextTokens(anchors),
  );

  for (const {candidate} of positiveCandidates) {
    if (selectedInSelectionOrder.length >= baselineMessageLimit) {
      break;
    }

    const candidateTokens = estimateContextTokens([candidate]);

    if (candidateTokens > remainingTokens) {
      skippedForBudgetMessageIds.push(candidate.id);
      continue;
    }

    selectedInSelectionOrder.push(candidate);
    selectedIds.add(candidate.id);
    remainingTokens -= candidateTokens;
  }

  let usedRecentBackfill = false;

  for (const candidate of [...olderCandidates].reverse()) {
    if (selectedInSelectionOrder.length >= baselineMessageLimit) {
      break;
    }

    if (selectedIds.has(candidate.id)) {
      continue;
    }

    const candidateTokens = estimateContextTokens([candidate]);

    if (candidateTokens > remainingTokens) {
      continue;
    }

    selectedInSelectionOrder.push(candidate);
    selectedIds.add(candidate.id);
    remainingTokens -= candidateTokens;
    usedRecentBackfill = true;
  }

  const selectedMessages = [...selectedInSelectionOrder]
    .sort(compareChronologically);

  return {
    selectedMessages,
    estimatedContextTokens: estimateContextTokens(selectedMessages),
    estimatedBaselineTokens,
    diagnostics: {
      candidateMessageIds: chronologicalCandidates.map(({id}) => id),
      rankedCandidates: toScoredDiagnostics(rankedCandidates),
      selectedMessageIds: selectedInSelectionOrder.map(({id}) => id),
      finalChronologicalMessageIds: selectedMessages.map(({id}) => id),
      skippedForBudgetMessageIds,
      fallback: usedRecentBackfill ? "recent_backfill" : "none",
    },
  };
}

function buildFallbackResult(
  allCandidates: ContextCandidate[],
  selectedMessages: ContextCandidate[],
  estimatedBaselineTokens: number,
  fallback: ContextSelectionFallback,
  rankedCandidates:
    ContextSelectionResult["diagnostics"]["rankedCandidates"] = [],
): ContextSelectionResult {
  const selectedIds = selectedMessages.map(({id}) => id);

  return {
    selectedMessages,
    estimatedContextTokens: estimateContextTokens(selectedMessages),
    estimatedBaselineTokens,
    diagnostics: {
      candidateMessageIds: allCandidates.map(({id}) => id),
      rankedCandidates,
      selectedMessageIds: selectedIds,
      finalChronologicalMessageIds: selectedIds,
      skippedForBudgetMessageIds: [],
      fallback,
    },
  };
}

function compareChronologically(
  left: ContextCandidate,
  right: ContextCandidate,
): number {
  if (left.chronologicalIndex !== right.chronologicalIndex) {
    return left.chronologicalIndex - right.chronologicalIndex;
  }

  return left.id.localeCompare(right.id);
}
