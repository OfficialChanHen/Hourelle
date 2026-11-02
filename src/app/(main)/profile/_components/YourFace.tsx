'use client'

/* Your face: compact to start (the face, one line, Edit), like Your account above.
   Edit opens a large preview, one row of small faces per part, and a shuffle.
   Every option is drawn as your face with that one part swapped, so the rows show
   what a tap does without words. Colour is the profile colour, picked here too.

   Nothing is kept until Save: a tap only changes the preview, and Save or Cancel
   folds it back. Saving writes the face
   to the account (the auth user's metadata; this browser alone with no backend) and
   puts it on your entry in every event this device holds, which then syncs. */

import { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Loader2, Pencil, Shuffle, X } from 'lucide-react'
import { FaceSvg } from '@/components/ui/FaceSvg'
import { FaceParts } from '@/components/ui/FaceParts'
import { personColors, personVar, type PersonColor } from '@/lib/colors'
import { defaultFace, sameFace, shuffleFace, type Face } from '@/lib/faces'
import { initialsOf, restampMe, stampMyFace } from '@/lib/events'
import { updateFace, updateProfile, type Account } from '@/lib/session'
import { reducedMotion } from '@/lib/prefs'
import { useHashOpen } from '@/hooks/useHashOpen'

const COLORS = Object.keys(personColors) as PersonColor[]

export function YourFace({ account }: { account: Account }) {
  const current = account.face ?? defaultFace(initialsOf(account.name), account.color)
  // null means untouched: the preview follows the account until the first tap
  const [draft, setDraft] = useState<Face | null>(null)
  const [draftColor, setDraftColor] = useState<PersonColor | null>(null)
  const face = draft ?? current
  const color = draftColor ?? account.color
  const faceDirty = !!draft && !sameFace(draft, current)
  const colorDirty = !!draftColor && draftColor !== account.color
  const dirty = faceDirty || colorDirty
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const ids = useId()
  // the account menu's Your face and a plan's Change face land here to change it
  const [editing, setEditing] = useState(false)
  useHashOpen(['face'], () => setEditing(true))
  // focus goes back to Edit once the editor folds away
  const editBtn = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) editBtn.current?.focus()
    wasEditing.current = editing
  }, [editing])

  // a small pop on the preview when it changes, so a tap reads as a change
  const preview = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const look = `${face.shape}.${face.eyes}.${face.mouth}.${face.hair}.${face.accessory}.${color}`
  useGSAP(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (reducedMotion() || !preview.current) return
    gsap.fromTo(preview.current, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' })
  }, { dependencies: [look] })

  function pick(next: Face) { setDraft(next); setSaved(false); setErr(null) }

  async function save() {
    if (!dirty || saving) return
    setSaving(true); setErr(null)
    if (colorDirty) {
      const e = await updateProfile({ color })
      if (e) { setSaving(false); setErr(e); return }
      restampMe({ color })
    }
    // a colour change alone still keeps the face: one that was only drawn from the
    // old colour would otherwise be redrawn from the new one
    if (faceDirty || !account.face) {
      const e = await updateFace(face)
      if (e) { setSaving(false); setErr(e); return }
      stampMyFace()
    }
    setSaving(false); setDraft(null); setDraftColor(null); setEditing(false)
    setSaved(true); setTimeout(() => setSaved(false), 1800)
  }
  function cancel() { setDraft(null); setDraftColor(null); setErr(null); setEditing(false) }

  if (!editing) return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-s1 p-5">
      <FaceSvg face={current} color={account.color} size={52} className="h-[52px] w-[52px] flex-none" />
      <div className="min-w-0 flex-1 text-[13px] text-dim">
        {saved
          ? <span role="status" className="flex items-center gap-1 font-medium text-teal-text"><Check size={13} /> Saved</span>
          : 'People in your plans see this face.'}
      </div>
      <button ref={editBtn} type="button" onClick={() => { setSaved(false); setEditing(true) }} className="flex h-11 flex-none items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9">
        <Pencil size={14} /> Edit
      </button>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        <div className="flex flex-none flex-col items-center gap-3 sm:w-[160px]">
          <div ref={preview} role="img" aria-label="Your face">
            <FaceSvg face={face} color={color} size={150} className="h-[120px] w-[120px] sm:h-[150px] sm:w-[150px]" />
          </div>
          <button
            type="button" onClick={() => pick(shuffleFace(face, String(Date.now())))}
            className="flex h-11 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-4 text-[13.5px] font-semibold text-text hover:bg-s2 sm:h-9"
          >
            <Shuffle size={15} /> Shuffle
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <FaceParts face={face} color={color} onPick={pick} />
          {/* the colour is the account's, so it needs an account to keep it */}
          {account.signedIn && (
            <div role="group" aria-labelledby={`${ids}-color`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span id={`${ids}-color`} className="text-[12.5px] font-semibold text-dim sm:w-[52px] sm:flex-none">Colour</span>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c} type="button" onClick={() => { setDraftColor(c); setSaved(false); setErr(null) }} aria-label={c} aria-pressed={color === c}
                    className={`grid h-11 w-11 place-items-center rounded-full border-2 sm:h-9 sm:w-9 ${color === c ? 'border-accent' : 'border-transparent hover:border-border2'}`}
                    style={{ background: personVar(c).bg, color: personVar(c).text }}
                  >
                    {color === c && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {err && <p role="alert" className="mt-4 text-[12.5px] font-medium text-brick-text">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={() => void save()} disabled={!dirty || saving} className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-40 sm:h-10">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
        </button>
        <button onClick={cancel} disabled={saving} className="flex h-11 items-center gap-1.5 rounded-full border border-border2 px-4 text-[14px] font-semibold text-dim hover:bg-s2 sm:h-10"><X size={15} /> Cancel</button>
      </div>
    </div>
  )
}
