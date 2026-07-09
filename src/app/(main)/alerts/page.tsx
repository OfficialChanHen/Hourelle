import { Bell } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Alerts</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Event reminders and new activity show up here.</p>

      <div className="mt-6 grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border bg-s2 text-dim"><Bell size={22} /></span>
          <p className="font-serif text-[25px] tracking-[-0.01em]">You&apos;re all caught up</p>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">Reminders for upcoming events and updates from people you&apos;re planning with will land here.</p>
        </div>
      </div>
    </div>
  )
}
