// What the lib modules expect from a browser, kept in memory and cleared before each
// test so one test's saved plans never leak into the next.
import { beforeEach } from 'vitest'

const store = new Map<string, string>()
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}
const g = globalThis as Record<string, unknown>
g.localStorage = storage
g.sessionStorage = storage
g.window = globalThis
g.addEventListener ??= () => {}
g.removeEventListener ??= () => {}
g.dispatchEvent ??= () => true

beforeEach(() => store.clear())
