'use client'

import { X } from 'lucide-react'
import { DateField } from '@/components/ui/DateField'
import { SettingField, SettingStepper, SettingToggle } from '@/components/ui/Settings'
import { todayKey } from '@/lib/events'

/* The rules of a vote, the same set and the same order wherever there is one: the
   place vote on the Location tab and a poll in the chat. Only the words for "adding"
   and "hiding" differ, since one is places and the other options. */
export function VoteRules({ votes, cap, onVotes, closes, onCloses, adding, onAdding, hidden, onHidden }: {
  votes: number
  cap: number
  onVotes: (n: number) => void
  closes: string            // a day key, '' for no closing day
  onCloses: (day: string) => void
  adding: { label: string; on: boolean }
  onAdding: (v: boolean) => void
  hidden: { label: string; on: boolean }
  onHidden: (v: boolean) => void
}) {
  return (
    <>
      <SettingField label="Votes per person">
        <SettingStepper label="Votes per person" value={Math.min(votes, cap)} max={cap} onChange={(n) => onVotes(Math.min(cap, Math.max(1, n)))} of={`of ${cap}`} />
      </SettingField>
      <SettingField label="Voting closes" hint="Votes and changes freeze after this day.">
        <div className="flex items-center gap-1.5">
          <DateField label="Voting closes" value={closes} min={todayKey()} onChange={onCloses} className="h-11 min-w-0 flex-1 !bg-s1 sm:h-8" />
          {closes && (
            <button type="button" onClick={() => onCloses('')} title="Remove the closing day" aria-label="Remove the closing day" className="grid h-11 w-11 flex-none place-items-center rounded-full border border-border2 text-dim hover:bg-s2 hover:text-brick-text sm:h-8 sm:w-8"><X size={14} /></button>
          )}
        </div>
      </SettingField>
      <SettingToggle label={adding.label} on={adding.on} onChange={onAdding} />
      <SettingToggle label={hidden.label} on={hidden.on} onChange={onHidden} />
    </>
  )
}
