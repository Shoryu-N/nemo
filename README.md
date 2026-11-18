# AI-Assisted Chat Proof of Concept

This repository contains an academic proof-of-concept chat application that uses Firebase and OpenAI to help a user understand a conversation and prepare a reply. The application supports one fixed chat room, two predefined display identities, real-time text messaging, conversation summarization, important-information extraction, and one editable suggested reply.

This project is **not a production-ready messaging platform**. It was implemented and validated within the scope of a university Study Project.

## Main Features

- Firebase Anonymous Authentication
- One fixed chat room: `main`
- Two predefined display identities: `Alice` and `Bob`
- Separate Alice/Bob message drafts
- Text-only message sending
- Cloud Firestore message storage
- Real-time Firestore message listener
- Chronological message display
- Message validation with a 1000-character limit
- Firestore Security Rules for authenticated, fixed-room access
- Callable Cloud Function for AI conversation analysis
- Selectable conversation context strategy:
  - Baseline — latest 20 messages
  - Method A — BM25 lexical relevance selection
  - Method B — BM25 plus reproducible recency scoring
  - Method C — BM25 plus recency and MMR diversity selection
  - Method D — BM25 plus MMR diversity selection, without recency
- AI output containing:
  - `summary`
  - `importantInformation`
  - `suggestedReply`
- Separate AI-analysis state for Alice and Bob
- Stale AI-analysis invalidation when the conversation changes
- Latest 100 chat messages displayed in chronological order
- Editable Use Reply workflow
- Explicit user-controlled Send action
- Firebase deployment support

Alice and Bob are application-level display identities. They are not separate Firebase user accounts.

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Authentication | Firebase Anonymous Authentication |
| Database | Cloud Firestore |
| Backend | Cloud Functions for Firebase v2 |
| AI Provider | OpenAI API, called from Cloud Functions only |
| Hosting | Firebase Hosting |
| Testing | Vitest, Firebase Emulator Suite, `@firebase/rules-unit-testing` |

## High-Level Architecture

```text
React + TypeScript frontend
        |
        | Firebase Anonymous Authentication
        v
Cloud Firestore
  - rooms/main/messages/{messageId}
  - real-time listener
  - restrictive Security Rules

React frontend
        |
        | callable function:
        | analyzeConversation({ replyAs, strategy })
        v
Cloud Functions for Firebase v2
        |
        | server-side OPENAI_API_KEY secret
        v
OpenAI API
```

Only the backend Cloud Function calls OpenAI. The OpenAI API key is never placed in frontend code.

## Human-in-the-Loop AI Workflow

1. The user signs in anonymously.
2. The user sends and receives text messages in the fixed `main` room.
3. The user explicitly clicks Analyze Conversation.
4. The callable function retrieves a bounded valid-message history and applies
   the selected Baseline or Method A-D context strategy.
5. At most 20 selected messages are restored to chronological order and sent to
   OpenAI for structured analysis.
6. The frontend displays the summary, important information, and suggested reply.
7. The user may click Use Reply to insert the suggestion into the editable draft.
8. The user can edit the draft.
9. The message is sent only when the user explicitly clicks Send.

AI-generated replies are never sent automatically.

## Capstone Context Selection

The original Study Project behavior remains available as the Baseline strategy:
the backend retrieves and sends the latest 20 valid messages without BM25
processing.

Method A retrieves a bounded candidate history of up to 100 messages. It builds
a lexical query from the latest three messages, reserves those messages as
anchors, and uses BM25 to rank older candidates. Selection is limited to 20
messages and an approximate character-based token budget comparable to the
Baseline window. The selected set is restored to chronological order before AI
analysis.

Method B reuses the same query, anchors, candidate bound, and context budget.
It normalizes BM25 and combines it with exponential timestamp decay using the
latest conversation timestamp as the reference. Its provisional internal
parameters are `alpha = 0.75` and `halfLifeDays = 7`. Only candidates with a
positive BM25 score are eligible, so recency alone cannot select an irrelevant
message.

