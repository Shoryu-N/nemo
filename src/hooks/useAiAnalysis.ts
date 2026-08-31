import { useCallback, useState } from 'react'
import { analyzeConversation } from '../firebase/functions'
import type { AiAnalysisResult, DisplayUserId } from '../types/chat'

type AiAnalysisState = {
  analysis: AiAnalysisResult | null
  analysisReplyAs: DisplayUserId | null
  isAnalyzing: boolean
  error: string | null
  requestAnalysis: (replyAs: DisplayUserId) => Promise<void>
  clearAnalysis: () => void
}

export function useAiAnalysis(): AiAnalysisState {
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null)
  const [analysisReplyAs, setAnalysisReplyAs] =
    useState<DisplayUserId | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearAnalysis = useCallback(() => {
    setAnalysis(null)
    setAnalysisReplyAs(null)
    setError(null)
  }, [])

  async function requestAnalysis(replyAs: DisplayUserId) {
    if (isAnalyzing) {
      return
    }

    setAnalysis(null)
    setAnalysisReplyAs(null)
    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeConversation({ replyAs })
      setAnalysis(result)
      setAnalysisReplyAs(replyAs)
    } catch {
      setAnalysis(null)
      setAnalysisReplyAs(null)
      setError('Conversation analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return {
    analysis,
    analysisReplyAs,
    isAnalyzing,
    error,
    requestAnalysis,
    clearAnalysis,
  }
}
