import type { ReactNode } from 'react'
import Link from 'next/link'

/* The privacy policy and the terms and conditions, as data: the pages at /privacy and
   /terms render them with a summary, a table of contents and numbered sections, and
   the sign-up sheet renders the same text with a reading bar. Plain words, and only
   claims the code actually keeps. Bump the version when the substance changes;
   acceptance is recorded against it. */
export const LEGAL_VERSION = '2026-09-18'
export const LEGAL_EFFECTIVE = 'September 18, 2026'

export type LegalKey = 'privacy' | 'terms'
export type LegalSection = { id: string; title: string; paragraphs: string[]; items?: string[] }
export type LegalDoc = { title: string; short: string; eyebrow: string; lead: string; summary: string[]; sections: LegalSection[] }

/* paragraphs are plain strings with one convention: [text](/path) becomes a link */
export function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<Link key={m.index} href={m[2]} className="font-semibold text-accent-text hover:underline">{m[1]}</Link>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** a reading time from the words in a document, at an unhurried pace */
export function readingMinutes(doc: LegalDoc): number {
  const words = [...doc.summary, ...doc.sections.flatMap((s) => [...s.paragraphs, ...(s.items ?? [])])].join(' ').split(/\s+/).length
  return Math.max(1, Math.round(words / 180))
}