Methods C and D add one shared greedy Maximal Marginal Relevance (MMR)
selector. Method C supplies Method B's combined BM25/recency score as
relevance; Method D supplies normalized BM25 and has no timestamp-based
relevance term. Both use the provisional internal value `lambda = 0.7`:

```text
MMR(d) = lambda * relevance(d)
  - (1 - lambda) * maxSimilarity(d, selectedHistorical)
```

Similarity is dependency-free lexical TF-IDF cosine similarity over the same
historical candidate corpus. The latest three messages remain mandatory
anchors, but they do not contribute to the redundancy penalty. MMR is applied
iteratively to positive-BM25 historical candidates; the existing 20-message
cap, estimated Baseline token budget, fallback/backfill rules, and final
chronological ordering remain unchanged. `lambda` is an experimental starting
parameter, not an optimized value or a client request field.

BM25 and TF-IDF similarity are lexical, not semantic. They may retrieve or
compare messages that share wording, but may miss synonyms or globally
important facts unrelated to the current topic. Diversity can also retain an
outdated fact alongside a newer correction. Any improvement in final AI output
remains a hypothesis requiring evaluation. Detailed design and evaluation
requirements are in `docs/CAPSTONE_SPEC.md`.

## Project Structure

```text
.
├── src/
│   ├── components/        # React UI components
│   ├── firebase/          # Firebase app, Auth, Firestore, Functions clients
│   ├── hooks/             # React state hooks for auth, messages, AI analysis
│   └── types/             # Shared frontend chat types and validation helpers
│
├── functions/
│   ├── src/               # Cloud Functions and AI provider integration
│   └── test/              # Functions unit tests
│
├── test/
│   ├── unit/              # Frontend/root unit tests
│   ├── rules/             # Firestore Security Rules tests
│   └── integration/       # Firebase Emulator integration tests
│
├── docs/                  # Project documentation and Phase 3 validation evidence
├── firestore.rules        # Firestore Security Rules
├── firestore.indexes.json # Firestore index configuration
└── firebase.json          # Firebase Hosting, Functions, Firestore, emulator config
```

## Local Setup

### Prerequisites

- Node.js compatible with the project dependencies
- npm
- Firebase CLI
- Java runtime for the Firestore Emulator
- Firebase project for deployment
- OpenAI API key for live AI analysis

Install root dependencies:

```bash
npm install
```

Install Functions dependencies:

```bash
npm --prefix functions install
```

## Environment Configuration

Create a local environment file such as `.env.local` for the Firebase web configuration.

```env
VITE_FIREBASE_API_KEY=<YOUR_FIREBASE_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=<YOUR_FIREBASE_AUTH_DOMAIN>
VITE_FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
VITE_FIREBASE_APP_ID=<YOUR_FIREBASE_APP_ID>
VITE_FIREBASE_MESSAGING_SENDER_ID=<YOUR_FIREBASE_MESSAGING_SENDER_ID>
VITE_FIREBASE_STORAGE_BUCKET=<YOUR_FIREBASE_STORAGE_BUCKET>

VITE_FIREBASE_FUNCTIONS_REGION=us-central1
```

For local emulator development, set the emulator flags to `true`:

```env
VITE_USE_FIREBASE_AUTH_EMULATOR=true
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099

VITE_USE_FIRESTORE_EMULATOR=true
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1
VITE_FIRESTORE_EMULATOR_PORT=8080

VITE_USE_FIREBASE_FUNCTIONS_EMULATOR=true
VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT=5001
```

For a production Vite build, ensure that the emulator flags are absent or set to `false`.

### OpenAI Secret

The OpenAI API key is stored as a server-side Firebase Functions secret named:

```text
OPENAI_API_KEY
```

Configure it with the Firebase CLI before deploying the function:

