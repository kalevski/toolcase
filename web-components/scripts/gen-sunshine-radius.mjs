// Generates style/themes/sunshine/components/_radius.scss — the corner-radius
// sweep that re-rounds every component for the sunshine theme (CITRINA opts out
// of the toolcase sharp-corner mandate). It reads the COMPILED stylesheet
// (lib/index.css), so build the CSS first, then run this:
//
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-sunshine-radius.mjs
//   npm -w @toolcase/web-components run build:css   # re-emit with the new sweep
//
// For every base rule whose `border-radius` resolves to 0 (or a per-component
// radius var that defaults to 0) it emits a sunshine-scoped override to a CITRINA
// radius; genuinely circular shapes (50%) and pills (999px) are re-asserted last
// so they survive. The default theme / aurora / dungeon are untouched.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CSS_IN = resolve(here, '../lib/index.css')
const SCSS_OUT = resolve(here, '../style/themes/sunshine/components/_radius.scss')

const css = readFileSync(CSS_IN, 'utf8')

// ── tiny CSS parser: collect (selector, body) for every style rule, recursing
// into @media/@supports/@container, skipping @keyframes/@font-face/@import. ──
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
            if (/^@(media|supports|container)/i.test(sel)) {
                parse(body)
            } else if (/^@(keyframes|font-face|charset|import|namespace|page)/i.test(sel)) {
                // skip — not normal style rules
            } else {
                rules.push({ sel, body })
            }
            i = j
        } else {
            buf += c
            i++
        }
    }
}
parse(css)

// split a selector group on top-level commas (respect parens)
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
const PRESERVE = /(50%|999px|9999px|50rem|9999rem)/i
const BIG =
    /(card|modal|panel|drawer|offcanvas|popover|dropdown-menu|hero|backdrop|lightbox|gallery|artboard|sheet|\bwell\b|tile|thumbnail|terminal-window|chat-window|code-snippet|code-with-output|json-editor|markdown-editor|node-editor|dialog|window|frame|lobby|screen|overlay|carousel|crop)/i

const mid = new Set()
const lg = new Set()
const preserve = new Map() // selector -> exact value (50% / pill) to re-assert last

const skip = (s) =>
    !s ||
    /tc-theme\[name=|\[data-tc-theme/.test(s) ||
    /^@/.test(s) ||
    s === ':root' ||
    s === 'html' ||
    s === 'body' ||
    s === '*'

for (const { sel, body } of rules) {
    // last border-radius value in the block wins
    let m
    let val = null
    RADIUS_RE.lastIndex = 0
    while ((m = RADIUS_RE.exec(body)) !== null) val = m[1].trim()
    if (val === null) continue

    const isPreserve = PRESERVE.test(val)
    const round = !isPreserve && (val === '0' || /^var\(--bs-/.test(val))

    for (const s of splitSel(sel)) {
        if (skip(s)) continue
        if (isPreserve) preserve.set(s, val)
        else if (round) (BIG.test(s) ? lg : mid).add(s)
    }
}

for (const s of lg) mid.delete(s) // lg wins over mid for the same selector

const scope = (s) => `[data-tc-theme='sunshine'] ${s},\ntc-theme[name='sunshine'] ${s}`
const block = (set, varName) =>
    `${[...set].sort().map(scope).join(',\n')} {\n    border-radius: var(${varName});\n}`

const preserveBlocks = () => {
    const byVal = new Map()
    for (const [s, v] of preserve) {
        if (!byVal.has(v)) byVal.set(v, [])
        byVal.get(v).push(s)
    }
    return [...byVal.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([v, sels]) => `${sels.sort().map(scope).join(',\n')} {\n    border-radius: ${v};\n}`)
        .join('\n\n')
}

const header = `// Sunshine › corner-radius sweep — GENERATED, do not hand-edit.
//
// Sunshine opts out of the toolcase sharp-corner mandate to match the rounded
// CITRINA storefront. The base components bake \`border-radius: 0\` (or a
// per-component radius var that defaults to 0) into ~${mid.size + lg.size} selectors;
// this file re-rounds every one inside the sunshine theme root. Genuinely
// circular shapes (border-radius: 50%) and pills (999px) are re-asserted last.
//
// Regenerate (see scripts/gen-sunshine-radius.mjs):
//   npm -w @toolcase/web-components run build:css
//   node scripts/gen-sunshine-radius.mjs
//   npm -w @toolcase/web-components run build:css
//
// Two tiers: large container surfaces (cards / modals / panels / overlays …) get
// --sun-radius-lg; everything else gets --sun-radius. Both knobs live in
// ../_foundation.scss.

`

const out =
    header +
    block(mid, '--sun-radius') +
    '\n\n' +
    block(lg, '--sun-radius-lg') +
    '\n\n// ── Preserve circular shapes + pills (re-asserted after the sweep) ──────────\n' +
    preserveBlocks() +
    '\n'

writeFileSync(SCSS_OUT, out)
console.log(
    `_radius.scss: mid ${mid.size}, lg ${lg.size}, preserve ${preserve.size} (round total ${mid.size + lg.size}); scanned ${rules.length} rules`,
)
