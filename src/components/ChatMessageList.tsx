import type { ChatMessage, DisplayUserId } from '../types/chat'

type ChatMessageListProps = {
  messages: ChatMessage[]
  selectedUserId: DisplayUserId
}

export function ChatMessageList({
  messages,
  selectedUserId,
}: ChatMessageListProps) {
  return (
    <section className="panel chat-panel" aria-labelledby="chat-title">
      <div className="section-header">
        <div>
          <h2 id="chat-title">Room: main</h2>
          <p className="section-note">Temporary fictional messages for Milestone 1.</p>
        </div>
      </div>

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
