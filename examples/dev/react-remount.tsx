// Dev-only. Pass C of the React compatibility harness: remount survival.
//
// React detaches and re-attaches subtrees all the time — StrictMode double-mounts
// in development, a changed `key` recreates a subtree, a route change or a portal
// move disconnects and reconnects the same element. For a light-DOM custom element
// that means connectedCallback runs again on a host whose markup is already there.
// An element that appends unconditionally DUPLICATES its markup; one that tears
// down on disconnect without rebuilding LOSES it; one that binds listeners only
// behind a first-run guard comes back dead.
//
// This mounts each tc-* element from React, then puts it through three
// disconnect/reconnect cycles, comparing its own markup each time.
import { createElement as h, StrictMode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

type Result = {
    tag: string
    /** cycle -> the element's own child count, when it changed across a remount */
    childCounts: number[]
    /** cycle -> markup length, to catch a rebuild that is a different shape */
    markupLengths: number[]
    /** the consumer's probe went missing on this cycle */
    probeLost: number[]
    /** the element stopped reacting to its own attributes after a remount */
    inert: boolean
    errors: string[]
}

const CYCLES = 3

const run = (tag: string, strict: boolean): Result & { strict: boolean } => {
    const errors: string[] = []
    const note = (where: string, e: unknown) => {
        const err = e as Error
        errors.push(`${where}: ${err?.name ?? 'Error'}: ${(err?.message ?? String(e)).slice(0, 160)}`)
    }
    const onError = (e: ErrorEvent) => note('window', e.error ?? e.message)
    window.addEventListener('error', onError)

    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px'
    document.body.appendChild(wrapper)
    const root: Root = createRoot(wrapper, {
        onUncaughtError: (e) => note('react-uncaught', e),
        onCaughtError: (e) => note('react-caught', e),
        onRecoverableError: (e) => note('react-recoverable', e),
    })
    const tree = h(tag, { className: 'stress-host' }, h('span', { key: 'p', className: 'probe' }, 'child'))
    try {
        flushSync(() => root.render(strict ? h(StrictMode, null, tree) : tree))
    } catch (e) {
        note('mount', e)
    }

    const el = wrapper.firstElementChild as HTMLElement | null
    const childCounts: number[] = []
    const markupLengths: number[] = []
    const probeLost: number[] = []
    let inert = false

    if (el) {
        const measure = () => {
            childCounts.push(el.children.length)
            markupLengths.push(el.innerHTML.length)
        }
        measure()
        for (let c = 0; c < CYCLES; c++) {
            try {
                // The exact pair of operations react-dom performs when it moves a
                // subtree: remove the host from the document, then put it back.
                wrapper.remove()
                document.body.appendChild(wrapper)
            } catch (e) {
                note(`remount#${c}`, e)
            }
            measure()
            if (!el.querySelector('.probe')) probeLost.push(c)
        }
        // Still alive? An element whose listeners were dropped on disconnect and
        // never re-bound reacts to nothing, so drive it through its own attributes.
        const ctor = customElements.get(tag) as (CustomElementConstructor & { observedAttributes?: string[] }) | undefined
        const observed = (ctor?.observedAttributes ?? []).filter((a) => a !== 'class' && a !== 'style')
        if (observed.length) {
            const before = el.innerHTML
            for (const attr of observed) {
                try {
                    el.setAttribute(attr, 'x1')
                } catch (e) {
                    note(`setAttribute(${attr})`, e)
                }
            }
            // Nothing at all changed for any watched attribute: the element is not
            // re-rendering. (Elements whose attributes are pure CSS hooks are
            // filtered out later by comparing against a fresh instance.)
            inert = el.innerHTML === before
        }
    } else {
        note('mount', 'host element missing')
    }

    try {
        flushSync(() => root.unmount())
    } catch (e) {
        note('unmount', e)
    }
    window.removeEventListener('error', onError)
    wrapper.remove()
    return { tag, strict, childCounts, markupLengths, probeLost, inert, errors }
}

const failing = (r: Result) => {
    const counts = new Set(r.childCounts)
    const lens = new Set(r.markupLengths)
    return counts.size > 1 || lens.size > 1 || r.probeLost.length > 0 || r.errors.length > 0
}

const out = document.getElementById('out')!
const results: (Result & { strict: boolean })[] = []
;(window as any).__remount = { results, ready: false, failing }
const CASES: [string, boolean][] = TAGS.flatMap((t) => [[t, false] as [string, boolean], [t, true] as [string, boolean]])
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < CASES.length && performance.now() - started < 60) {
        const [tag, strict] = CASES[i]
        try {
            results.push(run(tag, strict))
        } catch (e) {
            results.push({ tag, strict, childCounts: [], markupLengths: [], probeLost: [], inert: false, errors: [`harness: ${String(e)}`] })
        }
        i++
    }
    out.textContent = `${i}/${CASES.length} tested — ${results.filter(failing).length} failing`
    if (i < CASES.length) setTimeout(tick, 0)
    else {
        ;(window as any).__remount.ready = true
        out.textContent = `done: ${i} cases, ${results.filter(failing).length} failing`
    }
}
setTimeout(tick, 0)
export {}
