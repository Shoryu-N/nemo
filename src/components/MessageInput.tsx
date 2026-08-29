type MessageInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
}

const maxMessageLength = 1000

export function MessageInput({ value, onChange, onSend }: MessageInputProps) {
  const trimmedValue = value.trim()

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
        <button type="submit" disabled={trimmedValue.length === 0}>
          Send
        </button>
      </div>
    </form>
  )
}
