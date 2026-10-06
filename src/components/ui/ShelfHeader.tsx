import { SoftShapes } from './SoftShapes'

/* The heading of a shelf page (Plans, Templates, Demos): the serif title and what
   follows it, over the sand cap and its pebble. The paint is a fixed size and the
   heading a fixed minimum height, so the band and the circle sit exactly the same on
   all three pages however much the heading holds. `before` is anything above the
   title (the way back to an event, on Demos). */
export function ShelfHeader({ title, before, children }: { title: string; before?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative isolate -mt-[34px] mb-10 min-h-[176px] pb-6 pt-[34px]">
      <SoftShapes variant="shelf" />
      {before}
      <h1 className="font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em] sm:text-[40px]">{title}</h1>
      {children}
    </div>
  )
}
