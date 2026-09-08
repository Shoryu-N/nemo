import { describe, expect, it } from 'vitest'
import { validateAiAnalysisResult } from '../src/firebase/functions'

const validResult = {
  summary: 'Alice and Bob agreed to meet tomorrow.',
  importantInformation: ['Meet tomorrow.'],
  suggestedReply: 'Sounds good.',
}

describe('frontend AI result validation', () => {
  it('accepts the exact expected AI result shape', () => {
    expect(validateAiAnalysisResult(validResult)).toEqual(validResult)
  })

  it('rejects a missing summary', () => {
    expect(() => validateAiAnalysisResult({
      importantInformation: [],
      suggestedReply: 'Okay.',
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects a summary with the wrong type', () => {
    expect(() => validateAiAnalysisResult({
      ...validResult,
      summary: 123,
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects importantInformation with the wrong type', () => {
    expect(() => validateAiAnalysisResult({
      ...validResult,
      importantInformation: 'Meet tomorrow.',
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects non-string importantInformation entries', () => {
    expect(() => validateAiAnalysisResult({
      ...validResult,
      importantInformation: ['Meet tomorrow.', 123],
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects suggestedReply with the wrong type', () => {
    expect(() => validateAiAnalysisResult({
      ...validResult,
      suggestedReply: null,
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects another missing field', () => {
    expect(() => validateAiAnalysisResult({
      summary: 'Summary.',
      importantInformation: [],
    })).toThrow('Analysis result was not valid.')
  })

  it('rejects unexpected extra fields', () => {
    expect(() => validateAiAnalysisResult({
      ...validResult,
      confidence: 0.9,
    })).toThrow('Analysis result was not valid.')
  })
})
