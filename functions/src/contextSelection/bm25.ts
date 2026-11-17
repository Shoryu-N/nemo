import type {
  ContextCandidate,
  ScoredContextCandidate,
} from "./types";

export const defaultBm25Parameters = {
  k1: 1.2,
  b: 0.75,
} as const;

type Bm25Parameters = {
  k1: number;
  b: number;
};

type RankedCandidate = {
  candidate: ContextCandidate;
  score: number;
};

const tokenPattern = new RegExp("[\\p{L}\\p{N}]+", "gu");

/**
 * Performs dependency-free lexical normalization for the BM25 prototype.
 */
export function tokenize(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().match(tokenPattern) ?? [];
}

/**
 * Computes the positive Robertson/Sparck Jones inverse document frequency.
 */
export function calculateInverseDocumentFrequency(
  documentCount: number,
  documentFrequency: number,
): number {
  if (documentCount <= 0 || documentFrequency <= 0) {
    return 0;
  }

  return Math.log(
    1 + (documentCount - documentFrequency + 0.5) /
      (documentFrequency + 0.5),
  );
}

/**
 * Scores one tokenized document against unique query terms.
 */
export function calculateBm25Score(
  documentTokens: string[],
  queryTerms: string[],
  corpusTokens: string[][],
  parameters: Bm25Parameters = defaultBm25Parameters,
): number {
  if (
    documentTokens.length === 0 ||
    queryTerms.length === 0 ||
    corpusTokens.length === 0
  ) {
    return 0;
  }

  const averageDocumentLength = corpusTokens.reduce(
    (total, tokens) => total + tokens.length,
    0,
  ) / corpusTokens.length;

  if (averageDocumentLength === 0) {
    return 0;
  }

  const termFrequencies = countTerms(documentTokens);
  const uniqueQueryTerms = [...new Set(queryTerms)];

  return uniqueQueryTerms.reduce((score, term) => {
    const termFrequency = termFrequencies.get(term) ?? 0;

    if (termFrequency === 0) {
      return score;
    }

    const documentFrequency = corpusTokens.reduce(
      (count, tokens) => count + (tokens.includes(term) ? 1 : 0),
      0,
    );
    const inverseDocumentFrequency = calculateInverseDocumentFrequency(
      corpusTokens.length,
      documentFrequency,
    );
    const lengthNormalization = parameters.k1 * (
      1 - parameters.b +
      parameters.b * documentTokens.length / averageDocumentLength
    );
    const termScore = inverseDocumentFrequency * (
      termFrequency * (parameters.k1 + 1)
    ) / (termFrequency + lengthNormalization);

    return score + termScore;
  }, 0);
}

/**
 * Ranks candidates by BM25 without adding a recency score.
 */
export function rankCandidatesByBm25(
  candidates: ContextCandidate[],
  queryTerms: string[],
): RankedCandidate[] {
  const tokenizedCandidates = candidates.map((candidate) => ({
    candidate,
    tokens: tokenize(candidate.text),
  }));
  const corpusTokens = tokenizedCandidates.map(({tokens}) => tokens);

  return tokenizedCandidates
    .map(({candidate, tokens}) => ({
      candidate,
      score: calculateBm25Score(tokens, queryTerms, corpusTokens),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
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

/**
 * Removes candidate message bodies from diagnostics.
 */
export function toScoredDiagnostics(
  rankedCandidates: RankedCandidate[],
): ScoredContextCandidate[] {
  return rankedCandidates.map(({candidate, score}) => ({
    messageId: candidate.id,
    score,
  }));
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}
