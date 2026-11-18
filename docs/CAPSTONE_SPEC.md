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
3. **Method B:** BM25 plus recency scoring.
4. **Method C:** BM25 plus recency scoring and Maximal Marginal Relevance
   (MMR).
5. **Method D:** BM25 plus MMR, without recency scoring.

Methods A-D form a controlled four-arm comparison. Separating Method B's
recency component from Methods C and D's diversity component allows the study
to attribute observed selection differences to recency, diversity, or their
combination instead of changing both factors in one comparison.

**Method E**, BM25 plus Pseudo-Relevance Feedback (PRF), is planned as separate
future work. PRF will investigate classical, model-free query expansion rather
than the recency/diversity factor comparison.

Iteration 1 asks whether BM25-based selection can retrieve messages that are
lexically relevant to the current topic from a larger bounded history while
maintaining a context budget comparable to the baseline.

Iteration 1 does not claim that BM25 is semantically aware or that it improves
AI output quality.

Iteration 2 completed a literature review of BM25 extensions and alternatives
and produced the revised experimental design above. Iteration 3 implements
Methods B, C, and D incrementally. Methods B-D are now implemented and enabled;
manual OpenAI evaluation of Methods C and D remains pending.

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

## 5. Iteration Status and Scope

### 5.1 Iteration 1 -- Completed

Iteration 1 added:

- An independently testable BM25 implementation in TypeScript.
- A backend strategy selector supporting `baseline` and `bm25`.
- A frontend selector for those two enabled strategies.
- A BM25 candidate pool containing at most the latest 100 valid messages.
- Privacy-safe measurements for selection behavior.
- Deterministic fictional fixtures and development/test diagnostics.
- Automated unit and integration coverage.
- A correction so the frontend displays the latest 100 messages in
  chronological order rather than the oldest 100.

### 5.2 Iteration 2 -- Completed

Iteration 2 reviewed alternatives and extensions to BM25 and revised the
research design to separate recency scoring from diversity-based selection.
It made no production context-selection strategy change.

### 5.3 Iteration 3 -- In Progress

Method B adds BM25 score normalization, exponential timestamp-based recency, a
recency-specific deterministic fixture, explainable local diagnostics, and
focused tests. Methods C and D are also implemented and exposed in the backend
and frontend. They add shared lexical TF-IDF cosine similarity, one shared
greedy MMR selector, an MMR-specific deterministic fixture, and iterative
fixture-only diagnostics. Implementation and automated verification are
complete; the planned manual OpenAI comparison for C/D has not yet been run.

Embeddings, external retrieval APIs, trained retrieval models, and persistent
long-term AI memory remain excluded. Method E is future work rather than part
of the current implementation.

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
  strategy:
    | "baseline"
    | "bm25"
    | "bm25_recency"
    | "bm25_recency_mmr"
    | "bm25_mmr";
}
```

Both fields are required and unexpected fields are rejected. Future strategy
names, including Method E, remain invalid. Ranking parameters are internal and
are not accepted from clients. The callable response retains the exact Study
Project result shape and does not expose selection diagnostics.

## 7. Candidate Retrieval

### 7.1 Baseline

The backend retrieves at most the latest 20 Firestore message documents for the
Baseline strategy. Valid messages are restored to chronological order and sent
without BM25 scoring.

### 7.2 BM25-Based Methods

The backend retrieves at most the latest 100 Firestore message documents for
Methods A-D. This is a bounded research window, not unbounded memory.
Invalid records, including records without a valid Firestore timestamp, are
excluded using backend validation.

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

Method A remains BM25-only. Its scores, ranking behavior, and selection results
are not altered by enabling Method B.

## 9. Method B: BM25 Plus Recency Specification

### 9.1 Purpose

Method B tests whether an explicit recency signal helps prefer a newer relevant
revision over an older message with comparable lexical relevance. It does not
treat recency as relevance: a message must have a positive BM25 score before it
is eligible for combined-score selection.

### 9.2 Normalization and Recency

For eligible historical candidate `d`:

```text
normalizedBM25(d) = BM25(d) / maxBM25
recency(d) = 2 ^ (-ageDays(d) / halfLifeDays)
combinedScore(d) =
  alpha * normalizedBM25(d) + (1 - alpha) * recency(d)
