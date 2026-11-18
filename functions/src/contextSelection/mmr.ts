import type {ContextCandidate} from "./types";
import {
  getSimilarity,
  type SimilarityMatrix,
} from "./similarity";

export const defaultMmrParameters = {
  lambda: 0.7,
} as const;

export type MmrParameters = {
  lambda: number;
};

export type MmrCandidate = {
  candidate: ContextCandidate;
  relevanceScore: number;
};

export type MmrCandidateDiagnostic = {
  messageId: string;
  relevanceScore: number;
  selectionIteration?: number;
  evaluatedAfterIteration: number;
  maximumSimilarity: number;
  maximumSimilarityMessageId?: string;
  redundancyPenalty: number;
  mmrScore: number;
  includedByMmr: boolean;
  skippedForBudget: boolean;
};

export type MmrSelectionResult = {
  selectedCandidates: ContextCandidate[];
  diagnostics: MmrCandidateDiagnostic[];
  skippedForBudgetMessageIds: string[];
  remainingBudget: number;
  lambda: number;
};

export type MmrSelectionConstraints = {
  maximumSelections: number;
  tokenBudget: number;
  estimateTokens: (candidate: ContextCandidate) => number;
};

/**
 * Performs greedy MMR set selection. Similarity is measured only against
 * previously selected historical messages; mandatory recent anchors are not
 * part of this function or its redundancy penalty.
 */
export function selectCandidatesWithMmr(
  rankedCandidates: MmrCandidate[],
  similarityMatrix: SimilarityMatrix,
  constraints: MmrSelectionConstraints,
  parameters: MmrParameters = defaultMmrParameters,
): MmrSelectionResult {
  const lambda = isValidLambda(parameters.lambda) ?
    parameters.lambda : defaultMmrParameters.lambda;
  const uniqueCandidates = deduplicateCandidates(rankedCandidates);
  const remaining = [...uniqueCandidates];
  const selected: MmrCandidate[] = [];
  const selectedDiagnostics: MmrCandidateDiagnostic[] = [];
  const skippedForBudget = new Set<string>();
  let remainingBudget = Math.max(0, constraints.tokenBudget);

  while (
    remaining.length > 0 &&
    selected.length < Math.max(0, constraints.maximumSelections)
  ) {
    const fittingCandidates = remaining.filter(({candidate}) => {
      const fits = constraints.estimateTokens(candidate) <= remainingBudget;

      if (!fits) {
        skippedForBudget.add(candidate.id);
      }

      return fits;
    });

    if (fittingCandidates.length === 0) {
      break;
    }

    const scoredCandidates = fittingCandidates.map((candidate) => (
      scoreCandidate(candidate, selected, similarityMatrix, lambda)
    ));
    const selectedDiagnostic = scoredCandidates.reduce((best, current) => {
      const bestIndex = uniqueCandidates.indexOf(best.candidate);
      const currentIndex = uniqueCandidates.indexOf(current.candidate);

      if (current.diagnostic.mmrScore > best.diagnostic.mmrScore) {
        return current;
      }

      if (
        current.diagnostic.mmrScore === best.diagnostic.mmrScore &&
        currentIndex < bestIndex
      ) {
        return current;
      }

      return best;
    });
    const selectionIteration = selected.length + 1;

    selected.push(selectedDiagnostic.candidate);
    selectedDiagnostics.push({
      ...selectedDiagnostic.diagnostic,
      selectionIteration,
      evaluatedAfterIteration: selectionIteration - 1,
      includedByMmr: true,
    });
    remainingBudget -= constraints.estimateTokens(
      selectedDiagnostic.candidate.candidate,
    );
    remaining.splice(
      remaining.indexOf(selectedDiagnostic.candidate),
      1,
    );
  }

  const selectedIds = new Set(
    selected.map(({candidate}) => candidate.id),
  );
  const finalDiagnostics = uniqueCandidates
    .filter(({candidate}) => !selectedIds.has(candidate.id))
    .map((candidate) => ({
      ...scoreCandidate(
        candidate,
        selected,
        similarityMatrix,
        lambda,
      ).diagnostic,
      evaluatedAfterIteration: selected.length,
      includedByMmr: false,
      skippedForBudget: skippedForBudget.has(candidate.candidate.id),
    }));

  return {
    selectedCandidates: selected.map(({candidate}) => candidate),
    diagnostics: [...selectedDiagnostics, ...finalDiagnostics],
    skippedForBudgetMessageIds: [...skippedForBudget],
    remainingBudget,
    lambda,
  };
}

function scoreCandidate(
  candidate: MmrCandidate,
  selectedCandidates: MmrCandidate[],
  similarityMatrix: SimilarityMatrix,
  lambda: number,
) {
  let maximumSimilarity = 0;
  let maximumSimilarityMessageId: string | undefined;

  for (const selected of selectedCandidates) {
    const similarity = getSimilarity(
      similarityMatrix,
      candidate.candidate.id,
      selected.candidate.id,
    );

    if (similarity > maximumSimilarity) {
      maximumSimilarity = similarity;
      maximumSimilarityMessageId = selected.candidate.id;
    }
  }

  const redundancyPenalty = (1 - lambda) * maximumSimilarity;

  return {
    candidate,
    diagnostic: {
      messageId: candidate.candidate.id,
      relevanceScore: candidate.relevanceScore,
      evaluatedAfterIteration: selectedCandidates.length,
      maximumSimilarity,
      maximumSimilarityMessageId,
      redundancyPenalty,
      mmrScore: lambda * candidate.relevanceScore - redundancyPenalty,
      includedByMmr: false,
      skippedForBudget: false,
    } satisfies MmrCandidateDiagnostic,
  };
}

function deduplicateCandidates(
  candidates: MmrCandidate[],
): MmrCandidate[] {
  const seenIds = new Set<string>();

  return candidates.filter(({candidate}) => {
    if (seenIds.has(candidate.id)) {
      return false;
    }

    seenIds.add(candidate.id);
    return true;
  });
}

function isValidLambda(lambda: number): boolean {
  return Number.isFinite(lambda) && lambda >= 0 && lambda <= 1;
}
