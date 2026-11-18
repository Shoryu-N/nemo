import {describe, expect, it} from "vitest";
import {selectConversationContext} from "../../src/contextSelection/selector";
import {
  buildSimilarityMatrix,
  getSimilarity,
} from "../../src/contextSelection/similarity";
import type {
  ContextCandidate,
  ContextSelectionDiagnostics,
  ContextSelectionResult,
  ContextSelectionStrategy,
} from
  "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
  mmrComparisonFixture,
  mmrFixtureMetadata,
  recencyComparisonFixture,
} from "../fixtures/contextSelectionFixtures";

const showDiagnostics = process.env.SHOW_CONTEXT_DIAGNOSTICS === "true";

describe("fictional context-selection diagnostics", () => {
  it("exposes positive-fixture ranking and selection details", () => {
    const result = selectConversationContext(lexicalMatchFixture, "bm25");

    printDiagnostics("lexical-match", result.diagnostics);

    expect(result.diagnostics.candidateMessageIds)
      .toHaveLength(lexicalMatchFixture.length);
    expect(result.diagnostics.rankedCandidates.length).toBeGreaterThan(0);
    expect(result.diagnostics.selectedMessageIds)
      .toContain("older-projector-location");
  });

  it("exposes lexical-mismatch and fallback details", () => {
    const result = selectConversationContext(lexicalMismatchFixture, "bm25");

    printDiagnostics("lexical-mismatch", result.diagnostics);

    expect(result.diagnostics.rankedCandidates.find(
      ({messageId}) => messageId === "older-automobile-detail",
    )?.score).toBe(0);
  });

  it("exposes explainable Method A and Method B fixture diagnostics", () => {
    const methodA = selectConversationContext(
      recencyComparisonFixture,
      "bm25",
    );
    const methodB = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );

    printDiagnostics("recency-method-a", methodA.diagnostics);
    printDiagnostics("recency-method-b", methodB.diagnostics);

    expect(methodB.diagnostics.rankedCandidates).toHaveLength(21);
    expect(methodB.diagnostics.rankedCandidates.every((candidate) => (
      candidate.bm25Score !== undefined &&
      candidate.normalizedBm25Score !== undefined &&
      candidate.ageDays !== undefined &&
      candidate.recencyScore !== undefined &&
      candidate.combinedScore !== undefined &&
      candidate.rankingPosition !== undefined &&
      candidate.includedInFinalContext !== undefined
    ))).toBe(true);
  });

  it("compares all strategies on the fictional MMR fixture", () => {
    const strategies: ContextSelectionStrategy[] = [
      "baseline",
      "bm25",
      "bm25_recency",
      "bm25_recency_mmr",
      "bm25_mmr",
    ];
    const comparisons = strategies.map((strategy) => {
      const result = selectConversationContext(mmrComparisonFixture, strategy);

      return buildFixtureComparison(strategy, result);
    });

    if (showDiagnostics) {
      console.info(JSON.stringify({
        fixtureName: "mmr-launch-comparison",
        metricDefinitions: {
          distinctFactCoverage:
            "Unique predefined fact IDs in selected historical messages.",
          redundancyGroupCounts:
            "Selected historical messages per predefined fixture group.",
          meanPairwiseLexicalSimilarity:
            "Mean TF-IDF cosine similarity across unordered selected " +
            "historical-message pairs; lower does not imply better AI output.",
        },
        comparisons,
      }, null, 2));
    }

    const methodA = comparisons.find(({strategy}) => strategy === "bm25")!;
    const methodC = comparisons.find(
      ({strategy}) => strategy === "bm25_recency_mmr",
    )!;
    const methodD = comparisons.find(
      ({strategy}) => strategy === "bm25_mmr",
    )!;

    expect(methodC.distinctFactCoverage).toBe(8);
    expect(methodD.distinctFactCoverage).toBe(8);
    expect(methodC.redundancyGroupCounts.date_confirmation)
      .toBeLessThan(methodA.redundancyGroupCounts.date_confirmation);
    expect(methodC.meanPairwiseLexicalSimilarity)
      .toBeLessThan(methodA.meanPairwiseLexicalSimilarity);
    expect(methodD.meanPairwiseLexicalSimilarity)
      .toBeLessThan(methodA.meanPairwiseLexicalSimilarity);
  });

  it("compares all strategies across the regression fixtures", () => {
    const comparisons = [
      buildRegressionComparison("projector", lexicalMatchFixture),
      buildRegressionComparison("recency", recencyComparisonFixture),
      buildRegressionComparison("lexical-mismatch", lexicalMismatchFixture),
    ];

    if (showDiagnostics) {
      console.info(JSON.stringify({
        fixtureName: "cross-fixture-strategy-comparison",
        comparisons,
      }, null, 2));
    }

    const projector = comparisons[0].strategies;
    expect(projector.baseline.finalChronologicalMessageIds)
      .not.toContain("older-projector-location");
    for (const strategy of retrievalStrategies) {
      expect(projector[strategy].finalChronologicalMessageIds)
        .toContain("older-projector-location");
    }

    const mismatch = comparisons[2].strategies;
    for (const strategy of retrievalStrategies) {
      expect(mismatch[strategy].fallback).toBe("no_positive_match");
      expect(mismatch[strategy].finalChronologicalMessageIds)
        .not.toContain("older-automobile-detail");
    }
  });

  it.each([
    ["method-c", "bm25_recency_mmr"],
    ["method-d", "bm25_mmr"],
  ] as const)("exposes iterative MMR details for %s", (name, strategy) => {
    const result = selectConversationContext(mmrComparisonFixture, strategy);
    const eligibleDiagnostics = result.diagnostics.rankedCandidates.filter(
      ({bm25Score}) => (bm25Score ?? 0) > 0,
    );

    printDiagnostics(name, result.diagnostics);

    expect(eligibleDiagnostics.every((candidate) => (
      candidate.normalizedBm25Score !== undefined &&
      candidate.relevanceScore !== undefined &&
      candidate.mmrEvaluatedAfterIteration !== undefined &&
      candidate.maximumSimilarity !== undefined &&
      candidate.redundancyPenalty !== undefined &&
      candidate.mmrScore !== undefined &&
      candidate.includedByMmr !== undefined &&
      candidate.includedInFinalContext !== undefined
    ))).toBe(true);
    expect(eligibleDiagnostics.some(({mmrSelectionIteration}) => (
      mmrSelectionIteration !== undefined
    ))).toBe(true);
  });
});

