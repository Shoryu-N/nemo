import { isValidMessageText, maxMessageLength } from '../types/chat'

type MessageInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isSending: boolean
}

export function MessageInput({
  value,
  onChange,
  onSend,
  isSending,
}: MessageInputProps) {
  const canSend = isValidMessageText(value)

  return (
    <form
      className="message-input"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <label htmlFor="message-text">Message</label>
      <textarea
        id="message-text"
        maxLength={maxMessageLength}
        placeholder="Type a text message..."
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="input-actions">
        <span>{value.length}/{maxMessageLength}</span>
        <button type="submit" disabled={!canSend || isSending}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  )
}
