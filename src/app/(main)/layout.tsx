import { Header } from '@/components/Header'
import { MobileTabBar } from '@/components/MobileTabBar'
import { AccessBoundary } from '@/components/AccessBoundary'
import { FlashToast } from '@/components/ui/FlashToast'
import { SiteFooter } from '@/components/SiteFooter'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // flex-1 rather than min-h-full: the body is a flex column with a min-height, so a
  // percentage height inside it never resolves — growing as a flex child does, and
  // that is what keeps the footer at the bottom of a short page
  return (
    <div className="flex flex-1 flex-col">
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
