import {describe, expect, it} from "vitest";
import {selectConversationContext} from "../../src/contextSelection/selector";
import type {ContextSelectionDiagnostics} from
  "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
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
});

function printDiagnostics(
  fixtureName: string,
  diagnostics: ContextSelectionDiagnostics,
) {
  if (!showDiagnostics) {
    return;
  }

  console.info(JSON.stringify({fixtureName, ...diagnostics}, null, 2));
}
