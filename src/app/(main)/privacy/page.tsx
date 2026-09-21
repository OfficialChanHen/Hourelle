// The privacy policy, on its own page. The document itself lives in content/legal
// and is rendered by LegalDocument, so this page and the sheet shown before sign-up
// can never drift apart. Reachable without an account, which is why the back link
// only appears for someone who has one.

import { BackLink } from '@/components/ui/BackLink'
import { LegalDocument } from '@/components/ui/LegalDocument'
import { LEGAL, LEGAL_EFFECTIVE } from '@/content/legal'

const doc = LEGAL.privacy

export default function Page() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-[92px] pt-[34px] sm:px-[26px]">
      <BackLink href="/profile" label="Profile" onlyWithAccount />
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">{doc.eyebrow}</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">{doc.title}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-dim">{doc.lead}</p>
      <p className="mt-2 text-[12.5px] text-faint">Effective {LEGAL_EFFECTIVE}</p>
      <div className="mt-8 rounded-2xl border border-border bg-s1 px-5 py-6 sm:px-8 sm:py-8">
        <LegalDocument k="privacy" />
      </div>
      <p className="mt-6 text-[12.5px] leading-[1.6] text-faint">
        Questions about this document go through the Help page. Both documents are also shown, in full, before an account is created.
      </p>
    </div>
  )
}
