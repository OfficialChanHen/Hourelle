import { LEGAL, LEGAL_EFFECTIVE, readingMinutes, renderInline, type LegalKey } from '@/content/legal'

/* One rendering of a legal document, shared by its page and the sign-up sheet: a
   table of contents on the page, then the numbered sections, each with an anchor.
   `compact` is the sheet: no contents, tighter type. */
export function LegalDocument({ k, compact = false }: { k: LegalKey; compact?: boolean }) {
  const doc = LEGAL[k]
  const minutes = readingMinutes(doc)
  return (
    <div className={compact ? 'text-[13.5px]' : 'text-[14.5px]'}>
      {/* the sheet's own header already carries the date and the reading time */}
      {!compact && <p className="text-[12.5px] text-faint">Effective {LEGAL_EFFECTIVE}. About {minutes} min to read.</p>}

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

      <div className={compact ? 'mt-4' : 'mt-8'}>
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