const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  short: 'Privacy Policy',
  eyebrow: 'Privacy',
  lead: 'What Hourelle collects, why, who it is shared with, and the choices you have.',
  summary: [
    'We keep what you give us to plan events: your name and email, the events you create or join, and what you answer in them.',
    'Calendar imports are read in your browser. The entries themselves never reach our servers.',
    'There is no advertising, no analytics and no selling of data. We share only with the services that run the app.',
    'Deleting your account removes everything about it, straight away and for good.',
  ],
  sections: [
    {
      id: 'who-we-are', title: 'Who we are and what this policy covers',
      paragraphs: [
        'Hourelle is an independent service for settling on a time and a place with other people. It is operated by its maker, reachable through the [Help page](/help). This policy explains what personal information Hourelle collects when you use the website at hourelle.com, how it is used, who it is shared with and the rights you have over it.',
        'It applies to everyone who uses the service: people with an account, guests who join an event by a link, and visitors reading the public pages.',
      ],
    },
    {
      id: 'what-we-collect', title: 'Information we collect',
      paragraphs: [
        'Account information. When you create an account we store the name you give, your email address, the colour of your avatar, and which way you sign in: a password, Google or Microsoft. Google and Microsoft tell us your name and email address; we never see the password you use with them.',
        'Event content. For each event we store what the host adds: the title, description, dates, places, budget, number of spots, and a cover picture if one was uploaded. We store what participants add: the times they mark as free, their votes on places, whether they are coming, and the messages in the event chat.',
        'Guest information. A guest who joins by a link gives a name and, only if they choose, an email address. We store both, together with a private token that makes their personal link theirs.',
        'Calendar data. If you import from Google Calendar or Outlook, your browser asks the calendar, with your permission, for the times you are busy during the event’s days, works out your free times, and shows them for you to review. The calendar entries, their titles and their details are never sent to our servers and never stored. What we keep is the availability you save, plus a note of which stretches your calendar showed as busy, so the grid can mark them. The permission lasts about an hour, and the next import asks again.',
        'Information on your device. Your browser keeps a copy of the events you are part of so pages open at once, your sign-in session, a guest’s place on an event, and a few preferences such as the theme and clock style.',
        'Technical information. Our hosting provider keeps standard request logs, including the address of the device making the request, the page requested and the time, for a short period, as every website’s host does. We do not add our own tracking to this.',
      ],
    },
    {
      id: 'how-we-use', title: 'How we use information',
      paragraphs: [
        'We use the information above to run the service: to show an event to the people it was shared with, to work out when a group is free, to send the emails described below, to remember who you are between visits, and to keep the service secure. We do not use it for advertising, profiling or any purpose unrelated to the events you are part of.',
      ],
    },
    {
      id: 'legal-basis', title: 'Our legal basis',
      paragraphs: [
        'If you are in the United Kingdom or the European Economic Area, the law asks us to say why we may process your information. We process it because it is needed to provide the service you asked for, which is our contract with you; because you consented, which is the case for calendar imports and for the optional email a guest gives; and, for keeping the service secure and understanding how it is used, because we have a legitimate interest in running it well that does not override your rights.',
      ],
    },
    {
      id: 'sharing', title: 'Who we share information with',
      paragraphs: [
        'We never sell personal information. We share it only with the people it is meant for and with the providers that run the service on our behalf, each of which handles data under its own agreement with us.',
      ],
      items: [
        'People on your events. Anyone who holds an event’s link can see that event: its details, the availability grid, the places, the votes and the chat, including the names of the people on it. A host also sees the email addresses of the people they invited by email. Nobody else sees anyone’s email address.',
        'Supabase, which hosts our database and handles sign-in.',
        'Resend, which delivers the emails we send.',
        'Vercel, which hosts the website and keeps the request logs mentioned above.',
        'Google and Microsoft, when you choose to sign in with them or to import a calendar. Their handling of your data is governed by their own privacy policies.',
        'OpenStreetMap, Photon and OSRM, which provide map tiles, place search and driving routes on the Location tab. The text you search for and the coordinates of a route are sent to them when you use those features.',
        'Authorities, if the law requires us to, and only to the extent it requires.',
      ],
    },
    {
      id: 'emails', title: 'Emails we send',
      paragraphs: [
        'We send email only about events you are part of: an invitation with your personal link, a nudge when a host is waiting on your answer, an announcement when a plan is locked in, reminders the day before and the day of an event or a deadline, and a notice when your account is deleted. Accounts can turn each kind off in Settings, or turn email off altogether. Guests receive reminders only if they gave an email address. Invitations are sent on behalf of the host, and replying to one reaches the host, not us.',
      ],
    },
    {
      id: 'cookies', title: 'Cookies and local storage',
      paragraphs: [
        'Hourelle does not use advertising or analytics cookies. Your browser stores your sign-in session and a copy of your events in its own storage so that the service works and pages open quickly. Clearing your browser’s site data removes all of it; an account gets its events back from the server on the next visit.',
      ],
    },
    {
      id: 'retention', title: 'How long we keep information',
      paragraphs: [
        'Events and everything in them stay until the host deletes the event. A record of each email we sent, holding the address and the kind of message, is kept so nothing is sent twice. Deleting your account from your profile removes your account, the events you host, your place and answers on other people’s events and the messages you wrote, immediately and permanently; you confirm it with your password or by signing in once more, and a note goes to your email address to say it happened.',
      ],
    },
    {
      id: 'your-rights', title: 'Your rights and choices',
      paragraphs: [
        'You can see and change your name, avatar colour and email settings on your profile, delete any event you host, leave any event you joined, and delete your account. Depending on where you live you may also have the right to ask for a copy of your information, to have it corrected or erased, to restrict or object to how it is used, or to complain to a data protection authority. Write to us through the [Help page](/help) for any of these and we will answer within a month.',
      ],
    },
    {
      id: 'security', title: 'Security',
      paragraphs: [
        'Data travels over encrypted connections and is stored with a provider that encrypts it at rest. Access rules in the database, not only the screen, decide who may change an event. Passwords are never stored in a form we can read. No service can promise perfect security, and if we learn of a breach affecting you we will tell you without undue delay.',
      ],
    },
    {
      id: 'children', title: 'Children',
      paragraphs: [
        'Hourelle is not directed at children under 13, and we do not knowingly keep an account for anyone under that age. If you believe a child has made one, write to us and we will remove it.',
      ],
    },
    {
      id: 'transfers', title: 'Where information is stored',
      paragraphs: [
        'Information is stored in data centres operated by our providers. If you use Hourelle from outside the country where those centres are, your information is transferred there. Our providers commit to safeguards for such transfers that the law recognises.',
      ],
    },
    {
      id: 'changes', title: 'Changes to this policy',
      paragraphs: [
        'When this policy changes in substance, the effective date at the top changes, new accounts accept the new version at sign-up, and we will tell existing accounts by email or a notice in the app. We will not quietly widen what we collect.',
      ],
    },
    {
      id: 'contact', title: 'Contact',
      paragraphs: ['Questions, requests and complaints about this policy go through the [Help page](/help).'],
    },
  ],
}

