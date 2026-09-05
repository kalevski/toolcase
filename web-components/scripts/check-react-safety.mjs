// Conformance check for the React-safety rules stated in src/internal/tc-element.ts.
//
// The rules are only worth stating if something enforces them. This runs over
// every registered tc-* element and reports which ones break which rule, then
// compares the result with scripts/react-safety-baseline.json — a RATCHET, so the
// count can only go down. Fixing an element and forgetting to update the baseline
// is fine (the script tells you and, with --update, writes it); regressing is not.
//
// Report-only by default. `--check` is the CI mode: exit 1 when the number of
// conforming elements drops below the baseline, or when a new element is born
// non-conforming.
//
//   node scripts/check-react-safety.mjs            # report
//   node scripts/check-react-safety.mjs --check    # CI: fail on regression
//   node scripts/check-react-safety.mjs --update   # accept the current state
//
// Rule 3 (pre-upgrade property replay) is not checked per element: register.ts
// installs it for every element through installPropertyReplay, so it holds by
// construction.
//
// A handful of elements genuinely need a real element WRAPPING the consumer's
// content, which no amount of CSS ordering replaces:
//
//   tc-accordion-item, tc-navbar  — the Bootstrap collapse plugin animates the
//       height of the element that CONTAINS the collapsing content.
//   tc-carousel                   — slides are transformed as one track.
//   tc-dropdown, tc-context-menu  — Popper positions the menu ELEMENT; its items
//       have to be inside the box it moves.
//   tc-advanced-table             — a `<tr>` is only a row inside `<tbody>`.
//   tc-dashboard-layout           — the sidebar is a drawer that slides as a unit.
//
// Those ADOPT: they move the children once and then make the host answer for
// them, so `host.removeChild(node)` keeps working and react-dom never learns the
// difference (src/internal/adopt-children.ts). Adoption is a declared, checked
// state here rather than a silent exception — an element that imports
// `adoptChildren` is reported as adopting, and one that re-homes children by hand
// still fails rule 1.
//
// tc-select is the other shape: it never moves an `<option>` at all, it reads the
// options as DATA and builds a real `<select>` from them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..', 'src')
const baselinePath = join(here, 'react-safety-baseline.json')
const args = process.argv.slice(2)
const mode = args.includes('--update') ? 'update' : args.includes('--check') ? 'check' : 'report'

const register = readFileSync(join(srcDir, 'register.ts'), 'utf8')

// local import name -> file, from register.ts's own imports.
const importMap = new Map()
for (const m of register.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([A-Za-z0-9_]+)'/g)) {
    for (const spec of m[1].split(',')) {
        const parts = spec.trim().split(/\s+as\s+/)
        const local = (parts[1] || parts[0]).trim()
        if (local) importMap.set(local, m[2])
    }
}

const tags = []
for (const m of register.matchAll(
    /(?:customElements\.)?\bdefine\(\s*'(tc-[a-z0-9-]+)'\s*,\s*(?:class\s+extends\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+))/g,
)) {
    tags.push({ tag: m[1], cls: m[2] || m[3] })
}

const fileCache = new Map()
const read = (file) => {
    if (!fileCache.has(file)) {
        try {
            fileCache.set(file, readFileSync(join(srcDir, `${file}.ts`), 'utf8'))
        } catch {
            fileCache.set(file, null)
        }
    }
    return fileCache.get(file)
}
const readInternal = (name) => {
    try {
        return readFileSync(join(srcDir, 'internal', `${name}.ts`), 'utf8')
    } catch {
        return ''
    }
}

// The shared machinery is where the library's own appendChild/insertBefore calls
// live. Folding its text into a component's makes every component that imports it
// look like a mover — which is exactly how tc-select scored a rule-1 violation for
// merely reading `this.children` while importing patch-html.
const MACHINERY = new Set(['patch-html', 'adopt-children', 'content-observer'])

