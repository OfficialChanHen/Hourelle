'use client'

/* The one switch: 22 by 38, accent when on, with an invisible halo that grows the
   touch target to 44px without changing how it looks. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[22px] w-[38px] flex-none rounded-full border transition-colors after:absolute after:-inset-[11px] after:content-[''] ${on ? 'border-accent bg-accent' : 'border-border2 bg-s2'}`}
    >
      <span
        className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-s1 shadow-raised transition-all"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  )
}
