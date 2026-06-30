import { Badge } from '@/components/ui/Badge'

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-8 lg:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Reusable plans</p>
      <h1 className="mt-1 font-serif text-[36px] tracking-[-0.01em]">Templates</h1>
      <div className="mt-7 grid place-items-center rounded-xl border border-dashed border-border2 bg-s1 px-6 py-20 text-center">
        <p className="font-serif text-[26px] tracking-[-0.01em]">Start from a template</p>
        <p className="mt-2 max-w-sm text-[13.5px] text-dim">Weekend trip, team offsite, dinner party — pre-filled stages you can clone.</p>
        <div className="mt-5"><Badge variant="neutral">Coming next</Badge></div>
      </div>
    </div>
  )
}
