import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

type MessageData = {
  senderId: string
  senderName: string
  text: string
  createdAt: unknown
}

let testEnv: RulesTestEnvironment

const projectId = 'demo-nemo-rules'

function authenticatedDb(uid = 'phase3-user') {
  return testEnv.authenticatedContext(uid).firestore()
}

function unauthenticatedDb() {
  return testEnv.unauthenticatedContext().firestore()
}

function messagesCollection(db: Firestore) {
  return collection(db, 'rooms', 'main', 'messages')
}

function messageDocument(db: Firestore, id: string) {
  return doc(db, 'rooms', 'main', 'messages', id)
}

function validMessage(overrides: Partial<MessageData> = {}) {
  return {
    senderId: 'alice',
    senderName: 'Alice',
    text: 'Hello Bob.',
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

async function seedValidMessage(id: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(messageDocument(context.firestore(), id), {
      senderId: 'alice',
      senderName: 'Alice',
      text: 'Seed message.',
      createdAt: Timestamp.now(),
    })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('Firestore Security Rules read access', () => {
  it('RULE-001 denies unauthenticated reads from main messages', async () => {
    await assertFails(getDocs(messagesCollection(unauthenticatedDb())))
  })

  it('RULE-002 allows authenticated reads from main messages', async () => {
    await assertSucceeds(getDocs(messagesCollection(authenticatedDb())))
  })
})

describe('Firestore Security Rules message creation', () => {
  it('RULE-003 allows Alice to create a valid message', async () => {
    await assertSucceeds(
      setDoc(messageDocument(authenticatedDb(), 'valid-alice'), validMessage()),
    )
  })

  it('RULE-003 allows Bob to create a valid message', async () => {
    await assertSucceeds(
      setDoc(
        messageDocument(authenticatedDb(), 'valid-bob'),
        validMessage({
          senderId: 'bob',
          senderName: 'Bob',
          text: 'Hello Alice.',
        }),
      ),
    )
  })

  it('RULE-004 denies empty message text', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'empty-text'),
        validMessage({ text: '' }),
      ),
    )
  })

  it('RULE-005 denies ASCII spaces-only message text', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'spaces-only'),
        validMessage({ text: '     ' }),
      ),
    )
  })

  it('RULE-006 denies tabs and newlines-only message text', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'tabs-newlines-only'),
        validMessage({ text: '\t\n\r' }),
      ),
    )
  })

  it('RULE-007 denies Unicode whitespace-only message text', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'unicode-whitespace-only'),
        validMessage({ text: '\u3000' }),
      ),
    )
  })

  it('RULE-008 allows exactly 1000 characters of valid text', async () => {
    await assertSucceeds(
      setDoc(
        messageDocument(authenticatedDb(), 'max-length'),
        validMessage({ text: 'a'.repeat(1000) }),
      ),
    )
  })

  it('RULE-009 denies 1001 characters of valid text', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'over-max-length'),
        validMessage({ text: 'a'.repeat(1001) }),
      ),
    )
  })

  it('RULE-010 denies invalid senderId', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'invalid-sender-id'),
        validMessage({ senderId: 'charlie', senderName: 'Charlie' }),
      ),
    )
  })

  it('RULE-011 denies Alice senderId with Bob senderName', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'alice-bob-mismatch'),
        validMessage({ senderId: 'alice', senderName: 'Bob' }),
      ),
    )
  })

  it('RULE-012 denies Bob senderId with Alice senderName', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'bob-alice-mismatch'),
        validMessage({ senderId: 'bob', senderName: 'Alice' }),
      ),
    )
  })

  it('RULE-013 denies unexpected additional fields', async () => {
    await assertFails(
      setDoc(messageDocument(authenticatedDb(), 'extra-field'), {
        ...validMessage(),
        editedAt: serverTimestamp(),
      }),
    )
  })

  it('RULE-014 denies missing senderId', async () => {
    const message = validMessage() as Partial<MessageData>
    delete message.senderId

    await assertFails(
      setDoc(messageDocument(authenticatedDb(), 'missing-sender-id'), message),
    )
  })

  it('RULE-014 denies missing senderName', async () => {
    const message = validMessage() as Partial<MessageData>
    delete message.senderName

    await assertFails(
      setDoc(messageDocument(authenticatedDb(), 'missing-sender-name'), message),
    )
  })

  it('RULE-014 denies missing text', async () => {
    const message = validMessage() as Partial<MessageData>
    delete message.text

    await assertFails(
      setDoc(messageDocument(authenticatedDb(), 'missing-text'), message),
    )
  })

  it('RULE-014 denies missing createdAt', async () => {
    const message = validMessage() as Partial<MessageData>
    delete message.createdAt

    await assertFails(
      setDoc(messageDocument(authenticatedDb(), 'missing-created-at'), message),
    )
  })

  it('RULE-015 allows server timestamp request-time semantics', async () => {
    await assertSucceeds(
      setDoc(
        messageDocument(authenticatedDb(), 'server-timestamp'),
        validMessage({ createdAt: serverTimestamp() }),
      ),
    )
  })

  it('RULE-016 denies arbitrary client-provided timestamps', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'client-timestamp'),
        validMessage({ createdAt: Timestamp.fromMillis(0) }),
      ),
    )
  })

  it('RULE-017 denies null createdAt', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'null-created-at'),
        validMessage({ createdAt: null }),
      ),
    )
  })

  it('RULE-017 denies string createdAt', async () => {
    await assertFails(
      setDoc(
        messageDocument(authenticatedDb(), 'string-created-at'),
        validMessage({ createdAt: 'now' }),
      ),
    )
  })
})

describe('Firestore Security Rules immutability', () => {
  it('RULE-018 denies updates to existing messages', async () => {
    await seedValidMessage('update-target')

    await assertFails(
      updateDoc(messageDocument(authenticatedDb(), 'update-target'), {
        text: 'Edited message.',
      }),
    )
  })

  it('RULE-019 denies deletes of existing messages', async () => {
    await seedValidMessage('delete-target')

    await assertFails(deleteDoc(messageDocument(authenticatedDb(), 'delete-target')))
  })
})

describe('Firestore Security Rules path restrictions', () => {
  it('RULE-020 denies unrelated path reads and writes', async () => {
    const db = authenticatedDb()
    const unrelatedDocument = doc(db, 'profiles', 'alice')

    await assertFails(getDocs(collection(db, 'profiles')))
    await assertFails(setDoc(unrelatedDocument, { name: 'Alice' }))
  })

  it('RULE-021 denies access to another room', async () => {
    const db = authenticatedDb()
    const otherRoomMessages = collection(db, 'rooms', 'other', 'messages')
    const otherRoomMessage = doc(db, 'rooms', 'other', 'messages', 'message-1')

    await assertFails(getDocs(otherRoomMessages))
    await assertFails(setDoc(otherRoomMessage, validMessage()))
  })
})
