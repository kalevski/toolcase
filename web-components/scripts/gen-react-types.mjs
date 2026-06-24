// Generates src/react-types.ts — opt-in React JSX typings for every tc-* custom element.
//
// Source of truth is src/register.ts: every `customElements.define('tc-...', Class)`
// call. For each tag we resolve Class -> source file (from register's imports) and
// read that class's `static get observedAttributes()` to type its attributes.
// Events are detected by scanning for `this.emit('tc-...')` and
// `new CustomEvent('tc-...')` calls in the component file and any
// `./internal/` helpers it imports.
// Emits a JSX.IntrinsicElements augmentation for both React.JSX (React 17+/19) and
// the global JSX namespace (React 18).
//
// Run:  npm -w @toolcase/web-components run gen:react-types
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..', 'src')
const register = readFileSync(join(srcDir, 'register.ts'), 'utf8')

// local import name -> { file, realName } — handles `import { A, B as C } from './File'`
const importMap = new Map()
for (const m of register.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([A-Za-z0-9_]+)'/g)) {
    const file = m[2]
    for (const spec of m[1].split(',')) {
        const parts = spec.trim().split(/\s+as\s+/)
        const realName = parts[0].trim()
        const local = (parts[1] || parts[0]).trim()
        if (local) importMap.set(local, { file, realName })
    }
}

// tag -> class name from every customElements.define(...). Two shapes:
//   define('tc-x', SomeClass)  /  define('tc-x', SomeClass as unknown as ...)
//   define('tc-x', class extends BaseClass {})  ← anonymous subclass, inherits attrs
const tagToClass = []
// register.ts wraps registration in a local `define(tag, ctor)` helper, so match
// both the wrapper calls `define('tc-x', Class)` and bare `customElements.define`.
for (const m of register.matchAll(
    /(?:customElements\.)?\bdefine\(\s*'(tc-[a-z0-9-]+)'\s*,\s*(?:class\s+extends\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+))/g
)) {
    tagToClass.push({ tag: m[1], cls: m[2] || m[3] })
}

const fileCache = new Map()
const readSrc = (file) => {
    if (!fileCache.has(file)) fileCache.set(file, readFileSync(join(srcDir, `${file}.ts`), 'utf8'))
    return fileCache.get(file)
}

const readInternal = (name) => {
    try {
        return readFileSync(join(srcDir, 'internal', `${name}.ts`), 'utf8')
    } catch {
        return ''
    }
}

// NAME -> [string members] for every `(export) const NAME = [ ... ]` array across
// all source files. Used to expand `...NAME` spreads inside observedAttributes()
// (e.g. `return ['type', ...TEXT_FIELD_ATTRIBUTES]`), which the per-class literal
// scan in attrsFor cannot resolve on its own.
const constMap = new Map()
const scanConsts = (src) => {
    for (const m of src.matchAll(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\[[\s\S]*?\])/g)) {
        const members = []
        for (const s of m[2].matchAll(/['"]([^'"]+)['"]/g)) members.push(s[1])
        if (members.length) constMap.set(m[1], members)
    }
}
for (const dir of [srcDir, join(srcDir, 'internal')]) {
    let files
    try {
        files = readdirSync(dir)
    } catch {
        files = []
    }
    for (const f of files) {
        if (!f.endsWith('.ts')) continue
        try {
            scanConsts(readFileSync(join(dir, f), 'utf8'))
        } catch {
            // skip unreadable file
        }
    }
}

