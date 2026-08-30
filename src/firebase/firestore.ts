import {
  Timestamp,
  addDoc,
  collection,
  connectFirestoreEmulator,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseApp } from './app'
import {
  maxMessageLength,
  type ChatMessage,
  type DisplayUser,
  type DisplayUserId,
} from '../types/chat'

type FirestoreEnv = {
  VITE_USE_FIRESTORE_EMULATOR?: string
  VITE_FIRESTORE_EMULATOR_HOST?: string
  VITE_FIRESTORE_EMULATOR_PORT?: string
}

type FirestoreMessageData = {
  senderId?: unknown
  senderName?: unknown
  text?: unknown
  createdAt?: unknown
}

type SendMessageInput = {
  senderId: DisplayUserId
  senderName: DisplayUser['name']
  text: string
}

declare global {
  var __nemoFirestoreEmulatorConnected: boolean | undefined
}

const env = import.meta.env as FirestoreEnv
const fixedRoomId = 'main'
const defaultFirestoreEmulatorHost = '127.0.0.1'
const defaultFirestoreEmulatorPort = 8080

export function getFirebaseFirestore(): Firestore {
  const firestore = getFirestore(getFirebaseApp())

  if (
    env.VITE_USE_FIRESTORE_EMULATOR === 'true' &&
    !globalThis.__nemoFirestoreEmulatorConnected
  ) {
    connectFirestoreEmulator(
      firestore,
      env.VITE_FIRESTORE_EMULATOR_HOST || defaultFirestoreEmulatorHost,
      Number(env.VITE_FIRESTORE_EMULATOR_PORT) ||
        defaultFirestoreEmulatorPort,
    )
    globalThis.__nemoFirestoreEmulatorConnected = true
  }

  return firestore
}

export async function sendMessageToMainRoom({
  senderId,
  senderName,
  text,
}: SendMessageInput) {
  const trimmedText = text.trim()

  if (!trimmedText) {
    throw new Error('Message cannot be empty.')
  }

  if (trimmedText.length > maxMessageLength) {
    throw new Error(`Message cannot exceed ${maxMessageLength} characters.`)
  }

  await addDoc(getMainRoomMessagesCollection(), {
    senderId,
    senderName,
    text: trimmedText,
    createdAt: serverTimestamp(),
  })
}

export function subscribeToMainRoomMessages(
  onMessages: (messages: ChatMessage[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const messagesQuery = query(
    getMainRoomMessagesCollection(),
    orderBy('createdAt', 'asc'),
    limit(100),
  )

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onMessages(snapshot.docs.map(toChatMessage))
    },
    (unknownError) => {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'Could not load messages.'

      onError(message)
    },
  )
}

function getMainRoomMessagesCollection() {
  return collection(
    getFirebaseFirestore(),
    'rooms',
    fixedRoomId,
    'messages',
  )
}

function toChatMessage(
  documentSnapshot: QueryDocumentSnapshot,
): ChatMessage {
  const data = documentSnapshot.data() as FirestoreMessageData

  return {
    id: documentSnapshot.id,
    senderId: normalizeSenderId(data.senderId),
    senderName: normalizeSenderName(data.senderName),
    text: typeof data.text === 'string' ? data.text : '',
    createdAtLabel: formatTimestamp(data.createdAt),
  }
}

function normalizeSenderId(value: unknown): DisplayUserId {
  return value === 'bob' ? 'bob' : 'alice'
}

function normalizeSenderName(value: unknown): DisplayUser['name'] {
  return value === 'Bob' ? 'Bob' : 'Alice'
}

function formatTimestamp(value: unknown) {
  if (!(value instanceof Timestamp)) {
    return 'Pending'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value.toDate())
}
