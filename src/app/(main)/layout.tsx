import { Header } from '@/components/Header'
import { MobileTabBar } from '@/components/MobileTabBar'
import { AccessBoundary } from '@/components/AccessBoundary'
import { FlashToast } from '@/components/ui/FlashToast'
import { SiteFooter } from '@/components/SiteFooter'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      {/* a guest's browser only owns their event — every other page gates to sign-in.
          The toast mounts once here for every page, so a flash queued before a
          redirect (delete, leave, create) lands wherever the visitor does */}
      <main className="relative flex-1">
        <FlashToast />
        <AccessBoundary>{children}</AccessBoundary>
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  )
}
