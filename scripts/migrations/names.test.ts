import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script, no type declarations
import { parseName, toSlug, versionAt, nextVersion, nameProblems, replacedFunctions, functionClashes } from './names.mjs'

describe('migration names', () => {
  it('reads both the numbered and the stamped format', () => {
    expect(parseName('0023_link_scoped_access.sql')).toEqual({ version: '0023', slug: 'link_scoped_access', legacy: true })
    expect(parseName('supabase/migrations/20261123184502_weeks.sql')).toEqual({ version: '20261123184502', slug: 'weeks', legacy: false })
    expect(parseName('weeks.sql')).toBeNull()
  })

  it('makes a slug from what was typed', () => {
    expect(toSlug('Unavailable weeks!')).toBe('unavailable_weeks')
    expect(toSlug('  --cohosts-- ')).toBe('cohosts')
  })

  it('stamps the UTC second and steps past a taken one', () => {
    expect(versionAt(new Date('2026-11-23T18:45:02.900Z'))).toBe('20261123184502')
    expect(nextVersion('20261123184502')).toBe('20261123184503')
    expect(nextVersion('20261231235959')).toBe('20270101000000')
  })

  it('flags new numbers, odd names and shared versions', () => {
    expect(nameProblems(['0023_a.sql', '20261123184502_b.sql'])).toEqual([])
    expect(nameProblems(['0025_next.sql'])[0]).toMatch(/numbered names stop at 0024/)
    expect(nameProblems(['notes.sql'])[0]).toMatch(/YYYYMMDDHHMMSS_slug/)
    expect(nameProblems(['2026_11_23_weeks.sql'])[0]).toMatch(/numbered names stop/)
    expect(nameProblems(['20261123184502_a.sql', '20261123184502_b.sql'])[0]).toMatch(/also used by 20261123184502_a\.sql/)
  })
})

describe('functions rewritten on two branches', () => {
  const rules = 'create or replace function public.enforce_event_rules() returns trigger as $$ begin end $$;'

  it('finds whole-function rewrites, schema included, and skips comments', () => {
    const sql = `${rules}\n-- create or replace function public.old_one()\nCREATE OR REPLACE FUNCTION "public"."Event_Flagged_Ids"() returns void;\ncreate or replace function helper() returns int;`
    expect([...replacedFunctions(sql)].sort()).toEqual(['public.enforce_event_rules', 'public.event_flagged_ids', 'public.helper'])
  })

  it('reports another branch rewriting the same function', () => {
    const clashes = functionClashes(
      { '20261123184502_weeks.sql': rules },
      [
        { file: '0022_open_length.sql', branch: 'feature/day-hours', sql: rules },
        { file: '0013_covers.sql', branch: 'main', sql: 'create table covers ();' },
      ],
    )
    expect(clashes).toEqual([{ fn: 'public.enforce_event_rules', file: '20261123184502_weeks.sql', otherFile: '0022_open_length.sql', branch: 'feature/day-hours' }])
  })

  it('ignores a migration this branch already has', () => {
    expect(functionClashes({ 'a.sql': rules }, [{ file: 'a.sql', branch: 'main', sql: rules }])).toEqual([])
  })
})
