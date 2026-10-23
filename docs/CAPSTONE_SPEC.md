# Capstone Project Specification

## 1. Document Purpose

This document defines the Capstone extension of the completed AI-Assisted Chat
Study Project. It is the primary specification for Capstone work alongside
`AGENTS.md`, `docs/PROJECT_SPEC.md`, and the recorded Phase 3 test cases.

The Study Project remains the behavioral and security baseline. A requirement in
this document takes precedence only where it explicitly extends or changes that
baseline.

## 2. Background and Problem Statement

The application is a small academic chat prototype built with React,
TypeScript, Vite, Firebase Anonymous Authentication, Cloud Firestore, Cloud
Functions for Firebase v2, and the OpenAI API. Users explicitly request an AI
summary, important-information extraction, and one editable suggested reply.

The Study Project sends the latest 20 valid messages to the AI provider. This
bounded window is simple and predictable, but information outside that window
cannot influence the result. The Capstone investigates whether explainable,
algorithm-based context selection can retrieve useful older messages without
using embedding services or another AI API.

Context selection and final language-model generation are separate stages.
Retrieving a message does not guarantee a better summary or reply, and lexical
selection can miss relevant messages that use different wording. Improvements
in information retention, summary quality, and reply relevance are hypotheses
that require experimental evidence.

## 3. Objectives and Research Questions

The Capstone will implement and compare:

1. **Baseline:** latest 20 valid messages.
2. **Method A:** BM25 lexical relevance selection.
3. **Method B:** BM25 plus recency scoring, in a future iteration.
4. **Method C:** BM25 plus recency scoring and Maximal Marginal Relevance, in a
   future iteration.

Iteration 1 asks whether BM25-based selection can retrieve messages that are
lexically relevant to the current topic from a larger bounded history while
maintaining a context budget comparable to the baseline.

Iteration 1 does not claim that BM25 is semantically aware or that it improves
AI output quality.

## 4. Preserved Study Project Baseline

The following behavior remains unchanged:

- One fixed room named `main`.
- Exactly two display identities, Alice and Bob.
- Firebase Anonymous Authentication.
- Text-only messages with existing validation and Security Rules.
- One callable `analyzeConversation` Cloud Function.
- Server-side-only OpenAI credentials.
- Exact application result shape: `summary`, `importantInformation`, and
  `suggestedReply`.
- Separate Alice/Bob drafts and AI-analysis state.
- Stale analysis invalidation when the conversation changes.
- Suggestions are advisory, editable, and never sent automatically.
- The user must explicitly click Send.

The Baseline strategy remains the latest 20 valid messages, in chronological
order, with no BM25 processing.

## 5. Iteration 1 Scope

Iteration 1 will add:

- An independently testable BM25 implementation in TypeScript.
- A backend strategy selector supporting `baseline` and `bm25`.
- A frontend selector for those two enabled strategies.
- A BM25 candidate pool containing at most the latest 100 valid messages.
- Privacy-safe measurements for selection behavior.
- Deterministic fictional fixtures and development/test diagnostics.
- Automated unit and integration coverage.
- A correction so the frontend displays the latest 100 messages in
  chronological order rather than the oldest 100.

Recency scoring, MMR, embeddings, external retrieval APIs, and persistent
long-term AI memory are excluded from Iteration 1.

## 6. Context-Selection Architecture

The callable processing flow is:

```text
authenticated callable request
  -> exact input validation
  -> bounded Firestore candidate retrieval
  -> pure context-selection module
  -> privacy-safe measurements
  -> existing AI provider
  -> existing structured-output validation
```

Firestore access, selection algorithms, AI-provider integration, and frontend
state remain separate. Pure selection modules accept already validated message
candidates and do not import Firebase or OpenAI code.

The callable request is:

```ts
{
  replyAs: "alice" | "bob";
  strategy: "baseline" | "bm25";
}
```

Both fields are required and unexpected fields are rejected. Future strategy
names remain invalid until their corresponding iteration enables them. The
callable response retains the exact Study Project result shape and does not
expose selection diagnostics.

## 7. Candidate Retrieval

### 7.1 Baseline

The backend retrieves at most the latest 20 Firestore message documents for the
Baseline strategy. Valid messages are restored to chronological order and sent
without BM25 scoring.

### 7.2 BM25

The backend retrieves at most the latest 100 Firestore message documents for
Method A. This is a bounded research window, not unbounded memory. Invalid
records are excluded using the existing message validation.

Firestore results use creation time plus document ID for deterministic ordering
when timestamps are equal. Each valid candidate receives a stable chronological
ordinal before it enters the pure selector.

## 8. Method A: BM25 Specification

### 8.1 Retrieval Objective

The latest three valid messages form the lexical query and are reserved as
conversation anchors. This intentionally prioritizes older messages related to
the current topic. It may differ from preserving information that is globally
important to the whole conversation but unrelated to the latest wording.

### 8.2 Ranking Unit

Individual messages are ranked. This keeps Method A explainable and isolates the
effect of BM25. It can separate an older message from an adjacent question or
answer; that is a documented limitation for evaluation.

### 8.3 Normalization and Tokenization

Text is normalized with Unicode NFKC, converted to lowercase, and split into
Unicode letter/number sequences. Punctuation and whitespace are separators.
There is no stemming, stop-word list, embedding generation, or external API.

The approach is suitable for the existing fictional English-language test
scope. It is not a Japanese morphological analyzer and may tokenize languages
without whitespace poorly.

### 8.4 Scoring

Method A uses:

```text
IDF(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))

score(D,Q) = sum over unique query terms t of:
  IDF(t) *
  (tf(t,D) * (k1 + 1)) /
  (tf(t,D) + k1 * (1 - b + b * |D| / averageDocumentLength))
```

