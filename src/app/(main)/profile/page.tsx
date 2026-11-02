'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, CircleHelp, Info, Loader2, LogIn, LogOut, Pencil, Settings, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useAccount } from '@/hooks/useAccount'
import { deleteAccount, signOut, updateProfile } from '@/lib/session'
import { backendOn } from '@/lib/db'
import { PasswordField } from '@/components/ui/PasswordField'
import { initialsOf, restampMe } from '@/lib/events'
import { SignInMethods } from './_components/SignInMethods'
import { FacePicker, useFaceDraft } from './_components/YourFace'
import { useHashOpen } from '@/hooks/useHashOpen'
import { UsualWeekCard } from './_components/UsualWeekCard'
import { reducedMotion } from '@/lib/prefs'
import { APP_NAME } from '@/lib/brand'

// eyebrow labels give the page the sectioned shape settings pages are expected to
// have — account first, the rest of the account surface after, the exit at the end
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{children}</p>
)

// on phones this page is the account menu (the header avatar is desktop-only),
// so everything behind the avatar dropdown is reachable here too
const LINKS = [
  { href: '/settings', label: 'Settings', sub: 'Theme, clock style, reminders', icon: Settings },
  { href: '/help', label: 'Help & contact', sub: 'Common questions, and where to reach us', icon: CircleHelp },
  { href: '/about', label: `About ${APP_NAME}`, sub: 'What this is and where your data lives', icon: Info },
]

