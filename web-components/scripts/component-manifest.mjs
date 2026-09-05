// Shared component manifest for the React generators.
//
// gen-react-types.mjs (JSX typings) and gen-react-components.mjs (wrapper
// components) need exactly the same facts about every registered element — its
// class, its observed attributes and their declared types, and the tc-* events it
// emits with their detail shapes. Extracting them once is what stops the two
// generated files from disagreeing with each other.
//
// Source of truth is src/register.ts: every `customElements.define('tc-...', Class)`
// call. For each tag we resolve Class -> source file (from register's imports) and
// read that class's `static get observedAttributes()` to type its attributes.
// Events are detected by scanning for `this.emit('tc-...')` and
// `new CustomEvent('tc-...')` calls in the component file and any `./internal/`
// helpers it imports.

import { readFileSync, readdirSync } from 'node:fs'
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
    /(?:customElements\.)?\bdefine\(\s*'(tc-[a-z0-9-]+)'\s*,\s*(?:class\s+extends\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+))/g,
)) {
    tagToClass.push({ tag: m[1], cls: m[2] || m[3] })
}

const fileCache = new Map()
const readSrc = (file) => {
    if (!fileCache.has(file)) fileCache.set(file, readFileSync(join(srcDir, `${file}.ts`), 'utf8'))
    return fileCache.get(file)
}

const internalCache = new Map()
const readInternal = (name) => {
    if (internalCache.has(name)) return internalCache.get(name)
    let text
    try {
        text = readFileSync(join(srcDir, 'internal', `${name}.ts`), 'utf8')
    } catch {
        text = ''
    }
    internalCache.set(name, text)
    return text
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

// Resolve an exported name to the declared class name, following export aliases
// like `export { TcFile as File }` (used where the natural class name collides
// with a DOM global).
const declaredClassName = (src, exportedName) => {
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (const spec of m[1].split(',')) {
            const parts = spec.trim().split(/\s+as\s+/)
            if (parts.length === 2 && parts[1].trim() === exportedName) return parts[0].trim()
        }
    }
    return exportedName
}

/**
 * Everything the emitters need about one registered class, resolved once:
 * its file, its own source, the slice of source that is the class body, and the
 * text of every `./internal/` helper it imports (where base-class accessors,
 * events and attribute lists live).
 */
