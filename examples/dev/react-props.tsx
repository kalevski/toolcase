// Dev-only. Pass B of the React compatibility harness: property coercion (rule 4).
//
// React 19 writes a custom element's props as PROPERTIES whenever the element has
// a matching setter, so the setters — not the attributes — are the surface a React
// author actually hits. This writes every value React can hand a prop (numbers,
// booleans, '', null, undefined, the string 'false', arrays, objects, NaN) into
// every setter of every tc-* element and records which ones throw, and whether the
// consumer's children survived the write.
import { createElement as h } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

const VALUES: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['false', false],
    ['true', true],
    ['0', 0],
    ['1', 1],
    ['-1', -1],
    ["''", ''],
    ["'false'", 'false'],
    ["'abc'", 'abc'],
    ['NaN', NaN],
    ['[]', []],
    ['{}', {}],
    ["'a b'", 'a b'],
    ["'  '", '  '],
    ["'[object Object]'", '[object Object]'],
]

/** Setters the element itself declares — everything down to HTMLElement is the
 *  platform's and not ours to fuzz. */
const settersOf = (el: Element): string[] => {
    const names = new Set<string>()
    for (let p = Object.getPrototypeOf(el); p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
        for (const [name, d] of Object.entries(Object.getOwnPropertyDescriptors(p))) {
            if (typeof d.set === 'function') names.add(name)
        }
    }
    return [...names]
}

type Result = { tag: string; throws: string[]; damaged: string[]; reactErrors: string[] }

const run = (tag: string): Result => {
    const throws: string[] = []
    const damaged: string[] = []
    const reactErrors: string[] = []
    const host = document.createElement('div')
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px'
    document.body.appendChild(host)

    const note = (e: unknown, where: string) => {
        const err = e as Error
        reactErrors.push(`${where}: ${err?.name ?? 'Error'}: ${(err?.message ?? String(e)).slice(0, 160)}`)
    }
    const onError = (e: ErrorEvent) => note(e.error ?? e.message, 'window')
    window.addEventListener('error', onError)
    const root: Root = createRoot(host, {
        onUncaughtError: (e) => note(e, 'react-uncaught'),
        onCaughtError: (e) => note(e, 'react-caught'),
        onRecoverableError: (e) => note(e, 'react-recoverable'),
    })
    const probe = () => h(tag, {}, h('span', { key: 's', className: 'probe' }, 'child'))
    try {
        flushSync(() => root.render(probe()))
    } catch (e) {
        note(e, 'mount')
    }
    const el = host.firstElementChild as any
    if (el) {
        for (const name of settersOf(el)) {
            for (const [label, value] of VALUES) {
                try {
                    el[name] = value
                } catch (e) {
                    throws.push(`${name} = ${label} -> ${(e as Error)?.name}: ${((e as Error)?.message ?? '').slice(0, 120)}`)
                }
                if (!el.querySelector('.probe')) {
                    damaged.push(`${name} = ${label}`)
                    // restore so the rest of the sweep still has a probe to lose
                    const span = document.createElement('span')
                    span.className = 'probe'
                    el.appendChild(span)
                }
            }
        }
    }
    try {
        flushSync(() => root.unmount())
    } catch (e) {
        note(e, 'unmount')
    }
    window.removeEventListener('error', onError)
    host.remove()
    return { tag, throws, damaged, reactErrors }
}

const out = document.getElementById('out')!
const results: Result[] = []
;(window as any).__props = { results, ready: false }
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < TAGS.length && performance.now() - started < 60) {
        try {
            results.push(run(TAGS[i]))
        } catch (e) {
            results.push({ tag: TAGS[i], throws: [`harness: ${String(e)}`], damaged: [], reactErrors: [] })
        }
        i++
    }
    const bad = results.filter((r) => r.throws.length || r.damaged.length || r.reactErrors.length)
    out.textContent = `${i}/${TAGS.length} tested — ${bad.length} failing`
    if (i < TAGS.length) setTimeout(tick, 0)
    else (window as any).__props.ready = true
}
setTimeout(tick, 0)
export {}
