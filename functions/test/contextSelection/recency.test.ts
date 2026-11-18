import {describe, expect, it} from "vitest";
import {tokenize} from "../../src/contextSelection/bm25";
import {
  calculateRecencyScore,
  defaultRecencyParameters,
  millisecondsPerDay,
  rankCandidatesByBm25Recency,
} from "../../src/contextSelection/recency";
import type {ContextCandidate} from
  "../../src/contextSelection/types";

const referenceTimestamp = Date.UTC(2026, 2, 1);

function candidate(
  id: string,
  chronologicalIndex: number,
  text: string,
  ageDays: number,
): ContextCandidate {
  return {
    id,
    chronologicalIndex,
    createdAtMillis: referenceTimestamp - ageDays * millisecondsPerDay,
    senderId: "alice",
    senderName: "Alice",
    text,
  };
}

describe("recency scoring", () => {
  it("returns one at age zero", () => {
    expect(calculateRecencyScore(
      referenceTimestamp,
      referenceTimestamp,
      7,
    )).toBe(1);
  });

  it("returns one half at one half-life", () => {
    expect(calculateRecencyScore(
      referenceTimestamp - 7 * millisecondsPerDay,
      referenceTimestamp,
      7,
    )).toBeCloseTo(0.5);
  });

  it("returns one quarter at two half-lives", () => {
    expect(calculateRecencyScore(
      referenceTimestamp - 14 * millisecondsPerDay,
      referenceTimestamp,
      7,
    )).toBeCloseTo(0.25);
  });

  it("gives older messages lower scores deterministically", () => {
    const newer = calculateRecencyScore(
      referenceTimestamp - millisecondsPerDay,
      referenceTimestamp,
      7,
    );
    const older = calculateRecencyScore(
      referenceTimestamp - 10 * millisecondsPerDay,
      referenceTimestamp,
      7,
    );

    expect(older).toBeLessThan(newer);
    expect(calculateRecencyScore(
      referenceTimestamp - millisecondsPerDay,
      referenceTimestamp,
      7,
    )).toBe(newer);
  });

  it("handles invalid timestamps and half-lives safely", () => {
    expect(calculateRecencyScore(Number.NaN, referenceTimestamp, 7)).toBe(0);
    expect(calculateRecencyScore(0, Number.POSITIVE_INFINITY, 7)).toBe(0);
    expect(calculateRecencyScore(0, referenceTimestamp, 0)).toBe(0);
    expect(calculateRecencyScore(0, referenceTimestamp, -1)).toBe(0);
  });
});

describe("BM25 plus recency ranking", () => {
  it("prefers a newer candidate with comparable BM25 relevance", () => {
    const ranked = rankCandidatesByBm25Recency([
      candidate("older", 0, "Aurora venue checklist.", 28),
      candidate("newer", 1, "Aurora venue checklist.", 2),
    ], tokenize("Aurora venue checklist"), referenceTimestamp);

    expect(ranked.map(({candidate: item}) => item.id))
      .toEqual(["newer", "older"]);
  });

  it("allows strong lexical relevance to outweigh recency", () => {
    const ranked = rankCandidatesByBm25Recency([
      candidate(
        "strong-older",
        0,
        "Aurora venue checklist Aurora venue checklist contract.",
        14,
      ),
      candidate("weak-newer", 1, "Aurora lunch note.", 0),
    ], tokenize("Aurora venue checklist"), referenceTimestamp);

    expect(ranked[0].candidate.id).toBe("strong-older");
  });

  it("keeps recent zero-BM25 candidates behind relevant candidates", () => {
    const ranked = rankCandidatesByBm25Recency([
      candidate("relevant-old", 0, "Aurora venue checklist.", 60),
      candidate("irrelevant-new", 1, "Lunch soup delivery.", 0),
    ], tokenize("Aurora venue checklist"), referenceTimestamp);

    expect(ranked[0].candidate.id).toBe("relevant-old");
    expect(ranked[1].bm25Score).toBe(0);
  });

  it("handles a zero-BM25 corpus without division by zero", () => {
    const ranked = rankCandidatesByBm25Recency([
      candidate("first", 0, "Lunch.", 1),
      candidate("second", 1, "Dinner.", 0),
    ], ["aurora"], referenceTimestamp);

    expect(ranked.every(({normalizedBm25Score}) => (
      normalizedBm25Score === 0
    ))).toBe(true);
    expect(ranked.every(({combinedScore}) => (
      Number.isFinite(combinedScore)
    ))).toBe(true);
  });

  it("uses deterministic tie-breaking", () => {
    const candidates = [
      candidate("later", 2, "Aurora venue.", 7),
      candidate("earlier", 1, "Aurora venue.", 7),
    ];
    const first = rankCandidatesByBm25Recency(
      candidates,
      ["aurora", "venue"],
      referenceTimestamp,
    );
    const second = rankCandidatesByBm25Recency(
      candidates,
      ["aurora", "venue"],
      referenceTimestamp,
    );

    expect(first.map(({candidate: item}) => item.id))
      .toEqual(["earlier", "later"]);
    expect(second).toEqual(first);
  });

  it("matches BM25 relevance order when alpha is one", () => {
    const ranked = rankCandidatesByBm25Recency([
      candidate("weak-new", 1, "Aurora note.", 0),
      candidate("strong-old", 0, "Aurora venue checklist.", 60),
    ], tokenize("Aurora venue checklist"), referenceTimestamp, {
      ...defaultRecencyParameters,
      alpha: 1,
    });

    expect(ranked.map(({candidate: item}) => item.id))
      .toEqual(["strong-old", "weak-new"]);
  });
});
