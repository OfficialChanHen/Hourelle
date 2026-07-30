import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AppearancePicker } from '@/components/AppearancePicker'

// eyebrow labels give the page the sectioned shape settings pages are expected to
// have — account first, preferences after, the exit on its own at the end
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{children}</p>
)

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Profile</h1>

      <Eyebrow>Account</Eyebrow>
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-s1 p-5">
        <Avatar initials="JM" color="amber" size={52} font={19} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold">Jordan Miller</div>
          <div className="truncate text-[13px] text-dim">jordan@example.com</div>
        </div>
      </div>

      <Eyebrow>Preferences</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        {/* the sun/moon flips light and dark; the cards pick which look the app wears */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium">Appearance</span>
          <ThemeToggle />
        </div>
        <div className="mt-3">
          <AppearancePicker />
        </div>
      </div>

      {/* no real session to end yet — signing out just lands on the sign-in shell */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        <Link href="/auth/signin" className="flex w-full items-center justify-between px-5 py-4 text-left text-brick-text hover:bg-brick-bg/50">
          <span className="flex items-center gap-2 text-[14px] font-medium"><LogOut size={16} /> Sign out</span>
        </Link>
      </div>
    </div>
  )
}
