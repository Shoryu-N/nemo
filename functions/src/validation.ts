import {HttpsError} from "firebase-functions/v2/https";
import type {
  AiAnalysisResult,
  AnalyzeConversationInput,
  ConversationMessage,
  DisplayUserId,
} from "./types";
import type {ContextSelectionStrategy} from "./contextSelection/types";

const displayUserIds = ["alice", "bob"];
const contextSelectionStrategies = ["baseline", "bm25"];

/**
 * Validates the callable request payload for analyzeConversation.
 */
export function validateAnalyzeConversationInput(
  data: unknown,
): AnalyzeConversationInput {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }

  const keys = Object.keys(data);

  const expectedKeys = ["replyAs", "strategy"];

  if (
    keys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => keys.includes(key))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Request data must contain only replyAs and strategy.",
    );
  }

  if (!isDisplayUserId(data.replyAs)) {
    throw new HttpsError(
      "invalid-argument",
      "replyAs must be either alice or bob.",
    );
  }

  if (!isContextSelectionStrategy(data.strategy)) {
    throw new HttpsError(
      "invalid-argument",
      "strategy must be either baseline or bm25.",
    );
  }

  return {replyAs: data.replyAs, strategy: data.strategy};
}

/**
 * Validates the exact application-level AI analysis result shape.
 */
export function validateAiAnalysisResult(data: unknown): AiAnalysisResult {
  if (!isRecord(data)) {
    throw new HttpsError("internal", "AI result must be an object.");
  }

  const keys = Object.keys(data);
  const expectedKeys = ["summary", "importantInformation", "suggestedReply"];

  if (
    keys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => keys.includes(key))
  ) {
    throw new HttpsError("internal", "AI result has an invalid shape.");
  }

  if (
    typeof data.summary !== "string" ||
    !Array.isArray(data.importantInformation) ||
    !data.importantInformation.every((item) => typeof item === "string") ||
    typeof data.suggestedReply !== "string"
  ) {
    throw new HttpsError("internal", "AI result has invalid field types.");
  }

  return {
    summary: data.summary,
    importantInformation: data.importantInformation,
    suggestedReply: data.suggestedReply,
  };
}

/**
 * Checks whether a Firestore document can be used for conversation context.
 */
export function isValidConversationMessage(
  data: FirebaseFirestore.DocumentData,
): data is ConversationMessage {
  return (
    isDisplayUserId(data.senderId) &&
    (data.senderName === "Alice" || data.senderName === "Bob") &&
    matchesSenderName(data.senderId, data.senderName) &&
    typeof data.text === "string" &&
    data.text.trim().length > 0
  );
}

/**
 * Checks for a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks for one of the two approved display identity ids.
 */
function isDisplayUserId(value: unknown): value is DisplayUserId {
  return displayUserIds.includes(String(value));
}

/**
 * Checks for one of the enabled context-selection strategies.
 */
function isContextSelectionStrategy(
  value: unknown,
): value is ContextSelectionStrategy {
  return contextSelectionStrategies.includes(String(value));
}

/**
 * Confirms the display name matches the selected display identity id.
 */
function matchesSenderName(senderId: DisplayUserId, senderName: string) {
  return (
    (senderId === "alice" && senderName === "Alice") ||
    (senderId === "bob" && senderName === "Bob")
  );
}
