import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// The demo frames are 390px wide — the width the JADI.mk phone design was drawn at —
// so the dock can be compared against `mobile_design/TabBar.dc.html` by eye.
const frame: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    background: 'var(--tc-surface-hover)',
    border: '1px solid var(--tc-border)',
}

const pane: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

// The design's five destinations. `badgeLabel` is what a screen reader says: without
// it the accessible name is „Рецепти, 12" and 12 of what is anyone's guess.
const fiveTabs = [
    { id: 'home', label: 'Дома', icon: 'house', href: '#home' },
    {
        id: 'recipes',
        label: 'Рецепти',
        icon: 'book-open',
        href: '#recipes',
        badge: 12,
        badgeLabel: '12 нови',
    },
    { id: 'shopping', label: 'Листи', icon: 'shopping-basket', href: '#shopping' },
    { id: 'diet', label: 'Исхрана', icon: 'leaf', href: '#diet', badge: 2, badgeLabel: '2 нови' },
    { id: 'more', label: 'Повеќе', icon: 'ellipsis', href: '#more' },
]

// ── route dock: the URL owns the active state ─────────────────────────────────

const RouteExample: React.FC = () => {
    const [active, setActive] = useState('recipes')
    const [log, setLog] = useState<string[]>([])
    const dock = useTc<HTMLElement>(
        { tabs: fiveTabs },
        {
            'tc-tab-dock-change': (e: CustomEvent) => {
                // A router takes over here. Without preventDefault the browser follows
                // the href, which is the right fallback when JS has not loaded.
                e.preventDefault()
                setActive(e.detail.id)
                setLog((l) => [`change → ${e.detail.id}`, ...l].slice(0, 4))
            },
            // Re-tapping the ACTIVE tab is not a change, and a change event that never
            // fires cannot be acted on — hence the second event. Native docks use it
            // for "scroll this pane to top, then pop to the tab's root".
            'tc-tab-dock-reselect': (e: CustomEvent) => {
                e.preventDefault()
                setLog((l) => [`reselect → ${e.detail.id}`, ...l].slice(0, 4))
            },
        },
    )
    return (
        <div style={frame}>
            <div style={pane}>
                Active: <code>{active}</code>. Tap the active tab again to see{' '}
                <code>tc-tab-dock-reselect</code> instead of a change.
                <br />
                {log.length ? log.join(' · ') : 'no events yet'}
            </div>
            {/* @ts-ignore */}
            <tc-tab-dock ref={dock} active-id={active} aria-label="Главна навигација" />
        </div>
    )
}

// ── badge edge cases ──────────────────────────────────────────────────────────

const badgeTabs = [
    { id: 'zero', label: 'Нула', icon: 'house', badge: 0 },
    { id: 'empty', label: 'Празно', icon: 'book-open', badge: '' },
    { id: 'seven', label: 'Седум', icon: 'shopping-basket', badge: 7, badgeLabel: '7 нови' },
    { id: 'hundred', label: 'Сто', icon: 'leaf', badge: 100, badgeLabel: 'над 99 нови' },
    { id: 'null', label: 'Ништо', icon: 'ellipsis', badge: null },
]

const BadgeExample: React.FC = () => {
    const dock = useTc<HTMLElement>({ tabs: badgeTabs })
    return (
        <div style={frame}>
            <div style={pane}>
                <code>0</code>, <code>''</code> and <code>null</code> render nothing — a zero badge
                is noise, not information. <code>100</code> renders <code>99+</code>, because three
                characters is as wide as the 21px icon.
            </div>
            {/* @ts-ignore */}
            <tc-tab-dock ref={dock} active-id="seven" aria-label="Badge cases" />
        </div>
    )
}

// ── fewer tabs: the grid does not assume five ─────────────────────────────────

