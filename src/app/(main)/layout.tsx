import { Header } from '@/components/Header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  )
}
