'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, CircleHelp, Info, LogIn, LogOut, Settings } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useAccount } from '@/hooks/useAccount'
import { signOut } from '@/lib/session'
import { initialsOf } from '@/lib/events'

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
  { href: '/about', label: 'About Aline', sub: 'What this is and where your data lives', icon: Info },
]

export default function ProfilePage() {
  const account = useAccount()
  const router = useRouter()
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Profile</h1>

      <Eyebrow>Account</Eyebrow>
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-s1 p-5">
        <Avatar initials={initialsOf(account.name)} color={account.color} size={52} font={19} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold">{account.name}</div>
          <div className="truncate text-[13px] text-dim">
            {account.signedIn ? account.email : 'Not signed in. Your events live on this device.'}
          </div>
        </div>
      </div>

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
            onClick={() => void signOut().then(() => router.push('/home'))}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-brick-text hover:bg-brick-bg/50"
          >
            <span className="flex items-center gap-2 text-[14px] font-medium"><LogOut size={16} /> Sign out</span>
          </button>
        ) : (
          <Link href="/auth/signin" className="flex w-full items-center justify-between px-5 py-4 text-left text-accent-text hover:bg-s2">
            <span className="flex items-center gap-2 text-[14px] font-medium"><LogIn size={16} /> Sign in</span>
            <ChevronRight size={16} className="flex-none text-faint" />
          </Link>
        )}
      </div>
    </div>
  )
}