// Extract a class's observed attributes. Indexes every class declaration in the
// file, slices the target class's body up to the next declaration, then reads its
// `observedAttributes` return array.
const attrsFor = (localName) => {
    const entry = importMap.get(localName)
    if (!entry) return []
    let src
    try {
        src = readSrc(entry.file)
    } catch {
        return []
    }
    const decls = [...src.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g)]
    const i = decls.findIndex(d => d[1] === entry.realName)
    if (i === -1) return []
    const body = src.slice(decls[i].index, i + 1 < decls.length ? decls[i + 1].index : undefined)
    const obs = body.match(/observedAttributes\s*\(\s*\)\s*:\s*[^{]*\{[\s\S]*?\breturn\s*(\[[\s\S]*?\])/)
    if (!obs) return []
    const attrs = []
    for (const s of obs[1].matchAll(/['"]([^'"]+)['"]/g)) attrs.push(s[1])
    // Expand `...CONST` spreads (shared/base-class attribute lists) the literal
    // scan above can't see, e.g. `return ['type', ...TEXT_FIELD_ATTRIBUTES]`.
    for (const sp of obs[1].matchAll(/\.\.\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const members = constMap.get(sp[1])
        if (members) attrs.push(...members)
    }
    return [...new Set(attrs)].sort()
}

// Collect tc-* event names from a source string.
const collectEvents = (src, set) => {
    for (const m of src.matchAll(/(?:this\.emit|\.emit)\s*\(\s*'(tc-[a-z][a-z0-9-]*)'/g)) set.add(m[1])
    for (const m of src.matchAll(/new\s+CustomEvent\s*\(\s*'(tc-[a-z][a-z0-9-]*)'/g)) set.add(m[1])
}

// Extract the tc-* events a component emits. Scans the component's own source
// file plus any ./internal/ files it imports (for inherited base-class events).
const eventsFor = (localName) => {
    const entry = importMap.get(localName)
    if (!entry) return []
    let src
    try {
        src = readSrc(entry.file)
    } catch {
        return []
    }
    const events = new Set()
    collectEvents(src, events)

    // Follow ./internal/ imports so that base-class events (e.g. tc-show/tc-hidden
    // from BsOverlay) are captured for components that extend them.
    for (const m of src.matchAll(/from\s*['"]\.\/internal\/([A-Za-z0-9_-]+)['"]/g)) {
        collectEvents(readInternal(m[1]), events)
    }

    return [...events].sort()
}

// Convert 'tc-foo-bar' -> 'onTcFooBar'
const eventToProp = (name) =>
    'on' + name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')

// Identify which observed attributes are boolean (presence-based) for a class.
// Heuristic: a boolean-attribute getter returns `this.hasAttribute('name')` rather
// than `this.getAttribute('name')`. Scanning for `return this.hasAttribute(...)` is
// precise — it matches the getter pattern and avoids false positives like
// `if (!this.hasAttribute('title'))` guards on value attributes.
// Also follows ./internal/ imports so that attributes inherited from base helpers
// (e.g. `open` from bs-overlay, `disabled`/`required` from text-field-base) are
// detected correctly.
const booleanAttrsFor = (localName) => {
    const entry = importMap.get(localName)
    if (!entry) return new Set()
    let src
    try {
        src = readSrc(entry.file)
    } catch {
        return new Set()
    }
    const boolSet = new Set()
    const collectBooleans = (text) => {
        // A boolean attribute is one whose getter RETURNS `this.hasAttribute('name')`.
        // Two return shapes occur; both stop at statement boundaries (`;{}`) so guards
        // like `if (!this.hasAttribute(...))` after a bare `return` don't leak in:
        //   1) single-line:        `return … this.hasAttribute('name')`  (no newline crossing)
        //   2) parenthesised body: `return (\n  … ?? this.hasAttribute('name')\n)`
        // A bare `return` is never followed by `(`, so case 2 can't bridge into a later guard.
        for (const m of text.matchAll(/return\s+[^\n;{}]*?this\.hasAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            boolSet.add(m[1])
        }
        for (const m of text.matchAll(/return\s*\([^;{}]*?this\.hasAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            boolSet.add(m[1])
        }
    }
    collectBooleans(src)
    for (const m of src.matchAll(/from\s*['"]\.\/internal\/([A-Za-z0-9_-]+)['"]/g)) {
        collectBooleans(readInternal(m[1]))
    }
    return boolSet
}

const components = tagToClass
    .map(({ tag, cls }) => ({ tag, attrs: attrsFor(cls), events: eventsFor(cls), boolAttrs: booleanAttrsFor(cls) }))
    .sort((a, b) => a.tag.localeCompare(b.tag))

const lines = []
lines.push(`// AUTO-GENERATED by scripts/gen-react-types.mjs — do not edit by hand.`)
lines.push(`// Opt-in React JSX typings for @toolcase/web-components custom elements.`)
lines.push(`//`)
lines.push(`// Import via the package's ./react entry point (src/react.ts), which also`)
lines.push(`// exports the useTc / useTcEvents runtime hooks.`)
lines.push(`//`)
lines.push(`// Regenerate after adding/removing a component or attribute:`)
lines.push(`//     npm -w @toolcase/web-components run gen:react-types`)
lines.push(``)
lines.push(`import type * as React from 'react'`)
lines.push(``)
lines.push(`/**`)
lines.push(` * Props for a toolcase custom element: standard HTML attributes (className,`)
lines.push(` * style, ref, event handlers, …) plus the element's own kebab-case attributes`)
lines.push(` * in \`T\` for autocomplete. Typos in attribute names are now a TypeScript error.`)
lines.push(` * Use useTc() to wire the on* event handler props at runtime.`)
lines.push(` */`)
lines.push(`export type TcProps<T = {}> = React.DetailedHTMLProps<`)
lines.push(`    React.HTMLAttributes<HTMLElement> & T,`)
lines.push(`    HTMLElement`)
lines.push(`>`)
lines.push(``)
lines.push(`export interface ToolcaseIntrinsicElements {`)
for (const { tag, attrs, events, boolAttrs } of components) {
    const attrParts = attrs.map(a => {
        // Boolean (presence-based) attributes must not accept string | number, because
        // React sets the attribute string for any truthy value, so `disabled={false}`
        // would produce `disabled="false"` and keep hasAttribute('disabled') returning true.
        // Type them as `boolean` only so that false → omit, true → setAttribute('', '').
        const type = boolAttrs.has(a) ? 'boolean' : 'string | number'
        return `'${a}'?: ${type}`
    })
    const eventParts = events.map(e => `${eventToProp(e)}?: (e: CustomEvent) => void`)
    const allParts = [...attrParts, ...eventParts]
    if (allParts.length === 0) {
        lines.push(`    '${tag}': TcProps`)
    } else {
        const props = allParts.join('; ')
        lines.push(`    '${tag}': TcProps<{ ${props} }>`)
    }
}
lines.push(`}`)
lines.push(``)
lines.push(`// React 17+ automatic runtime / React 19 — IntrinsicElements lives on React.JSX.`)
lines.push(`declare module 'react' {`)
lines.push(`    namespace JSX {`)
lines.push(`        interface IntrinsicElements extends ToolcaseIntrinsicElements {}`)
lines.push(`    }`)
lines.push(`}`)
lines.push(``)
lines.push(`// Classic global JSX namespace — React 18 and the legacy runtime.`)
lines.push(`declare global {`)
lines.push(`    namespace JSX {`)
lines.push(`        interface IntrinsicElements extends ToolcaseIntrinsicElements {}`)
lines.push(`    }`)
lines.push(`}`)
lines.push(``)
lines.push(`export {}`)
lines.push(``)

writeFileSync(join(srcDir, 'react-types.ts'), lines.join('\n'))
console.log(`Wrote src/react-types.ts — ${components.length} tc-* elements`)
