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
- AI output containing:
  - `summary`
  - `importantInformation`
  - `suggestedReply`
- Separate AI-analysis state for Alice and Bob
- Stale AI-analysis invalidation when the conversation changes
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
        | analyzeConversation({ replyAs })
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
4. The callable function retrieves recent valid messages and requests structured AI output.
5. The frontend displays the summary, important information, and suggested reply.
6. The user may click Use Reply to insert the suggestion into the editable draft.
7. The user can edit the draft.
8. The message is sent only when the user explicitly clicks Send.

AI-generated replies are never sent automatically.

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
firebase emulators:start
```

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

## Validation Results

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
- Live AI evaluation used a small fictional scenario set
- AI output can vary between runs
- Performance validation was small-scale and was not production load testing
- Unicode whitespace handling was tested for required and common cases, not exhaustive Unicode normalization
