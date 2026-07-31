import React, { useState } from 'react'

// The demo frames are 390px wide — the width the JADI.mk phone design was drawn at —
// so each arrangement can be compared against its screen (1d/1h/1j/1k/1l) by eye.
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

// The design gives each screen its own button height — 46px on 1d/1h/1k, 44px on 1j,
// 48px on 1l — so the height goes on the CHILD, which is where the bar leaves it.
// `align-items: stretch` then puts the rest of the row on the same height. Task 13
// gives tc-button a size scale and a `block` attribute; until then this is how the
// design's geometry is expressed.
const h = (px: number): React.CSSProperties => ({ height: `${px}px` })

const glyph = (d: string) => (
    <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
    >
        <path d={d} />
    </svg>
)

// The design's two 1d icons and 1h's export arrow, as paths — tc-icon is not used here
// because these frames are about the bar's tracks, not about icon plumbing.
const BASKET = 'M4.2 9h15.6l-1.4 11H5.6zM8.5 9 12 3l3.5 6'
const PRINTER = 'M6 9V4h12v5M6 13h12v7H6zM4 9h16v6H4z'
const EXPORT = 'M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19h16'

// ── the five arrangements ─────────────────────────────────────────────────────

const Arrangements: React.FC = () => (
    <div className="d-flex flex-column gap-3">
        <div style={frame}>
            <div style={pane}>
                <code>1d</code> — one fluid primary and two compact icon tracks.
            </div>
            {/* @ts-ignore */}
            <tc-action-bar elevated>
                <tc-button variant="primary" style={h(46)}>
                    Готви
                </tc-button>
                <tc-button
                    className="tc-action-bar-compact"
                    variant="secondary"
                    outline
                    aria-label="Додај во листа"
                    style={h(46)}
                >
                    {glyph(BASKET)}
                </tc-button>
                <tc-button
                    className="tc-action-bar-compact"
                    variant="secondary"
                    outline
                    aria-label="Печати"
                    style={h(46)}
                >
                    {glyph(PRINTER)}
                </tc-button>
            </tc-action-bar>
        </div>

        <div style={frame}>
            <div style={pane}>
                <code>1h</code> — the same two track kinds, compact first. No shadow: a dock follows
                this bar on that screen.
            </div>
            {/* @ts-ignore */}
            <tc-action-bar>
                <tc-button
                    className="tc-action-bar-compact"
                    variant="secondary"
                    outline
                    aria-label="Извези"
                    style={h(46)}
                >
                    {glyph(EXPORT)}
                </tc-button>
                <tc-button variant="primary" style={h(46)}>
                    Заврши и стави во фрижидер
                </tc-button>
            </tc-action-bar>
        </div>

        <div style={frame}>
            <div style={pane}>
                <code>1j</code> — two fluid tracks, 44px. Equal width despite unequal labels,
                because a track is <code>flex: 1 1 0</code> and not <code>flex-grow: 1</code>.
            </div>
            {/* @ts-ignore */}
            <tc-action-bar>
                <tc-button variant="secondary" outline style={h(44)}>
                    Преглед на неделата
                </tc-button>
                <tc-button variant="primary" style={h(44)}>
                    Предложи диета
                </tc-button>
            </tc-action-bar>
        </div>

        <div style={frame}>
            <div style={pane}>
                <code>1k</code> — the same shape at 46px, and <code>flat</code>: bottom-most chrome
                that the design draws with no shadow.
            </div>
            {/* @ts-ignore */}
            <tc-action-bar flat>
                <tc-button variant="secondary" outline style={h(46)}>
                    Прати порака
                </tc-button>
                <tc-button variant="primary" style={h(46)}>
                    Побарај соработка
                </tc-button>
            </tc-action-bar>
        </div>

        <div style={frame}>
            <div style={pane}>
                <code>1l</code> — <code>stack</code>: a primary action over its escape hatch. The
                design draws the escape hatch borderless. That is the CHILD'S variant, not something
                this bar imposes — <code>tc-button</code> has no borderless variant until task 13's
                rework, so <code>light</code> stands in for it here.
            </div>
            {/* @ts-ignore */}
            <tc-action-bar stack flat>
                <tc-button variant="primary" style={h(48)}>
                    Контактирајте нѐ
                </tc-button>
                <tc-button variant="light" style={h(44)}>
                    Не сега
                </tc-button>
            </tc-action-bar>
        </div>
    </div>
)

// ── in a shell: elevation follows the context, and the keyboard lifts the bar ──

const rows = Array.from({ length: 24 }, (_, i) => i + 1)

