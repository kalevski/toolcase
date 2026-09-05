// Dev-only React compatibility harness. Not part of the built site (Vite only
// bundles index.html); served by `vite` at /react-stress.html.
//
// Every tc-* element is mounted from React with a realistic child set — a stable
// child, a conditional one, and a keyed list — then put through the four DOM
// operations react-dom performs on a host it owns: attribute updates (which make
// the element re-render), inserting a child, removing a child, reordering a list,
// and finally unmount. An element that moves, wraps or deletes a node it did not
// create makes one of those throw, and that is the failure this records.
import { createElement as h, StrictMode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

type Phase = 0 | 1 | 2 | 3

// An element that relocates children usually relocates only the tags it cares
// about — tc-select hunts <option>, tc-advanced-table hunts <tr>, a nav hunts
// <li>. Generic spans walk straight past those, so every tag is tested with
// three different child vocabularies. Order within a kind is
// [stable, cond, a, b, tail].
const KINDS: Record<string, string[]> = {
    inline: ['span', 'em', 'i', 'i', 'span'],
    interactive: ['a', 'button', 'input', 'input', 'label'],
    structural: ['li', 'option', 'img', 'tr', 'p'],
}

// The nodes react-dom actually created, captured by ref. Identity is the only
// reliable handle: tc-marquee legitimately CLONES the consumer's children for its
// seamless second copy, and a probe matched by selector would count those clones
// as the originals turning up in the wrong parent.
const nodes: Record<string, Element | null> = {}

const children = (phase: Phase, kind: string) => {
    const t = KINDS[kind]
    const probe = (i: number, key: string, label: string) =>
        h(
            t[i],
            {
                key,
                className: `probe probe-${label}`,
                ref: (n: Element | null) => {
                    nodes[label] = n
                },
            },
            t[i] === 'input' || t[i] === 'img' ? null : label,
        )
    const list = phase === 2 ? ['b', 'a'] : ['a', 'b']
    return [
        probe(0, 'stable', 'stable'),
        phase >= 1 ? probe(1, 'cond', 'cond') : null,
        ...list.map((id) => probe(id === 'a' ? 2 : 3, id, id)),
        phase === 3 ? null : probe(4, 'tail', 'tail'),
    ]
}

const Case = ({ tag, phase, kind }: { tag: string; phase: Phase; kind: string }) =>
    h(tag, { 'data-phase': String(phase), className: 'stress-host' }, ...children(phase, kind))

/** Attributes the element itself watches, toggled so attributeChangedCallback
 *  fires — the moment a rule-2 violation destroys React's children. */
const ATTR_VALUES = ['1', '2', '', ' ', 'a b', '[object Object]', '-1', 'NaN', 'null', 'undefined', 'false']

const observedOf = (tag: string): string[] => {
    const ctor = customElements.get(tag) as (CustomElementConstructor & { observedAttributes?: string[] }) | undefined
    return (ctor?.observedAttributes ?? []).filter((a) => a !== 'class' && a !== 'style')
}


type Result = {
    tag: string
    kind: string
    errors: string[]
    /** phase -> consumer nodes that left the host element's subtree entirely */
    escaped: Record<string, string[]>
    /** phase -> consumer nodes that vanished from the document entirely */
    lost: Record<string, string[]>
    /** phase -> the consumer's child order as it actually sits in the DOM */
    order: Record<string, string>
}

const EXPECTED: Record<Phase, string> = {
    0: 'stable,a,b,tail',
    1: 'stable,cond,a,b,tail',
    2: 'stable,cond,b,a,tail',
    3: 'stable,cond,a,b',
}

const run = (tag: string, kind: string): Result => {
    const errors: string[] = []
    const escaped: Record<string, string[]> = {}
    const lost: Record<string, string[]> = {}
    const order: Record<string, string> = {}
    const host = document.createElement('div')
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px'
    document.body.appendChild(host)

    const note = (where: string, e: unknown) => {
        const err = e as Error
        errors.push(`${where}: ${err?.name ?? 'Error'}: ${(err?.message ?? String(e)).slice(0, 200)}`)
    }
    const onError = (e: ErrorEvent) => note('window', e.error ?? e.message)
    window.addEventListener('error', onError)

    for (const key of Object.keys(nodes)) delete nodes[key]
    const root: Root = createRoot(host, {
        onUncaughtError: (e) => note('react-uncaught', e),
        onCaughtError: (e) => note('react-caught', e),
        onRecoverableError: (e) => note('react-recoverable', e),
    })

    const step = (where: string, fn: () => void) => {
        try {
            flushSync(fn)
        } catch (e) {
            note(where, e)
        }
    }

    /** What the consumer's nodes look like now, from the host element's angle. */
    const inspect = (phase: Phase, label: string) => {
        const el = host.firstElementChild
        if (!el) {
            lost[label] = ['<host missing>']
            return
        }
        const live = Object.entries(nodes).filter(([, n]) => n && n.isConnected)
        // Not "is it still a direct child": an element whose chrome has to CONTAIN
        // the consumer's children moves them one level down on purpose and keeps
        // answering for them (see internal/adopt-children.ts), which react-dom
        // cannot tell from them never having moved. Leaving the host's subtree
        // altogether is the violation — that is a node the element lost.
        const off = live.filter(([, n]) => !el.contains(n!)).map(([k]) => k)
        if (off.length) escaped[label] = off
        const expected = EXPECTED[phase].split(',')
        const missing = expected.filter((k) => !live.some(([name]) => name === k))
        if (missing.length) lost[label] = missing
        // Document order of the nodes React created, which is what a consumer sees.
        const seen = live
            .sort(([, a], [, b]) =>
                a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
            )
            .map(([k]) => k)
            .join(',')
        if (seen !== EXPECTED[phase]) order[label] = seen
    }

    step('mount', () => root.render(h(Case, { tag, phase: 0, kind })))
    inspect(0, 'mount')

    // The element re-renders itself: every attribute it watches is given, in turn,
    // each value React can end up writing there. React stringifies whatever the
    // author passed, so an object prop arrives as '[object Object]' and a number
    // as '-1' — both of which have broken a component in this library before.
    const el = host.firstElementChild
    if (el) {
        for (const attr of observedOf(tag)) {
            for (const value of ATTR_VALUES) {
                try {
                    el.setAttribute(attr, value)
                } catch (e) {
                    note(`setAttribute(${attr}=${JSON.stringify(value)})`, e)
                }
                inspect(0, `attr:${attr}=${JSON.stringify(value)}`)
            }
            el.removeAttribute(attr)
        }
        inspect(0, 'self-render')
    }

    step('insert-child', () => root.render(h(Case, { tag, phase: 1, kind })))
    inspect(1, 'insert-child')
    step('reorder-list', () => root.render(h(Case, { tag, phase: 2, kind })))
    inspect(2, 'reorder-list')
    step('remove-child', () => root.render(h(Case, { tag, phase: 3, kind })))
    inspect(3, 'remove-child')

    step('unmount', () => root.unmount())
    window.removeEventListener('error', onError)
    host.remove()
    return { tag, kind, errors, escaped, lost, order }
}

const failing = (r: Result) =>
    r.errors.length ||
    Object.keys(r.escaped).length ||
    Object.keys(r.lost).length ||
    Object.keys(r.order).length

const out = document.getElementById('out')!
const results: Result[] = []
;(window as any).__stress = { results, ready: false }

const KIND_NAMES = Object.keys(KINDS)
const CASES: [string, string][] = TAGS.flatMap((t) => KIND_NAMES.map((k) => [t, k] as [string, string]))
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < CASES.length && performance.now() - started < 60) {
        const [tag, kind] = CASES[i]
        try {
            results.push(run(tag, kind))
        } catch (e) {
            results.push({ tag, kind, errors: [`harness: ${String(e)}`], escaped: {}, lost: {}, order: {} })
        }
        i++
    }
    const bad = results.filter(failing)
    out.textContent = `${i}/${CASES.length} tested — ${bad.length} failing`
    if (i < CASES.length) setTimeout(tick, 0)
    else {
        ;(window as any).__stress.ready = true
        out.textContent = `done: ${i} cases, ${bad.length} failing`
    }
}
setTimeout(tick, 0)
export {}
