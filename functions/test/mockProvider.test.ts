import {describe, expect, it} from "vitest";
import {mockAiProvider} from "../src/ai/mockProvider";

describe("mockAiProvider", () => {
  it("returns the expected shape for a non-empty conversation", async () => {
    const result = await mockAiProvider.analyzeConversation([
      {
        senderId: "alice",
        senderName: "Alice",
        text: "Can we meet tomorrow?",
      },
    ], "bob");

    expect(result).toEqual({
      summary: "Mock summary for the current conversation.",
      importantInformation: ["Mock important information from 1 message(s)."],
      suggestedReply: "Mock suggested reply for bob.",
    });
  });

  it("reflects the selected reply identity", async () => {
    const result = await mockAiProvider.analyzeConversation([
      {
        senderId: "bob",
        senderName: "Bob",
        text: "Sounds good.",
      },
    ], "alice");

    expect(result.suggestedReply).toBe("Mock suggested reply for alice.");
  });

  it("returns deterministic empty conversation output", async () => {
    const result = await mockAiProvider.analyzeConversation([], "alice");

    expect(result).toEqual({
      summary: "Mock summary for an empty conversation.",
      importantInformation: [],
      suggestedReply: "Mock suggested reply for alice.",
    });
  });
});
