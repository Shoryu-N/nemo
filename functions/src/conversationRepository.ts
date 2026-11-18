import {FieldPath, Timestamp, getFirestore} from "firebase-admin/firestore";
import {
  baselineMessageLimit,
  bm25CandidateLimit,
} from "./contextSelection/selector";
import type {
  ContextCandidate,
  ContextSelectionStrategy,
} from "./contextSelection/types";
import {isValidConversationMessage} from "./validation";

const fixedRoomId = "main";

export type RetrievedContextCandidates = {
  candidates: ContextCandidate[];
  retrievedDocumentCount: number;
};

/**
 * Reads a strategy-specific bounded history from the fixed prototype room.
 */
export async function getContextCandidates(
  strategy: ContextSelectionStrategy,
): Promise<RetrievedContextCandidates> {
  const retrievalLimit = strategy === "baseline" ?
    baselineMessageLimit : bm25CandidateLimit;
  const snapshot = await getFirestore()
    .collection("rooms")
    .doc(fixedRoomId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(retrievalLimit)
    .get();
  const validDocuments = [...snapshot.docs]
    .reverse()
    .filter((documentSnapshot) => (
      isValidConversationMessage(documentSnapshot.data()) &&
      documentSnapshot.data().createdAt instanceof Timestamp
    ));

  return {
    candidates: validDocuments.map((documentSnapshot, index) => {
      const data = documentSnapshot.data();

      return {
        id: documentSnapshot.id,
        chronologicalIndex: index,
        createdAtMillis: (data.createdAt as Timestamp).toMillis(),
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
      };
    }),
    retrievedDocumentCount: snapshot.size,
  };
}