```

`maxBM25` is the highest BM25 score among the historical candidates for the
current query. A zero maximum produces normalized scores of zero without
division by zero. `ageDays` is measured relative to the latest valid
conversation-message timestamp, not wall-clock time, so identical histories
produce identical results. Future-dated candidates are treated as age zero;
invalid timestamps or decay parameters contribute no recency score.

The provisional defaults are `alpha = 0.75` and `halfLifeDays = 7`. These are
configurable internal TypeScript parameters and experimental starting values,
not optimized or empirically validated values. They are not client inputs.

### 9.3 Selection Behavior

Method B uses Method A's latest-three query construction, 100-message candidate
bound, 20-message cap, estimated Baseline token budget, anchor reservation,
fallback/backfill policy, and chronological output restoration. Only positive
BM25 candidates are ranked by the combined score. Therefore a recent
lexically irrelevant message cannot displace a relevant ranked candidate solely
through recency. Exact ties use BM25 score, chronological ordinal, and message
ID for deterministic resolution.

## 10. Methods C and D: Shared MMR Specification

### 10.1 Dependency-Free Lexical Similarity

Methods C and D build TF-IDF vectors for the same complete set of eligible
historical candidate documents in each selection operation. They reuse Method
A's tokenizer and use sparse term-weight maps:

```text
TF(t, d) = count(t, d)
IDF(t) = ln((N + 1) / (DF(t) + 1)) + 1
TFIDF(t, d) = TF(t, d) * IDF(t)

cosine(a, b) = dot(a, b) / (norm(a) * norm(b))
```

`N` is the historical-candidate corpus size and `DF(t)` is the number of those
documents containing `t`. Corpus statistics, sparse vectors, and the symmetric
pairwise similarity matrix are computed once per selection operation where
practical. A zero-magnitude vector has similarity zero, and floating-point
results are clamped to `[0, 1]`. This is lexical similarity, not semantic
equivalence; no embedding model, external service, or retrieval dependency is
used.

### 10.2 Greedy MMR Selection

Both methods call the same iterative selector:

```text
MMR(d) = lambda * relevance(d)
  - (1 - lambda) * maxSimilarity(d, selectedHistorical)
```

The provisional default is `lambda = 0.7`. It is an internal typed parameter
for ablation tests, not a callable/frontend parameter, and is an experimental
starting value rather than an optimized result. Invalid internal lambda values
fall back safely to the default.

The selector begins with no selected historical message, so the first
redundancy penalty is zero. After every selection it recomputes each remaining
candidate's penalty against all previously selected historical messages and
uses the maximum pairwise similarity. A negative MMR score is still eligible:
selection is relative. Parent relevance order resolves exact score ties, and
duplicate message IDs cannot be selected.

The latest three query messages remain mandatory anchors, but do not enter the
similarity penalty. This prevents a historical message from being penalized
merely for sharing the current query terms. Only historical candidates with a
positive original BM25 score enter the primary MMR pool. The existing
20-message limit, Baseline-derived estimated token budget, oversized-candidate
handling, recent backfill, no-match fallback, and final chronological ordering
apply to both methods without strategy-specific exceptions.

### 10.3 Method C: BM25 + Recency + MMR

Method C passes Method B's unchanged combined score to MMR:

```text
relevanceC(d) = 0.75 * normalizedBM25(d) + 0.25 * recency(d)
MMR_C(d) = 0.7 * relevanceC(d)
  - 0.3 * maxSimilarity(d, selectedHistorical)
