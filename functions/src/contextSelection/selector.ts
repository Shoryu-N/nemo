import {
  normalizeBm25Scores,
  rankCandidatesByBm25,
  toScoredDiagnostics,
  tokenize,
  type NormalizedBm25Candidate,
  type RankedCandidate,
} from "./bm25";
import {
  defaultMmrParameters,
  selectCandidatesWithMmr,
  type MmrCandidateDiagnostic,
  type MmrParameters,
} from "./mmr";
import {
  defaultRecencyParameters,
  rankCandidatesByBm25Recency,
  toRecencyDiagnostics,
  type RecencyParameters,
} from "./recency";
import {buildSimilarityMatrix} from "./similarity";
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

export type ContextSelectionOptions = {
  recencyParameters?: RecencyParameters;
  mmrParameters?: MmrParameters;
};

/**
 * Selects bounded conversation context without provider-specific behavior.
 */
export function selectConversationContext(
  candidates: ContextCandidate[],
  strategy: ContextSelectionStrategy,
  options: ContextSelectionOptions = {},
): ContextSelectionResult {
  const chronologicalCandidates = [...candidates].sort(compareChronologically);

  if (strategy === "baseline") {
    return selectBaselineContext(chronologicalCandidates);
  }

  return selectBm25Context(
    chronologicalCandidates,
    strategy,
    options.recencyParameters ?? defaultRecencyParameters,
    options.mmrParameters ?? defaultMmrParameters,
  );
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
  strategy: Exclude<ContextSelectionStrategy, "baseline">,
  recencyParameters: RecencyParameters,
  mmrParameters: MmrParameters,
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

  const isRecencyStrategy = strategy === "bm25_recency" ||
    strategy === "bm25_recency_mmr";
  const isMmrStrategy = strategy === "bm25_recency_mmr" ||
    strategy === "bm25_mmr";
  const bm25RankedCandidates = isRecencyStrategy ? [] : rankCandidatesByBm25(
    olderCandidates,
    queryTerms,
  );
  const recencyRankedCandidates = isRecencyStrategy ?
    rankCandidatesByBm25Recency(
      olderCandidates,
      queryTerms,
      chronologicalCandidates[chronologicalCandidates.length - 1]
        ?.createdAtMillis ?? Number.NaN,
      recencyParameters,
    ) : [];
  const positiveCandidates = isRecencyStrategy ?
    recencyRankedCandidates
      .filter(({bm25Score}) => bm25Score > 0)
      .map(({candidate}) => candidate) :
    bm25RankedCandidates
      .filter(({score}) => score > 0)
      .map(({candidate}) => candidate);

  if (positiveCandidates.length === 0) {
    return buildFallbackResult(
      chronologicalCandidates,
      baselineMessages,
      estimatedBaselineTokens,
      "no_positive_match",
      isRecencyStrategy ?
        toRecencyDiagnostics(
          recencyRankedCandidates,
          new Set(baselineMessages.map(({id}) => id)),
        ) :
        toScoredDiagnostics(bm25RankedCandidates),
    );
  }

  if (isMmrStrategy) {
    return selectMmrContext({
      chronologicalCandidates,
      olderCandidates,
      anchors,
      estimatedBaselineTokens,
      bm25RankedCandidates,
      recencyRankedCandidates,
      isRecencyStrategy,
      mmrParameters,
    });
  }

  const selectedInSelectionOrder = [...anchors];
  const selectedIds = new Set(anchors.map(({id}) => id));
  const skippedForBudgetMessageIds: string[] = [];
  let remainingTokens = Math.max(
    0,
    estimatedBaselineTokens - estimateContextTokens(anchors),
  );

  for (const candidate of positiveCandidates) {
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
      rankedCandidates: isRecencyStrategy ?
        toRecencyDiagnostics(recencyRankedCandidates, selectedIds) :
        toScoredDiagnostics(bm25RankedCandidates),
      selectedMessageIds: selectedInSelectionOrder.map(({id}) => id),
      finalChronologicalMessageIds: selectedMessages.map(({id}) => id),
      skippedForBudgetMessageIds,
      fallback: usedRecentBackfill ? "recent_backfill" : "none",
    },
  };
}

type MmrContextInput = {
  chronologicalCandidates: ContextCandidate[];
  olderCandidates: ContextCandidate[];
  anchors: ContextCandidate[];
  estimatedBaselineTokens: number;
  bm25RankedCandidates: RankedCandidate[];
  recencyRankedCandidates: ReturnType<
    typeof rankCandidatesByBm25Recency
  >;
  isRecencyStrategy: boolean;
  mmrParameters: MmrParameters;
};

