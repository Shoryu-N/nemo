import type { ChatMessage, DisplayUserId } from '../types/chat'

type ChatMessageListProps = {
  messages: ChatMessage[]
  selectedUserId: DisplayUserId
  isLoading: boolean
  error: string | null
}

export function ChatMessageList({
  messages,
  selectedUserId,
  isLoading,
  error,
}: ChatMessageListProps) {
  return (
    <section className="panel chat-panel" aria-labelledby="chat-title">
      <div className="section-header">
        <div>
          <h2 id="chat-title">Room: main</h2>
          <p className="section-note">Messages are shown in chronological order.</p>
        </div>
      </div>

      {isLoading && <p className="state-message">Loading messages...</p>}
      {error && <p className="state-message error-message">{error}</p>}
      {!isLoading && !error && messages.length === 0 && (
        <p className="state-message">No messages yet.</p>
      )}

      <ol className="message-list">
        {messages.map((message) => {
          const isOwnMessage = message.senderId === selectedUserId

          return (
            <li
              key={message.id}
              className={`message ${isOwnMessage ? 'own-message' : ''}`}
            >
              <div className="message-meta">
                <span>{message.senderName}</span>
                <time>{message.createdAtLabel}</time>
              </div>
              <p>{message.text}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
