import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions'
import { getFirebaseApp } from './app'
import type { AiAnalysisResult, DisplayUserId } from '../types/chat'

type FunctionsEnv = {
  VITE_USE_FIREBASE_FUNCTIONS_EMULATOR?: string
  VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST?: string
  VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT?: string
  VITE_FIREBASE_FUNCTIONS_REGION?: string
}

type AnalyzeConversationInput = {
  replyAs: DisplayUserId
}

declare global {
  var __nemoFunctionsEmulatorConnected: boolean | undefined
}

const env = import.meta.env as FunctionsEnv
const defaultFunctionsRegion = 'us-central1'
const defaultFunctionsEmulatorHost = '127.0.0.1'
const defaultFunctionsEmulatorPort = 5001

export function getFirebaseFunctions(): Functions {
  const functions = getFunctions(
    getFirebaseApp(),
    env.VITE_FIREBASE_FUNCTIONS_REGION || defaultFunctionsRegion,
  )

  if (
    env.VITE_USE_FIREBASE_FUNCTIONS_EMULATOR === 'true' &&
    !globalThis.__nemoFunctionsEmulatorConnected
  ) {
    connectFunctionsEmulator(
      functions,
      env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST ||
        defaultFunctionsEmulatorHost,
      Number(env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT) ||
        defaultFunctionsEmulatorPort,
    )
    globalThis.__nemoFunctionsEmulatorConnected = true
  }

  return functions
}

export async function analyzeConversation(
  input: AnalyzeConversationInput,
): Promise<AiAnalysisResult> {
  const callable = httpsCallable<AnalyzeConversationInput, unknown>(
    getFirebaseFunctions(),
    'analyzeConversation',
  )
  const result = await callable(input)

  return validateAiAnalysisResult(result.data)
}

export function validateAiAnalysisResult(data: unknown): AiAnalysisResult {
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data)
  ) {
    throw new Error('Analysis result was not valid.')
  }

  const result = data as Record<string, unknown>
  const keys = Object.keys(result)
  const expectedKeys = ['summary', 'importantInformation', 'suggestedReply']

  if (
    keys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => keys.includes(key))
  ) {
    throw new Error('Analysis result was not valid.')
  }

  if (
    typeof result.summary !== 'string' ||
    !Array.isArray(result.importantInformation) ||
    !result.importantInformation.every((item) => typeof item === 'string') ||
    typeof result.suggestedReply !== 'string'
  ) {
    throw new Error('Analysis result was not valid.')
  }

  return {
    summary: result.summary,
    importantInformation: result.importantInformation,
    suggestedReply: result.suggestedReply,
  }
}
