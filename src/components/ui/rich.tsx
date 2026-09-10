// tiny inline emphasis for copy that lives in data: **like this** becomes <strong>.
// Keeps feature names bold in demo descriptions without turning strings into JSX.
import type { ReactNode } from 'react'

export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**')
      ? <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}
