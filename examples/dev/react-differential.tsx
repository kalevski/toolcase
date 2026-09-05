// Dev-only. Pass F of the React compatibility harness: does the consumer's
// presence change the element's own markup?
//
// An element's own chrome is its business and should not depend on whether the
// consumer put anything inside it. When it does, the light-DOM reconciler has
// mis-aligned: it walked over the consumer's node, found a node IT had created a
// moment earlier, decided the two were the same node re-dressed, and dropped one
// of its own. That is invisible in a demo (the markup is merely missing) and
// invisible to a mount/unmount test (it is missing consistently), so it needs its
// own differential: render each element empty, render it with one child, and
// compare the chrome.
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

const PROBE = '<span class="tc-probe">child</span>'

/** The element's own markup, with the consumer's probe taken back out. */
const chrome = (host: HTMLElement): string => {
    const clone = host.cloneNode(true) as HTMLElement
    for (const probe of Array.from(clone.querySelectorAll('.tc-probe'))) probe.remove()
    return clone.innerHTML
}

type Result = { tag: string; empty: string; withChild: string }

const stage = document.createElement('div')
stage.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:600px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden'
document.body.appendChild(stage)

const render = (tag: string, inner: string): HTMLElement => {
    const box = document.createElement('div')
    box.innerHTML = `<${tag}>${inner}</${tag}>`
    stage.appendChild(box)
    return box.firstElementChild as HTMLElement
}

const run = (tag: string): Result => {
    const a = render(tag, '')
    const b = render(tag, PROBE)
    const result = { tag, empty: a.innerHTML, withChild: chrome(b) }
    a.parentElement?.remove()
    b.parentElement?.remove()
    return result
}

const out = document.getElementById('out')!
const results: Result[] = []
;(window as any).__diff = { results, ready: false }
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < TAGS.length && performance.now() - started < 60) {
        try {
            results.push(run(TAGS[i]))
        } catch (e) {
            results.push({ tag: TAGS[i], empty: `harness: ${String(e)}`, withChild: '' })
        }
        i++
    }
    const bad = results.filter((r) => r.empty !== r.withChild)
    out.textContent = `${i}/${TAGS.length} — ${bad.length} differ`
    if (i < TAGS.length) setTimeout(tick, 0)
    else (window as any).__diff.ready = true
}
setTimeout(tick, 0)
export {}
