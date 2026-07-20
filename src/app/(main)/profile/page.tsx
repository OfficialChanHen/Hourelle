import { Bell, LogOut, ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AppearancePicker } from '@/components/AppearancePicker'

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Profile</h1>

      {/* account */}
      <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-border bg-s1 p-5">
        <Avatar initials="JM" color="amber" size={52} font={19} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold">Jordan Miller</div>
          <div className="truncate text-[13px] text-dim">jordan@example.com</div>
        </div>
      </div>

      {/* settings */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        {/* the sun/moon flips light and dark; the cards pick which look the app wears */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="mt-3">
            <AppearancePicker />
          </div>
        </div>
        <button className="flex w-full items-center justify-between border-t border-border px-5 py-4 text-left hover:bg-s2">
          <span className="flex items-center gap-2 text-[14px] font-medium"><Bell size={16} className="text-dim" /> Notifications</span>
          <ChevronRight size={17} className="text-faint" />
        </button>
        <button className="flex w-full items-center justify-between border-t border-border px-5 py-4 text-left text-brick-text hover:bg-brick-bg/50">
          <span className="flex items-center gap-2 text-[14px] font-medium"><LogOut size={16} /> Sign out</span>
        </button>
      </div>
    </div>
  )
}