```bash
firebase functions:secrets:set OPENAI_API_KEY --project <YOUR_FIREBASE_PROJECT_ID>
```

Do not place the OpenAI API key in frontend `.env` files or commit it to the repository.

## Firebase Emulator Suite

The default emulator ports are configured in `firebase.json`:

| Emulator | Port |
| --- | ---: |
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |

Start the local emulators:

```bash
firebase emulators:start --project nemo-chat-app-645d
```

The emulator project ID must match `VITE_FIREBASE_PROJECT_ID` in `.env.local`.
Using a different project ID causes the frontend and callable/Firestore emulator
namespaces to diverge.

### Seed the BM25 Projector Calibration fixture

With the emulators running, seed the deterministic 24-message fictional
conversation from another terminal:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:bm25
```

The command is deliberately restricted to a loopback Firestore Emulator. It
also verifies the running emulator project against `VITE_FIREBASE_PROJECT_ID`
and refuses to run when production service-account credentials are configured.
It never reads or prints an API key.

The fixture is written to `rooms/main/messages` with deterministic document
IDs, alternating Alice/Bob identities, and one-minute timestamps beginning at
`2026-01-01T00:00:00Z`. A successful first run reports 24 created messages. A
repeat run reports 0 created and 0 updated, without creating duplicates.

If unrelated messages or modified fixture documents already exist in the room,
the command stops without changing data. To reset the local fictional
conversation safely, stop the Emulator Suite and restart it without an import
or exported-data option, then run the seed command again. This clears the
ephemeral local emulator state; do not delete or overwrite unrelated documents
with the seed utility.

Verify the fixture in the Emulator UI at `http://127.0.0.1:4000`, or start the
application with `npm run dev` and confirm that 24 messages appear in
chronological order. For a repeatable Baseline-versus-BM25 experiment, avoid
sending additional messages after seeding. Baseline uses messages 5-24 and
therefore excludes the blue-folder fact in message 2; Method A should retrieve
that fact from the larger candidate history while retaining messages 22-24 as
anchors.

### Compare Method A and Method B with the recency fixture

This is a constructed functional comparison, not evidence that Method B is
generally superior. Start with an empty ephemeral Emulator Suite:

```bash
firebase emulators:start --project nemo-chat-app-645d
```

In a second terminal, seed the deterministic 24-message Aurora Venue fixture:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:recency
```

The seeder uses explicit timestamps spread across days and weeks, is
idempotent, accepts only a loopback Firestore Emulator, rejects production
credentials, and refuses to alter a room containing unrelated or conflicting
documents.

Start the frontend in a third terminal:

```bash
npm run dev
```

Open the local Vite URL. Select `Method A — BM25`, explicitly run Analyze
Conversation, and record Summary, Important Information, and Suggested Reply.
Then select `Method B — BM25 + Recency`, confirm that the previous analysis is
invalidated while any message draft remains, and explicitly run Analyze
Conversation again. No request runs merely by switching strategies.

For the deterministic selector behavior, Method A includes the older Cedar
Hall revision and excludes the newer comparable Harbor Hall revision at the
fixture's context budget. Method B includes Harbor Hall and excludes Cedar
Hall. Both retain the strongly relevant old contract message and all three
anchors; the recent lunch and book messages remain excluded. Inspect the exact
fictional-ID ranking and scores without OpenAI:

```bash
SHOW_CONTEXT_DIAGNOSTICS=true npm --prefix functions test -- test/contextSelection/diagnostics.test.ts --reporter=verbose
```

Method B diagnostics show message ID, original and normalized BM25, age in
days, recency, combined score, rank, and final inclusion. These details are
test-only and are not returned by the callable or logged in production. Any
difference in generated Summary, Important Information, or Suggested Reply
must be recorded as a manual observation; the fixture alone does not establish
an AI-output improvement.

The completed manual comparison on this one constructed recency conversation
was: Baseline selected Harbor Hall in 3.85 seconds, Method A selected Cedar
Hall in 4.12 seconds, and Method B selected Harbor Hall in 3.99 seconds. Both
retrieval methods retained the highly relevant 60-day-old message, used 19
messages under the same 333-token estimate, kept all three anchors, and
excluded recent lexical irrelevance. These are preliminary single-run
observations, not statistically validated performance findings.

### Compare Methods A-D with the MMR fixture

Use an empty, ephemeral Emulator Suite. If another fictional dataset is
present, stop the suite and restart it without `--import`; this safely clears
the emulator's in-memory data. The seeder intentionally refuses to delete,
overwrite, or mix with unrelated/conflicting room documents.

```bash
firebase emulators:start --project nemo-chat-app-645d
```

In a second terminal, seed the deterministic 36-message Orion Launch fixture:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:mmr
```