export default function ProfilePage() {
  const account = useAccount()
  const router = useRouter()

  // /profile#face (the account menu's Your face, an event's Change face) lands on
  // the face, and /profile#usual-week (a plan's Import menu) on the usual week. The section only renders once the account is known, which can be after
  // the router has already looked for it, so it is looked for again when it appears.
  const faceShown = account.signedIn || !backendOn
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.slice(1)
      if (id !== 'face' && id !== 'usual-week' && id !== 'usual-days') return
      document.getElementById(id === 'usual-days' ? 'usual-week' : id)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    go()
    window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
  }, [faceShown])

  // editing: the name and, where there is an owner to keep it, the face and colour
  const [editing, setEditing] = useState(false)
  const faceDraft = useFaceDraft(account)
  const [name, setName] = useState(account.name)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const clean = name.trim().replace(/\s+/g, ' ')
  const nameDirty = account.signedIn && clean !== account.name
  const nameBad = nameDirty && clean.length < 2
  const dirty = nameDirty || faceDraft.dirty

  function edit() { setName(account.name); faceDraft.reset(); setSaveErr(null); setSaved(false); setEditing(true) }
  // the account menu's Your face and a plan's Change face land here to change it
  useHashOpen(faceShown ? ['face'] : [], () => { if (!editing) edit() })
  // focus goes back to Edit once the editor folds away
  const editBtn = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) editBtn.current?.focus()
    wasEditing.current = editing
  }, [editing])

  async function save() {
    if (!dirty || nameBad || saving) return
    setSaving(true); setSaveErr(null)
    if (nameDirty) {
      const err = await updateProfile({ name: clean })
      if (err) { setSaving(false); setSaveErr(err); return }
      // every event this account sits on shows the new name
      restampMe({ name: clean })
    }
    if (faceDraft.dirty) {
      const err = await faceDraft.save()
      if (err) { setSaving(false); setSaveErr(err); return }
    }
    setSaving(false)
    setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 1800)
  }
  function cancel() { setEditing(false); setName(account.name); faceDraft.reset(); setSaveErr(null) }

  // the end of the account: a second step spells out what goes with it and asks
  // for the words "delete my account" typed out, the way most services confirm
  // something that cannot be undone. The server asks for the same words.
  const DELETE_PHRASE = 'delete my account'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const phraseOk = typed.trim().toLowerCase() === DELETE_PHRASE
  async function destroy() {
    if (!phraseOk) return
    setDeleting(true); setDeleteErr(null)
    const err = await deleteAccount(typed.trim())
    setDeleting(false)
    if (err) { setDeleteErr(err); return }
    router.push('/')
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[92px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif font-normal text-[33.5px] leading-[1.04] tracking-[-0.01em]">Profile</h1>

      {/* who you are: name, email and the face everyone sees on your plans. The face
          belongs to an account, or to this browser when there is no backend; a
          visitor with neither has none to make */}
      <section id="face" aria-label="Account" className="scroll-mt-[72px]">
      <Eyebrow>Account</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 p-5">
        {!editing ? (
          <div className="flex items-center gap-3.5">
            <Avatar initials={initialsOf(account.name)} color={account.color} face={account.face} size={52} font={19} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[16px] font-semibold">{account.name}{saved && <span role="status" className="flex items-center gap-1 text-[12px] font-medium text-teal-text"><Check size={13} /> Saved</span>}</div>
              <div className="truncate text-[13px] text-dim">
                {account.signedIn ? account.email : 'Not logged in. Your plans live on this device.'}
              </div>
            </div>
            {faceShown && (
              <button ref={editBtn} onClick={edit} className="flex h-11 flex-none items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9">
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {account.signedIn && (
              <div>
                <label htmlFor="profile-name" className="block text-[12.5px] font-semibold text-dim">Your name</label>
                <input
                  id="profile-name" value={name} autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') cancel() }}
                  aria-invalid={clean.length < 2 || undefined}
                  aria-describedby="profile-name-hint"
                  className="mt-2 h-11 w-full max-w-[360px] rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none focus:border-accent"
                />
                <p id="profile-name-hint" className="mt-1.5 text-[12px] text-faint">{clean.length < 2 ? 'At least two characters.' : 'Shows on every plan you are part of.'}</p>
              </div>
            )}
            <div>
              <p className="mb-3 text-[12.5px] font-semibold text-dim">Your face</p>
              <FacePicker account={account} draft={faceDraft} />
            </div>
            {saveErr && <p role="alert" className="text-[12.5px] font-medium text-brick-text">{saveErr}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <button onClick={() => void save()} disabled={!dirty || nameBad || saving} className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-40 sm:h-10">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
              </button>
              <button onClick={cancel} disabled={saving} className="flex h-11 items-center gap-1.5 rounded-full border border-border2 px-4 text-[14px] font-semibold text-dim hover:bg-s2 sm:h-10"><X size={15} /> Cancel</button>
            </div>
          </div>
        )}
      </div>
      </section>

      {/* the week a plan can fill from, when you ask it to; it belongs to the same
          owner as the face */}
      {faceShown && (
        <section id="usual-week" aria-label="My usual week" className="scroll-mt-[72px]">
          <Eyebrow>My usual week</Eyebrow>
          <UsualWeekCard account={account} />
        </section>
      )}

      {/* both doors to this account, and the way out of having made two */}
      {account.signedIn && (
        <>
          <Eyebrow>How you log in</Eyebrow>
          <SignInMethods account={account} />
        </>
      )}

      <Eyebrow>More</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {LINKS.map((l, i) => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={l.href} className={`flex items-center gap-3.5 px-5 py-4 hover:bg-s2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border bg-s2 text-dim">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{l.label}</span>
                <span className="block truncate text-[12.5px] text-dim">{l.sub}</span>
              </span>
              <ChevronRight size={16} className="flex-none text-faint" />
            </Link>
          )
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        {account.signedIn ? (
          <button
            onClick={() => void signOut().then(() => router.push('/'))}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-brick-text hover:bg-brick-bg/50"
          >
            <span className="flex items-center gap-2 text-[14px] font-medium"><LogOut size={16} /> Log out</span>
          </button>
        ) : (
          <Link href="/auth/signin" className="flex w-full items-center justify-between px-5 py-4 text-left text-accent-text hover:bg-s2">
            <span className="flex items-center gap-2 text-[14px] font-medium"><LogIn size={16} /> Log in</span>
            <ChevronRight size={16} className="flex-none text-faint" />
          </Link>
        )}
      </div>

      {account.signedIn && (
        <>
          <Eyebrow>Danger zone</Eyebrow>
          <div className="rounded-2xl border border-border bg-s1 p-5">
            {!confirmDelete ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">Delete your account</div>
                  <div className="mt-0.5 text-[12.5px] text-dim">Removes you and the plans you host. This cannot be undone.</div>
                </div>
                <button onClick={() => setConfirmDelete(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-brick-border bg-brick-bg px-3 text-[13px] font-semibold text-brick-text hover:opacity-90">
                  <Trash2 size={14} /> Delete account
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[14px] font-semibold">Delete {account.email ?? 'this account'}?</p>
                <p className="mt-1 text-[13px] leading-[1.55] text-dim">
                  The plans you host are deleted for everyone in them. On plans other people host, your name, your times and your votes are removed. Your chat messages go too. There is no way back.
                </p>
                <label htmlFor="delete-phrase" className="mt-3 block text-[12.5px] font-semibold text-dim">Type <span className="font-mono text-text">delete my account</span> to confirm</label>
                <input
                  id="delete-phrase" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
                  onKeyDown={(e) => { if (e.key === 'Enter' && phraseOk && !deleting) void destroy() }}
                  className="mt-1.5 h-11 w-full max-w-[380px] rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none focus:border-brick-border"
                />
                {deleteErr && <p role="alert" className="mt-2 text-[12.5px] font-medium text-brick-text">{deleteErr} If it keeps failing, write to us from the Help page and we will do it by hand.</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => void destroy()} disabled={deleting || !phraseOk} className="flex h-10 items-center gap-1.5 rounded-full bg-brick px-4 text-[14px] font-semibold text-on-accent disabled:opacity-60">
                    {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete my account
                  </button>
                  <button onClick={() => { setConfirmDelete(false); setDeleteErr(null); setTyped('') }} disabled={deleting} className="flex h-10 items-center rounded-full border border-border2 px-4 text-[14px] font-semibold text-dim hover:bg-s2">Keep it</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
