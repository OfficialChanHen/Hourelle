#!/usr/bin/env node
// npm run migration:new <slug>   make supabase/migrations/<UTC second>_<slug>.sql
// npm run migration:check        names, duplicate versions, functions another branch also rewrites
//
// Agents work at once in separate worktrees of this repo. A version is claimed by
// creating `<git common dir>/migration-claims/<version>` with O_EXCL: every worktree
// shares that directory and the create either wins or fails, so two agents asking in
// the same second get different versions. Versions already used on any local branch
// are skipped as well.
import { execFileSync } from 'node:child_process'
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  parseName, toSlug, versionAt, nextVersion, nameProblems, functionClashes, isRenamedCopy,
} from './names.mjs'

const DIR = 'supabase/migrations'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

const root = git('rev-parse', '--show-toplevel')
const claims = join(resolve(root, git('rev-parse', '--git-common-dir')), 'migration-claims')

function branches() {
  return git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean)
}

function filesOn(ref) {
  try {
    return git('ls-tree', '--name-only', `${ref}:${DIR}`).split('\n').filter((f) => f.endsWith('.sql'))
  } catch {
    return []
  }
}

/** Every version used on any local branch or in this working tree. */
function usedVersions() {
  const used = new Set()
  for (const b of branches()) for (const f of filesOn(b)) used.add(parseName(f)?.version)
  for (const f of readdirSync(join(root, DIR))) used.add(parseName(f)?.version)
  return used
}

function claim(version) {
  mkdirSync(claims, { recursive: true })
  try {
    closeSync(openSync(join(claims, version), 'wx'))
    return true
  } catch (e) {
    if (e.code === 'EEXIST') return false
    throw e
  }
}

function create(text) {
  const slug = toSlug(text ?? '')
  if (!slug) {
    console.error('usage: npm run migration:new <slug>   (for example: unavailable_weeks)')
    process.exit(1)
  }
  const used = usedVersions()
  let version = versionAt(new Date())
  while (used.has(version) || !claim(version)) version = nextVersion(version)
  const file = join(DIR, `${version}_${slug}.sql`)
  writeFileSync(join(root, file), `-- ${slug.replace(/_/g, ' ')}\n--\n-- What this changes and why.\n\n`, { flag: 'wx' })
  console.log(file)
}

function check() {
  const here = readdirSync(join(root, DIR)).filter((f) => f.endsWith('.sql')).sort()
  const problems = nameProblems(here)

  // Compare against main and every other local branch: a migration they have and
  // this tree does not, rewriting a function this branch's own new migrations rewrite.
  const onMain = new Set(filesOn('main'))
  const current = git('rev-parse', '--abbrev-ref', 'HEAD')
  const read = (ref, f) => git('show', `${ref}:${DIR}/${f}`)
  const mine = {}
  for (const f of here) {
    if (!onMain.has(f)) mine[f] = readFileSync(join(root, DIR, f), 'utf8')
  }
  const theirs = []
  if (Object.keys(mine).length) {
    const hereSet = new Set(here)
    for (const b of branches()) {
      if (b === current) continue
      for (const f of filesOn(b)) {
        if (hereSet.has(f) || isRenamedCopy(f, here) || theirs.some((t) => t.file === f)) continue
        theirs.push({ file: f, branch: b, sql: read(b, f) })
      }
    }
  }
  for (const c of functionClashes(mine, theirs)) {
    problems.push(
      `${c.file}: rewrites ${c.fn}, which ${c.otherFile} on ${c.branch} also rewrites. ` +
      'Whichever runs last drops the other change: build on its version and say so with `-- includes: ' + c.otherFile + '`.',
    )
  }

  if (problems.length) {
    for (const p of problems) console.error(p)
    process.exit(1)
  }
  console.log(`${here.length} migrations, no clashes`)
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'new') create(rest.join(' '))
else if (cmd === 'check') check()
else {
  console.error('usage: migrations.mjs new <slug> | check')
  process.exit(1)
}
