import {describe, expect, it} from "vitest";
import {
  buildTfIdfVectors,
  calculateCosineSimilarity,
} from "../../src/contextSelection/similarity";

const documents = [
  {id: "first", text: "launch venue access"},
  {id: "identical", text: "launch venue access"},
  {id: "partial", text: "launch venue equipment"},
  {id: "disjoint", text: "lunch soup order"},
  {id: "empty", text: "..."},
];

describe("TF-IDF cosine similarity", () => {
  const vectors = buildTfIdfVectors(documents);

  it("gives identical nonempty vectors similarity one", () => {
    expect(calculateCosineSimilarity(
      vectors.get("first")!,
      vectors.get("identical")!,
    )).toBeCloseTo(1);
  });

  it("gives disjoint vectors similarity zero", () => {
    expect(calculateCosineSimilarity(
      vectors.get("first")!,
      vectors.get("disjoint")!,
    )).toBe(0);
  });

  it("gives partial overlap an intermediate similarity", () => {
    const similarity = calculateCosineSimilarity(
      vectors.get("first")!,
      vectors.get("partial")!,
    );

    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it("is symmetric and deterministic", () => {
    const leftToRight = calculateCosineSimilarity(
      vectors.get("first")!,
      vectors.get("partial")!,
    );
    const rightToLeft = calculateCosineSimilarity(
      vectors.get("partial")!,
      vectors.get("first")!,
    );

    expect(rightToLeft).toBe(leftToRight);
    expect(calculateCosineSimilarity(
      vectors.get("first")!,
      vectors.get("partial")!,
    )).toBe(leftToRight);
  });

  it("handles empty vectors safely", () => {
    expect(calculateCosineSimilarity(
      vectors.get("empty")!,
      vectors.get("first")!,
    )).toBe(0);
    expect(calculateCosineSimilarity(new Map(), new Map())).toBe(0);
  });
});