const ShellExample: React.FC<{ dock?: boolean }> = ({ dock }) => (
    <div style={{ ...frame, height: '340px' }}>
        {/* @ts-ignore height override: an embedded preview, not an app root */}
        <tc-mobile-shell
            data-key={`action-bar-${dock ? 'dock' : 'bare'}`}
            style={{ height: '100%' }}
        >
            {/* @ts-ignore */}
            <tc-app-bar slot="header" variant="back" heading="Тавче гравче" back-label="Назад" />
            <div>
                {rows.map((n) => (
                    <div key={n} style={pane}>
                        Состојка {n}
                    </div>
                ))}
            </div>
            {/* Neither `elevated` nor `flat`: the shell decides. With no dock below it the
                bar is the bottom-most chrome and gets the lift-off shadow (1d); with a
                dock it gets none (1h, 1j), because two stacked shadows read as grime. */}
            {/* @ts-ignore */}
            <tc-action-bar slot="action">
                <tc-button variant="primary" style={h(46)}>
                    Готви
                </tc-button>
                <tc-button
                    className="tc-action-bar-compact"
                    variant="secondary"
                    outline
                    aria-label="Додај во листа"
                    style={h(46)}
                >
                    {glyph(BASKET)}
                </tc-button>
            </tc-action-bar>
            {dock ? (
                // @ts-ignore
                <tc-tab-dock
                    slot="dock"
                    active-id="recipes"
                    aria-label="Главна навигација"
                    ref={(el: any) => {
                        if (el)
                            el.tabs = [
                                { id: 'home', label: 'Дома', icon: 'house' },
                                { id: 'recipes', label: 'Рецепти', icon: 'book-open' },
                                { id: 'more', label: 'Повеќе', icon: 'ellipsis' },
                            ]
                    }}
                />
            ) : null}
        </tc-mobile-shell>
    </div>
)

// The keyboard inset and the home-indicator strip are both hardware state a desktop
// browser cannot produce — env(safe-area-inset-*) always reads 0px there, and there
// is no software keyboard to raise. Both are consumed as TOKENS
// (--tc-safe-bottom, --tc-keyboard-inset) for exactly this reason: forcing the token
// proves the behaviour without the hardware.
const InsetExample: React.FC = () => {
    const [safe, setSafe] = useState('0px')
    const [keyboard, setKeyboard] = useState('0px')
    return (
        <div>
            <div style={{ ...pane, padding: '0 0 8px', display: 'flex', gap: '14px' }}>
                <label>
                    <code>--tc-safe-bottom</code>{' '}
                    <select value={safe} onChange={(e) => setSafe(e.target.value)}>
                        <option value="0px">0px</option>
                        <option value="34px">34px</option>
                    </select>
                </label>
                <label>
                    <code>--tc-keyboard-inset</code>{' '}
                    <select value={keyboard} onChange={(e) => setKeyboard(e.target.value)}>
                        <option value="0px">0px</option>
                        <option value="291px">291px</option>
                    </select>
                </label>
            </div>
            <div
                style={{
                    ...frame,
                    height: '340px',
                    ['--tc-safe-bottom' as any]: safe,
                    ['--tc-keyboard-inset' as any]: keyboard,
                }}
            >
                {/* @ts-ignore */}
                <tc-mobile-shell data-key="action-bar-inset" style={{ height: '100%' }}>
                    <div style={pane}>
                        Inside a shell the bar's own padding stays a flat 10px — the shell pays{' '}
                        <code>max(safe, keyboard)</code> out of its own padding box and the bar sits
                        in that flow, so paying either again would double it. Standing alone the bar
                        pays both itself.
                    </div>
                    {/* @ts-ignore */}
                    <tc-action-bar slot="action">
                        <tc-button variant="primary" style={h(46)}>
                            Испрати
                        </tc-button>
                    </tc-action-bar>
                </tc-mobile-shell>
            </div>
            <div style={{ ...pane, padding: '8px 0 0' }}>Standing alone, same two tokens:</div>
            <div
                style={{
                    ...frame,
                    ['--tc-safe-bottom' as any]: safe,
                    ['--tc-keyboard-inset' as any]: keyboard,
                }}
            >
                {/* @ts-ignore */}
                <tc-action-bar elevated>
                    <tc-button variant="primary" style={h(46)}>
                        Испрати
                    </tc-button>
                </tc-action-bar>
            </div>
        </div>
    )
}

const ActionBarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="ActionBar"
                        description="The sticky bottom action bar: a detail screen's primary action in the thumb zone. One flex container, two track kinds and a stack attribute cover all five arrangements in the design — the bar owns the surface, the safe-area padding, the elevation and the keyboard inset, and imposes no button styling."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: these are deliberately NOT nested inside tc-section-card or
                        tc-rich-page-header. Those components distribute their own slots with
                        a subtree-wide querySelectorAll, so a [slot="action"] inside one of
                        them would be hoisted out of its shell. tc-action-bar renders nothing
                        and has no slots of its own, so it can never do that in return. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>All five arrangements — 1d / 1h / 1j / 1k / 1l</div>
                            <Arrangements />
                        </div>
                        <div>
                            <div style={label}>
                                In a shell, bottom-most — the shell adds the shadow
                            </div>
                            <ShellExample />
                        </div>
                        <div>
                            <div style={label}>In a shell, with a dock below — no shadow</div>
                            <ShellExample dock />
                        </div>
                        <div>
                            <div style={label}>
                                Safe-area and keyboard insets — forced, because hardware cannot be
                            </div>
                            <InsetExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ActionBarDemo
