import {describe, expect, it} from "vitest";
import {
  isValidConversationMessage,
  validateAiAnalysisResult,
  validateAnalyzeConversationInput,
} from "../src/validation";

const validAiResult = {
  summary: "Alice and Bob discussed a meeting.",
  importantInformation: ["The meeting is tomorrow."],
  suggestedReply: "See you then.",
};

describe("validateAnalyzeConversationInput", () => {
  it("accepts alice with the Baseline strategy", () => {
    expect(validateAnalyzeConversationInput({
      replyAs: "alice",
      strategy: "baseline",
    })).toEqual({
      replyAs: "alice",
      strategy: "baseline",
    });
  });

  it("accepts bob with the BM25 strategy", () => {
    expect(validateAnalyzeConversationInput({
      replyAs: "bob",
      strategy: "bm25",
    })).toEqual({
      replyAs: "bob",
      strategy: "bm25",
    });
  });

  it("accepts Method B with the BM25 plus recency strategy", () => {
    expect(validateAnalyzeConversationInput({
      replyAs: "alice",
      strategy: "bm25_recency",
    })).toEqual({
      replyAs: "alice",
      strategy: "bm25_recency",
    });
  });

  it("rejects a missing replyAs", () => {
    expect(() => validateAnalyzeConversationInput({strategy: "baseline"}))
      .toThrow(
        "Request data must contain only replyAs and strategy.",
      );
  });

  it("rejects a missing strategy", () => {
    expect(() => validateAnalyzeConversationInput({replyAs: "alice"}))
      .toThrow(
        "Request data must contain only replyAs and strategy.",
      );
  });

  it("rejects an empty object", () => {
    expect(() => validateAnalyzeConversationInput({})).toThrow(
      "Request data must contain only replyAs and strategy.",
    );
  });

  it("rejects null", () => {
    expect(() => validateAnalyzeConversationInput(null)).toThrow(
      "Request data must be an object.",
    );
  });

  it("rejects a string instead of an object", () => {
    expect(() => validateAnalyzeConversationInput("alice")).toThrow(
      "Request data must be an object.",
    );
  });

  it("rejects an invalid identity", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "charlie",
      strategy: "baseline",
    }))
      .toThrow("replyAs must be either alice or bob.");
  });

  it("rejects uppercase identities", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "Alice",
      strategy: "baseline",
    }))
      .toThrow("replyAs must be either alice or bob.");
  });

  it("rejects an invalid strategy", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "alice",
      strategy: "semantic",
    })).toThrow("strategy must be baseline, bm25, or bm25_recency.");
  });

  it("rejects future strategies that are not enabled", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "alice",
      strategy: "bm25_mmr",
    })).toThrow("strategy must be baseline, bm25, or bm25_recency.");
  });

  it("rejects unexpected extra fields", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "alice",
      strategy: "baseline",
      roomId: "main",
    })).toThrow("Request data must contain only replyAs and strategy.");
  });
});

describe("validateAiAnalysisResult", () => {
  it("accepts a valid AI result", () => {
    expect(validateAiAnalysisResult(validAiResult)).toEqual(validAiResult);
  });

  it("accepts empty strings and an empty importantInformation array", () => {
    const emptyResult = {
      summary: "",
      importantInformation: [],
      suggestedReply: "",
    };

    expect(validateAiAnalysisResult(emptyResult)).toEqual(emptyResult);
  });

  it("rejects missing fields", () => {
    expect(() => validateAiAnalysisResult({
      summary: "Summary.",
      importantInformation: [],
    })).toThrow("AI result has an invalid shape.");
  });

  it("rejects wrong field types", () => {
    expect(() => validateAiAnalysisResult({
      ...validAiResult,
      suggestedReply: false,
    })).toThrow("AI result has invalid field types.");
  });

  it("rejects non-string importantInformation entries", () => {
    expect(() => validateAiAnalysisResult({
      ...validAiResult,
      importantInformation: ["Valid.", 12],
    })).toThrow("AI result has invalid field types.");
  });

  it("rejects unexpected extra fields", () => {
    expect(() => validateAiAnalysisResult({
      ...validAiResult,
      extra: "not allowed",
    })).toThrow("AI result has an invalid shape.");
  });
});

describe("isValidConversationMessage", () => {
  it("accepts the backend conversation message shape for Alice", () => {
    expect(isValidConversationMessage({
      senderId: "alice",
      senderName: "Alice",
      text: "Hi Bob.",
    })).toBe(true);
  });

  it("accepts the backend conversation message shape for Bob", () => {
    expect(isValidConversationMessage({
      senderId: "bob",
      senderName: "Bob",
      text: "Hi Alice.",
    })).toBe(true);
  });

  it("rejects sender id and name mismatches", () => {
    expect(isValidConversationMessage({
      senderId: "alice",
      senderName: "Bob",
      text: "Hi.",
    })).toBe(false);
  });

  it("rejects invalid sender ids", () => {
    expect(isValidConversationMessage({
      senderId: "charlie",
      senderName: "Charlie",
      text: "Hi.",
    })).toBe(false);
  });

  it("rejects blank message text", () => {
    expect(isValidConversationMessage({
      senderId: "bob",
      senderName: "Bob",
      text: "   ",
    })).toBe(false);
  });

  it("rejects non-string message text", () => {
    expect(isValidConversationMessage({
      senderId: "bob",
      senderName: "Bob",
      text: 42,
    })).toBe(false);
  });
});
