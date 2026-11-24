// Pure rules for naming Supabase migrations, shared by the CLI (migrations.mjs) and its
// tests. Several agents work at once on separate branches, and each used to take
// "the last number plus one", so two branches could both write 0024. A new migration
// is now named for the UTC second it was made (the Supabase CLI's own format,
// `20261123184502_unavailable_weeks.sql`), claimed through a file in the shared git
// directory so no two worktrees get the same second.

// 0001 to 0024 were run by hand in the SQL editor under these names, so they keep
// them. They sort before every timestamp, so the order still holds.
export const LEGACY_LAST = 24

const LEGACY = /^(\d{4})_([a-z0-9_]+)\.sql$/
const STAMPED = /^(\d{14})_([a-z0-9_]+)\.sql$/

/** `{ version, slug, legacy }` for a migration file name, or null if it fits neither format. */
export function parseName(file) {
  const base = file.split('/').pop()
  const stamped = STAMPED.exec(base)
  if (stamped) return { version: stamped[1], slug: stamped[2], legacy: false }
  const legacy = LEGACY.exec(base)
  if (legacy) return { version: legacy[1], slug: legacy[2], legacy: true }
  return null
}

/** Lower-case words joined by underscores; "Unavailable weeks!" becomes "unavailable_weeks". */
export function toSlug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

/** The 14-digit UTC version for a moment: YYYYMMDDHHMMSS. */
export function versionAt(date) {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

/** The version one second later, for when a second is already claimed. */
export function nextVersion(version) {
  const d = new Date(Date.UTC(
    +version.slice(0, 4), +version.slice(4, 6) - 1, +version.slice(6, 8),
    +version.slice(8, 10), +version.slice(10, 12), +version.slice(12, 14),
  ))
  return versionAt(new Date(d.getTime() + 1000))
}

/**
 * Problems with one branch's set of migration files: names in neither format, a
 * 4-digit number past the legacy range, and two files sharing a version.
 */
export function nameProblems(files) {
  const problems = []
  const seen = new Map()
  for (const file of files) {
    const parsed = parseName(file)
    if (!parsed) {
      problems.push(`${file}: name it YYYYMMDDHHMMSS_slug.sql (run npm run migration:new <slug>)`)
      continue
    }
    if (parsed.legacy && +parsed.version > LEGACY_LAST) {
      problems.push(`${file}: numbered names stop at ${String(LEGACY_LAST).padStart(4, '0')}; run npm run migration:new ${parsed.slug}`)
    }
    const other = seen.get(parsed.version)
    if (other) problems.push(`${file}: version ${parsed.version} is also used by ${other}`)
    else seen.set(parsed.version, file)
  }
  return problems
}

/**
 * The functions a migration rewrites whole (`create or replace function public.x`),
 * lower-cased with their schema. Rewriting one replaces every earlier copy, so two
 * branches that both rewrite it each drop the other's change, whichever runs last.
 */
export function replacedFunctions(sql) {
  const names = new Set()
  const noComments = sql.replace(/--[^\n]*/g, '')
  const re = /create\s+or\s+replace\s+function\s+("?[\w]+"?\s*\.\s*)?"?(\w+)"?/gi
  for (const m of noComments.matchAll(re)) {
    const schema = m[1] ? m[1].replace(/[\s".]/g, '') : 'public'
    names.add(`${schema}.${m[2]}`.toLowerCase())
  }
  return names
}

/**
 * The migrations a file says it already folds in, from lines like
 * `-- includes: 0020_repeating_plans.sql, 0021_cohosts.sql`. A rewrite that carries
 * another branch's change over is not a clash with it.
 */
export function includedFiles(sql) {
  const files = new Set()
  for (const m of sql.matchAll(/^--\s*includes:\s*(.+)$/gim)) {
    for (const f of m[1].split(/[\s,]+/)) if (f) files.add(f)
  }
  return files
}

/**
 * Functions this branch rewrites that another branch also rewrites in a migration
 * this branch does not have. `mine` and `theirs` map file name to SQL; `theirs`
 * carries the branch name: `{ file, branch, sql }[]`.
 */
export function functionClashes(mine, theirs) {
  const clashes = []
  const mineFiles = new Set(Object.keys(mine))
  for (const [file, sql] of Object.entries(mine)) {
    const included = includedFiles(sql)
    for (const fn of replacedFunctions(sql)) {
      for (const other of theirs) {
        if (mineFiles.has(other.file) || included.has(other.file)) continue
        if (replacedFunctions(other.sql).has(fn)) {
          clashes.push({ fn, file, otherFile: other.file, branch: other.branch })
        }
      }
    }
  }
  return clashes
}