Iteration 1 parameters are `k1 = 1.2` and `b = 0.75`. These are fixed,
documented defaults rather than tuned experimental results.

### 8.5 Anchors and Selection Budget

The latest three messages are reserved before any older ranked message. They
are never removed to make room for an older candidate.

The selection has two limits:

- At most 20 messages.
- An approximate token budget equal to the estimated context tokens of the
  Baseline latest-20 window for the same candidate history.

The estimate uses the consistently formatted sender/message character count and
approximately four characters per token. It is explicitly an approximation,
not an exact OpenAI token count. Exact provider usage should be recorded during
formal evaluation when available.

After reserving anchors, older positive-scoring messages are considered in BM25
rank order and selected only if they fit the remaining estimated budget. A
ranked message that cannot fit is skipped; anchors remain selected. Remaining
space is backfilled with the most recent unselected messages that fit. This
backfill is an edge-case policy, not a recency component added to BM25 scores.

### 8.6 Edge Cases

- Empty history returns the existing deterministic empty-conversation result.
- Histories containing 20 or fewer valid messages retain all messages.
- An empty tokenized query falls back to the Baseline latest-20 selection.
- No positive BM25 match falls back to the Baseline latest-20 selection.
- Missing query terms contribute zero.
- Exact score ties use chronological ordinal and then message ID.
- The final selected set is restored to chronological order before AI use.

## 9. Frontend Strategy Behavior

The AI panel provides:

- `Baseline — Latest 20 Messages`
- `Method A — BM25`

Baseline is the default. The selected strategy is included in every callable
request. Changing strategy clears displayed Alice and Bob analyses and errors
but does not clear either draft. Strategy changes are disabled while an
analysis request is active, and the existing request-version guard prevents an
invalidated result from appearing later.

Analysis and Use Reply continue to create no message. Only the existing Send
action writes a message.

## 10. Measurements and Diagnostic Visibility

Production structured logs may include only:

- strategy
- retrieved document count
- valid candidate count
- selected message count
- context-selection duration
- approximate selected-context tokens
- approximate Baseline-context tokens
- fallback category

Production logs must not contain raw message text, query terms, document IDs,
Firebase user IDs, credentials, or AI output.

Pure selector diagnostics are available only to tests and local development
fixtures. They expose fictional candidate IDs, BM25 scores, selected IDs, final
chronological IDs, budget skips, and fallback behavior. They are not returned by
the callable or written to production logs.

## 11. Testing and Acceptance Criteria

Automated tests cover tokenization, term frequency, IDF, document-length
normalization, relevance ranking, missing terms, empty queries, empty histories,
small candidate sets, deterministic ties, anchor preservation, budget behavior,
chronological restoration, Baseline preservation, callable validation, and
authentication.

A deterministic fictional fixture contains more than 20 messages. An important
older message outside the Baseline window shares lexical terms with the latest
three messages. The fixture must show that Baseline cannot select it while BM25
can, the anchors remain selected, final output is chronological, and repeated
runs agree.

A negative fixture contains conceptually related messages with no shared lexical
terms. It demonstrates that BM25 can miss relevant information because lexical
matching is not semantic similarity.

The complete Study Project unit, Security Rules, integration, lint, and build
checks must continue to pass unless an assertion is intentionally updated for
the required callable contract.

## 12. Evaluation Methodology

Context selection will be evaluated separately from OpenAI generation using
fictional histories with reference relevant-message IDs and important-fact
annotations. Candidate datasets and budgets must be identical across compared
strategies where their definitions allow it.

Selection metrics may include precision, recall, F1, nDCG, and annotated-fact
retention at the 20-message budget. End-to-end evaluation will separately assess
summary factual coverage, important-information precision, suggested-reply
relevance, speaker perspective, hallucinations, latency, input/output tokens,
and estimated API cost.

The same OpenAI model, prompt, schema, and generation settings must be used
within an experimental comparison. Multiple generation runs may be required
because outputs can vary. Strategy labels should be hidden or randomized during
human review where practical.

No quality improvement will be claimed without measured evidence.

## 13. Technical Constraints and Limitations

- BM25 measures lexical relevance, not semantic similarity.
- Synonyms and paraphrases can cause false negatives.
- Repeated terms and message length influence scores.
- Individual-message ranking can reduce conversational coherence.
- Current-topic retrieval can omit globally important but lexically unrelated
  information.
- The 100-message candidate bound can exclude older information.
- Character-based token estimates are approximate and language-dependent.
- Reading 100 candidates costs more than reading 20 candidates.
- The prototype and evaluation datasets remain small and fictional.
- The project is not production-ready and does not provide long-term AI memory.

## 14. Differences from the Original Study Project

Iteration 1 changes the callable input from `{ replyAs }` to the required
`{ replyAs, strategy }`, adds a larger bounded candidate read for BM25, adds a
frontend selector, introduces selection measurements and fixture-only
diagnostics, and corrects the frontend message window to the latest 100.

It does not change Firestore Security Rules, message writes, the AI output
contract, secret handling, supported users or rooms, or human control over
sending.

## 15. Iterations and Milestones

### Iteration 1

Baseline, BM25, selector UI, validation, measurements, deterministic fixtures,
and full regression testing.

### Future Iteration 2

Introduce and evaluate an explicit recency score while keeping Method A
available unchanged.

### Future Iteration 3

Introduce and evaluate MMR for relevance/diversity trade-offs while keeping all
earlier strategies available unchanged.

Deployment to Firebase Hosting or production Cloud Functions requires separate
explicit approval.
