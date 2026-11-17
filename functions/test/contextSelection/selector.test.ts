import {describe, expect, it} from "vitest";
import {
  baselineMessageLimit,
  selectConversationContext,
} from "../../src/contextSelection/selector";
import type {ContextCandidate} from "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
} from "../fixtures/contextSelectionFixtures";

function message(
  id: string,
  chronologicalIndex: number,
  text: string,
): ContextCandidate {
  return {
    id,
    chronologicalIndex,
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

  it("returns an empty selection for empty history", () => {
    const result = selectConversationContext([], "bm25");

    expect(result.selectedMessages).toEqual([]);
    expect(result.diagnostics.fallback).toBe("short_history");
  });

  it("keeps every message in a small candidate set", () => {
    const candidates = [
      message("first", 0, "First message."),
      message("second", 1, "Second message."),
    ];
    const result = selectConversationContext(candidates, "bm25");

    expect(result.selectedMessages).toEqual(candidates);
    expect(result.diagnostics.fallback).toBe("short_history");
  });

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
});
