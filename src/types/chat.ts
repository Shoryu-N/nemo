export type DisplayUserId = 'alice' | 'bob'

export type DisplayUser = {
  id: DisplayUserId
  name: 'Alice' | 'Bob'
}

export type ChatMessage = {
  id: string
  senderId: DisplayUserId
  senderName: DisplayUser['name']
  text: string
  createdAtLabel: string
}

export type AiAnalysisResult = {
  summary: string
  importantInformation: string[]
  suggestedReply: string
}
