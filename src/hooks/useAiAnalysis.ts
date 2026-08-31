import { useCallback, useRef, useState } from 'react'
import { analyzeConversation } from '../firebase/functions'
import type { AiAnalysisResult, DisplayUserId } from '../types/chat'

type AiAnalysisByUser = Record<DisplayUserId, AiAnalysisResult | null>
type AiErrorByUser = Record<DisplayUserId, string | null>
type AiLoadingByUser = Record<DisplayUserId, boolean>

type AiAnalysisState = {
  analyses: AiAnalysisByUser
  isAnalyzingByUser: AiLoadingByUser
  errors: AiErrorByUser
  requestAnalysis: (replyAs: DisplayUserId) => Promise<void>
  clearAllAnalysis: () => void
}

const initialAnalyses: AiAnalysisByUser = {
  alice: null,
  bob: null,
}

const initialErrors: AiErrorByUser = {
  alice: null,
  bob: null,
}

const initialLoading: AiLoadingByUser = {
  alice: false,
  bob: false,
}

export function useAiAnalysis(): AiAnalysisState {
  const [analyses, setAnalyses] =
    useState<AiAnalysisByUser>(initialAnalyses)
  const [isAnalyzingByUser, setIsAnalyzingByUser] =
    useState<AiLoadingByUser>(initialLoading)
  const [errors, setErrors] = useState<AiErrorByUser>(initialErrors)
  const analysisVersion = useRef(0)

  const clearAllAnalysis = useCallback(() => {
    analysisVersion.current += 1
    setAnalyses(initialAnalyses)
    setErrors(initialErrors)
  }, [])

  async function requestAnalysis(replyAs: DisplayUserId) {
    if (isAnalyzingByUser[replyAs]) {
      return
    }

    const requestVersion = analysisVersion.current

    setAnalyses((currentAnalyses) => ({
      ...currentAnalyses,
      [replyAs]: null,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [replyAs]: null,
    }))
    setIsAnalyzingByUser((currentLoading) => ({
      ...currentLoading,
      [replyAs]: true,
    }))

    try {
      const result = await analyzeConversation({ replyAs })
      if (analysisVersion.current === requestVersion) {
        setAnalyses((currentAnalyses) => ({
          ...currentAnalyses,
          [replyAs]: result,
        }))
      }
    } catch {
      if (analysisVersion.current === requestVersion) {
        setAnalyses((currentAnalyses) => ({
          ...currentAnalyses,
          [replyAs]: null,
        }))
        setErrors((currentErrors) => ({
          ...currentErrors,
          [replyAs]: 'Conversation analysis failed. Please try again.',
        }))
      }
    } finally {
      setIsAnalyzingByUser((currentLoading) => ({
        ...currentLoading,
        [replyAs]: false,
      }))
    }
  }

  return {
    analyses,
    isAnalyzingByUser,
    errors,
    requestAnalysis,
    clearAllAnalysis,
  }
}
