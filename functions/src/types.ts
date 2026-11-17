import type {ContextSelectionStrategy} from "./contextSelection/types";

export type DisplayUserId = "alice" | "bob";

export type AnalyzeConversationInput = {
  replyAs: DisplayUserId;
  strategy: ContextSelectionStrategy;
};

export type ConversationMessage = {
  senderId: DisplayUserId;
  senderName: "Alice" | "Bob";
  text: string;
};

export type AiAnalysisResult = {
  summary: string;
  importantInformation: string[];
  suggestedReply: string;
};

export type AiProvider = {
  analyzeConversation(
    messages: ConversationMessage[],
    replyAs: DisplayUserId,
  ): Promise<AiAnalysisResult>;
};
