import { Header } from '@/components/Header'
import { MobileTabBar } from '@/components/MobileTabBar'
import { AccessBoundary } from '@/components/AccessBoundary'
import { FlashToast } from '@/components/ui/FlashToast'
import { RouteTrail } from '@/components/RouteTrail'
import { SiteFooter } from '@/components/SiteFooter'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // flex-1 rather than min-h-full: the body is a flex column with a min-height, so a
  // percentage height inside it never resolves — growing as a flex child does, and
  // that is what keeps the footer at the bottom of a short page
  return (
    <div className="flex flex-1 flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[10px] focus:border focus:border-accent focus:bg-s1 focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-accent-text focus:shadow-soft"
      >
        Skip to content
      </a>
      <Header />
      {/* a guest's browser only owns their event — every other page gates to sign-in.
          The toast mounts once here for every page, so a flash queued before a
          redirect (delete, leave, create) lands wherever the visitor does */}
      <main id="main" tabIndex={-1} className="relative flex-1">
        <FlashToast />
        <RouteTrail />
        <AccessBoundary>{children}</AccessBoundary>
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  )
}
