import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {createOpenAiProvider} from "./ai/openaiProvider";
import {createAiProvider} from "./ai/provider";
import {
  isValidConversationMessage,
  validateAiAnalysisResult,
  validateAnalyzeConversationInput,
} from "./validation";
import type {ConversationMessage} from "./types";

initializeApp();
setGlobalOptions({maxInstances: 10});

const fixedRoomId = "main";
const maxAnalysisMessages = 20;
const openAiApiKey = defineSecret("OPENAI_API_KEY");

export const analyzeConversation = onCall({
  secrets: [openAiApiKey],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication is required to analyze a conversation.",
    );
  }

  const {replyAs} = validateAnalyzeConversationInput(request.data);
  const messages = await getLatestMessagesForAnalysis();

  if (messages.length === 0) {
    return {
      summary: "No conversation to summarize.",
      importantInformation: [],
      suggestedReply: "",
    };
  }

  const apiKey = openAiApiKey.value();

  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "OpenAI API key is not configured.",
    );
  }

  const aiProvider = createAiProvider(createOpenAiProvider(apiKey));
  let providerResult;

  try {
    providerResult = await aiProvider.analyzeConversation(messages, replyAs);
  } catch {
    throw new HttpsError("internal", "Conversation analysis failed.");
  }

  return validateAiAnalysisResult(providerResult);
});

/**
 * Reads the latest messages from the fixed prototype room for AI analysis.
 */
async function getLatestMessagesForAnalysis(): Promise<ConversationMessage[]> {
  const snapshot = await getFirestore()
    .collection("rooms")
    .doc(fixedRoomId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(maxAnalysisMessages)
    .get();

  return snapshot.docs
    .reverse()
    .map((documentSnapshot) => documentSnapshot.data())
    .filter(isValidConversationMessage)
    .map((data) => ({
      senderId: data.senderId,
      senderName: data.senderName,
      text: data.text,
    }));
}