The command has the same loopback-only, project-verification, credential
rejection, conflict-detection, deterministic, and idempotent protections as
the existing fixture seeders. A second identical run creates and updates zero
documents.

Inspect selection without calling OpenAI:

```bash
SHOW_CONTEXT_DIAGNOSTICS=true npm --prefix functions test -- \
  test/contextSelection/diagnostics.test.ts --reporter=verbose
```

The fixture-only output includes per-candidate BM25/normalized BM25,
Method C age and recency, MMR relevance, the selection iteration, maximum
similarity and its selected-message ID, redundancy penalty, iteration-specific
MMR score, final inclusion, budget skips, fallback/backfill status, final IDs,
and compact strategy metrics. Distinct-fact coverage means the number of the
eight predefined historical facts represented. Mean pairwise lexical
similarity is the average TF-IDF cosine over unordered selected-historical
pairs; a lower value does not itself mean better generated output.

Start the frontend separately:

```bash
npm run dev
```

For each of Baseline and Methods A-D, select the strategy, explicitly click
Analyze Conversation, and record Summary, Important Information, and Suggested
Reply before switching. Switching clears stale analysis but preserves message
drafts and does not start an analysis or send a reply. Inspect whether the
output preserves these predefined facts: launch date, venue, equipment
delivery, technical requirement, responsible team, access instruction, backup
power, and safety contact. Also inspect the 12 repeated date confirmations,
six repeated venue confirmations, and the Riverside-to-Harbor, east-to-west
gate, and 08:30-to-09:00 revisions. The deterministic selector comparison
shows redundancy reduction and broader fixture fact coverage for C/D, but both
can retain old and new venue revisions. Generated-output quality remains for a
separate manual OpenAI experiment.

Run emulator-backed test suites:

```bash
npm run test:rules
npm run test:integration
```

The Rules and integration test commands use isolated test project IDs and local emulator ports.

## Build and Test Commands

Root/frontend:

```bash
npm test
npm run test:rules
npm run test:integration
npm run lint
npm run build
```

Functions:

```bash
npm --prefix functions test
npm --prefix functions run lint
npm --prefix functions run build
```

Development server:

```bash
npm run dev
```

Preview the production frontend build locally:

```bash
npm run preview
```

## Deployment

Before deploying, make sure the required Firebase services are configured for your Firebase project.

### 1. Select the Firebase project

```bash
firebase use <YOUR_FIREBASE_PROJECT_ID>
```

### 2. Configure Firebase services

Confirm the following in the Firebase Console:

- Anonymous Authentication is enabled
- Cloud Firestore is configured
- Cloud Functions for Firebase requirements are enabled
- Firebase Hosting is configured

### 3. Configure the OpenAI secret

```bash
firebase functions:secrets:set OPENAI_API_KEY --project <YOUR_FIREBASE_PROJECT_ID>
```

### 4. Build and validate

```bash
npm test
npm run test:rules
npm run test:integration
npm run lint
npm run build

npm --prefix functions test
npm --prefix functions run lint
npm --prefix functions run build
```

### 5. Deploy

Deploy all configured Firebase resources:

