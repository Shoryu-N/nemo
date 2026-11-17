import {initializeApp} from "firebase-admin/app";
import {logger, setGlobalOptions} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {performance} from "node:perf_hooks";
import {createOpenAiProvider} from "./ai/openaiProvider";
import {createAiProvider} from "./ai/provider";
import {getContextCandidates} from "./conversationRepository";
import {selectConversationContext} from "./contextSelection/selector";
import {
  validateAiAnalysisResult,
  validateAnalyzeConversationInput,
} from "./validation";

initializeApp();
setGlobalOptions({maxInstances: 10});

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

  const {replyAs, strategy} = validateAnalyzeConversationInput(request.data);
  const {candidates, retrievedDocumentCount} =
    await getContextCandidates(strategy);
  const selectionStartedAt = performance.now();
  const selection = selectConversationContext(candidates, strategy);
  const selectionDurationMs = performance.now() - selectionStartedAt;

  logger.info("Conversation context selected.", {
    strategy,
    retrievedDocumentCount,
    candidateMessageCount: candidates.length,
    selectedMessageCount: selection.selectedMessages.length,
    selectionDurationMs,
    estimatedContextTokens: selection.estimatedContextTokens,
    estimatedBaselineTokens: selection.estimatedBaselineTokens,
    fallback: selection.diagnostics.fallback,
  });

  if (selection.selectedMessages.length === 0) {
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
    providerResult = await aiProvider.analyzeConversation(
      selection.selectedMessages.map(({senderId, senderName, text}) => ({
        senderId,
        senderName,
        text,
      })),
      replyAs,
    );
  } catch {
    throw new HttpsError("internal", "Conversation analysis failed.");
  }

  return validateAiAnalysisResult(providerResult);
});
