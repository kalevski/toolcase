// Generates style/themes/sunshine/components/_border.scss — the border sweep
// that gives every flat component an olive hairline for the sunshine theme
// (CITRINA outlines every surface). Reads the COMPILED stylesheet
// (lib/index.css), so build the CSS first, then run this:
//
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-sunshine-border.mjs
//   npm -w @toolcase/web-components run build:css   # re-emit with the new sweep
//
// Strategy — for every component SURFACE (a flat-cornered selector, so
// cards / chips / buttons / tiles / inputs … and NOT inner bars / dots / circles):
//   (a) the surface draws a transparent border through its own
//       `border: var(--bs-X-border-width) solid var(--bs-X-border-color)` machinery
//       → re-point those vars to the olive line (no clobber, keeps the markup).
//   (b) the surface is frameless (`border: none` / `0` / no border decl)
//       → add `border: 1px solid var(--sun-line)`.
//   (c) the surface already shows a visible border (e.g. the alert left bar,
//       cards, panels) → SKIP; the foundation token already paints it olive.
// Header / footer / body sub-parts are skipped so framed parents don't double-box.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../lib/index.css'), 'utf8')
const SCSS_OUT = resolve(here, '../style/themes/sunshine/components/_border.scss')

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
const RADIUS_PRESERVE = /(50%|999px|9999px|50rem|9999rem)/i
// border / border-<side> shorthands (NOT -radius/-width/-color/-style longhands)
const EDGE_RE = /(?:^|;)\s*(border(?:-(?:top|right|bottom|left))?)\s*:\s*([^;}]+)/gi
const skip = (s) =>
    !s ||
    /tc-theme\[name=|\[data-tc-theme/.test(s) ||
    /^@/.test(s) ||
    s === ':root' ||
    s === 'html' ||
    s === 'body' ||
    s === '*' ||
    /-(header|footer|body)(__|\b|$)/.test(s) // sub-parts of framed parents

const addShorthand = new Set() // selectors → border:1px solid var(--sun-line)
const varOverride = new Map() // selector → Set(var-prefix) e.g. --bs-btn-

for (const { sel, body } of rules) {
    // surface = the radius sweep's criterion (round corner, not circle/pill)
    let m
    let rv = null
    RADIUS_RE.lastIndex = 0
    while ((m = RADIUS_RE.exec(body)) !== null) rv = m[1].trim()
    const isSurface = rv !== null && !RADIUS_PRESERVE.test(rv) && (rv === '0' || /^var\(--bs-/.test(rv))
    if (!isSurface) continue

    // inspect every border-edge declaration
    const edges = [...body.matchAll(EDGE_RE)].map((e) => [e[1].toLowerCase(), e[2].trim()])
    let visible = false
    const prefixes = new Set()
    for (const [, val] of edges) {
        if (val === 'none' || val === '0' || /^0\s/.test(val)) continue
        const varMatch = val.match(/var\(\s*(--bs-[a-z0-9-]*?)-border-color/i)
        if (varMatch) {
            const prefix = varMatch[1] // e.g. --bs-btn
            // is that color var set transparent / 0 in THIS body? → invisible
            const re = new RegExp(`${prefix}-border-color\\s*:\\s*(transparent|0)\\b`, 'i')
            if (re.test(body)) {
                prefixes.add(prefix)
            } else {
                visible = true // var resolves to a real (olive via token) colour
            }
            continue
        }
        if (/transparent/.test(val)) continue
        visible = true // literal width+style+colour
    }

    if (visible) continue // case (c): already framed → token handles the colour

    for (const s of splitSel(sel)) {
        if (skip(s)) continue
        if (prefixes.size) {
            if (!varOverride.has(s)) varOverride.set(s, new Set())
            for (const p of prefixes) varOverride.get(s).add(p)
        } else {
            addShorthand.add(s)
        }
    }
}

// a selector that gets a clean var-override shouldn't also get the shorthand
for (const s of varOverride.keys()) addShorthand.delete(s)

const scope = (s) => `[data-tc-theme='sunshine'] ${s},\ntc-theme[name='sunshine'] ${s}`

const shorthandBlock = `${[...addShorthand].sort().map(scope).join(',\n')} {\n    border: 1px solid var(--sun-line);\n}`

const varBlocks = [...varOverride.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([s, prefixes]) => {
        const decls = [...prefixes]
            .sort()
            .flatMap((p) => [`    ${p}-border-color: var(--sun-line);`, `    ${p}-border-width: 1px;`])
            .join('\n')
        return `${scope(s)} {\n${decls}\n}`
    })
    .join('\n\n')

const header = `// Sunshine › border sweep — GENERATED, do not hand-edit.
//
// Gives every flat component an olive hairline so the sunshine theme matches the
// fully-outlined CITRINA storefront. Surfaces that already show a border (cards,
// panels, chips, inputs, the alert left bar …) are skipped — the foundation
// token already paints those olive. See scripts/gen-sunshine-border.mjs.
//
// Regenerate:
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-sunshine-border.mjs
//   npm -w @toolcase/web-components run build:css
//
// ${addShorthand.size} frameless surfaces get a shorthand border; ${varOverride.size} draw a
// transparent var-border that is re-pointed to the olive line.

`

writeFileSync(
    SCSS_OUT,
    header +
        '// ── Frameless surfaces → add an olive hairline ─────────────────────────────\n' +
        shorthandBlock +
        '\n\n// ── Transparent var-borders → re-point the colour/width vars to olive ──────\n' +
        varBlocks +
        '\n',
)
console.log(
    `_border.scss: shorthand ${addShorthand.size}, var-override ${varOverride.size}; scanned ${rules.length} rules`,
)
