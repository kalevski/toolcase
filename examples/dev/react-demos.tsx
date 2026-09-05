// Dev-only. Pass E of the React compatibility harness: the real demos.
//
// Passes A-D drive synthetic props. This one mounts the actual demo components
// from examples/src/web-components — real prop values, real children, real refs
// and effects — then does what a router does: mount, re-render, unmount, and
// mount again. Anything react-dom throws on the way out is a route that would
// render blank in a real app.
import { createElement as h, StrictMode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import '@toolcase/web-components/react'
import { webComponentExamples } from '../src/web-components/index'

register()

type Result = { key: string; errors: string[] }

const run = (key: string, element: any): Result => {
    const errors: string[] = []
    const note = (where: string, e: unknown) => {
        const err = e as Error
        const msg = `${where}: ${err?.name ?? 'Error'}: ${(err?.message ?? String(e)).slice(0, 200)}`
        if (!errors.includes(msg)) errors.push(msg)
    }
    const onError = (e: ErrorEvent) => note('window', e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => note('unhandled-rejection', e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:800px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden'
    document.body.appendChild(wrapper)
    const root: Root = createRoot(wrapper, {
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
    // StrictMode is what a real dev-mode React app runs: mount, unmount, remount.
    step('mount', () => root.render(h(StrictMode, null, element)))
    step('re-render', () => root.render(h(StrictMode, null, element)))
    step('unmount', () => root.unmount())

    // Mount a second time into a fresh root — a route revisit.
    const root2: Root = createRoot(wrapper, {
        onUncaughtError: (e) => note('remount-uncaught', e),
        onCaughtError: (e) => note('remount-caught', e),
        onRecoverableError: (e) => note('remount-recoverable', e),
    })
    step('remount', () => root2.render(h(StrictMode, null, element)))
    step('remount-unmount', () => root2.unmount())

    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    wrapper.remove()
    return { key, errors }
}

const out = document.getElementById('out')!
const results: Result[] = []
;(window as any).__demos = { results, ready: false, total: webComponentExamples.length }
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < webComponentExamples.length && performance.now() - started < 60) {
        const demo = webComponentExamples[i]
        try {
            results.push(run(demo.key, demo.element))
        } catch (e) {
            results.push({ key: demo.key, errors: [`harness: ${String(e)}`] })
        }
        i++
    }
    const bad = results.filter((r) => r.errors.length)
    out.textContent = `${i}/${webComponentExamples.length} demos — ${bad.length} failing`
    if (i < webComponentExamples.length) setTimeout(tick, 0)
    else (window as any).__demos.ready = true
}
setTimeout(tick, 0)
export {}
