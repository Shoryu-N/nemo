import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {mockAiProvider} from "./ai/mockProvider";
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
const aiProvider = createAiProvider(mockAiProvider);

export const analyzeConversation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication is required to analyze a conversation.",
    );
  }

  const {replyAs} = validateAnalyzeConversationInput(request.data);
  const messages = await getLatestMessagesForAnalysis();
  const providerResult = await aiProvider.analyzeConversation(
    messages,
    replyAs,
  );

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