```

The BM25 defaults remain `k1 = 1.2`, `b = 0.75`; the recency half-life remains
seven days. No additional normalization is applied to Method B's combined
score.

### 10.4 Method D: BM25 + MMR Without Recency

Method D passes normalized BM25 to the same MMR selector:

```text
relevanceD(d) = BM25(d) / maxBM25
MMR_D(d) = 0.7 * relevanceD(d)
  - 0.3 * maxSimilarity(d, selectedHistorical)
```

Method D has no exponential decay, recency-weighted relevance, or implicit
timestamp bonus. It still shares the common latest-three anchors and recent
backfill policy; those bounded-context policies are not scoring signals.

## 11. Frontend Strategy Behavior

The AI panel provides:

- `Baseline — Latest 20 Messages`
- `Method A — BM25`
- `Method B — BM25 + Recency`
- `Method C — BM25 + Recency + MMR`
- `Method D — BM25 + MMR`

Baseline is the default. The selected strategy is included in every callable
request. Changing strategy clears displayed Alice and Bob analyses and errors
but does not clear either draft. Strategy changes are disabled while an
analysis request is active, and the existing request-version guard prevents an
invalidated result from appearing later.

Analysis and Use Reply continue to create no message. Only the existing Send
action writes a message.

## 12. Measurements and Diagnostic Visibility

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
chronological IDs, budget skips, and fallback behavior. Recency diagnostics
also expose normalized BM25 score, age in days, recency score, combined score,
ranking position, and final inclusion. MMR diagnostics add the relevance input,
selection iteration, maximum similarity and responsible selected-message ID,
redundancy penalty, iteration-specific MMR score, MMR inclusion, and budget
skip. They are not returned by the callable or written to production logs.

## 13. Testing and Acceptance Criteria

Automated tests cover tokenization, term frequency, IDF, document-length
normalization, relevance ranking, missing terms, empty queries, empty histories,
small candidate sets, deterministic ties, anchor preservation, budget behavior,
chronological restoration, Baseline preservation, callable validation, and
authentication.

Method B tests additionally cover exponential decay landmarks, invalid input,
BM25 normalization, combined ranking, deterministic ties, the positive-BM25
eligibility gate, alpha-one BM25 equivalence, anchors, budgets, chronological
output, callable validation, and frontend strategy availability.

Methods C and D add focused tests for the documented TF-IDF formula, cosine
symmetry and empty vectors, iterative greedy MMR, maximum-similarity penalties,
negative scores, duplicate IDs, deterministic ties, invalid lambda, count and
budget constraints, lambda-one parent-method equivalence, absence of a Method D
timestamp bonus, all anchors/fallbacks, strict callable validation, and all five
frontend options.

A deterministic fictional fixture contains more than 20 messages. An important
older message outside the Baseline window shares lexical terms with the latest
three messages. The fixture must show that Baseline cannot select it while BM25
can, the anchors remain selected, final output is chronological, and repeated
runs agree.

A negative fixture contains conceptually related messages with no shared lexical
terms. It demonstrates that BM25 can miss relevant information because lexical
matching is not semantic similarity.

A separate deterministic recency fixture contains older and newer messages with
comparable lexical relevance, a revised fact, recent irrelevant messages, and
three anchors. It is a constructed functional test of expected ranking and
budget behavior, not evidence of general performance superiority.

The deterministic 36-message Orion Launch fixture defines eight reference
facts and explicit redundancy groups. It contains 12 repeated launch-date
confirmations, six repeated venue confirmations, complementary facts, old/new
revisions, three recent irrelevant messages, and three multi-fact anchors. Its
test assertions are based on the predefined annotations rather than inferred
from implementation output. The emulator-only `npm run seed:mmr` command is
deterministic, idempotent, loopback-restricted, production-credential guarded,
and refuses unrelated or conflicting room data.

The complete Study Project unit, Security Rules, integration, lint, and build
checks must continue to pass unless an assertion is intentionally updated for
the required callable contract.

## 14. Evaluation Methodology

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

### 14.1 Current Constructed-Fixture Observations

For the Orion fixture, the estimated Baseline budget is 363 tokens. The
deterministic selector produced:

| Strategy | Messages | Est. tokens | Defined facts | Date repeats | Venue repeats | Mean pairwise lexical similarity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 20 | 363 | 7 | 0 | 3 | 0.083 |
| Method A | 16 | 362 | 2 | 11 | 0 | 0.715 |
| Method B | 16 | 363 | 4 | 4 | 6 | 0.512 |
| Method C | 18 | 356 | 8 | 1 | 3 | 0.125 |
| Method D | 18 | 360 | 8 | 4 | 1 | 0.144 |

Defined-fact coverage counts unique predefined fact IDs among selected
historical messages. Redundancy counts are selected historical messages in the
fixture's named groups. Mean pairwise lexical similarity is the average TF-IDF
cosine over unordered selected-historical-message pairs. Lower similarity does
not itself demonstrate a better summary or reply.

On this constructed fixture, both MMR methods covered all eight defined facts
and reduced repeated evidence relative to Method A/B, but both also selected
the old Riverside and new Harbor venue revisions. This is a concrete temporal
consistency trade-off: diversity does not determine which statement is true or
current. On the separate recency fixture, Method C retained newer Harbor Hall;
Method D did not, because it has no recency relevance component. On the
Projector Calibration fixture Methods A-D preserved the older projector fact
and all anchors. On the lexical-mismatch fixture Methods A-D all used the
no-positive-match fallback and still missed the synonym-only old fact.

The earlier one-run manual recency comparison observed Baseline selecting
Harbor Hall in 3.85 seconds, Method A selecting Cedar Hall in 4.12 seconds, and
Method B selecting Harbor Hall in 3.99 seconds. Methods A/B both retained the
highly relevant 60-day-old message, selected 19 messages under the same
333-token estimate, kept all anchors, and excluded recent lexical irrelevance.
These and the deterministic fixture results are preliminary constructed-case
observations, not statistically validated performance or generated-output
quality claims. Manual OpenAI comparison of Methods C/D remains pending.

## 15. Technical Constraints and Limitations

- BM25 measures lexical relevance, not semantic similarity.
- Recency measures age, not truth, importance, or semantic relevance.
- TF-IDF cosine measures lexical similarity, not semantic equivalence.
- MMR diversity does not resolve contradiction or temporal truth.
- The provisional alpha, half-life, and lambda have not been optimized or
  validated.
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

## 16. Differences from the Original Study Project

Iteration 1 changes the callable input from `{ replyAs }` to the required
`{ replyAs, strategy }`, adds a larger bounded candidate read for BM25, adds a
frontend selector, introduces selection measurements and fixture-only
diagnostics, and corrects the frontend message window to the latest 100.

It does not change Firestore Security Rules, message writes, the AI output
contract, secret handling, supported users or rooms, or human control over
sending.

Iteration 3 adds `bm25_recency`, `bm25_recency_mmr`, and `bm25_mmr`; carries
valid message timestamps into the pure selector; and adds local-only recency
and iterative MMR diagnostics. It leaves the OpenAI model, prompt, structured
schema, and explicit user approval behavior unchanged.

## 17. Iterations and Milestones

### Iteration 1

**Completed:** Baseline, BM25, selector UI, validation, measurements,
deterministic fixtures, and regression testing.

### Iteration 2

**Completed:** literature review and revised controlled experimental design.

### Iteration 3

**In progress:** Methods B (BM25 + Recency), C (BM25 + Recency + MMR), and D
(BM25 + MMR) are implemented, exposed, and automatically verified. The manual
OpenAI output comparison for Methods C and D remains to be performed.

### Future Work

**Planned:** Method E (BM25 + PRF) as a separate classical, model-free query
expansion investigation.

Deployment to Firebase Hosting or production Cloud Functions requires separate
explicit approval.
