import { LEGAL, LEGAL_EFFECTIVE, readingMinutes, renderInline, type LegalKey } from '@/content/legal'

/* One rendering of a legal document, shared by its page and the sign-up sheet: the
   short version first, a table of contents on the page, then the numbered sections,
   each with an anchor. `compact` is the sheet: no contents, tighter type. */
export function LegalDocument({ k, compact = false }: { k: LegalKey; compact?: boolean }) {
  const doc = LEGAL[k]
  const minutes = readingMinutes(doc)
  return (
    <div className={compact ? 'text-[13.5px]' : 'text-[14.5px]'}>
      <div className="rounded-[12px] border border-accent-border bg-accent-bg px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-accent-text">The short version</p>
          <p className="text-[12px] text-accent-text/80">Effective {LEGAL_EFFECTIVE}. About {minutes} min to read.</p>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {doc.summary.map((s, i) => (
            <li key={i} className="flex gap-2.5 leading-[1.55] text-accent-text">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[12px] leading-[1.5] text-accent-text/80">The short version is a guide. The sections below are the agreement.</p>
      </div>

      {!compact && (
        <nav aria-label="Contents" className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Contents</p>
          <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {doc.sections.map((s, i) => (
              <li key={s.id} className="flex gap-2 text-[13.5px] leading-[1.5]">
                <span className="w-5 flex-none tabular-nums text-faint">{i + 1}.</span>
                <a href={`#${s.id}`} className="text-dim hover:text-text hover:underline">{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className={compact ? 'mt-5' : 'mt-8'}>
        {doc.sections.map((s, i) => (
          <section key={s.id} id={compact ? undefined : s.id} className={`scroll-mt-20 ${i > 0 ? (compact ? 'mt-6' : 'mt-8') : ''}`}>
            <h2 className={`flex gap-2.5 font-serif leading-[1.15] tracking-[-0.01em] ${compact ? 'text-[19px]' : 'text-[22px]'}`}>
              <span className="tabular-nums text-faint">{i + 1}.</span>
              <span>{s.title}</span>
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="mt-3 leading-[1.65] text-dim">{renderInline(p)}</p>
            ))}
            {s.items && (
              <ul className="mt-3 flex flex-col gap-2 pl-1">
                {s.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 leading-[1.6] text-dim">
                    <span aria-hidden className="mt-[10px] h-1.5 w-1.5 flex-none rounded-full bg-border2" />
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
