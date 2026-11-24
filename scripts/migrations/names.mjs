// Pure rules for naming Supabase migrations, shared by the CLI (migrations.mjs) and its
// tests. Several agents work at once on separate branches, and each used to take
// "the last number plus one", so two branches could both write 0024. A migration is
// now named for the UTC second it was made (the Supabase CLI's own format,
// `20261123184502_unavailable_weeks.sql`), claimed through a file in the shared git
// directory so no two worktrees get the same second. The numbered ones, 0001 to 0024,
// were renamed to the second each was first committed, so they keep their order.

const STAMPED = /^(\d{14})_([a-z0-9_]+)\.sql$/
const NUMBERED = /^(\d{4})_([a-z0-9_]+)\.sql$/

/** `{ version, slug }` for a migration file name, or null if it is not stamped. */
export function parseName(file) {
  const stamped = STAMPED.exec(file.split('/').pop())
  return stamped ? { version: stamped[1], slug: stamped[2] } : null
}

/**
 * Whether `file` is an old numbered name for one of `here`, the stamped files on this
 * branch: a branch that has not merged the rename still carries 0022_open_length.sql,
 * which is the same migration as 20261112235150_open_length.sql here.
 */
export function isRenamedCopy(file, here) {
  const numbered = NUMBERED.exec(file.split('/').pop())
  return !!numbered && here.some((f) => parseName(f)?.slug === numbered[2])
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

/** Problems with one branch's set of migration files: unstamped names and two files sharing a version. */
export function nameProblems(files) {
  const problems = []
  const seen = new Map()
  for (const file of files) {
    const parsed = parseName(file)
    if (!parsed) {
      const numbered = NUMBERED.exec(file.split('/').pop())
      problems.push(numbered
        ? `${file}: numbered names are retired; run npm run migration:new ${numbered[2]}`
        : `${file}: name it YYYYMMDDHHMMSS_slug.sql (run npm run migration:new <slug>)`)
      continue
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
 * `-- includes: 20261102232202_repeating_plans.sql, 20261112233930_cohosts.sql`. A rewrite that carries
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
