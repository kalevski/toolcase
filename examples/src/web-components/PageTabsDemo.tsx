import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const frame: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    background: 'var(--tc-surface)',
    border: '1px solid var(--tc-border)',
}

const note: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const rail: React.CSSProperties = { padding: '0 16px' }

// The real /admin tab set: six tabs, ~470px of labels. At 320px that is more than a
// screen and a half, which is the case this element exists for.
const adminTabs = [
    { id: 'overview', label: 'Преглед', href: '#overview' },
    { id: 'users', label: 'Корисници', href: '#users' },
    { id: 'catalog', label: 'Состојки', href: '#catalog' },
    { id: 'access', label: 'Пристап и лимити', href: '#access' },
    { id: 'keys', label: 'Клучеви', href: '#keys' },
    { id: 'settings', label: 'Поставки', href: '#settings' },
]

const switcherTabs = [
    { id: 'goals', label: 'Цели и мерки' },
    { id: 'planner', label: 'Планер' },
    { id: 'ingredients', label: 'Состојки' },
    { id: 'chat', label: 'Разговор' },
]

const countTabs = [
    { id: 'recipes', label: 'Рецепти', count: 12 },
    { id: 'bundles', label: 'Папки', count: 3 },
    { id: 'archive', label: 'Архива', disabled: true },
]

// ── link rail: the URL owns the active state ──────────────────────────────────

const LinkExample: React.FC = () => {
    const [active, setActive] = useState('keys')
    // Counted, because "one event per activation" is a promise this element has to keep:
    // click, Enter and Space each fire tc-change exactly once, on a link tab as on a
    // button tab. (An earlier version notified from the keydown handler AND from the
    // click it synthesised, so a router that navigates without cancelling got two.)
    const [fired, setFired] = useState(0)
    const ref = useTc<HTMLElement>(
        { tabs: adminTabs },
        {
            'tc-change': (e: CustomEvent) => {
                // A router takes over here. Without preventDefault the browser follows
                // the href, which is the correct no-JS fallback.
                e.preventDefault()
                setActive(e.detail.id)
                setFired((n) => n + 1)
            },
        },
    )
    return (
        <div style={frame}>
            {/* @ts-ignore */}
            <tc-page-tabs ref={ref} active-id={active} style={rail} />
            <div style={note}>
                Six tabs, rendered as real <code>&lt;a href&gt;</code>. Narrow the window: the rail
                scrolls sideways with no visible scrollbar and never wraps to a second line.
                Changing the active tab scrolls it into view — and only this element, never an
                ancestor. Active: <code>{active}</code>, after <code>{fired}</code>{' '}
                <code>tc-change</code> — one per activation, whether by pointer, Enter or Space.
            </div>
        </div>
    )
}

// ── switcher rail: the element owns the active state ──────────────────────────

const SwitcherExample: React.FC = () => {
    const [last, setLast] = useState('goals')
    const ref = useTc<HTMLElement>(
        { tabs: switcherTabs },
        { 'tc-change': (e: CustomEvent) => setLast(e.detail.id) },
    )
    return (
        <div style={frame}>
            {/* @ts-ignore */}
            <tc-page-tabs
                ref={ref}
                active-id="goals"
                style={{ ...rail, '--bs-page-tabs-gap': '18px' } as React.CSSProperties}
            />
            <div style={note}>
                No <code>href</code>, so these are <code>&lt;button&gt;</code>s over panels that are
                already in the DOM: the element writes <code>active-id</code> itself and the arrow
                keys activate as they move focus. Last change: <code>{last}</code>
            </div>
        </div>
    )
}

// ── counts and a disabled tab ────────────────────────────────────────────────

const CountExample: React.FC = () => {
    const ref = useTc<HTMLElement>({ tabs: countTabs })
    return (
        <div style={frame}>
            {/* @ts-ignore */}
            <tc-page-tabs ref={ref} active-id="recipes" style={rail} />
            <div style={note}>
                A <code>count</code> is a parenthesised suffix on the label, not a badge — a badge
                would compete with the amber underline for the same 2px of attention. A disabled tab
                renders as an inert <code>&lt;span&gt;</code>, never a link.
            </div>
        </div>
    )
}

const PageTabsDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="PageTabs"
                        description="The phone page rail: a horizontal underline tab strip that NEVER wraps. It scrolls instead, hides its scrollbar, keeps the active tab in view, and renders real anchors when its tabs are routes. The wrapping tc-tab-bar is the desktop counterpart; tc-tab-dock is the bottom dock."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>Six route tabs — scrolls, never wraps</div>
                            <LinkExample />
                        </div>
                        <div>
                            <div style={label}>A panel switcher — no href</div>
                            <SwitcherExample />
                        </div>
                        <div>
                            <div style={label}>Counts and a disabled tab</div>
                            <CountExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PageTabsDemo
