import { useState } from 'react'
import { analyzeConversation } from '../firebase/functions'
import type { AiAnalysisResult, DisplayUserId } from '../types/chat'

type AiAnalysisState = {
  analysis: AiAnalysisResult | null
  isAnalyzing: boolean
  error: string | null
  requestAnalysis: (replyAs: DisplayUserId) => Promise<void>
}

export function useAiAnalysis(): AiAnalysisState {
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestAnalysis(replyAs: DisplayUserId) {
    if (isAnalyzing) {
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeConversation({ replyAs })
      setAnalysis(result)
    } catch {
      setError('Conversation analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return { analysis, isAnalyzing, error, requestAnalysis }
}
