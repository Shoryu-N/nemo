import {describe, expect, it} from "vitest";
import {
  defaultMmrParameters,
  selectCandidatesWithMmr,
  type MmrCandidate,
} from "../../src/contextSelection/mmr";
import {buildSimilarityMatrix} from
  "../../src/contextSelection/similarity";
import type {ContextCandidate} from
  "../../src/contextSelection/types";

function candidate(
  id: string,
  chronologicalIndex: number,
  text: string,
  relevanceScore: number,
): MmrCandidate {
  return {
    candidate: {
      id,
      chronologicalIndex,
      createdAtMillis: chronologicalIndex,
      senderId: "alice",
      senderName: "Alice",
      text,
    },
    relevanceScore,
  };
}

function select(
  candidates: MmrCandidate[],
  maximumSelections = candidates.length,
  lambda = defaultMmrParameters.lambda,
) {
  const matrix = buildSimilarityMatrix(candidates.map(({candidate: item}) => ({
    id: item.id,
    text: item.text,
  })));

  return selectCandidatesWithMmr(candidates, matrix, {
    maximumSelections,
    tokenBudget: 100,
    estimateTokens: () => 1,
  }, {lambda});
}

describe("greedy MMR selection", () => {
  it("uses relevance without a redundancy penalty first", () => {
    const result = select([
      candidate("highest", 0, "launch date venue", 1),
      candidate("lower", 1, "equipment access", 0.5),
    ], 1);

    expect(result.selectedCandidates[0].id).toBe("highest");
    expect(result.diagnostics[0]).toMatchObject({
      selectionIteration: 1,
      maximumSimilarity: 0,
      redundancyPenalty: 0,
    });
  });

  it("lets a complementary candidate outrank redundant evidence", () => {
    const result = select([
      candidate("first", 0, "launch date march ten", 1),
      candidate("redundant", 1, "launch date march ten", 0.95),
      candidate("complementary", 2, "equipment delivery projector", 0.8),
    ], 2);

    expect(result.selectedCandidates.map(({id}) => id))
      .toEqual(["first", "complementary"]);
    expect(result.diagnostics.find(
      ({messageId}) => messageId === "redundant",
    )?.redundancyPenalty).toBeGreaterThan(0);
  });

  it("recalculates penalties and uses maximum selected similarity", () => {
    const result = select([
      candidate("date", 0, "launch date march", 1),
      candidate("equipment", 1, "equipment projector delivery", 0.9),
      candidate("equipment-copy", 2, "equipment projector delivery", 0.85),
      candidate("access", 3, "access gate badge", 0.7),
    ], 3);
    const copy = result.diagnostics.find(
      ({messageId}) => messageId === "equipment-copy",
    );

    expect(result.selectedCandidates.map(({id}) => id))
      .toEqual(["date", "equipment", "access"]);
    expect(copy).toMatchObject({
      evaluatedAfterIteration: 3,
      maximumSimilarityMessageId: "equipment",
      maximumSimilarity: 1,
    });
  });

  it("never selects duplicate IDs", () => {
    const result = select([
      candidate("same", 0, "launch date", 1),
      candidate("same", 1, "launch venue", 0.9),
    ]);

    expect(result.selectedCandidates.map(({id}) => id)).toEqual(["same"]);
  });

  it("selects the best relative candidate even when MMR is negative", () => {
    const result = select([
      candidate("first", 0, "launch date", 1),
      candidate("copy", 1, "launch date", 0.1),
    ], 2, 0.1);

    expect(result.selectedCandidates.map(({id}) => id))
      .toEqual(["first", "copy"]);
    expect(result.diagnostics[1].mmrScore).toBeLessThan(0);
  });

  it("uses parent order for deterministic score ties", () => {
    const candidates = [
      candidate("earlier-parent", 1, "launch date", 0.5),
      candidate("later-parent", 0, "launch venue", 0.5),
    ];

    expect(select(candidates, 1).selectedCandidates[0].id)
      .toBe("earlier-parent");
    expect(select(candidates, 1)).toEqual(select(candidates, 1));
  });

  it("falls back to the default for invalid lambda values", () => {
    const candidates = [candidate("only", 0, "launch", 1)];

    expect(select(candidates, 1, Number.NaN).lambda)
      .toBe(defaultMmrParameters.lambda);
    expect(select(candidates, 1, -1).lambda)
      .toBe(defaultMmrParameters.lambda);
    expect(select(candidates, 1, 2).lambda)
      .toBe(defaultMmrParameters.lambda);
  });

  it("respects count and token constraints and records budget skips", () => {
    const candidates = [
      candidate("too-large", 0, "launch date", 1),
      candidate("fits", 1, "launch venue", 0.9),
    ];
    const matrix = buildSimilarityMatrix(candidates.map(
      ({candidate: item}) => ({
        id: item.id,
        text: item.text,
      }),
    ));
    const costs = new Map([["too-large", 3], ["fits", 1]]);
    const result = selectCandidatesWithMmr(candidates, matrix, {
      maximumSelections: 1,
      tokenBudget: 1,
      estimateTokens: (item: ContextCandidate) => costs.get(item.id) ?? 1,
    });

    expect(result.selectedCandidates.map(({id}) => id)).toEqual(["fits"]);
    expect(result.skippedForBudgetMessageIds).toContain("too-large");
  });
});