const allStrategies: ContextSelectionStrategy[] = [
  "baseline",
  "bm25",
  "bm25_recency",
  "bm25_recency_mmr",
  "bm25_mmr",
];
const retrievalStrategies = allStrategies.filter(
  (strategy): strategy is Exclude<ContextSelectionStrategy, "baseline"> =>
    strategy !== "baseline",
);

function buildRegressionComparison(
  fixtureName: string,
  fixture: ContextCandidate[],
) {
  return {
    fixtureName,
    strategies: Object.fromEntries(allStrategies.map((strategy) => {
      const result = selectConversationContext(fixture, strategy);

      return [strategy, {
        selectedMessageCount: result.selectedMessages.length,
        estimatedContextTokens: result.estimatedContextTokens,
        estimatedBaselineTokens: result.estimatedBaselineTokens,
        fallback: result.diagnostics.fallback,
        finalChronologicalMessageIds:
          result.diagnostics.finalChronologicalMessageIds,
      }];
    })) as Record<ContextSelectionStrategy, {
      selectedMessageCount: number;
      estimatedContextTokens: number;
      estimatedBaselineTokens: number;
      fallback: ContextSelectionResult["diagnostics"]["fallback"];
      finalChronologicalMessageIds: string[];
    }>,
  };
}

function buildFixtureComparison(
  strategy: ContextSelectionStrategy,
  result: ContextSelectionResult,
) {
  const anchorIds = new Set(
    mmrComparisonFixture.slice(-3).map(({id}) => id),
  );
  const selectedHistorical = result.selectedMessages.filter(
    ({id}) => !anchorIds.has(id),
  );
  const factIds = new Set<string>();
  const redundancyGroupCounts: Record<string, number> = {};

  for (const {id} of selectedHistorical) {
    const metadata = mmrFixtureMetadata.get(id);

    if (metadata?.factId) {
      factIds.add(metadata.factId);
    }

    if (metadata?.redundancyGroup) {
      redundancyGroupCounts[metadata.redundancyGroup] =
        (redundancyGroupCounts[metadata.redundancyGroup] ?? 0) + 1;
    }
  }

  return {
    strategy,
    selectedMessageCount: result.selectedMessages.length,
    estimatedContextTokens: result.estimatedContextTokens,
    estimatedBaselineTokens: result.estimatedBaselineTokens,
    fallback: result.diagnostics.fallback,
    finalChronologicalMessageIds:
      result.diagnostics.finalChronologicalMessageIds,
    distinctFactCoverage: factIds.size,
    coveredFactIds: [...factIds].sort(),
    redundancyGroupCounts,
    meanPairwiseLexicalSimilarity: calculateMeanPairwiseSimilarity(
      mmrComparisonFixture.slice(0, -3),
      selectedHistorical,
    ),
  };
}

function calculateMeanPairwiseSimilarity(
  corpus: ContextCandidate[],
  selected: ContextCandidate[],
): number {
  if (selected.length < 2) {
    return 0;
  }

  const matrix = buildSimilarityMatrix(
    corpus.map(({id, text}) => ({id, text})),
  );
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let left = 0; left < selected.length; left += 1) {
    for (let right = left + 1; right < selected.length; right += 1) {
      totalSimilarity += getSimilarity(
        matrix,
        selected[left].id,
        selected[right].id,
      );
      pairCount += 1;
    }
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

function printDiagnostics(
  fixtureName: string,
  diagnostics: ContextSelectionDiagnostics,
) {
  if (!showDiagnostics) {
    return;
  }

  console.info(JSON.stringify({fixtureName, ...diagnostics}, null, 2));
}
