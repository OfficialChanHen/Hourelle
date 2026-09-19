// The public price list. Free is the whole product; Plus is a thank-you with a few
// extras, and is shown as coming soon. The same two cards appear on the welcome
// steps and in the Plan section of Settings, so they live in one component.

import { BackLink } from '@/components/ui/BackLink'
import { PlanCards } from '@/components/PlanCards'

export default function PlansPage() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <BackLink href="/settings" label="Settings" onlyWithAccount />
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Plans</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">Free to host, free to join.</h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-[1.65] text-dim">
        Everything it takes to plan something with people is free and stays that way. Hourelle Plus is a way to say thanks, with a few extras for people who plan often.
      </p>
      <div className="mt-8">
        <PlanCards />
      </div>
    </div>
  )
}
