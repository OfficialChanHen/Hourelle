import type { ReactNode } from 'react'
import Link from 'next/link'

/* The privacy policy and the terms of use, in one place: the pages at /privacy and
   /terms render them, and the sign-up gate shows the same text in a sheet that has
   to be scrolled to the end. Plain words, and only claims the code actually keeps.
   Bump the version when the substance changes; acceptance is recorded against it. */
export const LEGAL_VERSION = '2026-09-18'

export type LegalKey = 'privacy' | 'terms'

const H = ({ children }: { children: ReactNode }) => <h2 className="mt-7 font-serif text-[22px] leading-[1.15] tracking-[-0.01em] first:mt-0">{children}</h2>
const P = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[14px] leading-[1.65] text-dim">{children}</p>
const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="font-semibold text-accent-text hover:underline">{children}</Link>

function PrivacyBody() {
  return (
    <div>
      <H>What Hourelle is</H>
      <P>Hourelle helps a group settle on a time and a place. One link collects when people are free, where they want to go and who is coming. It is an independent project. Questions about this policy go through the <A href="/help">Help page</A>.</P>

      <H>What we keep about you</H>
      <P>If you make an account, we keep the name you gave, your email address, the colour of your avatar and which way you log in (a password, Google or Microsoft). If you take part in an event as a guest, we keep the name you typed and, only if you chose to give one, your email address, together with a private token that makes your personal link yours.</P>
      <P>For every event we keep what the host put in it: the title, the description, the dates, the places, the budget, how many spots there are and the cover picture, if one was added. We keep what people answer in it: the times they marked as free, their votes on places, whether they are coming, and the messages in the event’s chat.</P>

      <H>Your calendar</H>
      <P>Importing from Google Calendar or Outlook is optional and happens only when you ask for it. With your permission your browser asks the calendar for the times you are busy in the days of the event, works out the free times from that, and shows them on the grid for you to review. The calendar entries themselves, their titles and details, never reach our servers and are never stored. What we save is the availability you end up with, plus a note of which stretches came from a calendar so the grid can mark them. The permission lasts about an hour and the next import asks again. You can disconnect Google or Microsoft from your profile at any time.</P>

      <H>Who can see what</H>
      <P>Anyone who holds an event’s link can open that event and see its details, the availability grid, the places, the votes and the chat, including the names of the people on it. Only the host can change the event or lock it in, and the database enforces that, not just the screen. A host sees the email addresses of the people they invited by email. Nobody else sees anyone’s email address.</P>

      <H>Email we send</H>
      <P>We send email only about events you are part of: an invitation with your personal link, a nudge when a host is waiting on your answer, an announcement when a plan is locked in, and reminders the day before and the day of an event or a deadline. Accounts can turn each kind off in Settings, or turn email off altogether. Guests get reminders only if they gave an email address. Invitations are sent on behalf of the host, and replying to one reaches the host, not us.</P>

      <H>Where it lives and who helps us run it</H>
      <P>Data is stored in a Postgres database hosted by Supabase, which also handles log-in. Email goes out through Resend. Signing in with Google or Microsoft happens on their pages, and they tell us your name and email address; we never see your password with them. Map tiles come from OpenStreetMap, place search from Photon and driving routes from OSRM, which means the text you search for and the coordinates of a route are sent to those services when you use the Location tab. There is no advertising and no analytics, and no third-party script runs on the pages.</P>

      <H>On your device</H>
      <P>Your browser keeps a copy of the events you are part of so pages open at once, your log-in session, and a few preferences such as the theme and the clock style. A guest’s place on an event is remembered on that device. Clearing your browser’s site data removes all of it; a logged-in account gets its events back from the server on the next visit.</P>

      <H>How long we keep it</H>
      <P>Events and everything in them stay until the host deletes the event. A record of each email we sent is kept so nothing is sent twice. Deleting your account from your profile removes your account, the events you host, your place and your answers on other people’s events and the messages you wrote, straight away and for good; you confirm it with your password or by signing in once more, and a note goes to your email address to say it happened. To ask for a copy of your data or for anything this page does not cover, write through the <A href="/help">Help page</A>.</P>

      <H>Children</H>
      <P>Hourelle is not directed at children under 13, and we do not knowingly keep an account for one.</P>

      <H>Changes</H>
      <P>When this policy changes in substance, the date at the top changes and new accounts accept the new version at sign-up. We will not quietly widen what we collect.</P>
    </div>
  )
}

function TermsBody() {
  return (
    <div>
      <H>The service</H>
      <P>Hourelle lets you create an event, invite people to it and settle on a time and a place together. By making an account or joining an event you agree to these terms and to the <A href="/privacy">privacy policy</A>. If you do not agree, please do not use Hourelle.</P>

      <H>Your account</H>
      <P>One account per email address. Give a real name people will recognise and keep your password to yourself. What happens under your account is your responsibility, so tell us through the <A href="/help">Help page</A> if you think someone else has got into it. You may delete your account at any time from your profile.</P>

      <H>What you put in</H>
      <P>Everything you add stays yours: the events, the descriptions, the pictures, the messages. You give us permission to store it and to show it to the people you share the event with, which is what the service is for and nothing more. Only add a picture or a text you have the right to share.</P>

      <H>Inviting people</H>
      <P>When you invite someone by email, Hourelle sends them a message on your behalf. Only invite people who will want to hear from you about the event. Using invitations to send unwanted mail, advertising or anything unrelated to a real event is not allowed and may end your account.</P>

      <H>Behaviour</H>
      <P>Do not use Hourelle to harass, threaten or impersonate anyone, to post anything unlawful, or to interfere with the service or other people’s events. Do not try to get at events or accounts that are not yours, or to copy data out of the service in bulk. Anyone holding an event’s link can open it, so share links with the people the event is for.</P>

      <H>Hosts and guests</H>
      <P>A host decides who is invited, can change or delete the event and can lock in the plan. Everyone else can answer, vote, chat and leave. A guest takes part without an account and is identified by the name they typed and, if they gave one, their email address.</P>

      <H>Availability of the service</H>
      <P>Hourelle is provided as it is. We work to keep it running and to keep your data safe, but we cannot promise it will always be available or free of mistakes, and features may change or be withdrawn. To the extent the law allows, we are not liable for losses that come from using the service or from it being unavailable. Nothing here limits rights the law gives you that cannot be limited.</P>

      <H>Ending things</H>
      <P>You can stop using Hourelle whenever you like and delete your account from your profile. We may suspend or close an account that breaks these terms, and will say why unless the law prevents it.</P>

      <H>Changes</H>
      <P>When these terms change in substance, the date at the top changes and new accounts accept the new version at sign-up. Continuing to use Hourelle after a change means you accept it.</P>
    </div>
  )
}

export const LEGAL: Record<LegalKey, { title: string; eyebrow: string; lead: string; body: ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Privacy',
    lead: 'What Hourelle keeps about you, who can see it, and how to take it away.',
    body: <PrivacyBody />,
  },
  terms: {
    title: 'Terms of Use',
    eyebrow: 'Terms',
    lead: 'The plain rules for having an account and planning events with other people.',
    body: <TermsBody />,
  },
}
