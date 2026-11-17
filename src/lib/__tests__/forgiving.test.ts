import { describe, expect, it } from 'vitest'
import { cleanEmail, meetingHref, meetingSource, onMeeting, pickEmails, wholeAmount } from '../forgiving'

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

describe('meetingHref', () => {
  it('keeps a full link as it is', () => {
    expect(meetingHref(' https://zoom.us/j/123?pwd=x ')).toBe('https://zoom.us/j/123?pwd=x')
  })
  it('adds https to a link pasted without one', () => {
    expect(meetingHref('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij')
  })
  it('takes the link out of a pasted "Join <link>" line', () => {
    expect(meetingHref('Join Zoom Meeting <https://us02web.zoom.us/j/123>')).toBe('https://us02web.zoom.us/j/123')
  })
  it('is empty when nothing in it is a link', () => {
    expect(meetingHref('')).toBe('')
    expect(meetingHref('ask Sam')).toBe('')
    expect(meetingHref('javascript:alert(1)')).toBe('')
  })
})

describe('meetingSource', () => {
  it('names the big platforms from the link host', () => {
    expect(meetingSource('https://us02web.zoom.us/j/123')).toBe('Zoom')
    expect(meetingSource('zoom.com/j/1')).toBe('Zoom')
    expect(meetingSource('https://meet.google.com/abc-defg-hij')).toBe('Google Meet')
    expect(meetingSource('https://teams.microsoft.com/l/meetup-join/x')).toBe('Teams')
    expect(meetingSource('https://teams.live.com/meet/9')).toBe('Teams')
    expect(meetingSource('https://discord.gg/abc')).toBe('Discord')
    expect(meetingSource('https://discord.com/channels/1/2')).toBe('Discord')
    expect(meetingSource('https://acme.webex.com/meet/sam')).toBe('Webex')
    expect(meetingSource('https://meet.jit.si/OurRoom')).toBe('Jitsi')
    expect(meetingSource('https://whereby.com/sam')).toBe('Whereby')
    expect(meetingSource('https://facetime.apple.com/join#v=1')).toBe('FaceTime')
    expect(meetingSource('https://app.slack.com/huddle/T1/C2')).toBe('Slack')
    expect(meetingSource('https://call.whatsapp.com/video/abc')).toBe('WhatsApp')
    expect(meetingSource('https://join.skype.com/abc')).toBe('Skype')
    expect(meetingSource('https://meet.goto.com/123')).toBe('GoTo Meeting')
  })
  it('ignores case and a www in front', () => {
    expect(meetingSource('HTTPS://WWW.Zoom.US/j/1')).toBe('Zoom')
  })
  it('calls an empty or unknown link custom', () => {
    expect(meetingSource('')).toBe('Custom')
    expect(meetingSource('   ')).toBe('Custom')
    expect(meetingSource('https://calls.example.org/room')).toBe('Custom')
    expect(meetingSource('not a link')).toBe('Custom')
  })
  it('is not fooled by a lookalike host', () => {
    expect(meetingSource('https://zoom.us.evil.com/j/1')).toBe('Custom')
    expect(meetingSource('https://notzoom.us/j/1')).toBe('Custom')
    expect(meetingSource('https://evil.com/meet.google.com')).toBe('Custom')
  })
})

describe('onMeeting', () => {
  it('reads as a clause after "on"', () => {
    expect(onMeeting('https://zoom.us/j/1')).toBe('Zoom')
    expect(onMeeting('')).toBe('a custom link')
  })
})
