import {describe, expect, it} from "vitest";
import {selectConversationContext} from "../../src/contextSelection/selector";
import type {ContextSelectionDiagnostics} from
  "../../src/contextSelection/types";
import {
  lexicalMatchFixture,
  lexicalMismatchFixture,
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
