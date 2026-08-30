import { useState } from 'react'
import { AiPanel } from './components/AiPanel'
import { ChatMessageList } from './components/ChatMessageList'
import { MessageInput } from './components/MessageInput'
import { UserSwitcher } from './components/UserSwitcher'
import { useAnonymousAuth } from './hooks/useAnonymousAuth'
import { useMessages } from './hooks/useMessages'
import type {
  AiAnalysisResult,
  DisplayUser,
  DisplayUserId,
} from './types/chat'
import './App.css'

const displayUsers: DisplayUser[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
]

const placeholderAnalysis: AiAnalysisResult = {
  summary:
    'Alice and Bob are coordinating a review of their study project outline.',
  importantInformation: [
    'Bob will review the Firebase section tonight.',
    'Alice will prepare fictional chat examples for the demo.',
    'The outline should be reviewed before Friday.',
  ],
  suggestedReply:
    'Thanks, Alice. I will share my Firebase notes after reviewing them tonight.',
}

function App() {
  const { user, isLoading, error } = useAnonymousAuth()
  const {
    messages,
    isLoading: areMessagesLoading,
    isSending,
    error: messagesError,
    sendMessage,
  } = useMessages(Boolean(user) && !isLoading && !error)
  const [selectedUserId, setSelectedUserId] =
    useState<DisplayUserId>('alice')
  const [messageText, setMessageText] = useState('')

  const selectedUser = displayUsers.find((user) => user.id === selectedUserId)

  async function handleSendMessage() {
    const text = messageText.trim()

    if (!text || !selectedUser) {
      return
    }

    const didSend = await sendMessage(selectedUser, text)

    if (didSend) {
      setMessageText('')
    }
  }

  if (isLoading) {
    return (
      <main className="app-shell centered-state">
        <section className="panel status-panel" aria-live="polite">
          <p className="eyebrow">Firebase Authentication</p>
          <h1>Signing in anonymously...</h1>
          <p className="section-note">
            The chat prototype will load after Firebase Authentication is ready.
          </p>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="app-shell centered-state">
        <section className="panel status-panel" role="alert">
          <p className="eyebrow">Firebase Authentication</p>
          <h1>Authentication failed</h1>
          <p>{error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Academic Phase 2 PoC</p>
          <h1>AI-Assisted Chat</h1>
        </div>
        <div className="header-meta">
          <p className="room-label">Room: main</p>
          <p className="auth-label">Firebase Auth: {user?.isAnonymous ? 'anonymous' : 'ready'}</p>
        </div>
      </header>

      <div className="workspace">
        <section className="chat-column" aria-label="Chat workspace">
          <UserSwitcher
            users={displayUsers}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
          />
          <ChatMessageList
            messages={messages}
            selectedUserId={selectedUserId}
            isLoading={areMessagesLoading}
            error={messagesError}
          />
          <MessageInput
            value={messageText}
            onChange={setMessageText}
            onSend={handleSendMessage}
            isSending={isSending}
          />
        </section>

        <AiPanel
          analysis={placeholderAnalysis}
          onAnalyze={() => undefined}
          onUseReply={() => setMessageText(placeholderAnalysis.suggestedReply)}
        />
      </div>
    </main>
  )
}

export default App
