import {describe, expect, it} from "vitest";
import {
  calculateBm25Score,
  calculateInverseDocumentFrequency,
  rankCandidatesByBm25,
  tokenize,
} from "../../src/contextSelection/bm25";
import type {ContextCandidate} from "../../src/contextSelection/types";

function candidate(
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

describe("BM25 lexical helpers", () => {
  it("normalizes case, compatibility characters, and punctuation", () => {
    expect(tokenize("ＰＲＯＪＥＣＴ, Project! １２"))
      .toEqual(["project", "project", "12"]);
  });

  it("gives a larger IDF to a rarer term", () => {
    expect(calculateInverseDocumentFrequency(10, 1))
      .toBeGreaterThan(calculateInverseDocumentFrequency(10, 8));
  });

  it("returns zero IDF for a missing term", () => {
    expect(calculateInverseDocumentFrequency(10, 0)).toBe(0);
  });

  it("rewards higher term frequency at equal document length", () => {
    const corpus = [
      ["project", "project", "note"],
      ["project", "other", "note"],
    ];
    const repeated = calculateBm25Score(corpus[0], ["project"], corpus);
    const single = calculateBm25Score(corpus[1], ["project"], corpus);

    expect(repeated).toBeGreaterThan(single);
  });

  it("normalizes for document length", () => {
    const corpus = [
      ["project"],
      ["project", "one", "two", "three", "four", "five"],
    ];
    const shortScore = calculateBm25Score(corpus[0], ["project"], corpus);
    const longScore = calculateBm25Score(corpus[1], ["project"], corpus);

    expect(shortScore).toBeGreaterThan(longScore);
  });

  it("scores missing query terms as zero", () => {
    const corpus = [["project"], ["meeting"]];

    expect(calculateBm25Score(corpus[0], ["projector"], corpus)).toBe(0);
  });

  it("ranks relevant messages above irrelevant messages", () => {
    const ranked = rankCandidatesByBm25([
      candidate("irrelevant", 0, "Lunch is ready."),
      candidate("relevant", 1, "Projector calibration checklist."),
    ], ["projector", "checklist"]);

    expect(ranked.map(({candidate: item}) => item.id))
      .toEqual(["relevant", "irrelevant"]);
  });

  it("uses deterministic chronological tie-breaking", () => {
    const ranked = rankCandidatesByBm25([
      candidate("later", 2, "Same term."),
      candidate("earlier", 1, "Same term."),
    ], ["same"]);

    expect(ranked.map(({candidate: item}) => item.id))
      .toEqual(["earlier", "later"]);
  });
});
