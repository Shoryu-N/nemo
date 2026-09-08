import { describe, expect, it } from 'vitest'
import {
  isValidMessageText,
  maxMessageLength,
  normalizeMessageText,
} from '../src/types/chat'

describe('message text helpers', () => {
  it('rejects an empty string', () => {
    expect(isValidMessageText('')).toBe(false)
  })

  it('rejects ASCII whitespace-only text', () => {
    expect(isValidMessageText('   ')).toBe(false)
  })

  it('rejects tabs and newlines-only text', () => {
    expect(isValidMessageText('\t\n\r')).toBe(false)
  })

  it('rejects Unicode whitespace-only text where trim supports it', () => {
    expect(isValidMessageText('\u3000')).toBe(false)
  })

  it('normalizes leading and trailing whitespace', () => {
    expect(normalizeMessageText('  Hello, Bob. \n')).toBe('Hello, Bob.')
  })

  it('accepts normal valid text', () => {
    expect(isValidMessageText('Hello, Alice.')).toBe(true)
  })

  it('accepts exactly 1000 characters', () => {
    expect(isValidMessageText('a'.repeat(maxMessageLength))).toBe(true)
  })

  it('rejects 1001 characters', () => {
    expect(isValidMessageText('a'.repeat(maxMessageLength + 1))).toBe(false)
  })
})
