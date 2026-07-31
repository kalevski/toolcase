import React, { useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

// The demo frames are 390px wide — the width the JADI.mk phone design was drawn at —
// so the bars can be compared against that canvas by eye.
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

// Screen 1b's bell + amber count badge. The bar offers the `actions` region; what
// goes in it is the app's, which is why this is markup here and not an attribute.
const Bell: React.FC<{ count: number }> = ({ count }) => (
    <div
        slot="actions"
        style={{
            position: 'relative',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <tc-icon name="bell" size="20" />
        <span
            style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '15px',
                height: '15px',
                borderRadius: '999px',
                background: 'var(--tc-app-accent)',
                color: 'var(--tc-app-accent-contrast)',
                font: '700 9px var(--tc-font-sans)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {count}
        </span>
    </div>
)

// ── brand ─────────────────────────────────────────────────────────────────────

const BrandExample: React.FC = () => (
    <div style={frame}>
        {/* No style overrides: each variant ships the gutter and gap its own screen in
            the design uses, so the bare tag is the canvas. */}
        {/* @ts-ignore */}
        <tc-app-bar variant="brand" heading="JADI" subheading=".mk">
            <Bell count={3} />
        </tc-app-bar>
        <div style={pane}>
            One size drives the whole wordmark. A login screen scales it with{' '}
            <code>--bs-app-bar-brand-size</code> alone:
        </div>
        {/* @ts-ignore */}
        <tc-app-bar
            variant="brand"
            heading="JADI"
            subheading=".mk"
            style={
                {
                    '--bs-app-bar-brand-size': '19px',
                    '--bs-app-bar-brand-dash-width': '26px',
                } as React.CSSProperties
            }
        />
    </div>
)

// ── title + page tabs ─────────────────────────────────────────────────────────

const routeTabs = [
    { id: 'recipes', label: 'Рецепти', href: '#recipes' },
    { id: 'bundles', label: 'Папки', href: '#bundles' },
]

const TitleExample: React.FC = () => {
    const [active, setActive] = useState('recipes')
    const rail = useTc<HTMLElement>(
        { tabs: routeTabs },
        {
            'tc-change': (e: CustomEvent) => {
                // What a client-side router does: cancel the anchor's navigation and
                // route instead. Without preventDefault the browser follows the href,
                // which is the right fallback when JS has not loaded.
                e.preventDefault()
                setActive(e.detail.id)
            },
        },
    )
    return (
        <div style={frame}>
            {/* heading-level="1" makes the title the page's real <h1>. Left off by
                default: on most of the design's screens the pane carries the heading. */}
            {/* @ts-ignore */}
            <tc-app-bar
                variant="title"
                heading="Рецепти"
                subheading="вашиот личен готвач"
                heading-level="1"
            >
                {/* @ts-ignore */}
                <tc-page-tabs ref={rail} slot="below" active-id={active} />
            </tc-app-bar>
            <div style={pane}>
                The `title` variant draws NO bottom rule: on every screen of the design something
                under it owns that hairline — a search band, a day strip, or the content pane's own{' '}
                <code>border-top</code>. Active tab: <code>{active}</code>
            </div>
        </div>
    )
}

// ── back ──────────────────────────────────────────────────────────────────────

const BackExample: React.FC = () => {
    const [pressed, setPressed] = useState(0)
    const bar = useTcEvents<HTMLElement>({ 'tc-app-bar-back': () => setPressed((n) => n + 1) })
    return (
        <div style={frame}>
            {/* @ts-ignore */}
            <tc-app-bar
                ref={bar}
                variant="back"
                heading="Тавче гравче со домашен ајвар, зимница и рамен леб од фурна"
                back-label="Назад"
            >
                <tc-icon slot="actions" name="more-horizontal" size="22" />
            </tc-app-bar>
            <div style={pane}>
                The heading ellipsises rather than wrapping — a bar has one line of height. Back
                pressed <code>{pressed}</code> times.
            </div>
            {/* The two-line bar is the design's outlier: a 14px gutter (--m-pad-navbar,
                which is why it is named that), a 10px gap and a 15px title. */}
            {/* @ts-ignore */}
            <tc-app-bar
                variant="back"
                heading="Пазар за среда"
                subheading="4 од 7 купено"
                back-label="Назад"
                style={
                    {
                        '--bs-app-bar-padding': 'var(--m-pad-navbar)',
                        '--bs-app-bar-gap': '10px',
                        '--bs-app-bar-heading-font': 'var(--m-font-title-sm)',
                    } as React.CSSProperties
                }
            >
                <tc-icon slot="actions" name="download" size="20" />
            </tc-app-bar>
            <div style={pane}>
                A second line and a trailing icon action. That line is a counter, so the variant
                gives it tabular figures. The chevron's hit box is 44px wide and as tall as the bar
                (44x35 here, 44x44 on a phone with a safe-area strip to reach into) — padding grows
                it, an equal negative margin keeps the bar at the design's 36px.
            </div>
        </div>
    )
}

// ── elevation driven by the shell's scroll ────────────────────────────────────

const rows = Array.from({ length: 40 }, (_, i) => i + 1)

const ElevatedExample: React.FC = () => (
    <div style={{ ...frame, height: '320px' }}>
        {/* @ts-ignore height override: an embedded preview, not an app root */}
        <tc-mobile-shell data-key="app-bar-demo" style={{ height: '100%' }}>
            {/* @ts-ignore */}
            <tc-app-bar
                slot="header"
                variant="back"
                heading="Тавче гравче"
                back-label="Назад"
                elevate-on-scroll
            >
                <tc-icon slot="actions" name="more-horizontal" size="22" />
            </tc-app-bar>
            <div>
                {rows.map((n) => (
                    <div key={n} style={pane}>
                        Ред {n} — scroll me. <code>elevate-on-scroll</code> makes the bar listen for
                        the shell's <code>tc-shell-scroll</code> and reflect <code>elevated</code>{' '}
                        itself; the separator is a box-shadow, so switching it on costs no 1px
                        reflow.
                    </div>
                ))}
            </div>
        </tc-mobile-shell>
    </div>
)

const AppBarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="AppBar"
                        description="The phone top bar in the three shapes a mobile app uses: a wordmark root, a page title with a tab rail under it, and a back chevron with a title and trailing actions. It renders one node of its own and re-parents nothing, so a framework can add, remove or swap its slotted regions freely."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: the bars below are deliberately NOT nested inside
                        tc-section-card / tc-rich-page-header. Those components distribute
                        their own slots with a subtree-wide querySelectorAll, and
                        tc-rich-page-header's `actions` lookup collides with this bar's —
                        it would hoist a nested bar's trailing action into its own header.
                        tc-app-bar's own lookups are all `:scope >`, so it can never do
                        that to anything nested inside it. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>variant="brand" — wordmark + trailing actions</div>
                            <BrandExample />
                        </div>
                        <div>
                            <div style={label}>variant="title" — page title + tc-page-tabs</div>
                            <TitleExample />
                        </div>
                        <div>
                            <div style={label}>variant="back" — chevron, title, actions</div>
                            <BackExample />
                        </div>
                        <div>
                            <div style={label}>elevate-on-scroll — inside a tc-mobile-shell</div>
                            <ElevatedExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AppBarDemo
