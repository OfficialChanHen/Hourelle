import { Header } from '@/components/Header'
import { MobileTabBar } from '@/components/MobileTabBar'
import { GuestBoundary } from '@/components/GuestBoundary'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      {/* a guest's browser only owns their event — every other page gates to sign-in */}
      <main className="flex-1"><GuestBoundary>{children}</GuestBoundary></main>
      <MobileTabBar />
    </div>
  )
}
