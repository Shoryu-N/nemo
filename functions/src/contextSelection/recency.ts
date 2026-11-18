import {normalizeBm25Scores, rankCandidatesByBm25} from "./bm25";
import type {
  ContextCandidate,
  ScoredContextCandidate,
} from "./types";

export const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const defaultRecencyParameters = {
  alpha: 0.75,
  halfLifeDays: 7,
} as const;

export type RecencyParameters = {
  alpha: number;
  halfLifeDays: number;
};

export type RecencyRankedCandidate = {
  candidate: ContextCandidate;
  bm25Score: number;
  normalizedBm25Score: number;
  ageDays: number;
  recencyScore: number;
  combinedScore: number;
};

/**
 * Computes reproducible exponential decay from conversation timestamps.
 * Future-dated candidates are treated as age zero. Invalid inputs contribute
 * no recency score instead of producing NaN or Infinity.
 */
export function calculateRecencyScore(
  candidateTimestampMillis: number,
  referenceTimestampMillis: number,
  halfLifeDays: number,
): number {
  if (
    !Number.isFinite(candidateTimestampMillis) ||
    !Number.isFinite(referenceTimestampMillis) ||
    !Number.isFinite(halfLifeDays) ||
    halfLifeDays <= 0
  ) {
    return 0;
  }

  const ageDays = Math.max(
    0,
    (referenceTimestampMillis - candidateTimestampMillis) /
      millisecondsPerDay,
  );

  return 2 ** (-ageDays / halfLifeDays);
}

/**
 * Ranks only with local BM25 and timestamp arithmetic. BM25 remains the
 * relevance gate in the selector, so zero-score messages cannot enter the
 * ranked selection solely because they are recent.
 */
export function rankCandidatesByBm25Recency(
  candidates: ContextCandidate[],
  queryTerms: string[],
  referenceTimestampMillis: number,
  parameters: RecencyParameters = defaultRecencyParameters,
): RecencyRankedCandidate[] {
  const bm25Ranked = rankCandidatesByBm25(candidates, queryTerms);
  const normalizedBm25 = normalizeBm25Scores(bm25Ranked);
  const safeAlpha = isValidAlpha(parameters.alpha) ? parameters.alpha : 1;

  return normalizedBm25
    .map(({candidate, score, normalizedScore}) => {
      const ageDays = calculateAgeDays(
        candidate.createdAtMillis,
        referenceTimestampMillis,
      );
      const recencyScore = calculateRecencyScore(
        candidate.createdAtMillis,
        referenceTimestampMillis,
        parameters.halfLifeDays,
      );

      return {
        candidate,
        bm25Score: score,
        normalizedBm25Score: normalizedScore,
        ageDays,
        recencyScore,
        combinedScore: safeAlpha * normalizedScore +
          (1 - safeAlpha) * recencyScore,
      };
    })
    .sort((left, right) => {
      const leftIsRelevant = left.bm25Score > 0;
      const rightIsRelevant = right.bm25Score > 0;

      if (leftIsRelevant !== rightIsRelevant) {
        return rightIsRelevant ? 1 : -1;
      }

      if (right.combinedScore !== left.combinedScore) {
        return right.combinedScore - left.combinedScore;
      }

      if (right.bm25Score !== left.bm25Score) {
        return right.bm25Score - left.bm25Score;
      }

      if (
        left.candidate.chronologicalIndex !==
        right.candidate.chronologicalIndex
      ) {
        return left.candidate.chronologicalIndex -
          right.candidate.chronologicalIndex;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    });
}

export function toRecencyDiagnostics(
  rankedCandidates: RecencyRankedCandidate[],
  selectedIds: ReadonlySet<string> = new Set(),
): ScoredContextCandidate[] {
  return rankedCandidates.map((candidate, index) => ({
    messageId: candidate.candidate.id,
    score: candidate.combinedScore,
    bm25Score: candidate.bm25Score,
    normalizedBm25Score: candidate.normalizedBm25Score,
    ageDays: candidate.ageDays,
    recencyScore: candidate.recencyScore,
    combinedScore: candidate.combinedScore,
    rankingPosition: index + 1,
    includedInFinalContext: selectedIds.has(candidate.candidate.id),
  }));
}

function calculateAgeDays(
  candidateTimestampMillis: number,
  referenceTimestampMillis: number,
): number {
  if (
    !Number.isFinite(candidateTimestampMillis) ||
    !Number.isFinite(referenceTimestampMillis)
  ) {
    return 0;
  }

  return Math.max(
    0,
    (referenceTimestampMillis - candidateTimestampMillis) /
      millisecondsPerDay,
  );
}

function isValidAlpha(alpha: number): boolean {
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1;
}
