import { useEffect, useState } from 'react'
import {
  sendMessageToMainRoom,
  subscribeToMainRoomMessages,
} from '../firebase/firestore'
import type { ChatMessage, DisplayUser } from '../types/chat'

type UseMessagesState = {
  messages: ChatMessage[]
  isLoading: boolean
  isSending: boolean
  error: string | null
  sendMessage: (sender: DisplayUser, text: string) => Promise<boolean>
}

export function useMessages(enabled: boolean): UseMessagesState {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const unsubscribe = subscribeToMainRoomMessages(
      (nextMessages) => {
        setMessages(nextMessages)
        setIsLoading(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [enabled])

  async function sendMessage(sender: DisplayUser, text: string) {
    if (!enabled || isSending) {
      return false
    }

    setIsSending(true)
    setError(null)

    try {
      await sendMessageToMainRoom({
        senderId: sender.id,
        senderName: sender.name,
        text,
      })
      return true
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'Could not send message.'

      setError(message)
      return false
    } finally {
      setIsSending(false)
    }
  }

  return {
    messages,
    isLoading: enabled && isLoading,
    isSending,
    error,
    sendMessage,
  }
}
