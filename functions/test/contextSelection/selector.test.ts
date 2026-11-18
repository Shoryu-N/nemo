import {describe, expect, it} from "vitest";
import {
  baselineMessageLimit,
  selectConversationContext,
} from "../../src/contextSelection/selector";
import type {ContextCandidate} from "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
  mmrComparisonFixture,
  mmrExpectedFactIds,
  mmrFixtureMetadata,
  recencyComparisonFixture,
} from "../fixtures/contextSelectionFixtures";

function message(
  id: string,
  chronologicalIndex: number,
  text: string,
): ContextCandidate {
  return {
    id,
    chronologicalIndex,
    createdAtMillis: Date.UTC(2026, 0, 1 + chronologicalIndex),
    senderId: "alice",
    senderName: "Alice",
    text,
  };
}

describe("context strategy selector", () => {
  it("keeps the Baseline equivalent to the latest 20 messages", () => {
    const result = selectConversationContext(lexicalMatchFixture, "baseline");

    expect(result.selectedMessages).toHaveLength(baselineMessageLimit);
    expect(result.diagnostics.finalChronologicalMessageIds)
      .not.toContain("older-projector-location");
    expect(result.diagnostics.rankedCandidates).toEqual([]);
  });

  it("retrieves an older lexical match and preserves all anchors", () => {
    const result = selectConversationContext(lexicalMatchFixture, "bm25");
    const selectedIds = result.diagnostics.finalChronologicalMessageIds;

    expect(selectedIds).toContain("older-projector-location");
    expect(selectedIds).toEqual(expect.arrayContaining([
      "anchor-projector",
      "anchor-checklist",
      "anchor-location",
    ]));
    expect(result.diagnostics.rankedCandidates[0].messageId)
      .toBe("older-projector-location");
  });

  it("restores BM25 selections to chronological order", () => {
    const result = selectConversationContext(lexicalMatchFixture, "bm25");
    const indexes = result.selectedMessages.map(
      ({chronologicalIndex}) => chronologicalIndex,
    );

    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    expect(result.diagnostics.finalChronologicalMessageIds.indexOf(
      "older-projector-location",
    )).toBeLessThan(result.diagnostics.finalChronologicalMessageIds.indexOf(
      "anchor-projector",
    ));
  });

  it("is reproducible for the deterministic fictional fixture", () => {
    const first = selectConversationContext(lexicalMatchFixture, "bm25");
    const second = selectConversationContext(lexicalMatchFixture, "bm25");

    expect(second.diagnostics).toEqual(first.diagnostics);
  });

  it("documents lexical mismatch through a negative fixture", () => {
    const result = selectConversationContext(lexicalMismatchFixture, "bm25");
    const oldScore = result.diagnostics.rankedCandidates.find(
      ({messageId}) => messageId === "older-automobile-detail",
    );

    expect(oldScore?.score).toBe(0);
    expect(result.diagnostics.finalChronologicalMessageIds)
      .not.toContain("older-automobile-detail");
  });

  it.each([
    "bm25",
    "bm25_recency",
    "bm25_recency_mmr",
    "bm25_mmr",
  ] as const)(
    "returns an empty selection for empty history with %s",
    (strategy) => {
      const result = selectConversationContext([], strategy);

      expect(result.selectedMessages).toEqual([]);
      expect(result.diagnostics.fallback).toBe("short_history");
    },
  );

  it.each([
    "bm25",
    "bm25_recency",
    "bm25_recency_mmr",
    "bm25_mmr",
  ] as const)(
    "keeps every message in a small candidate set with %s",
    (strategy) => {
      const candidates = [
        message("first", 0, "First message."),
        message("second", 1, "Second message."),
      ];
      const result = selectConversationContext(candidates, strategy);

      expect(result.selectedMessages).toEqual(candidates);
      expect(result.diagnostics.fallback).toBe("short_history");
    },
  );

  it("falls back to latest 20 for an empty lexical query", () => {
    const candidates = Array.from({length: 24}, (_, index) => message(
      `message-${index}`,
      index,
      index >= 21 ? "..." : `Normal content ${index}`,
    ));
    const result = selectConversationContext(candidates, "bm25");

    expect(result.diagnostics.fallback).toBe("empty_query");
    expect(result.diagnostics.finalChronologicalMessageIds[0])
      .toBe("message-4");
  });

  it("falls back to latest 20 when no older message matches", () => {
    const candidates = Array.from({length: 24}, (_, index) => message(
      `message-${index}`,
      index,
      index >= 21 ? "projector" : "lunch",
    ));
    const result = selectConversationContext(candidates, "bm25");

    expect(result.diagnostics.fallback).toBe("no_positive_match");
    expect(result.diagnostics.finalChronologicalMessageIds[0])
      .toBe("message-4");
  });

  it("never drops anchors when a ranked candidate exceeds the budget", () => {
    const candidates = [
      message("oversized-match", 0, `nebula ${"detail ".repeat(140)}`),
      ...Array.from({length: 20}, (_, index) => message(
        `short-${index}`,
        index + 1,
        index >= 17 ? "nebula" : "x",
      )),
    ];
    const result = selectConversationContext(candidates, "bm25");
    const finalIds = result.diagnostics.finalChronologicalMessageIds;

    expect(result.diagnostics.skippedForBudgetMessageIds)
      .toContain("oversized-match");
    expect(finalIds).not.toContain("oversized-match");
    expect(finalIds).toEqual(expect.arrayContaining([
      "short-17",
      "short-18",
      "short-19",
    ]));
    expect(result.selectedMessages.length).toBeLessThanOrEqual(
      baselineMessageLimit,
    );
    expect(result.estimatedContextTokens)
      .toBeLessThanOrEqual(result.estimatedBaselineTokens);
  });

  it("lets Method B prefer a newer comparable relevant revision", () => {
    const methodA = selectConversationContext(
      recencyComparisonFixture,
      "bm25",
    );
    const methodB = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );

    expect(methodA.diagnostics.finalChronologicalMessageIds)
      .toContain("older-venue-cedar");
    expect(methodA.diagnostics.finalChronologicalMessageIds)
      .not.toContain("newer-venue-harbor");
    expect(methodB.diagnostics.finalChronologicalMessageIds)
      .toContain("newer-venue-harbor");
    expect(methodB.diagnostics.finalChronologicalMessageIds)
      .not.toContain("older-venue-cedar");
  });

  it("keeps old relevance and anchors without recent irrelevance", () => {
    const result = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );
    const selectedIds = result.diagnostics.finalChronologicalMessageIds;

    expect(selectedIds).toContain("strong-older-venue-contract");
    expect(selectedIds).not.toContain("recent-irrelevant-lunch");
    expect(selectedIds).not.toContain("recent-irrelevant-book");
    expect(selectedIds).toEqual(expect.arrayContaining([
      "anchor-current-venue",
      "anchor-latest-update",
      "anchor-which-venue",
    ]));
    expect(result.selectedMessages.length).toBeLessThanOrEqual(
      baselineMessageLimit,
    );
    expect(result.estimatedContextTokens)
      .toBeLessThanOrEqual(result.estimatedBaselineTokens);
  });

  it("restores Method B output chronologically and is reproducible", () => {
    const first = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );
    const second = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );
    const indexes = first.selectedMessages.map(
      ({chronologicalIndex}) => chronologicalIndex,
    );

    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    expect(second.diagnostics).toEqual(first.diagnostics);
  });

  it("makes alpha one match Method A relevance selection", () => {
    const methodA = selectConversationContext(
      recencyComparisonFixture,
      "bm25",
    );
    const alphaOne = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
      {recencyParameters: {alpha: 1, halfLifeDays: 7}},
    );

    expect(alphaOne.diagnostics.finalChronologicalMessageIds)
      .toEqual(methodA.diagnostics.finalChronologicalMessageIds);
  });

  it("makes lambda one match each parent relevance selection", () => {
    const methodA = selectConversationContext(
      recencyComparisonFixture,
      "bm25",
    );
    const methodB = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency",
    );
    const methodC = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency_mmr",
      {mmrParameters: {lambda: 1}},
    );
    const methodD = selectConversationContext(
      recencyComparisonFixture,
      "bm25_mmr",
      {mmrParameters: {lambda: 1}},
    );

    expect(methodC.diagnostics.finalChronologicalMessageIds)
      .toEqual(methodB.diagnostics.finalChronologicalMessageIds);
    expect(methodD.diagnostics.finalChronologicalMessageIds)
      .toEqual(methodA.diagnostics.finalChronologicalMessageIds);
  });

  it("does not add an implicit timestamp bonus to Method D", () => {
    const shiftedTimestamps = recencyComparisonFixture.map((candidate) => ({
      ...candidate,
      createdAtMillis: candidate.id === "older-venue-cedar" ?
        Date.UTC(2030, 0, 1) : candidate.createdAtMillis,
    }));
    const original = selectConversationContext(
      recencyComparisonFixture,
      "bm25_mmr",
    );
    const shifted = selectConversationContext(
      shiftedTimestamps,
      "bm25_mmr",
    );

    expect(shifted.diagnostics.selectedMessageIds)
      .toEqual(original.diagnostics.selectedMessageIds);
  });

  it.each(["bm25_recency_mmr", "bm25_mmr"] as const)(
    "keeps projector evidence and anchors with %s",
    (strategy) => {
      const result = selectConversationContext(lexicalMatchFixture, strategy);

      expect(result.diagnostics.finalChronologicalMessageIds)
        .toContain("older-projector-location");
      expect(result.diagnostics.finalChronologicalMessageIds)
        .toEqual(expect.arrayContaining([
          "anchor-projector",
          "anchor-checklist",
          "anchor-location",
        ]));
    },
  );

  it.each(["bm25_recency_mmr", "bm25_mmr"] as const)(
    "keeps no-positive-match fallback with %s",
    (strategy) => {
      const result = selectConversationContext(
        lexicalMismatchFixture,
        strategy,
      );

      expect(result.diagnostics.fallback).toBe("no_positive_match");
      expect(result.diagnostics.finalChronologicalMessageIds)
        .not.toContain("older-automobile-detail");
    },
  );

  it("uses MMR to cover predefined complementary launch facts", () => {
    const methodA = selectConversationContext(mmrComparisonFixture, "bm25");
    const methodC = selectConversationContext(
      mmrComparisonFixture,
      "bm25_recency_mmr",
    );
    const methodD = selectConversationContext(
      mmrComparisonFixture,
      "bm25_mmr",
    );
    const methodAFacts = selectedFactIds(methodA.selectedMessages);
    const methodCFacts = selectedFactIds(methodC.selectedMessages);
    const methodDFacts = selectedFactIds(methodD.selectedMessages);

    expect(methodAFacts).toEqual(new Set([
      "launch_date",
      "responsible_team",
    ]));
    expect(methodCFacts).toEqual(new Set(mmrExpectedFactIds));
    expect(methodDFacts).toEqual(new Set(mmrExpectedFactIds));
    expect(selectedGroupCount(
      methodC.selectedMessages,
      "date_confirmation",
    )).toBeLessThan(selectedGroupCount(
      methodA.selectedMessages,
      "date_confirmation",
    ));
  });

  it.each(["bm25_recency_mmr", "bm25_mmr"] as const)(
    "enforces anchors, count, budget, and chronology for %s",
    (strategy) => {
      const result = selectConversationContext(mmrComparisonFixture, strategy);
      const indexes = result.selectedMessages.map(
        ({chronologicalIndex}) => chronologicalIndex,
      );

      expect(result.diagnostics.finalChronologicalMessageIds)
        .toEqual(expect.arrayContaining([
          "anchor-multiple-facts",
          "anchor-team-access",
          "anchor-final-briefing",
        ]));
      expect(result.selectedMessages.length)
        .toBeLessThanOrEqual(baselineMessageLimit);
      expect(result.estimatedContextTokens)
        .toBeLessThanOrEqual(result.estimatedBaselineTokens);
      expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    },
  );

  it("shows the recency/diversity trade-off on the revision fixture", () => {
    const methodC = selectConversationContext(
      recencyComparisonFixture,
      "bm25_recency_mmr",
    );
    const methodD = selectConversationContext(
      recencyComparisonFixture,
      "bm25_mmr",
    );

    expect(methodC.diagnostics.finalChronologicalMessageIds)
      .toContain("newer-venue-harbor");
    expect(methodD.diagnostics.finalChronologicalMessageIds)
      .not.toContain("newer-venue-harbor");
  });
});

function selectedFactIds(candidates: ContextCandidate[]): Set<string> {
  return new Set(candidates.flatMap(({id}) => {
    const factId = mmrFixtureMetadata.get(id)?.factId;

    return factId ? [factId] : [];
  }));
}

function selectedGroupCount(
  candidates: ContextCandidate[],
  group: string,
): number {
  return candidates.filter(({id}) => (
    mmrFixtureMetadata.get(id)?.redundancyGroup === group
  )).length;
}