const CountExample: React.FC = () => {
    const three = useTc<HTMLElement>({ tabs: fiveTabs.slice(0, 3) })
    const four = useTc<HTMLElement>({
        tabs: [
            ...fiveTabs.slice(0, 3),
            { id: 'long', label: 'Многу долго име', icon: 'leaf', badge: 5 },
        ],
    })
    return (
        <div style={frame}>
            <div style={pane}>
                Roles see different destinations, so the item count changes between sessions. The
                columns are <em>implicit</em> grid tracks at <code>minmax(0, 1fr)</code> — equal at
                any count, with no number passed in. A label too long for its column ellipsises
                rather than wrapping, which would change the dock's height.
            </div>
            {/* @ts-ignore */}
            <tc-tab-dock ref={three} active-id="home" aria-label="Три" />
            <div style={{ height: '10px' }} />
            {/* @ts-ignore */}
            <tc-tab-dock ref={four} active-id="home" aria-label="Четири" />
        </div>
    )
}

// ── switcher: no href, the element owns active-id ─────────────────────────────

const switcherTabs = [
    { id: 'steps', label: 'Чекори', icon: 'list-ordered' },
    { id: 'ingredients', label: 'Состојки', icon: 'carrot' },
    { id: 'notes', label: 'Белешки', icon: 'notebook-pen', disabled: true },
    { id: 'timer', label: 'Тајмер', icon: 'timer' },
]

const SwitcherExample: React.FC = () => {
    const dock = useTc<HTMLElement>({ tabs: switcherTabs })
    return (
        <div style={frame}>
            <div style={pane}>
                Without <code>href</code> the dock is a switcher over panes already in the DOM: it
                writes <code>active-id</code> itself and the arrow keys activate as they move. The
                disabled tab is an inert <code>&lt;span&gt;</code> and is skipped by both.
            </div>
            {/* @ts-ignore */}
            <tc-tab-dock ref={dock} active-id="steps" aria-label="Режим на готвење" />
        </div>
    )
}

// ── inside a real shell, with auto-hide ───────────────────────────────────────

const rows = Array.from({ length: 40 }, (_, i) => i + 1)

const ShellExample: React.FC = () => {
    const dock = useTc<HTMLElement>({ tabs: fiveTabs })
    return (
        <div style={{ ...frame, height: '360px' }}>
            {/* @ts-ignore height override: an embedded preview, not an app root */}
            <tc-mobile-shell data-key="tab-dock-demo" style={{ height: '100%' }}>
                {/* @ts-ignore */}
                <tc-app-bar slot="header" variant="title" heading="Рецепти" subheading="437" />
                <div>
                    {rows.map((n) => (
                        <div key={n} style={pane}>
                            Ред {n} — scroll down and the dock slides out, scroll up and it comes
                            back.
                        </div>
                    ))}
                </div>
                {/* auto-hide is OFF by default and is opted into here to demonstrate it.
                    Do not turn it on for a primary nav without deciding to: you cannot
                    navigate to what you cannot see. */}
                {/* @ts-ignore */}
                <tc-tab-dock
                    ref={dock}
                    slot="dock"
                    active-id="recipes"
                    auto-hide
                    aria-label="Главна навигација"
                />
            </tc-mobile-shell>
        </div>
    )
}

const TabDockDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="TabDock"
                        description="The fixed bottom navigation dock: icon over a 10px label, amber count badges, safe-area padding, and equal columns at any item count. Re-tapping the active tab is a separate event, so a pane can scroll to top instead of navigating to where it already is."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: the docks below are deliberately NOT nested inside
                        tc-section-card / tc-rich-page-header. Those components distribute
                        their own slots with a subtree-wide querySelectorAll, so a
                        [slot="dock"] inside one of them would be hoisted out. tc-tab-dock
                        renders its own children from the `tabs` property and has no slots
                        of its own, so it can never do that to anything nested inside it. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>Route dock — change vs reselect</div>
                            <RouteExample />
                        </div>
                        <div>
                            <div style={label}>Badges — 0 / '' / 7 / 100 / null</div>
                            <BadgeExample />
                        </div>
                        <div>
                            <div style={label}>Three and four items</div>
                            <CountExample />
                        </div>
                        <div>
                            <div style={label}>Switcher — no href, one disabled tab</div>
                            <SwitcherExample />
                        </div>
                        <div>
                            <div style={label}>auto-hide — inside a tc-mobile-shell</div>
                            <ShellExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TabDockDemo
