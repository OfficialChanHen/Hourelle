'use client'

import { Loader2, TriangleAlert } from 'lucide-react'

/* Save and Cancel under an editor that waits for the database (useConfirmedSave).
   Save shows it is working until the answer comes back; a save that did not land
   says so under the buttons and leaves the draft where it is, so Save tries again. */
export function EditorActions({ onSave, onCancel, saving = false, disabled = false, error }: {
  onSave: () => void; onCancel: () => void; saving?: boolean; disabled?: boolean; error?: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={onSave} disabled={disabled || saving} aria-busy={saving || undefined}
          className={`flex h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent sm:h-8 sm:px-3 sm:text-[12.5px] ${saving ? 'disabled:opacity-70' : 'disabled:opacity-40'}`}
        >
          {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel} disabled={saving}
          className="h-11 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 disabled:opacity-40 sm:h-8 sm:px-3 sm:text-[12.5px]"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] font-medium leading-[1.45] text-brick-text">
          <TriangleAlert size={13} className="mt-0.5 flex-none" aria-hidden />
          <span><span className="font-semibold">Not saved.</span> {error}</span>
        </p>
      )}
    </div>
  )
}
