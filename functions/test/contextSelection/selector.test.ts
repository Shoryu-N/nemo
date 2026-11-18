import {describe, expect, it} from "vitest";
import {
  baselineMessageLimit,
  selectConversationContext,
} from "../../src/contextSelection/selector";
import type {ContextCandidate} from "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
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

  it.each(["bm25", "bm25_recency"] as const)(
    "returns an empty selection for empty history with %s",
    (strategy) => {
      const result = selectConversationContext([], strategy);

      expect(result.selectedMessages).toEqual([]);
      expect(result.diagnostics.fallback).toBe("short_history");
    },
  );

  it.each(["bm25", "bm25_recency"] as const)(
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
});
