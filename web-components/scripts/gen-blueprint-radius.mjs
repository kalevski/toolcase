// Generates style/themes/blueprint/components/_radius.scss — the radius sweep
// that ROUNDS every flat-cornered surface for the blueprint theme. Blueprint is
// the one toolcase theme that breaks the sharp-corner mandate: its identity is
// the rounded rectangle (see blueprint_theme.md §1 / §5). The base partials
// hardcode `border-radius: 0` on ~282 surfaces, so a root --bs-border-radius
// override alone can't reach them — this sweep re-rounds them, scoped to the
// theme. Reads the COMPILED stylesheet (lib/index.css), so build the CSS first:
//
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-blueprint-radius.mjs
//   npm -w @toolcase/web-components run build:css   # re-emit with the new sweep
//
// Strategy — for every component SURFACE (a rule whose border-radius is `0` or a
// `var(--bs-X-border-radius)` slot, and NOT a circle/pill 50% / 999px):
//   (a) radius comes from a `var(--bs-X-border-radius)` slot → re-point that var
//       to the blueprint tier (cleanest — keeps the var machinery).
//   (b) radius is a hardcoded `0` literal → emit `border-radius: <tier>`.
// Two tiers by selector keyword: LG (8px) for big framed container surfaces
// (cards, panels, modals, menus, sheets, tiles …); MD (5px) for everything else
// (buttons, inputs, chips, badges, controls). Circles/pills (50% / 999px) and
// header/footer/body sub-parts of a framed parent are preserved/skipped so the
// rounded parent's corners aren't fought from the inside.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../lib/index.css'), 'utf8')
const SCSS_OUT = resolve(here, '../style/themes/blueprint/components/_radius.scss')

// ── tiny CSS parser: collect (selector, body) for every style rule ──────────
const rules = []
function parse(str) {
    let i = 0
    let buf = ''
    while (i < str.length) {
        const c = str[i]
        if (c === '{') {
            const sel = buf.trim()
            buf = ''
            let depth = 1
            let j = i + 1
            for (; j < str.length && depth > 0; j++) {
                if (str[j] === '{') depth++
                else if (str[j] === '}') depth--
            }
            const body = str.slice(i + 1, j - 1)
            if (/^@(media|supports|container)/i.test(sel)) parse(body)
            else if (!/^@/.test(sel)) rules.push({ sel, body })
            i = j
        } else {
            buf += c
            i++
        }
    }
}
parse(css)

function splitSel(sel) {
    const out = []
    let depth = 0
    let cur = ''
    for (const ch of sel) {
        if (ch === '(') depth++
        else if (ch === ')') depth--
        if (ch === ',' && depth === 0) {
            out.push(cur.trim())
            cur = ''
        } else cur += ch
    }
    if (cur.trim()) out.push(cur.trim())
    return out
}

const RADIUS_RE = /(?:^|;)\s*border-radius\s*:\s*([^;}]+)/gi
const RADIUS_PRESERVE = /(50%|999px|9999px|50rem|9999rem|100vmax)/i

// Big framed container surfaces → the 8px LG tier; everything else → 5px MD.
const LG_RE =
    /(card|panel|modal|popover|dropdown-menu|offcanvas|drawer|toast|sheet|dialog|lightbox|command-palette|menu(?!-item)|tile|hero|banner|callout|well|alert|code-snippet|code-with-output|terminal|tooltip|welcome-guide|empty-state|section-card|list-card|status-card|metric-card|feature-card|pricing|brief-card|activity-card|game-showcase|status-card|usage-summary)/i

const skip = (s) =>
    !s ||
    /tc-theme\[name=|\[data-tc-theme/.test(s) ||
    /^@/.test(s) ||
    s === ':root' ||
    s === 'html' ||
    s === 'body' ||
    s === '*' ||
    /-(header|footer|body)(__|\b|$)/.test(s) // sub-parts of framed parents

const litLg = new Set() // selectors → border-radius: var(--bp-r-lg)
const litMd = new Set() // selectors → border-radius: var(--bp-r-md)
const varOverride = new Map() // selector → Map(var-prefix → tier token)

for (const { sel, body } of rules) {
    let m
    let rv = null
    RADIUS_RE.lastIndex = 0
    while ((m = RADIUS_RE.exec(body)) !== null) rv = m[1].trim()
    if (rv === null) continue
    if (RADIUS_PRESERVE.test(rv)) continue

    const viaVar = rv.match(/var\(\s*(--bs-[a-z0-9-]*?)-border-radius/i)
    const isZero = rv === '0' || rv === '0px' || rv === '0rem'
    if (!viaVar && !isZero) continue

    for (const s of splitSel(sel)) {
        if (skip(s)) continue
        const tierToken = LG_RE.test(s) ? '--bp-r-lg' : '--bp-r-md'
        if (viaVar) {
            const prefix = viaVar[1] // e.g. --bs-card
            if (!varOverride.has(s)) varOverride.set(s, new Map())
            varOverride.get(s).set(prefix, tierToken)
        } else {
            ;(tierToken === '--bp-r-lg' ? litLg : litMd).add(s)
        }
    }
}

// a selector that gets a clean var-override shouldn't also get a literal sweep
for (const s of varOverride.keys()) {
    litLg.delete(s)
    litMd.delete(s)
}

const scope = (s) => `[data-tc-theme='blueprint'] ${s},\ntc-theme[name='blueprint'] ${s}`

const litBlock = (set, token) =>
    set.size
        ? `${[...set].sort().map(scope).join(',\n')} {\n    border-radius: var(${token});\n}`
        : ''

const varBlocks = [...varOverride.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([s, prefixes]) => {
        const decls = [...prefixes.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([p, token]) => `    ${p}-border-radius: var(${token});`)
            .join('\n')
        return `${scope(s)} {\n${decls}\n}`
    })
    .join('\n\n')

const header = `// Blueprint › radius sweep — GENERATED, do not hand-edit.
//
// Rounds every flat-cornered surface for the blueprint theme (its signature —
// blueprint is the one toolcase theme that breaks the sharp-corner mandate).
// LG tier (var(--bp-r-lg), 8px) for big framed containers; MD tier
// (var(--bp-r-md), 5px) for controls. Circles/pills (50% / 999px) and
// header/footer/body sub-parts are preserved. See scripts/gen-blueprint-radius.mjs.
//
// Regenerate:
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-blueprint-radius.mjs
//   npm -w @toolcase/web-components run build:css
//
// ${litLg.size} literal LG surfaces, ${litMd.size} literal MD surfaces, ${varOverride.size} var-driven re-points.

`

const parts = [header]
const lg = litBlock(litLg, '--bp-r-lg')
const md = litBlock(litMd, '--bp-r-md')
if (lg) parts.push('// ── Big framed surfaces → 8px (LG) ─────────────────────────────────────────\n' + lg)
if (md) parts.push('// ── Controls / small surfaces → 5px (MD) ───────────────────────────────────\n' + md)
if (varBlocks)
    parts.push('// ── Var-driven radii → re-point the --bs-*-border-radius slots ─────────────\n' + varBlocks)

writeFileSync(SCSS_OUT, parts.join('\n\n') + '\n')
console.log(
    `_radius.scss: lit-lg ${litLg.size}, lit-md ${litMd.size}, var-override ${varOverride.size}; scanned ${rules.length} rules`,
)
