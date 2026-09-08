import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteApp, getApps } from 'firebase/app'
import { signOut } from 'firebase/auth'
import {
  Timestamp,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-key')
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo-nemo-integration.firebaseapp.com')
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-nemo-integration')
vi.stubEnv('VITE_FIREBASE_APP_ID', 'demo-app-id')
vi.stubEnv('VITE_USE_FIREBASE_AUTH_EMULATOR', 'true')
vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:19099')
vi.stubEnv('VITE_USE_FIRESTORE_EMULATOR', 'true')
vi.stubEnv('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1')
vi.stubEnv('VITE_FIRESTORE_EMULATOR_PORT', '18081')
vi.stubEnv('VITE_USE_FIREBASE_FUNCTIONS_EMULATOR', 'true')
vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST', '127.0.0.1')
vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT', '15001')
vi.stubEnv('VITE_FIREBASE_FUNCTIONS_REGION', 'us-central1')

const projectId = 'demo-nemo-integration'
const listenerTimeoutMs = 5000

const authModule = await import('../../src/firebase/auth')
const firestoreModule = await import('../../src/firebase/firestore')
const functionsModule = await import('../../src/firebase/functions')

let testEnv: RulesTestEnvironment

async function signInAnonymously() {
  return authModule.signInWithAnonymousAuth()
}

async function signOutIfNeeded() {
  const auth = authModule.getFirebaseAuth()

  if (auth.currentUser) {
    await signOut(auth)
  }
}

async function seedMessage(
  id: string,
  text: string,
  createdAt: Timestamp,
  senderId: 'alice' | 'bob' = 'alice',
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), 'rooms', 'main', 'messages', id),
      {
        senderId,
        senderName: senderId === 'alice' ? 'Alice' : 'Bob',
        text,
        createdAt,
      },
    )
  })
}

function waitForMessages(
  predicate: (messages: { text: string }[]) => boolean,
) {
  return new Promise<Awaited<
    ReturnType<typeof collectMessages>
  >>((resolve, reject) => {
    let unsubscribe = () => {}
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('Timed out waiting for Firestore listener.'))
    }, listenerTimeoutMs)

    unsubscribe = firestoreModule.subscribeToMainRoomMessages(
      (messages) => {
        if (predicate(messages)) {
          clearTimeout(timeout)
          unsubscribe()
          resolve(messages)
        }
      },
      (message) => {
        clearTimeout(timeout)
        unsubscribe()
        reject(new Error(message))
      },
    )
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
  })
})

beforeEach(async () => {
  await signOutIfNeeded()
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await signOutIfNeeded()
  await Promise.all(getApps().map((app) => deleteApp(app)))
  await testEnv.cleanup()
})

describe('Firebase emulator integration', () => {
  it('INT-001 allows an anonymous Auth Emulator user to access Firestore', async () => {
    const user = await signInAnonymously()

    expect(user.isAnonymous).toBe(true)

    await firestoreModule.sendMessageToMainRoom({
      senderId: 'alice',
      senderName: 'Alice',
      text: 'Authenticated Firestore write.',
    })

    const snapshot = await getDocs(
      doc(
        firestoreModule.getFirebaseFirestore(),
        'rooms',
        'main',
        'messages',
        'placeholder',
      ).parent,
    )

    expect(snapshot.docs.map((message) => message.data().text)).toContain(
      'Authenticated Firestore write.',
    )
  })

  it('INT-002 writes through the frontend module and receives the message through the listener', async () => {
    await signInAnonymously()
    const messagesPromise = waitForMessages((messages) =>
      messages.some((message) => message.text === 'Listener integration.'),
    )

    await firestoreModule.sendMessageToMainRoom({
      senderId: 'bob',
      senderName: 'Bob',
      text: 'Listener integration.',
    })

    const messages = await messagesPromise

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senderId: 'bob',
          senderName: 'Bob',
          text: 'Listener integration.',
        }),
      ]),
    )
  })

  it('INT-003 exposes messages in chronological order through the listener', async () => {
    await seedMessage('third', 'Third message.', Timestamp.fromMillis(3000))
    await seedMessage('first', 'First message.', Timestamp.fromMillis(1000))
    await seedMessage('second', 'Second message.', Timestamp.fromMillis(2000))
    await signInAnonymously()

    const messages = await waitForMessages((nextMessages) =>
      nextMessages.length === 3,
    )

    expect(messages.map((message) => message.text)).toEqual([
      'First message.',
      'Second message.',
      'Third message.',
    ])
  })

  it('INT-004 rejects unauthenticated analyzeConversation calls', async () => {
    await expect(
      functionsModule.analyzeConversation({ replyAs: 'alice' }),
    ).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    })
  })

  it('INT-005 rejects authenticated analyzeConversation calls with invalid input', async () => {
    await signInAnonymously()

    await expect(
      functionsModule.analyzeConversation({
        replyAs: 'charlie',
      } as Parameters<typeof functionsModule.analyzeConversation>[0]),
    ).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    })

    await expect(
      functionsModule.analyzeConversation({
        replyAs: 'alice',
        roomId: 'main',
      } as Parameters<typeof functionsModule.analyzeConversation>[0]),
    ).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    })
  })

  it('INT-006 returns structured empty-conversation analysis without OpenAI', async () => {
    await signInAnonymously()

    const result = await functionsModule.analyzeConversation({
      replyAs: 'bob',
    })

    expect(result).toEqual({
      summary: 'No conversation to summarize.',
      importantInformation: [],
      suggestedReply: '',
    })
  })
})
