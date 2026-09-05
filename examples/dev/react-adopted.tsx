// Dev-only. Pass G of the React compatibility harness: the adopting elements.
//
// A handful of tc-* elements have chrome that must CONTAIN the consumer's
// children — a dropdown menu, an accordion body, a carousel slide, a <tbody> —
// so they move those children one level down and answer for them afterwards
// (web-components/src/internal/adopt-children.ts).
//
// Passes A-F prove react-dom never throws around that. They do NOT prove the
// element still WORKS: a menu item that landed outside the menu is invisible, a
// slide that was never numbered never shows, a collapse whose body moved does
// not animate. This drives each adopting element the way a user does — open the
// menu, toggle the panel, advance the carousel — and re-checks it after React
// has inserted, reordered and removed children underneath it.
import { createElement as h, StrictMode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'

register()

type Check = { name: string; pass: boolean; detail?: string }

// A macrotask, not requestAnimationFrame: rAF is throttled to nothing in a
// background or collapsed window and the harness would simply never continue.
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

class Case {
    readonly checks: Check[] = []
    constructor(readonly name: string) {}

    ok(name: string, pass: boolean, detail?: string): void {
        this.checks.push({ name, pass, detail: pass ? undefined : detail })
    }

    /** Every consumer probe sits inside `selector`, and none was left behind. */
    inside(host: Element, selector: string, expected: number, label = selector): void {
        const box = host.querySelector(selector)
        const probes = Array.from(host.querySelectorAll('.probe'))
        const within = box ? probes.filter((p) => box.contains(p)) : []
        this.ok(
            `children in ${label}`,
            !!box && probes.length === expected && within.length === expected,
            `box=${!!box} probes=${probes.length} inside=${within.length} expected=${expected}`,
        )
    }
}

/** Consumer children, keyed so React reorders rather than re-creates them. */
const probes = (ids: string[], tag = 'span', extra: Record<string, unknown> = {}) =>
    ids.map((id) => h(tag, { key: id, className: 'probe', 'data-id': id, ...extra }, id))

type Mount = (children: unknown, props?: Record<string, unknown>) => Element
type Scenario = (c: Case, mount: Mount) => void | Promise<void>

const scenarios: Record<string, Scenario> = {
    // ── one shared container ────────────────────────────────────────────────
    'tc-dropdown': async (c, mount) => {
        const el = mount(probes(['a', 'b', 'c'])) as HTMLElement & {
            show(): void
            hide(): void
        }
        c.inside(el, '.dropdown-menu', 3)
        c.ok('toggle rendered', !!el.querySelector('[data-bs-toggle="dropdown"]'))
        el.show()
        await settle()
        c.ok('show() opens the menu', !!el.querySelector('.dropdown-menu.show'))
        el.hide()
        await settle()
        c.ok('hide() closes the menu', !el.querySelector('.dropdown-menu.show'))
    },

    'tc-accordion-item': async (c, mount) => {
        const el = mount(probes(['a', 'b'])) as HTMLElement
        c.inside(el, '.accordion-body', 2)
        const button = el.querySelector<HTMLButtonElement>('.accordion-button')
        c.ok('header button rendered', !!button)
        el.setAttribute('open', '')
        await settle()
        c.ok('open shows the collapse', !!el.querySelector('.accordion-collapse.show'))
        // The body has to be inside the region that collapses, or nothing animates.
        const collapse = el.querySelector('.accordion-collapse')
        const body = el.querySelector('.accordion-body')
        c.ok('body nested in the collapse', !!collapse && !!body && collapse.contains(body))
        el.removeAttribute('open')
        await settle()
        c.ok('close hides the collapse', !el.querySelector('.accordion-collapse.show'))
        c.inside(el, '.accordion-body', 2)
    },

    'tc-navbar': async (c, mount) => {
        const el = mount(probes(['a', 'b'])) as HTMLElement
        c.inside(el, '.navbar-collapse', 2)
        c.ok('toggler rendered', !!el.querySelector('.navbar-toggler'))
        el.setAttribute('brand', 'Renamed')
        await settle()
        // A re-render must not strand the nav content outside the collapse.
        c.inside(el, '.navbar-collapse', 2, '.navbar-collapse after re-render')
        c.ok(
            'brand applied',
            el.querySelector('.navbar-brand')?.textContent?.includes('Renamed') === true,
        )
    },

    'tc-context-menu': async (c, mount) => {
        const el = mount(probes(['a'])) as HTMLElement
        c.inside(el, '.tc-context-menu-trigger', 1)
    },

    // ── many containers, routed by slot ─────────────────────────────────────
    'tc-dashboard-layout': async (c, mount) => {
        const el = mount([
            h('span', { key: 'b', className: 'probe', slot: 'brand' }, 'brand'),
            h('span', { key: 'l', className: 'probe', slot: 'navbar-left' }, 'left'),
            h('span', { key: 'm', className: 'probe', slot: 'sidebar-menu' }, 'menu'),
            h('span', { key: 'c', className: 'probe' }, 'content'),
        ]) as HTMLElement
        const at = (region: string, id: string) =>
            el.querySelector(`.tc-dashboard-layout__${region}`)?.querySelector(`.probe`)
                ?.textContent === id
        c.ok('brand routed', at('brand', 'brand'))
        c.ok('navbar-left routed', at('navbar-left', 'left'))
        c.ok('sidebar-menu routed', at('sidebar-menu', 'menu'))
        c.ok('unslotted routed to content', at('content', 'content'))
    },

    // ── one container per child ─────────────────────────────────────────────
    'tc-carousel': async (c, mount) => {
        // Indicators and controls are opt-in, and both are what a mis-aligned
        // region walk used to break — so this case runs with them on.
        // `true`, not `''`: the library's documented boolean coercion (`bool()` in
        // internal/tc-element.ts) reads an empty string as OFF, so `indicators=""`
        // from JSX genuinely disables it.
        const el = mount(probes(['a', 'b', 'c']), {
            indicators: true,
            controls: true,
        }) as HTMLElement & { next(): void }
        await settle()
        const slides = () => Array.from(el.querySelectorAll('.carousel-item'))
        const numbering = () =>
            slides()
                .map((s) => s.getAttribute('data-tc-slide'))
                .join(',')
        c.ok('one slide per child', slides().length === 3, `slides=${slides().length}`)
        c.ok('slides numbered in order', numbering() === '0,1,2', numbering())
        c.ok(
            'each slide holds exactly one child',
            slides().every((s) => s.querySelectorAll('.probe').length === 1),
        )
        c.ok(
            'exactly one slide active',
            el.querySelectorAll('.carousel-item.active').length === 1,
            String(el.querySelectorAll('.carousel-item.active').length),
        )
        c.ok(
            'indicators match slide count',
            el.querySelectorAll('.carousel-indicators button').length === 3,
            String(el.querySelectorAll('.carousel-indicators button').length),
        )
        c.ok('track is a direct child', !!el.querySelector(':scope > .carousel-inner'))
        c.ok(
            'slides live in the track',
            slides().every((s) => s.parentElement?.classList.contains('carousel-inner')),
        )
        el.next()
        await settle()
        c.ok(
            'next() moves the active slide',
            el.querySelectorAll('.carousel-item.active').length === 1,
        )
        // Toggling the optional regions must leave the track and its slides alone.
        el.removeAttribute('indicators')
        el.setAttribute('indicators', '')
        await settle()
        c.ok(
            'slides survive an indicators toggle',
            slides().length === 3,
            `slides=${slides().length}`,
        )
        c.ok(
            'indicators rebuilt to match',
            el.querySelectorAll('.carousel-indicators button').length === 3,
            String(el.querySelectorAll('.carousel-indicators button').length),
        )
    },

    'tc-advanced-table': async (c, mount) => {
        const el = mount(
            ['a', 'b'].map((id) =>
                h('tr', { key: id, className: 'probe', 'data-id': id }, h('td', null, id)),
            ),
        ) as HTMLElement & { rows: string | null }
        c.inside(el, '.tc-advanced-table-body', 2, 'tbody')
        c.ok(
            'rows are real table rows',
            Array.from(el.querySelectorAll('.probe')).every((p) => p.tagName === 'TR'),
        )
        // The `rows` prop reconciles as its own region — the consumer's own rows
        // written as children must survive it.
        el.rows = '<tr class="from-prop"><td>x</td></tr>'
        await settle()
        c.ok('rows prop rendered', !!el.querySelector('tr.from-prop'))
        c.inside(el, '.tc-advanced-table-body', 2, 'tbody after rows prop')
    },
}

/** Mount, then put the element through the child churn a real app produces. */
const churn = async (
    c: Case,
    tag: string,
    mountInto: HTMLElement,
    childTag: string,
): Promise<void> => {
    const root = createRoot(mountInto, {
        onUncaughtError: (e) =>
            c.ok('react error', false, String((e as Error)?.message).slice(0, 120)),
        onCaughtError: (e) =>
            c.ok('react error', false, String((e as Error)?.message).slice(0, 120)),
    })
    const render = (ids: string[]) =>
        flushSync(() =>
            root.render(
                h(StrictMode, null, h(tag, { className: 'churn' }, ...probes(ids, childTag))),
            ),
        )
    try {
        render(['a', 'b', 'c'])
        const el = mountInto.firstElementChild as HTMLElement
        const ids = () =>
            Array.from(el.querySelectorAll('.probe'))
                .map((p) => p.getAttribute('data-id'))
                .join(',')
        render(['a', 'x', 'b', 'c'])
        c.ok('insert in the middle keeps order', ids() === 'a,x,b,c', ids())
        render(['c', 'a', 'x', 'b'])
        c.ok('reorder keeps order', ids() === 'c,a,x,b', ids())
        render(['c', 'b'])
        c.ok('remove keeps order', ids() === 'c,b', ids())
        await settle()
        c.ok('survivors still in the element', el.querySelectorAll('.probe').length === 2)
        flushSync(() => root.unmount())
        c.ok('unmount is clean', true)
    } catch (e) {
        c.ok('churn threw', false, String((e as Error)?.message ?? e).slice(0, 160))
    }
}

const CHILD_TAG: Record<string, string> = { 'tc-advanced-table': 'tr' }

const stage = document.getElementById('stage')!
const out = document.getElementById('out')!

const only = new URLSearchParams(location.search).get('only')

const run = async (): Promise<Case[]> => {
    const cases: Case[] = []
    for (const [tag, scenario] of Object.entries(scenarios)) {
        if (only && !only.split(',').includes(tag)) continue
        const c = new Case(tag)
        cases.push(c)
        const box = document.createElement('div')
        box.style.cssText =
            'position:fixed;left:0;top:0;width:1200px;height:700px;opacity:0;pointer-events:none;z-index:-1'
        stage.appendChild(box)
        const errors: string[] = []
        const onError = (e: ErrorEvent) =>
            errors.push(String(e.error?.message ?? e.message).slice(0, 140))
        window.addEventListener('error', onError)
        try {
            const root: Root = createRoot(box, {
                onUncaughtError: (e) =>
                    errors.push(`uncaught: ${String((e as Error)?.message).slice(0, 140)}`),
                onCaughtError: (e) =>
                    errors.push(`caught: ${String((e as Error)?.message).slice(0, 140)}`),
            })
            const mount: Mount = (children, props) => {
                flushSync(() =>
                    root.render(h(tag, { className: 'adopted', ...props }, children as never)),
                )
                return box.firstElementChild!
            }
            await scenario(c, mount)
            flushSync(() => root.unmount())
        } catch (e) {
            c.ok('scenario threw', false, String((e as Error)?.message ?? e).slice(0, 160))
        }
        // Same element, now under React child churn.
        const churnBox = document.createElement('div')
        churnBox.style.cssText = box.style.cssText
        stage.appendChild(churnBox)
        await churn(c, tag, churnBox, CHILD_TAG[tag] ?? 'span')
        window.removeEventListener('error', onError)
        for (const message of errors) c.ok('window error', false, message)
        box.remove()
        churnBox.remove()
    }
    return cases
}

run().then((cases) => {
    const failed = cases.flatMap((c) =>
        c.checks.filter((k) => !k.pass).map((k) => `${c.name} — ${k.name}: ${k.detail ?? ''}`),
    )
    const total = cases.reduce((n, c) => n + c.checks.length, 0)
    ;(window as any).__adopted = { cases, ready: true, failed, total }
    out.textContent =
        failed.length === 0
            ? `all good: ${total} checks across ${cases.length} adopting elements`
            : `${failed.length}/${total} checks failing\n\n${failed.join('\n')}`
})
export {}