function selectMmrContext({
  chronologicalCandidates,
  olderCandidates,
  anchors,
  estimatedBaselineTokens,
  bm25RankedCandidates,
  recencyRankedCandidates,
  isRecencyStrategy,
  mmrParameters,
}: MmrContextInput): ContextSelectionResult {
  const normalizedBm25Candidates = isRecencyStrategy ? [] :
    normalizeBm25Scores(bm25RankedCandidates);
  const mmrCandidates = isRecencyStrategy ?
    recencyRankedCandidates
      .filter(({bm25Score}) => bm25Score > 0)
      .map(({candidate, combinedScore}) => ({
        candidate,
        relevanceScore: combinedScore,
      })) :
    normalizedBm25Candidates
      .filter(({score}) => score > 0)
      .map(({candidate, normalizedScore}) => ({
        candidate,
        relevanceScore: normalizedScore,
      }));
  const similarityMatrix = buildSimilarityMatrix(
    olderCandidates.map(({id, text}) => ({id, text})),
  );
  const anchorTokens = estimateContextTokens(anchors);
  const mmrSelection = selectCandidatesWithMmr(
    mmrCandidates,
    similarityMatrix,
    {
      maximumSelections: Math.max(
        0,
        baselineMessageLimit - anchors.length,
      ),
      tokenBudget: Math.max(
        0,
        estimatedBaselineTokens - anchorTokens,
      ),
      estimateTokens: (candidate) => estimateContextTokens([candidate]),
    },
    mmrParameters,
  );
  const selectedInSelectionOrder = [
    ...anchors,
    ...mmrSelection.selectedCandidates,
  ];
  const selectedIds = new Set(
    selectedInSelectionOrder.map(({id}) => id),
  );
  let remainingTokens = mmrSelection.remainingBudget;
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
  const diagnostics = buildMmrDiagnostics(
    isRecencyStrategy,
    normalizedBm25Candidates,
    recencyRankedCandidates,
    mmrSelection.diagnostics,
    selectedIds,
  );

  return {
    selectedMessages,
    estimatedContextTokens: estimateContextTokens(selectedMessages),
    estimatedBaselineTokens,
    diagnostics: {
      candidateMessageIds: chronologicalCandidates.map(({id}) => id),
      rankedCandidates: diagnostics,
      selectedMessageIds: selectedInSelectionOrder.map(({id}) => id),
      finalChronologicalMessageIds: selectedMessages.map(({id}) => id),
      skippedForBudgetMessageIds:
        mmrSelection.skippedForBudgetMessageIds,
      fallback: usedRecentBackfill ? "recent_backfill" : "none",
    },
  };
}

function buildMmrDiagnostics(
  isRecencyStrategy: boolean,
  normalizedBm25Candidates: NormalizedBm25Candidate[],
  recencyRankedCandidates: ReturnType<typeof rankCandidatesByBm25Recency>,
  mmrDiagnostics: MmrCandidateDiagnostic[],
  selectedIds: ReadonlySet<string>,
) {
  const mmrById = new Map(
    mmrDiagnostics.map((diagnostic) => [diagnostic.messageId, diagnostic]),
  );

  if (isRecencyStrategy) {
    return recencyRankedCandidates.map((rankedCandidate, index) => {
      const mmr = mmrById.get(rankedCandidate.candidate.id);

      return {
        messageId: rankedCandidate.candidate.id,
        score: mmr?.mmrScore ?? rankedCandidate.combinedScore,
        bm25Score: rankedCandidate.bm25Score,
        normalizedBm25Score: rankedCandidate.normalizedBm25Score,
        ageDays: rankedCandidate.ageDays,
        recencyScore: rankedCandidate.recencyScore,
        combinedScore: rankedCandidate.combinedScore,
        rankingPosition: index + 1,
        ...toMmrDiagnosticFields(mmr),
        includedInFinalContext: selectedIds.has(
          rankedCandidate.candidate.id,
        ),
      };
    });
  }

  return normalizedBm25Candidates.map((rankedCandidate, index) => {
    const mmr = mmrById.get(rankedCandidate.candidate.id);

    return {
      messageId: rankedCandidate.candidate.id,
      score: mmr?.mmrScore ?? rankedCandidate.normalizedScore,
      bm25Score: rankedCandidate.score,
      normalizedBm25Score: rankedCandidate.normalizedScore,
      rankingPosition: index + 1,
      ...toMmrDiagnosticFields(mmr),
      includedInFinalContext: selectedIds.has(rankedCandidate.candidate.id),
    };
  });
}

function toMmrDiagnosticFields(
  diagnostic: MmrCandidateDiagnostic | undefined,
) {
  if (!diagnostic) {
    return {};
  }

  return {
    relevanceScore: diagnostic.relevanceScore,
    mmrSelectionIteration: diagnostic.selectionIteration,
    mmrEvaluatedAfterIteration: diagnostic.evaluatedAfterIteration,
    maximumSimilarity: diagnostic.maximumSimilarity,
    maximumSimilarityMessageId: diagnostic.maximumSimilarityMessageId,
    redundancyPenalty: diagnostic.redundancyPenalty,
    mmrScore: diagnostic.mmrScore,
    includedByMmr: diagnostic.includedByMmr,
    skippedForBudget: diagnostic.skippedForBudget,
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