const TERMS: LegalDoc = {
  title: 'Terms and Conditions',
  short: 'Terms and Conditions',
  eyebrow: 'Terms',
  lead: 'The agreement between you and Hourelle for using the service.',
  summary: [
    'Hourelle is free to host and free to join. Using it means you agree to these terms and to the Privacy Policy.',
    'What you add stays yours. You let us store it and show it to the people you share the event with.',
    'Invite people who want to hear from you, treat others decently, and do not tamper with the service.',
    'The service is provided as it is, without guarantees, and either of us can end the relationship at any time.',
  ],
  sections: [
    {
      id: 'agreement', title: 'Agreement to these terms',
      paragraphs: [
        'These terms and conditions are an agreement between you and Hourelle, operated by its maker and reachable through the [Help page](/help). By creating an account, joining an event or otherwise using the service at hourelle.com you agree to them and to the [Privacy Policy](/privacy), which explains how personal information is handled. If you do not agree, please do not use the service.',
      ],
    },
    {
      id: 'eligibility', title: 'Who may use Hourelle',
      paragraphs: [
        'You must be at least 13 years old to use Hourelle, and old enough to enter into this agreement where you live. If you use the service on behalf of an organisation, you confirm that you may bind it to these terms.',
      ],
    },
    {
      id: 'accounts', title: 'Your account',
      paragraphs: [
        'One account per email address. Give a real name that the people you plan with will recognise, keep your password to yourself, and tell us through the Help page if you think someone else has got into your account. You are responsible for what happens under it. You may delete your account at any time from your profile, which removes it and everything in it as described in the Privacy Policy.',
      ],
    },
    {
      id: 'your-content', title: 'Your content',
      paragraphs: [
        'Everything you add to Hourelle stays yours: events, descriptions, pictures, answers and messages. You grant us a non-exclusive, worldwide, royalty-free licence to store, copy and display that content only as needed to provide the service, which means showing it to the people you share the event with and sending the emails the service sends. The licence ends when the content is deleted, except for copies held briefly in backups.',
        'You are responsible for what you add. Only add pictures and text you have the right to share, and nothing that is unlawful or that infringes someone else’s rights.',
      ],
    },
    {
      id: 'acceptable-use', title: 'Acceptable use',
      paragraphs: ['When using Hourelle you agree not to:'],
      items: [
        'harass, threaten, defame or impersonate anyone, or post content that is unlawful, hateful or sexually explicit;',
        'use invitations or the chat to send unsolicited messages, advertising or anything unrelated to a genuine event;',
        'try to access events, accounts or data that are not yours, or to bypass the access rules of the service;',
        'copy data out of the service in bulk, scrape it, or use automated tools against it without our written permission;',
        'interfere with the service, its infrastructure or other people’s events, or introduce malicious code;',
        'use the service in breach of any law that applies to you.',
      ],
    },
    {
      id: 'invitations', title: 'Invitations and email',
      paragraphs: [
        'When you invite someone by email, Hourelle sends them a message on your behalf, with your name on it. Only invite people who will want to hear from you about that event. We may limit or stop sending on behalf of an account that sends unwanted mail.',
        'Anyone holding an event’s link can open the event, so share links with the people the event is for.',
      ],
    },
    {
      id: 'hosts-guests', title: 'Hosts and guests',
      paragraphs: [
        'A host creates an event, decides who is invited, may change or delete it and may lock in the plan. Everyone else may answer, vote, chat and leave. A guest takes part without an account and is identified by the name they typed and, if they gave one, their email address. Hosts are responsible for how they use the information their guests provide.',
      ],
    },
    {
      id: 'third-party', title: 'Calendar connections and other services',
      paragraphs: [
        'Signing in with Google or Microsoft, importing a calendar, and the maps on the Location tab rely on services run by others. Their terms govern your use of them. We do not control those services and are not responsible for them. You may disconnect a calendar provider from your profile at any time.',
      ],
    },
    {
      id: 'our-content', title: 'Our content',
      paragraphs: [
        'The Hourelle name, wordmark and design are ours and may not be used to suggest endorsement without permission. The source code of the service is published on GitHub under the licence stated there; that licence, not these terms, governs its use.',
      ],
    },
    {
      id: 'free-service', title: 'A free service',
      paragraphs: [
        'Hourelle is free to use. If we ever offer paid extras, they will be described separately and hosting an event will remain free. Contributions made through the coffee link are voluntary gifts, not payments for a service, and are not refundable.',
      ],
    },
    {
      id: 'disclaimers', title: 'Availability and disclaimers',
      paragraphs: [
        'The service is provided “as is” and “as available”. We work to keep it running and to keep your data safe, but we do not promise that it will be uninterrupted, timely, error-free or free of harmful components, that any defect will be corrected, or that it will meet your needs. Features may change or be withdrawn. To the extent the law allows, we disclaim all warranties, express or implied, including those of merchantability, fitness for a particular purpose and non-infringement.',
      ],
    },
    {
      id: 'liability', title: 'Limitation of liability',
      paragraphs: [
        'To the extent the law allows, Hourelle and its maker are not liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of data, profits or goodwill, arising from your use of or inability to use the service, however caused. Our total liability for any claim relating to the service is limited to one hundred US dollars. Nothing in these terms limits liability that cannot be limited by law, and nothing removes rights that the law gives you as a consumer.',
      ],
    },
    {
      id: 'termination', title: 'Suspension and termination',
      paragraphs: [
        'You may stop using Hourelle at any time and delete your account from your profile. We may suspend or close an account, or remove content, that breaks these terms or the law, or that puts the service or other people at risk, and we will say why unless the law prevents it. Sections that by their nature should survive, such as those on your content, disclaimers and liability, survive termination.',
      ],
    },
    {
      id: 'changes', title: 'Changes to the service and these terms',
      paragraphs: [
        'We may change the service, and we may change these terms. When the terms change in substance, the effective date at the top changes, new accounts accept the new version at sign-up, and we will tell existing accounts by email or a notice in the app. Continuing to use Hourelle after a change means you accept it.',
      ],
    },
    {
      id: 'law', title: 'Governing law and disputes',
      paragraphs: [
        'These terms are governed by the laws of the United States and of the state in which Hourelle is operated, without regard to conflict-of-law rules, and any dispute will be brought in the courts there, except where the law of the country you live in gives you the right to bring it at home. Before going to court, please write to us; most things can be sorted out that way.',
      ],
    },
    {
      id: 'general', title: 'General',
      paragraphs: [
        'These terms and the Privacy Policy are the whole agreement between you and Hourelle about the service. If any part of them is found unenforceable, the rest still applies. Our not enforcing a term is not a waiver of it. You may not transfer this agreement to anyone else; we may transfer it to a successor that takes over the service.',
      ],
    },
    {
      id: 'contact', title: 'Contact',
      paragraphs: ['Questions about these terms go through the [Help page](/help).'],
    },
  ],
}

export const LEGAL: Record<LegalKey, LegalDoc> = { privacy: PRIVACY, terms: TERMS }
