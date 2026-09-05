// Dev-only. Pass H of the React compatibility harness: derived state going stale.
//
// Several tc-* elements read the CONSUMER'S content and copy something out of it
// into their own markup — a button takes its `aria-label` from its label text, a
// select builds its `<option>` list from `<tc-option>` children, a nav marks the
// active item. That copy is made during a render, and a render only happens when
// one of the element's own ATTRIBUTES changes.
//
// React changes children without touching attributes. `<tc-button>{label}</…>`
// with a new label rewrites the text node and nothing else, so the element never
// re-derives: the button keeps announcing the previous label to a screen reader,
// and the select keeps offering options that are no longer in the data.
//
// The test needs no per-element knowledge. Render with one word, re-render with
// another, and look for the FIRST word still sitting in markup the element made:
// anything found there is a copy that did not keep up.
import { createElement as h } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

const BEFORE = 'ZALPHAZ'
const AFTER = 'ZBRAVOZ'

/** The element's own markup: the consumer's nodes lifted back out, so their text
 *  is not mistaken for a copy the element made. */
const chromeOf = (host: Element): string => {
    const clone = host.cloneNode(true) as Element
    for (const probe of Array.from(clone.querySelectorAll('[data-probe]'))) probe.remove()
    return clone.innerHTML
}

/** Two child shapes, because elements derive from different things: plain label
 *  text, and the option/item elements a list-like element reads. */
const SHAPES: Record<string, (word: string) => unknown> = {
    text: (word) => h('span', { key: 'p', 'data-probe': '' }, word),
    // `value` is deliberately constant: an element that re-derives only when a
    // child's ATTRIBUTE changes looks correct until the attribute stops moving,
    // and the label alone is exactly the case that used to go stale.
    option: (word) => h('tc-option', { key: 'p', 'data-probe': '', value: 'v1' }, word),
}

type Result = { tag: string; shape: string; stale: string; errors: string[] }

// The element's re-derivation is coalesced to a microtask — react-dom applies a
// render as a burst of operations and re-deriving after each one would be waste —
// so the second reading has to happen after that has had a turn to run.
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const run = async (tag: string, shape: string): Promise<Result> => {
    const errors: string[] = []
    const note = (where: string, e: unknown) =>
        errors.push(`${where}: ${String((e as Error)?.message ?? e).slice(0, 140)}`)

    const box = document.createElement('div')
    box.style.cssText =
        'position:fixed;left:0;top:0;width:1000px;opacity:0;pointer-events:none;z-index:-1'
    document.body.appendChild(box)
    const root: Root = createRoot(box, {
        onUncaughtError: (e) => note('uncaught', e),
        onCaughtError: (e) => note('caught', e),
    })
    const child = SHAPES[shape]
    let stale = ''
    try {
        flushSync(() => root.render(h(tag, {}, child(BEFORE))))
        const el = box.firstElementChild
        if (el) {
            const before = chromeOf(el)
            // Only elements that actually copied the word are interesting; the rest
            // have nothing that could go stale.
            if (before.includes(BEFORE)) {
                flushSync(() => root.render(h(tag, {}, child(AFTER))))
                await settle()
                const after = chromeOf(box.firstElementChild ?? el)
                if (after.includes(BEFORE)) {
                    // Report where, so the fix is obvious from the output.
                    const at = after.indexOf(BEFORE)
                    stale = after.slice(Math.max(0, at - 70), at + BEFORE.length + 10)
                }
            }
        }
        flushSync(() => root.unmount())
    } catch (e) {
        note('render', e)
    }
    box.remove()
    return { tag, shape, stale, errors }
}

const CASES: [string, string][] = TAGS.flatMap((t) =>
    Object.keys(SHAPES).map((s) => [t, s] as [string, string]),
)
const out = document.getElementById('out')!
const results: Result[] = []
const failing = (r: Result) => !!r.stale || r.errors.length > 0
;(window as any).__derived = { results, ready: false, failing }
const main = async (): Promise<void> => {
    for (const [tag, shape] of CASES) {
        try {
            results.push(await run(tag, shape))
        } catch (e) {
            results.push({ tag, shape, stale: '', errors: [`harness: ${String(e)}`] })
        }
        if (results.length % 40 === 0)
            out.textContent = `${results.length}/${CASES.length} — ${results.filter(failing).length} stale`
    }
    const bad = results.filter(failing)
    ;(window as any).__derived.ready = true
    out.textContent =
        `done: ${results.length} cases, ${bad.length} stale\n\n` +
        bad.map((r) => `${r.tag} [${r.shape}] ${r.errors[0] ?? r.stale}`).join('\n')
}
main()
export {}
