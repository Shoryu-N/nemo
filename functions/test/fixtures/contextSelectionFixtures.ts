import type {ContextCandidate} from "../../src/contextSelection/types";
import projectorCalibrationConversation from
  "./projectorCalibrationConversation.json";
import recencyComparisonConversation from
  "./recencyComparisonConversation.json";

function message(
  id: string,
  chronologicalIndex: number,
  text: string,
): ContextCandidate {
  const isAlice = chronologicalIndex % 2 === 0;

  return {
    id,
    chronologicalIndex,
    createdAtMillis: Date.UTC(2026, 0, 1 + chronologicalIndex),
    senderId: isAlice ? "alice" : "bob",
    senderName: isAlice ? "Alice" : "Bob",
    text,
  };
}

/**
 * The important second message sits outside the latest-20 Baseline window.
 * It shares multiple terms with the final three query messages.
 */
export const lexicalMatchFixture: ContextCandidate[] =
  projectorCalibrationConversation.map(({id, text}, index) => (
    message(id, index, text)
  ));

/**
 * The old message is conceptually related to the recent topic but deliberately
 * shares no lexical terms, demonstrating BM25's synonym limitation.
 */
export const lexicalMismatchFixture: ContextCandidate[] = [
  message(
    "older-automobile-detail",
    0,
    "Automobile maintenance quotation archived cabinet seven.",
  ),
  ...Array.from({length: 20}, (_, index) => message(
    `mismatch-neutral-${String(index + 1).padStart(2, "0")}`,
    index + 1,
    `Unrelated research memo ${index + 1}.`,
  )),
  message("mismatch-anchor-car", 21, "Please locate our car service price."),
  message(
    "mismatch-anchor-folder",
    22,
    "Which folder holds that vehicle expense?",
  ),
  message(
    "mismatch-anchor-deadline",
    23,
    "Can you find it before lunch?",
  ),
];

/**
 * Constructed functional fixture for comparing Method A and Method B. It is
 * not evidence that either method is generally superior.
 */
export const recencyComparisonFixture: ContextCandidate[] =
  recencyComparisonConversation.map((fixtureMessage, index) => ({
    id: fixtureMessage.id,
    chronologicalIndex: index,
    createdAtMillis: Date.parse(fixtureMessage.createdAt),
    senderId: fixtureMessage.senderId as "alice" | "bob",
    senderName: fixtureMessage.senderId === "alice" ? "Alice" : "Bob",
    text: fixtureMessage.text,
  }));
