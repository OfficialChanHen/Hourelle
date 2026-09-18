import { BackLink } from '@/components/ui/BackLink'
import { LEGAL, LEGAL_VERSION } from '@/content/legal'

const doc = LEGAL.privacy

export default function Page() {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <BackLink href="/profile" label="Profile" onlyWithAccount />
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">{doc.eyebrow}</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">{doc.title}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-dim">{doc.lead}</p>
      <p className="mt-2 text-[12.5px] text-faint">Last updated {LEGAL_VERSION}</p>
      <div className="mt-8 rounded-2xl border border-border bg-s1 px-5 py-6 sm:px-7">{doc.body}</div>
    </div>
  )
}
