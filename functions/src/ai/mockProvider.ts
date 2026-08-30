import type {
  AiAnalysisResult,
  AiProvider,
  ConversationMessage,
  DisplayUserId,
} from "../types";

export const mockAiProvider: AiProvider = {
  async analyzeConversation(
    messages: ConversationMessage[],
    replyAs: DisplayUserId,
  ): Promise<AiAnalysisResult> {
    if (messages.length === 0) {
      return {
        summary: "Mock summary for an empty conversation.",
        importantInformation: [],
        suggestedReply: `Mock suggested reply for ${replyAs}.`,
      };
    }

    return {
      summary: "Mock summary for the current conversation.",
      importantInformation: [
        `Mock important information from ${messages.length} message(s).`,
      ],
      suggestedReply: `Mock suggested reply for ${replyAs}.`,
    };
  },
};
