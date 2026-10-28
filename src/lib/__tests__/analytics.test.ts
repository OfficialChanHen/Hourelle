import { describe, expect, it } from 'vitest'
import { redactUrl } from '@/lib/analytics'

describe('redactUrl', () => {
  it('replaces a plan id so the plan link never leaves the browser', () => {
    expect(redactUrl('https://hourelle.com/events/0b1c2d3e-aaaa-bbbb-cccc-123456789abc')).toBe('https://hourelle.com/events/[id]')
  })
  it('keeps the page under a plan, without its query', () => {
    expect(redactUrl('https://hourelle.com/events/abc/join?token=secret&invite=x')).toBe('https://hourelle.com/events/[id]/join')
  })
  it('drops the query and hash from any page', () => {
    expect(redactUrl('https://hourelle.com/auth/callback?next=/events/abc#access_token=secret')).toBe('https://hourelle.com/auth/callback')
    expect(redactUrl('https://hourelle.com/events?filter=past')).toBe('https://hourelle.com/events')
  })
  it('leaves other pages alone', () => {
    expect(redactUrl('https://hourelle.com/')).toBe('https://hourelle.com/')
    expect(redactUrl('https://hourelle.com/templates')).toBe('https://hourelle.com/templates')
  })
})