/** The ./internal/ helpers a component imports. */
const helpersOf = (src) =>
    [...src.matchAll(/from\s*['"]\.\/internal\/([A-Za-z0-9_-]+)['"]/g)].map((m) => m[1])

/** The component's own source plus every ./internal/ helper it imports — base
 *  classes live there, and a base class breaking a rule breaks it for the tag. */
const sourcesFor = (file) => {
    const src = read(file)
    if (src == null) return null
    return [src, ...helpersOf(src).map(readInternal)]
}

/** The same list with the machinery left out — what rule 1 has to read, so a
 *  component is judged on ITS OWN node handling. */
const ownSourcesFor = (file) => {
    const src = read(file)
    if (src == null) return null
    return [
        src,
        ...helpersOf(src)
            .filter((h) => !MACHINERY.has(h))
            .map(readInternal),
    ]
}

/** Does the element delegate its re-parenting to adoptChildren? That is the
 *  sanctioned path: the host forwards the mutations react-dom performs on it to
 *  wherever the child actually went, so the move is invisible to React. */
const adopts = (texts) => texts.some((t) => /\badoptChildren\s*\(/.test(t))

// ── Rule 1: never move a node you did not create ────────────────────────────
//
// The signature of a re-parenting element: capture the host's child nodes, then
// append them somewhere else. Both halves have to be present — plenty of
// elements read `this.children` to count or measure them, which is fine.
const CAPTURE =
    /(?:Array\.from\(\s*this\.(?:childNodes|children)\s*\)|\[\s*\.\.\.\s*this\.(?:childNodes|children)\s*\])/
// `append` is spelled the same on FormData, and `fd.append(name, value)` scored
// tc-select a rule-1 violation for a form submission. The DOM call takes nodes,
// so a bare `append` only counts with a single non-string argument; the other
// four names are unambiguous.
const REHOME =
    /\.(?:appendChild|insertBefore|prepend|replaceChildren)\s*\(|\.append\s*\(\s*(?!['"`])[^,)]*\)/

// The other shape of the same defect, and the one this check used to walk past:
// take ONE of the consumer's children — `this.firstElementChild`, `this.children[0]`
// — into a variable, then append THAT variable into a wrapper the element made.
// tc-floating-label did exactly this and scored as conforming for a whole release.
//
// The variable is what makes the check precise. Reading `firstElementChild` to
// measure or test it is fine and common, and so is appending a node the element
// created itself; only appending a node that CAME FROM the host is a move. Names
// are tainted transitively, because the capture and the append are usually a
// field and a local apart (`this._control = this.firstElementChild`, then
// `const control = this._control`, then `wrapper.appendChild(control)`).
const CHILD_READ = String.raw`this\.(?:firstChild|firstElementChild|lastChild|lastElementChild|children\s*\[|childNodes\s*\[)`

const taintedNames = (text) => {
    const tainted = new Set()
    const add = (name) => name && !RESERVED.has(name) && tainted.add(name)
    for (const m of text.matchAll(
        new RegExp(String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*` + CHILD_READ, 'g'),
    )) {
        add(m[1])
    }
    for (const m of text.matchAll(
        new RegExp(String.raw`this\.([A-Za-z_$][\w$]*)\s*=\s*` + CHILD_READ, 'g'),
    )) {
        add(m[1])
    }
    // Propagate through aliases: `const control = this._control` / `= control`.
    for (let pass = 0; pass < 3; pass++) {
        const before = tainted.size
        for (const m of text.matchAll(
            /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*(?:\?\?|\|\||$|;|\n)/gm,
        )) {
            if (tainted.has(m[2])) add(m[1])
        }
        if (tainted.size === before) break
    }
    return tainted
}

// Names that are never a captured child, only the platform's own.
const RESERVED = new Set(['document', 'window', 'undefined', 'null'])

const movesOneChild = (text) => {
    const tainted = taintedNames(text)
    if (tainted.size === 0) return false
    for (const m of text.matchAll(
        /\.(?:appendChild|append|insertBefore|prepend|replaceChildren)\s*\(\s*(?:this\.)?([A-Za-z_$][\w$]*)/g,
    )) {
        if (tainted.has(m[1])) return true
    }
    return false
}

const movesChildren = (texts) =>
    texts.some((t) => (CAPTURE.test(t) && REHOME.test(t)) || movesOneChild(t))

// ── Rule 2: build structure once, patch it forever ──────────────────────────
//
// An element that both observes attributes and assigns `this.innerHTML` rebuilds
// its subtree on a cosmetic change — losing focus, caret and any React-managed
// children inside it.
const OBSERVES = /static\s+get\s+observedAttributes/
const REBUILDS = /this\.innerHTML\s*=/

const rebuildsOnAttribute = (texts) => texts.some((t) => OBSERVES.test(t) && REBUILDS.test(t))

// ── Rule 4: every setter coerces ────────────────────────────────────────────
//
// Only the tri-state attributes are checked, because only they can receive the
// STRING 'false' and mean it. Their getters read `getAttribute(x) !== 'false'`
// (default-on); the matching setter must run its argument through `bool()` or an
// equivalent explicit `'false'` comparison, or `handle={false}` from React writes
// the literal string "false" straight back in as truthy.
const triStateGetters = (texts) => {
    const names = new Set()
    for (const text of texts) {
        for (const m of text.matchAll(
            /this\.getAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)\s*!==\s*['"]false['"]/g,
        )) {
            names.add(m[1])
        }
    }
    return names
}

const uncoercedTriState = (texts) => {
    const names = triStateGetters(texts)
    if (names.size === 0) return []
    const bad = []
    for (const name of names) {
        const prop = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
        const setter = new RegExp(`\\bset\\s+${prop}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s{4}\\}`)
        const body = texts.map((t) => setter.exec(t)).find(Boolean)?.[1]
        if (body == null) continue
        if (/\bbool\s*\(/.test(body) || /['"]false['"]/.test(body)) continue
        bad.push(name)
    }
    return bad
}

// ── Rule 5: self-initiated state changes reflect back ───────────────────────
//
// An element that observes `open` AND can close itself — a scrim tap, Escape, a
// drag, its own hide() — has to clear the attribute on every one of those paths,
// or `open={false}` on the next render is a no-op React never notices and the
// overlay is stuck open.
//
// The self-closing half of that is the qualifier, not decoration: an element that
// only ever reflects an `open` its consumer owns (tc-floating-action-bar) has no
// close path to reflect and is not in scope.
const observesOpen = (texts) =>
    texts.some((t) => /observedAttributes[\s\S]{0,400}?['"]open['"]/.test(t))
const closesItself = (texts) => texts.some((t) => /\b(?:hide|close|dismiss)\s*\(/.test(t))
const clearsOpen = (texts) => texts.some((t) => /removeAttribute\s*\(\s*['"]open['"]\s*\)/.test(t))

const RULES = [
    { id: 1, label: 'moves consumer children into an element-owned wrapper' },
    { id: 2, label: 'assigns this.innerHTML while observing attributes' },
    { id: 4, label: 'tri-state setter does not coerce the string "false"' },
    { id: 5, label: 'closes itself but never removes the `open` attribute' },
]

const results = []
const seen = new Set()
for (const { tag, cls } of tags) {
    if (seen.has(tag)) continue
    seen.add(tag)
    const file = importMap.get(cls)
    const texts = file ? sourcesFor(file) : null
    if (!texts) {
        results.push({ tag, file: file ?? '?', violations: [] })
        continue
    }
    const violations = []
    const ownTexts = ownSourcesFor(file)
    const adopting = adopts(ownTexts)
    if (!adopting && movesChildren(ownTexts)) violations.push(1)
    if (rebuildsOnAttribute(texts)) violations.push(2)
    const uncoerced = uncoercedTriState(texts)
    if (uncoerced.length) violations.push(4)
    if (observesOpen(texts) && closesItself(texts) && !clearsOpen(texts)) violations.push(5)
    results.push({ tag, file, violations, detail: uncoerced, adopting })
}

results.sort((a, b) => a.tag.localeCompare(b.tag))
const failing = results.filter((r) => r.violations.length > 0)
const conforming = results.length - failing.length

const label = (id) => RULES.find((r) => r.id === id).label

for (const r of failing) {
    for (const id of r.violations) {
        console.log(`  ✗ ${r.tag.padEnd(28)} ${label(id).padEnd(58)} (rule ${id})`)
    }
}
const adopting = results.filter((r) => r.adopting && r.violations.length === 0)
if (adopting.length) {
    console.log(
        `  ${adopting.length} element(s) adopt their children and answer for them (rule 1 by delegation):`,
    )
    console.log(`    ${adopting.map((r) => r.tag).join(', ')}`)
}
console.log('')
console.log(`  ${conforming} of ${results.length} elements conform`)
for (const rule of RULES) {
    const n = failing.filter((r) => r.violations.includes(rule.id)).length
    if (n) console.log(`    rule ${rule.id}: ${n} element${n === 1 ? '' : 's'}`)
}
console.log('')

const current = {
    // Only the count and the failing tag list are tracked. Storing tag names, not
    // just a number, is what stops a fixed element from paying for a new broken one.
    total: results.length,
    conforming,
    failing: failing.map((r) => r.tag),
    // Tracked so that an element quietly LOSING its adoption — going back to
    // moving children by hand — shows up as a change even though both states
    // report as conforming.
    adopting: adopting.map((r) => r.tag),
}

if (mode === 'update' || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, JSON.stringify(current, null, 4) + '\n')
    console.log(`  baseline written — ${conforming}/${results.length} conforming`)
    process.exit(0)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const known = new Set(baseline.failing)
const regressions = current.failing.filter((tag) => !known.has(tag))
const fixed = baseline.failing.filter((tag) => !current.failing.includes(tag))

if (fixed.length) {
    console.log(
        `  ${fixed.length} element(s) newly conforming: ${fixed.slice(0, 8).join(', ')}${fixed.length > 8 ? ', …' : ''}`,
    )
    console.log(`  run with --update to lower the ratchet.`)
}
if (regressions.length) {
    console.error(`  REGRESSION — ${regressions.length} element(s) newly non-conforming:`)
    for (const tag of regressions) console.error(`    ${tag}`)
    if (mode === 'check') process.exit(1)
}
process.exit(0)