const infoCache = new Map()
const classInfo = (localName) => {
    if (infoCache.has(localName)) return infoCache.get(localName)
    let info = null
    const entry = importMap.get(localName)
    if (entry) {
        let src
        try {
            src = readSrc(entry.file)
        } catch {
            src = null
        }
        if (src != null) {
            const className = declaredClassName(src, entry.realName)
            // Anchored to line start so the word "class" inside comments/strings can't
            // register as a declaration and truncate the real class's body slice.
            const decls = [...src.matchAll(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm)]
            const i = decls.findIndex((d) => d[1] === className)
            const body =
                i === -1
                    ? ''
                    : src.slice(
                          decls[i].index,
                          i + 1 < decls.length ? decls[i + 1].index : undefined,
                      )
            const internals = []
            for (const m of src.matchAll(/from\s*['"]\.\/internal\/([A-Za-z0-9_-]+)['"]/g)) {
                internals.push({ name: m[1], text: readInternal(m[1]) })
            }
            info = { file: entry.file, exportName: entry.realName, className, src, body, internals }
        }
    }
    infoCache.set(localName, info)
    return info
}

// Extract a class's observed attributes from its body slice.
const attrsFor = (info, seen = new Set()) => {
    if (!info || !info.body) return []
    const obs = info.body.match(
        /observedAttributes\s*\(\s*\)\s*:\s*[^{]*\{[\s\S]*?\breturn\s*(\[[\s\S]*?\])/,
    )
    if (!obs) return []
    const attrs = []
    for (const s of obs[1].matchAll(/['"]([^'"]+)['"]/g)) attrs.push(s[1])
    // Expand `...CONST` spreads (shared/base-class attribute lists) the literal
    // scan above can't see, e.g. `return ['type', ...TEXT_FIELD_ATTRIBUTES]`.
    for (const sp of obs[1].matchAll(/\.\.\.([A-Za-z_][A-Za-z0-9_]*)(?!\s*\.)/g)) {
        const members = constMap.get(sp[1])
        if (members) attrs.push(...members)
    }
    // Expand `...BaseClass.observedAttributes` — the spelling a SUBCLASS uses to
    // extend its base's list (tc-confirm-sheet and tc-qr-scan-sheet both extend
    // tc-bottom-sheet this way). Without it a subclass loses every attribute it
    // inherited, which is most of them.
    for (const sp of obs[1].matchAll(/\.\.\.([A-Za-z_][A-Za-z0-9_]*)\.observedAttributes/g)) {
        const name = sp[1]
        // Guarded against a cycle, and against a class importing itself.
        if (seen.has(name)) continue
        seen.add(name)
        const base = classInfo(name)
        if (base) attrs.push(...attrsFor(base, seen))
    }
    // `class` is observed by the elements that own their host class (so they can
    // re-assert it after react-dom overwrites the attribute), but it is not part of
    // their prop surface — React spells it `className` and already types it.
    return [...new Set(attrs)].filter((a) => a !== 'class').sort()
}

// Collect tc-* event names from a source string.
const collectEvents = (src, set) => {
    for (const m of src.matchAll(/(?:this\.emit|\.emit)\s*\(\s*'(tc-[a-z][a-z0-9-]*)'/g))
        set.add(m[1])
    // The optional `<Detail>` group is not cosmetic: five components type the
    // detail at the construction site, and without it their events were silently
    // absent from the generated props — tc-generate on tc-bitmap-font-generator
    // and tc-normal-map-generator, tc-continue on tc-press-any-key, tc-step-click
    // on tc-welcome-guide, tc-shell-scroll on tc-mobile-shell. `[^>]*` suffices;
    // no detail type in this library is itself generic.
    for (const m of src.matchAll(/new\s+CustomEvent\s*(?:<[^>]*>)?\s*\(\s*'(tc-[a-z][a-z0-9-]*)'/g))
        set.add(m[1])
}

// Extract the tc-* events a component emits. Scans the component's own source
// file plus any ./internal/ files it imports (for inherited base-class events).
const eventsFor = (info) => {
    if (!info) return []
    const events = new Set()
    collectEvents(info.src, events)
    // Follow ./internal/ imports so that base-class events (e.g. tc-show/tc-hidden
    // from BsOverlay) are captured for components that extend them.
    for (const helper of info.internals) collectEvents(helper.text, events)
    return [...events].sort()
}

// Identify which observed attributes are boolean (presence-based) for a class.
// Heuristic: a boolean-attribute getter returns `this.hasAttribute('name')` rather
// than `this.getAttribute('name')`. Scanning for `return this.hasAttribute(...)` is
// precise — it matches the getter pattern and avoids false positives like
// `if (!this.hasAttribute('title'))` guards on value attributes.
// Also follows ./internal/ imports so that attributes inherited from base helpers
// (e.g. `open` from bs-overlay, `disabled`/`required` from text-field-base) are
// detected correctly.
const booleanAttrsFor = (info) => {
    if (!info) return new Set()
    const boolSet = new Set()
    const collectBooleans = (text) => {
        // A boolean attribute is one whose getter RETURNS `this.hasAttribute('name')`.
        // Two return shapes occur; both stop at statement boundaries (`;{}`) so guards
        // like `if (!this.hasAttribute(...))` after a bare `return` don't leak in:
        //   1) single-line:        `return … this.hasAttribute('name')`  (no newline crossing)
        //   2) parenthesised body: `return (\n  … ?? this.hasAttribute('name')\n)`
        // A bare `return` is never followed by `(`, so case 2 can't bridge into a later guard.
        for (const m of text.matchAll(
            /return\s+[^\n;{}]*?this\.hasAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        )) {
            boolSet.add(m[1])
        }
        for (const m of text.matchAll(
            /return\s*\([^;{}]*?this\.hasAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        )) {
            boolSet.add(m[1])
        }
    }
    collectBooleans(info.src)
    for (const helper of info.internals) collectBooleans(helper.text)
    for (const text of scanTexts(info)) collectBooleans(text)
    return boolSet
}

// ── Imported-type bookkeeping ───────────────────────────────────────────────
//
// Union types and event-detail types live beside the components that declare
// them, so a generated file has to import them. Descriptors below name the type
// and the module it comes from; each generator does its own aliasing.

/** Locate `export type X = …` / `export interface X …` in a component file or one
 *  of its internal helpers. Returns the module specifier to import it from. */
const findExportedTypeModule = (info, name) => {
    const decl = new RegExp(`export\\s+(?:type|interface)\\s+${name}\\b`)
    if (decl.test(info.src)) return `./${info.file}`
    for (const helper of info.internals) {
        if (decl.test(helper.text)) return `./internal/${helper.name}`
    }
    return null
}

/**
 * Body of `export type X = …`. Both prettier shapes occur in this codebase — the
 * one-liner `= 'a' | 'b'` and the leading-pipe block — so continuation lines are
 * taken while they start with `|`, and the alias ends at the first line that does
 * not (a comment, the next declaration, a blank line).
 */
const typeAliasBody = (text, name) => {
    const m = new RegExp(`export\\s+type\\s+${name}\\s*=`).exec(text)
    if (!m) return null
    const rest = text.slice(m.index + m[0].length).split('\n')
    const out = []
    for (const line of rest) {
        const trimmed = line.trim()
        if (out.join('').trim() !== '' && !trimmed.startsWith('|')) break
        out.push(trimmed)
    }
    return out.join(' ').trim().replace(/;$/, '')
}

/** True when the alias is a pure union of string literals — the only shape that
 *  is safe to use as an HTML-attribute type (React stringifies whatever it gets). */
const isStringLiteralUnion = (body) => {
    if (!body) return false
    const parts = body
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean)
    if (parts.length === 0) return false
    return parts.every((p) => /^'[^']*'$/.test(p) || p === 'null' || p === 'undefined')
}

// ── Attribute types ─────────────────────────────────────────────────────────

const camel = (attr) => attr.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

/** Read the declared parameter type of `set <prop>(…)`, balancing parentheses so
 *  function-typed parameters like `(v: (() => void) | null)` are read whole. */
const setterParamType = (text, prop) => {
    const re = new RegExp(`\\bset\\s+${prop}\\s*\\(`, 'g')
    const m = re.exec(text)
    if (!m) return null
    let depth = 1
    let i = re.lastIndex
    for (; i < text.length && depth > 0; i++) {
        if (text[i] === '(') depth++
        else if (text[i] === ')') depth--
    }
    const params = text.slice(re.lastIndex, i - 1)
    const colon = params.indexOf(':')
    return colon === -1 ? null : params.slice(colon + 1).trim()
}

/**
 * The JSX type for one observed attribute.
 *
 * Booleans stay `boolean` only: React sets the attribute string for any truthy
 * value, so `disabled={false}` typed as `string` would produce `disabled="false"`
 * and keep `hasAttribute('disabled')` returning true.
 *
 * Everything else defaults to `string | number` — but when the matching setter
 * declares a named string-literal union (`ButtonVariant`, `FieldState`, …) that
 * union is emitted instead, so a misspelt variant is a compile error rather than
 * a silently ignored attribute.
 */
/**
 * Every class body a per-attribute scanner has to look at: the component's own,
 * plus the body of any class it extends through a
 * `...Base.observedAttributes` spread.
 *
 * Without this, a SUBCLASS inherits its base's attribute NAMES (attrsFor resolves
 * the spread) but not their types — so `dismissible` on tc-confirm-sheet came out
 * `string | number` while the identical attribute on tc-bottom-sheet came out
 * tri-state. Two spellings of one attribute is exactly the drift these generators
 * exist to prevent.
 */
const scanTexts = (info, seen = new Set()) => {
    const texts = [info.body, ...info.internals.map((h) => h.text)]
    const obs = info.body.match(
        /observedAttributes\s*\(\s*\)\s*:\s*[^{]*\{[\s\S]*?\breturn\s*(\[[\s\S]*?\])/,
    )
    if (!obs) return texts
    for (const sp of obs[1].matchAll(/\.\.\.([A-Za-z_][A-Za-z0-9_]*)\.observedAttributes/g)) {
        if (seen.has(sp[1])) continue
        seen.add(sp[1])
        const base = classInfo(sp[1])
        if (base) texts.push(...scanTexts(base, seen))
    }
    return texts
}

const STRING_OR_NUMBER = { kind: 'raw', text: 'string | number' }

/**
 * A TRI-STATE attribute: one whose default is ON, so it carries the STRING
 * `"false"` to turn it off rather than being presence-based (`dismissible`,
 * `handle`, `blur-behind`, `autohide`, `locked`, `inspector-open`, `rail-open`).
 *
 * `boolean | 'true' | 'false'` and not `string | number`: `handle={false}` is the
 * spelling a React author reaches for, the setters all coerce it, and typing it as
 * a string made the one correct spelling a compile error.
 */
const TRI_STATE = { kind: 'raw', text: "boolean | 'true' | 'false'" }

/** Names whose getter reads `getAttribute(x) !== 'false'` — the tri-state shape. */
const triStateAttrsFor = (info) => {
    const names = new Set()
    for (const text of scanTexts(info)) {
        for (const m of text.matchAll(
            /this\.getAttribute\s*\(\s*['"]([^'"]+)['"]\s*\)\s*!==\s*['"]false['"]/g,
        )) {
            names.add(m[1])
        }
    }
    return names
}

const attrType = (info, attr, boolAttrs, triState) => {
    if (boolAttrs.has(attr)) return { kind: 'boolean' }
    if (triState.has(attr)) return TRI_STATE
    const prop = camel(attr)
    for (const text of scanTexts(info)) {
        const declared = setterParamType(text, prop)
        if (!declared) continue
        const named = declared
            .split('|')
            .map((p) => p.trim())
            .filter((p) => p && p !== 'null' && p !== 'undefined')
        if (named.length !== 1 || !/^[A-Z][A-Za-z0-9_]*$/.test(named[0])) return STRING_OR_NUMBER
        const typeName = named[0]
        const module = findExportedTypeModule(info, typeName)
        if (!module) return STRING_OR_NUMBER
        const source =
            module === `./${info.file}`
                ? info.src
                : (info.internals.find((h) => `./internal/${h.name}` === module)?.text ?? '')
        if (!isStringLiteralUnion(typeAliasBody(source, typeName))) return STRING_OR_NUMBER
        return { kind: 'named', name: typeName, module }
    }
    return STRING_OR_NUMBER
}

// ── Event detail types ──────────────────────────────────────────────────────

/** Top-level keys of an object literal body (`a: 1, b, 'c': 3` → a, b, c). */
const objectLiteralKeys = (body) => {
    const keys = []
    let depth = 0
    let start = 0
    const parts = []
    for (let i = 0; i < body.length; i++) {
        const ch = body[i]
        if (ch === '{' || ch === '[' || ch === '(') depth++
        else if (ch === '}' || ch === ']' || ch === ')') depth--
        else if (ch === ',' && depth === 0) {
            parts.push(body.slice(start, i))
            start = i + 1
        }
    }
    parts.push(body.slice(start))
    for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed || trimmed.startsWith('...')) continue
        const colon = trimmed.indexOf(':')
        const raw = (colon === -1 ? trimmed : trimmed.slice(0, colon)).trim()
        const key = raw.replace(/^['"]|['"]$/g, '')
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) keys.push(key)
    }
    return [...new Set(keys)]
}

/** Slice from an opening brace/paren at `open` to its match (inclusive). */
const balanced = (text, open) => {
    const closers = { '{': '}', '(': ')', '[': ']' }
    const closer = closers[text[open]]
    let depth = 0
    for (let i = open; i < text.length; i++) {
        if (text[i] === text[open]) depth++
        else if (text[i] === closer) {
            depth--
            if (depth === 0) return text.slice(open, i + 1)
        }
    }
    return null
}

/**
 * The `CustomEvent<Detail>` type argument for one event.
 *
 * Three sources, in order of confidence:
 *  1. an explicit `new CustomEvent<Detail>('tc-x', …)` type argument, imported
 *     when the named type is exported;
 *  2. the keys of the `detail: { … }` object literal at a dispatch site — the
 *     key names are what a consumer needs; the value types are not statically
 *     recoverable here, so they are `any`;
 *  3. `dispatchFieldChange`, the shared form-field helper, which always fires
 *     `tc-change` with `{ value }`.
 *
 * Falling back to a bare `CustomEvent` (i.e. `CustomEvent<any>`) is deliberate:
 * an over-narrow detail type would push consumers straight back into casting.
 */
const detailFor = (info, event) => {
    const texts = [info.src, ...info.internals.map((h) => h.text)]

    for (const text of texts) {
        const g = new RegExp(`new\\s+CustomEvent\\s*<([^>]*)>\\s*\\(\\s*'${event}'`).exec(text)
        if (!g) continue
        const declared = g[1].trim()
        if (/^[A-Z][A-Za-z0-9_]*$/.test(declared)) {
            const module = findExportedTypeModule(info, declared)
            if (module) return { kind: 'named', name: declared, module }
            return null
        }
        // `void`, `{ key: string }` and friends can be emitted verbatim.
        return { kind: 'raw', text: declared }
    }

    for (const text of texts) {
        const re = new RegExp(`new\\s+CustomEvent\\s*\\(\\s*'${event}'\\s*,`, 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            const braceAt = text.indexOf('{', m.index + m[0].length - 1)
            if (braceAt === -1) continue
            const init = balanced(text, braceAt)
            if (!init) continue
            const d = /(^|[\s,{])detail\s*:\s*\{/.exec(init)
            if (!d) continue
            const detailBrace = init.indexOf('{', d.index + d[0].length - 1)
            const detail = balanced(init, detailBrace)
            if (!detail) continue
            const keys = objectLiteralKeys(detail.slice(1, -1))
            if (keys.length) {
                return { kind: 'raw', text: `{ ${keys.map((k) => `${k}: any`).join('; ')} }` }
            }
        }
    }

    if (event === 'tc-change' && texts.some((t) => /\bdispatchFieldChange\s*\(/.test(t))) {
        return { kind: 'raw', text: '{ value: any }' }
    }

    return null
}

// ── JS-only properties ──────────────────────────────────────────────────────
//
// The props React cannot express as attributes: arrays, objects and callbacks.
// They are what useTc exists for, and what the generated wrappers assign to the
// instance instead of stringifying. Collected from the class's public setters and
// public callback fields, minus anything already covered by an observed attribute.

// Types that need no import. Anything else that survives must resolve to an
// export of the component file or one of its internals, or the property falls
// back to `any` — a wrong import is worse than a loose type.
const BUILTIN_TYPES = new Set([
    'Array',
    'ReadonlyArray',
    'Record',
    'Partial',
    'Required',
    'Readonly',
    'Pick',
    'Omit',
    'Exclude',
    'Extract',
    'NonNullable',
    'ReturnType',
    'Parameters',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Promise',
    'Date',
    'RegExp',
    'Error',
    'Function',
    'Object',
    'String',
    'Number',
    'Boolean',
    'Symbol',
    'BigInt',
    'JSON',
    'Math',
    'Iterable',
    'Iterator',
    'ArrayLike',
    'ArrayBuffer',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int8Array',
    'Uint16Array',
    'Int16Array',
    'Uint32Array',
    'Int32Array',
    'Float32Array',
    'Float64Array',
    'DataView',
    'Blob',
    'File',
    'FormData',
    'URL',
    'URLSearchParams',
    'AbortSignal',
    'AbortController',
    'Node',
    'Element',
    'Document',
    'DocumentFragment',
    'ShadowRoot',
    'Text',
    'Event',
    'CustomEvent',
    'EventTarget',
    'KeyboardEvent',
    'MouseEvent',
    'PointerEvent',
    'TouchEvent',
    'WheelEvent',
    'FocusEvent',
    'InputEvent',
    'DragEvent',
    'ClipboardEvent',
    'AnimationEvent',
    'TransitionEvent',
    'SubmitEvent',
    'ElementInternals',
    'ValidityStateFlags',
    'DOMRect',
    'CSSStyleDeclaration',
    'IntersectionObserver',
    'MutationObserver',
    'ResizeObserver',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'HTMLSelectElement',
    'HTMLButtonElement',
    'HTMLAnchorElement',
    'HTMLImageElement',
    'HTMLCanvasElement',
    'HTMLVideoElement',
    'HTMLAudioElement',
    'HTMLFormElement',
    'HTMLDivElement',
    'HTMLTableElement',
    'HTMLOptionElement',
    'SVGElement',
    'ImageData',
    'CanvasRenderingContext2D',
])

/**
 * Turn a declared TypeScript type into an emittable descriptor. Every capitalised
 * identifier in the text must be a builtin or an export we can point at; if even
 * one is not, the whole thing degrades to `any` rather than emitting a name the
 * generated file cannot import.
 */
const resolveTypeExpression = (info, text) => {
    const clean = text.trim()
    if (!clean) return { kind: 'raw', text: 'any' }
    const refs = []
    const seen = new Set()
    for (const m of clean.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
        const name = m[1]
        if (BUILTIN_TYPES.has(name) || seen.has(name)) continue
        seen.add(name)
        const module = findExportedTypeModule(info, name)
        if (!module) return { kind: 'raw', text: 'any' }
        refs.push({ name, module })
    }
    if (refs.length === 0) return { kind: 'raw', text: clean }
    return { kind: 'expr', text: clean, refs }
}

/** All public setters declared at class-body top level (four-space indent). */
const publicSetters = (text) => {
    const out = []
    const re = /\n {4}set\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/g
    let m
    while ((m = re.exec(text)) !== null) {
        const name = m[1]
        let depth = 1
        let i = re.lastIndex
        for (; i < text.length && depth > 0; i++) {
            if (text[i] === '(') depth++
            else if (text[i] === ')') depth--
        }
        const params = text.slice(re.lastIndex, i - 1)
        const colon = params.indexOf(':')
        out.push({ name, type: colon === -1 ? '' : params.slice(colon + 1).trim() })
    }
    return out
}

/** Public callback FIELDS — `onChange: ((v: unknown) => void) | null = null` and
 *  friends. They are the second half of the 137-strong callback-field API. */
const publicFields = (text) => {
    const out = []
    // `\s=\s` and not `=` alone: an arrow in the type (`(v: string) => void`) has
    // no space between `=` and `>`, so this splits on the initialiser only.
    for (const m of text.matchAll(/\n {4}([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s=\s[^\n]*\n/g)) {
        out.push({ name: m[1], type: m[2].trim() })
    }
    return out
}

const jsPropsFor = (info, attrNames) => {
    // Case-insensitive: the attribute `inputmode` and the setter `inputMode` are
    // the same knob, and emitting both would put two spellings of one prop on the
    // wrapper's surface.
    const covered = new Set(
        attrNames.map((a) => a.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).toLowerCase()),
    )
    const texts = [info.body, ...info.internals.map((h) => h.text)]
    const found = new Map()
    for (const text of texts) {
        for (const entry of [...publicSetters(text), ...publicFields(text)]) {
            if (covered.has(entry.name.toLowerCase())) continue
            if (found.has(entry.name)) continue
            if (!entry.type) continue
            found.set(entry.name, resolveTypeExpression(info, entry.type))
        }
    }
    return [...found.entries()]
        .map(([name, type]) => ({ name, type }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Assemble ────────────────────────────────────────────────────────────────

/**
 * Every registered tc-* element, sorted by tag.
 *
 * Attribute and detail types are DESCRIPTORS, not rendered text:
 *   { kind: 'boolean' }                       presence-based attribute
 *   { kind: 'raw',   text: 'string | number' }  emit verbatim
 *   { kind: 'named', name, module }             import the type, then emit it
 *   { kind: 'expr',  text, refs: [{name, module}] }  emit text with refs aliased
 */
export function collectComponents() {
    return tagToClass
        .map(({ tag, cls }) => {
            const info = classInfo(cls)
            if (!info)
                return { tag, file: null, exportName: null, attrs: [], events: [], jsProps: [] }
            const boolAttrs = booleanAttrsFor(info)
            const triState = triStateAttrsFor(info)
            const attrs = attrsFor(info).map((name) => ({
                name,
                type: attrType(info, name, boolAttrs, triState),
            }))
            const events = eventsFor(info).map((name) => ({
                name,
                detail: detailFor(info, name),
            }))
            const jsProps = jsPropsFor(
                info,
                attrs.map((a) => a.name),
            )
            return { tag, file: info.file, exportName: info.exportName, attrs, events, jsProps }
        })
        .sort((a, b) => a.tag.localeCompare(b.tag))
}
