import { describe, expect, it } from 'vitest'
import { cleanEmail, pickEmails, wholeAmount } from '../forgiving'

describe('cleanEmail', () => {
  it('keeps a plain address, lowercased and trimmed', () => {
    expect(cleanEmail('  Sam@Example.com ')).toBe('sam@example.com')
  })
  it('drops mailto, a name and angle brackets', () => {
    expect(cleanEmail('mailto:sam@x.com')).toBe('sam@x.com')
    expect(cleanEmail('Sam Lee <sam@x.com>')).toBe('sam@x.com')
  })
  it('drops a trailing full stop or comma', () => {
    expect(cleanEmail('sam@x.com.')).toBe('sam@x.com')
    expect(cleanEmail('sam@x.com,')).toBe('sam@x.com')
  })
  it('leaves something that is not an address for the caller to reject', () => {
    expect(cleanEmail('sam')).toBe('sam')
  })
})

describe('pickEmails', () => {
  it('splits on commas, semicolons, spaces and new lines', () => {
    expect(pickEmails('a@x.com, b@x.com;c@x.com\nd@x.com e@x.com').emails).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'])
  })
  it('reads a list pasted from a mail client', () => {
    const r = pickEmails('"Sam Lee" <Sam@x.com>, Ava Cruz <ava@y.org>')
    expect(r).toEqual({ emails: ['sam@x.com', 'ava@y.org'], bad: null })
  })
  it('keeps each address once', () => {
    expect(pickEmails('a@x.com A@x.com').emails).toEqual(['a@x.com'])
  })
  it('names a broken address', () => {
    expect(pickEmails('a@x.com, b@x').bad).toBe('b@x')
  })
  it('names the text when nothing in it is an address', () => {
    expect(pickEmails('sam')).toEqual({ emails: [], bad: 'sam' })
  })
  it('says nothing about empty text', () => {
    expect(pickEmails('  ')).toEqual({ emails: [], bad: null })
  })
})

describe('wholeAmount', () => {
  it('drops the currency sign and thousands commas', () => {
    expect(wholeAmount('$1,250')).toBe('1250')
  })
  it('drops cents rather than folding them into the dollars', () => {
    expect(wholeAmount('20.50')).toBe('20')
    expect(wholeAmount('$19.99')).toBe('19')
  })
  it('ignores words around the number', () => {
    expect(wholeAmount('about 40 bucks')).toBe('40')
  })
  it('drops leading zeros and caps the digits', () => {
    expect(wholeAmount('007')).toBe('7')
    expect(wholeAmount('123456789')).toBe('1234567')
  })
  it('is empty for nothing', () => {
    expect(wholeAmount('')).toBe('')
    expect(wholeAmount('.50')).toBe('')
  })
})
