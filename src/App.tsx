import { useState } from 'react'
import { AiPanel } from './components/AiPanel'
import { ChatMessageList } from './components/ChatMessageList'
import { MessageInput } from './components/MessageInput'
import { UserSwitcher } from './components/UserSwitcher'
import type {
  AiAnalysisResult,
  ChatMessage,
  DisplayUser,
  DisplayUserId,
} from './types/chat'
import './App.css'

const displayUsers: DisplayUser[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
]

const initialMessages: ChatMessage[] = [
  {
    id: 'message-1',
    senderId: 'alice',
    senderName: 'Alice',
    text: 'Hi Bob, can we review the study project outline before Friday?',
    createdAtLabel: '09:10',
  },
  {
    id: 'message-2',
    senderId: 'bob',
    senderName: 'Bob',
    text: 'Yes. I can check the Firebase section tonight and note any missing parts.',
    createdAtLabel: '09:12',
  },
  {
    id: 'message-3',
    senderId: 'alice',
    senderName: 'Alice',
    text: 'Great. I will prepare fictional chat examples for the AI analysis demo.',
    createdAtLabel: '09:15',
  },
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
  const [selectedUserId, setSelectedUserId] =
    useState<DisplayUserId>('alice')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [messageText, setMessageText] = useState('')

  const selectedUser = displayUsers.find((user) => user.id === selectedUserId)

  function handleSendMessage() {
    const text = messageText.trim()

    if (!text || !selectedUser) {
      return
    }

    const nextMessage: ChatMessage = {
      id: `message-${messages.length + 1}`,
      senderId: selectedUser.id,
      senderName: selectedUser.name,
      text,
      createdAtLabel: 'Now',
    }

    setMessages((currentMessages) => [...currentMessages, nextMessage])
    setMessageText('')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Academic Phase 2 PoC</p>
          <h1>AI-Assisted Chat</h1>
        </div>
        <p className="room-label">Room: main</p>
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
          />
          <MessageInput
            value={messageText}
            onChange={setMessageText}
            onSend={handleSendMessage}
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
