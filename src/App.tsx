import { useEffect, useMemo, useRef, useState } from 'react'
import { AiPanel } from './components/AiPanel'
import { ChatMessageList } from './components/ChatMessageList'
import { MessageInput } from './components/MessageInput'
import { UserSwitcher } from './components/UserSwitcher'
import { useAnonymousAuth } from './hooks/useAnonymousAuth'
import { useAiAnalysis } from './hooks/useAiAnalysis'
import { useMessages } from './hooks/useMessages'
import {
  isValidMessageText,
  normalizeMessageText,
  type DisplayUser,
  type DisplayUserId,
} from './types/chat'
import './App.css'

const displayUsers: DisplayUser[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
]

const initialDrafts: Record<DisplayUserId, string> = {
  alice: '',
  bob: '',
}

function createConversationSignature(messages: ReturnType<typeof useMessages>['messages']) {
  return JSON.stringify(
    messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
    })),
  )
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
  const {
    analyses,
    isAnalyzingByUser,
    errors: analysisErrors,
    requestAnalysis,
    clearAllAnalysis,
  } = useAiAnalysis()
  const [selectedUserId, setSelectedUserId] =
    useState<DisplayUserId>('alice')
  const [drafts, setDrafts] =
    useState<Record<DisplayUserId, string>>(initialDrafts)

  const selectedUser = displayUsers.find((user) => user.id === selectedUserId)
  const currentAnalysis = analyses[selectedUserId]
  const isAnalyzing = isAnalyzingByUser[selectedUserId]
  const analysisError = analysisErrors[selectedUserId]
  const messageText = drafts[selectedUserId]
  const conversationSignature = useMemo(
    () => createConversationSignature(messages),
    [messages],
  )
  const lastConversationSignature = useRef<string | null>(null)
  const clearAllAnalysisRef = useRef(clearAllAnalysis)

  useEffect(() => {
    clearAllAnalysisRef.current = clearAllAnalysis
  }, [clearAllAnalysis])

  useEffect(() => {
    if (areMessagesLoading || isSending) {
      return
    }

    if (lastConversationSignature.current === null) {
      lastConversationSignature.current = conversationSignature
      return
    }

    if (lastConversationSignature.current !== conversationSignature) {
      lastConversationSignature.current = conversationSignature
      clearAllAnalysisRef.current()
    }
  }, [areMessagesLoading, conversationSignature, isSending])

  function setSelectedDraft(text: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedUserId]: text,
    }))
  }

  async function handleSendMessage() {
    const text = normalizeMessageText(messageText)

    if (!isValidMessageText(messageText) || !selectedUser) {
      return
    }

    const didSend = await sendMessage(selectedUser, text)

    if (didSend) {
      setSelectedDraft('')
      clearAllAnalysis()
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
            onSelectUser={(userId) => {
              if (userId !== selectedUserId) {
                setSelectedUserId(userId)
              }
            }}
          />
          <ChatMessageList
            messages={messages}
            selectedUserId={selectedUserId}
            isLoading={areMessagesLoading}
            error={messagesError}
          />
          <MessageInput
            value={messageText}
            onChange={setSelectedDraft}
            onSend={handleSendMessage}
            isSending={isSending}
          />
        </section>

        <AiPanel
          analysis={currentAnalysis}
          isAnalyzing={isAnalyzing}
          error={analysisError}
          onAnalyze={() => void requestAnalysis(selectedUserId)}
          onUseReply={() => {
            if (currentAnalysis?.suggestedReply) {
              setSelectedDraft(currentAnalysis.suggestedReply)
            }
          }}
        />
      </div>
    </main>
  )
}

export default App
