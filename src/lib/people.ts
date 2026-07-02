import type { PersonColor } from './colors'

// The full cast from the reference, keyed by initials.
export const people: Record<string, { name: string; color: PersonColor }> = {
  JM: { name: 'Jordan M', color: 'purple' },
  SR: { name: 'Sarah R', color: 'teal' },
  AT: { name: 'Alex T', color: 'coral' },
  KL: { name: 'Kyle L', color: 'blue' },
  PR: { name: 'Priya R', color: 'pink' },
  DW: { name: 'Dana W', color: 'gray' },
  MN: { name: 'Mia N', color: 'amber' },
  CL: { name: 'Chris L', color: 'green' },
  RW: { name: 'Riley W', color: 'blue' },
  TC: { name: 'Tom C', color: 'amber' },
  NK: { name: 'Nina K', color: 'pink' },
  BH: { name: 'Ben H', color: 'teal' },
  DV: { name: 'Dana V', color: 'coral' },
  EM: { name: 'Ellen M', color: 'purple' },
  GH: { name: 'Grace H', color: 'green' },
  OB: { name: 'Omar B', color: 'gray' },
}

export type Avatar = { initials: string; name: string; color: PersonColor }

export function av(id: string): Avatar {
  const p = people[id] ?? { name: id, color: 'gray' as PersonColor }
  return { initials: id, name: p.name, color: p.color }
}

export function avs(ids: string[]): Avatar[] {
  return ids.map(av)
}
