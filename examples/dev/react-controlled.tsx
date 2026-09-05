// Dev-only. Pass D of the React compatibility harness: the controlled-input contract.
//
// A React form is controlled: state is the source of truth and every render
// re-declares `value`. For a native <input> react-dom tracks the DOM value and
// re-asserts it; for a custom element it does NOT — so if the element drops or
// ignores an externally declared value, the field diverges from state and the app
// is broken in a way no amount of app code can fix.
//
// The contract checked here, on every element that has a value at all:
//   1. the value React declares at mount reaches the real control;
//   2. a value React declares on a LATER render reaches it too;
//   3. it still reaches it while the control has focus — masking, formatting and
//      "revert the edit" all update value mid-typing;
//   4. the same holds for a property write, which is how React 19 sends props to
//      an upgraded custom element.
import { createElement as h } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { TAGS } from './tags'

register()

/** Elements that model a value: they either watch the attribute or expose the setter. */
const valueTags = TAGS.filter((tag) => {
    const ctor = customElements.get(tag) as (CustomElementConstructor & { observedAttributes?: string[] }) | undefined
    if (!ctor) return false
    if ((ctor.observedAttributes ?? []).includes('value')) return true
    for (let p = ctor.prototype; p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
        const d = Object.getOwnPropertyDescriptor(p, 'value')
        if (d) return typeof d.set === 'function'
    }
    return false
})

/** The real control inside the element, if it has one. */
const controlOf = (el: Element): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null =>
    el.querySelector('input, textarea, select')

type Result = { tag: string; failures: string[]; errors: string[]; kind: string }

/** Three values this particular control can actually hold. "alpha" is a wrong
 *  answer for <input type=number>, so the probe values come from the control:
 *  a select is driven by its own options, a numeric field by its own range. */
const probeValues = (control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string[] | null => {
    if (control instanceof HTMLSelectElement) {
        const values = Array.from(control.options)
            .map((o) => o.value)
            .filter((v) => v !== '')
        const distinct = [...new Set(values)]
        return distinct.length >= 2 ? [distinct[1], distinct[0], distinct[distinct.length - 1]] : null
    }
    const type = (control as HTMLInputElement).type ?? 'text'
    if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') return null
    if (type === 'number' || type === 'range') {
        const el = control as HTMLInputElement
        const min = el.min === '' ? 0 : Number(el.min)
        const max = el.max === '' ? 100 : Number(el.max)
        const step = el.step === '' || el.step === 'any' ? (max - min) / 10 || 1 : Number(el.step)
        const at = (n: number) => String(min + step * n)
        return max >= min + step * 3 ? [at(1), at(2), at(3)] : null
    }
    if (type === 'date') return ['2024-01-15', '2024-02-20', '2024-03-25']
    if (type === 'month') return ['2024-01', '2024-02', '2024-03']
    if (type === 'week') return ['2024-W03', '2024-W04', '2024-W05']
    if (type === 'time') return ['10:30', '11:45', '13:15']
    if (type === 'datetime-local') return ['2024-01-15T10:30', '2024-02-20T11:45', '2024-03-25T13:15']
    if (type === 'color') return ['#112233', '#445566', '#778899']
    if (type === 'email') return ['a@example.com', 'b@example.com', 'c@example.com']
    if (type === 'url') return ['https://a.example', 'https://b.example', 'https://c.example']
    return ['alpha', 'bravo', 'charlie']
}

const run = (tag: string): Result => {
    const failures: string[] = []
    const errors: string[] = []
    let kind = 'n/a'
    const note = (where: string, e: unknown) => {
        const err = e as Error
        errors.push(`${where}: ${err?.name ?? 'Error'}: ${(err?.message ?? String(e)).slice(0, 140)}`)
    }
    const onError = (e: ErrorEvent) => note('window', e.error ?? e.message)
    window.addEventListener('error', onError)

    const wrapper = document.createElement('div')
    // On-screen, not off-screen: focus() is a no-op on a display-less subtree and
    // the focused re-render step depends on the control really taking focus.
    wrapper.style.cssText = 'position:fixed;left:0;top:0;width:600px;opacity:0;pointer-events:none;z-index:-1'
    document.body.appendChild(wrapper)
    const root: Root = createRoot(wrapper, {
        onUncaughtError: (e) => note('react-uncaught', e),
        onCaughtError: (e) => note('react-caught', e),
        onRecoverableError: (e) => note('react-recoverable', e),
    })
    const render = (props: Record<string, unknown>) => {
        try {
            flushSync(() => root.render(h(tag, { name: 'probe', ...props })))
        } catch (e) {
            note(`render(${JSON.stringify(props)})`, e)
        }
    }

    // First mount plain, so the control can be inspected before a value is declared.
    render({})
    const el = wrapper.firstElementChild as (HTMLElement & { value?: unknown }) | null
    const control = el ? controlOf(el) : null
    const values = control ? probeValues(control) : null

    if (el && control && values) {
        kind = control instanceof HTMLSelectElement ? 'select' : ((control as HTMLInputElement).type ?? 'text')
        const [a, b, c] = values
        render({ value: a })
        if (control.value !== a) failures.push(`mount: control shows ${JSON.stringify(control.value)}, not ${JSON.stringify(a)}`)
        render({ value: b })
        if (control.value !== b) failures.push(`re-render: control shows ${JSON.stringify(control.value)}, not ${JSON.stringify(b)}`)
        control.focus()
        const focused = el.contains(document.activeElement)
        render({ value: c })
        if (control.value !== c)
            failures.push(`re-render while focused${focused ? '' : ' (focus not taken)'}: control shows ${JSON.stringify(control.value)}, not ${JSON.stringify(c)}`)
        control.blur()
        try {
            ;(el as { value?: unknown }).value = a
        } catch (e) {
            note('value=', e)
        }
        if (control.value !== a) failures.push(`property write: control shows ${JSON.stringify(control.value)}, not ${JSON.stringify(a)}`)
        const got = (el as { value?: unknown }).value
        if (typeof got === 'string' && got !== control.value)
            failures.push(`getter disagrees with control: ${JSON.stringify(got)} vs ${JSON.stringify(control.value)}`)
    } else if (el && control && !values) {
        failures.push('untestable-control')
    } else if (el && !control) {
        failures.push('no-control')
    } else {
        failures.push('no-host')
    }

    try {
        flushSync(() => root.unmount())
    } catch (e) {
        note('unmount', e)
    }
    window.removeEventListener('error', onError)
    wrapper.remove()
    return { tag, failures, errors, kind }
}

const SKIP = new Set(['no-control', 'untestable-control'])
const failing = (r: Result) => (r.failures.length > 0 && !SKIP.has(r.failures[0])) || r.errors.length > 0

const out = document.getElementById('out')!
const results: Result[] = []
;(window as any).__controlled = { results, ready: false, tags: valueTags, failing }
let i = 0
const tick = () => {
    const started = performance.now()
    while (i < valueTags.length && performance.now() - started < 60) {
        try {
            results.push(run(valueTags[i]))
        } catch (e) {
            results.push({ tag: valueTags[i], failures: [`harness: ${String(e)}`], errors: [], kind: 'n/a' })
        }
        i++
    }
    const bad = results.filter(failing)
    out.textContent = `${i}/${valueTags.length} value elements — ${bad.length} failing`
    if (i < valueTags.length) setTimeout(tick, 0)
    else (window as any).__controlled.ready = true
}
setTimeout(tick, 0)
export {}
