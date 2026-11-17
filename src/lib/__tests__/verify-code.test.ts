import { describe, expect, it } from 'vitest'
import { cleanCode, codeReady, CODE_MAX, CODE_MIN, verifyHref } from '@/lib/verify-code'

describe('cleanCode', () => {
  it('keeps the digits of a typed code', () => {
    expect(cleanCode('123456')).toBe('123456')
  })
  it('drops the spaces, dashes and dots a pasted code carries', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456')
    expect(cleanCode('123-456')).toBe('123456')
    expect(cleanCode('12.34.56')).toBe('123456')
  })
  it('pulls the code out of a pasted sentence', () => {
    expect(cleanCode('Your code is 482913')).toBe('482913')
  })
  it('reads full-width digits as plain ones', () => {
    expect(cleanCode('１２３４５６')).toBe('123456')
  })
  it('stops at the longest code Supabase sends', () => {
    expect(cleanCode('12345678901234')).toHaveLength(CODE_MAX)
  })
})

describe('codeReady', () => {
  it('wants at least the shortest code', () => {
    expect(codeReady('12345')).toBe(false)
    expect(codeReady('1'.repeat(CODE_MIN))).toBe(true)
  })
  it('takes the longer codes a project can be set to', () => {
    expect(codeReady('12345678')).toBe(true)
  })
})

describe('verifyHref', () => {
  it('carries the address and where to go next', () => {
    expect(verifyHref('a+b@x.com', '/events/1/join')).toBe('/auth/verify?email=a%2Bb%40x.com&next=%2Fevents%2F1%2Fjoin')
  })
  it('leaves out the default destination', () => {
    expect(verifyHref('a@x.com', '/home')).toBe('/auth/verify?email=a%40x.com')
  })
})
