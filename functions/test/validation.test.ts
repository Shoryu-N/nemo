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
  it("accepts alice as replyAs", () => {
    expect(validateAnalyzeConversationInput({replyAs: "alice"})).toEqual({
      replyAs: "alice",
    });
  });

  it("accepts bob as replyAs", () => {
    expect(validateAnalyzeConversationInput({replyAs: "bob"})).toEqual({
      replyAs: "bob",
    });
  });

  it("rejects a missing replyAs", () => {
    expect(() => validateAnalyzeConversationInput({})).toThrow(
      "Request data must contain only replyAs.",
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
    expect(() => validateAnalyzeConversationInput({replyAs: "charlie"}))
      .toThrow("replyAs must be either alice or bob.");
  });

  it("rejects uppercase identities", () => {
    expect(() => validateAnalyzeConversationInput({replyAs: "Alice"}))
      .toThrow("replyAs must be either alice or bob.");
  });

  it("rejects unexpected extra fields", () => {
    expect(() => validateAnalyzeConversationInput({
      replyAs: "alice",
      roomId: "main",
    })).toThrow("Request data must contain only replyAs.");
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