```bash
firebase deploy --project <YOUR_FIREBASE_PROJECT_ID>
```

Alternatively, deploy resources separately:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project <YOUR_FIREBASE_PROJECT_ID>

firebase deploy --only functions --project <YOUR_FIREBASE_PROJECT_ID>

firebase deploy --only hosting --project <YOUR_FIREBASE_PROJECT_ID>
```

## Study Project Baseline Validation Results

Phase 3 validation produced the following recorded results:

| Category | Result |
| --- | --- |
| Frontend Unit Tests | 16 passed, 0 failed |
| Functions Unit Tests | 23 passed, 0 failed |
| Firestore Security Rules Tests | 26 passed, 0 failed |
| Firebase Integration Tests | 6 passed, 0 failed |
| Automated Total | 71 passed, 0 failed |
| Manual UI / Exploratory Tests | 16 passed, 0 partial, 0 failed |
| Live OpenAI Quality Scenarios | 8 passed, 0 partial, 0 failed |

During Firestore Security Rules testing, messages containing only U+3000 full-width whitespace were found to be accepted by the previous rule. The rule was tightened, and the complete Security Rules test suite passed afterward.

### Performance Observations

| Measurement | Average and Range |
| --- | --- |
| Message send to UI appearance | Approx. 0.41 s; 0.35–0.51 s |
| Real-time propagation between two browsers | Approx. 0.72 s; 0.65–0.80 s |
| Analyze Conversation with live OpenAI | Approx. 3.75 s; 3.00–5.65 s |
| Repeated Analyze Conversation | Approx. 4.11 s; 3.16–6.28 s |

These measurements are small-scale proof-of-concept observations and should not be interpreted as production-scale performance or load-testing evidence.

## Capstone Iteration 1 Automated Validation

The following table records the completed Iteration 1 validation baseline;
current Method A-D verification is reported by the commands above and in the
implementation handoff:

| Category | Result |
| --- | --- |
| Frontend Unit Tests | 16 passed, 0 failed |
| Functions Unit Tests | 47 passed, 0 failed |
| Firestore Security Rules Tests | 26 passed, 0 failed |
| Firebase Integration Tests | 8 passed, 0 failed |
| Automated Total | 97 passed, 0 failed |
| Frontend TypeScript/Vite Build | Pass |
| Functions TypeScript Build | Pass |
| Frontend and Functions Lint | Pass |

The Functions tests include deterministic fictional positive, recency,
lexical-mismatch, and MMR fixtures. To inspect fixture-only candidate scores,
MMR iteration details, selected IDs, chronological output, metrics, and fallback
assertions, run:

```bash
SHOW_CONTEXT_DIAGNOSTICS=true npm --prefix functions test -- \
  --run test/contextSelection/diagnostics.test.ts --disableConsoleIntercept
```

These diagnostics are not returned by the production callable and production
logs contain only aggregate counts, timings, approximate token estimates, and
fallback categories.

## Current Limitations

- Academic proof of concept, not production-ready
- One fixed room only: `main`
- Exactly two display identities: Alice and Bob
- Alice and Bob are not separate authenticated Firebase users
- Text messages only
- No attachments or images
- No reactions, notifications, read receipts, typing indicators, or message search
- No message editing or deletion workflow
- No offline support
- AI analysis uses limited recent conversation context
- BM25 selection is lexical and can miss paraphrases or synonyms
- TF-IDF cosine is lexical similarity, not semantic equivalence
- MMR diversity can preserve complementary evidence but can also retain an
  outdated fact alongside a newer correction
- The provisional recency and MMR parameters are not empirically optimized
- The BM25 candidate history is bounded to the latest 100 messages
- Context token counts used during selection are character-based estimates, not
  exact OpenAI token counts
- Live AI evaluation used a small fictional scenario set
- AI output can vary between runs
- Performance validation was small-scale and was not production load testing
- Unicode whitespace handling was tested for required and common cases, not exhaustive Unicode normalization
