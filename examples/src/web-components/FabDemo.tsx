import React, { useState } from 'react'

// The demo frames are 390px wide — the width the JADI.mk phone design was drawn at —
// so the FAB can be compared against screen `1c` by eye.
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

const rows = Array.from({ length: 30 }, (_, i) => i + 1)

// ── over a list, in a shell's overlay layer: the design's own placement ────────

const ShellExample: React.FC<{ autoHide?: boolean; offset?: string }> = ({ autoHide, offset }) => (
    <div style={{ ...frame, height: '420px' }}>
        {/* @ts-ignore height override: an embedded preview, not an app root */}
        <tc-mobile-shell
            data-key={`fab-demo-${autoHide ? 'hide' : 'stay'}`}
            style={{ height: '100%' }}
        >
            {/* @ts-ignore */}
            <tc-app-bar
                slot="header"
                variant="title"
                heading="Рецепти"
                subheading="вашиот личен готвач"
            />
            {/* THE SCROLL PANE PAYS FOR THE FAB. At bottom:104px the button covers part
                of the last card in a list; the design accepts that, but the pane has to
                add `offset + size + 16px` of bottom padding so the final row can still
                be read. That belongs to the consumer, not to the FAB — the FAB has no
                idea what is under it. */}
            <div style={{ paddingBottom: 'calc(104px + 56px + 16px)' }}>
                {rows.map((n) => (
                    <div key={n} style={pane}>
                        Рецепт {n} —{' '}
                        {autoHide
                            ? 'scroll down and the FAB retracts, scroll up and it comes back.'
                            : 'the FAB stays put; scrolling does nothing to it.'}
                    </div>
                ))}
            </div>
            {/* @ts-ignore */}
            <tc-tab-dock
                slot="dock"
                active-id="recipes"
                aria-label="Главна навигација"
                ref={(el: any) => {
                    if (el)
                        el.tabs = [
                            { id: 'home', label: 'Дома', icon: 'house' },
                            { id: 'recipes', label: 'Рецепти', icon: 'book-open' },
                            { id: 'shopping', label: 'Листи', icon: 'shopping-basket' },
                            { id: 'diet', label: 'Исхрана', icon: 'leaf' },
                            { id: 'more', label: 'Повеќе', icon: 'ellipsis' },
                        ]
                }}
            />
            <div slot="overlay">
                {/* @ts-ignore */}
                <tc-fab icon="plus" label="Нов рецепт" auto-hide={autoHide} offset={offset} />
            </div>
        </tc-mobile-shell>
    </div>
)

// ── placement, variant and the safe-area inset ────────────────────────────────

// env(safe-area-inset-*) cannot be synthesised in a desktop browser — it always
// reads 0px, whatever the device emulator says. Overriding --tc-safe-bottom on the
// frame is how the inset behaviour is actually provable: the FAB and the dock both
// read the token, never env() directly, which is the whole reason the token exists.
const InsetExample: React.FC = () => {
    const [inset, setInset] = useState('0px')
    return (
        <div>
            <div style={{ ...pane, padding: '0 0 8px' }}>
                <label>
                    Forced <code>--tc-safe-bottom</code>:{' '}
                    <select value={inset} onChange={(e) => setInset(e.target.value)}>
                        <option value="0px">0px (flat phone)</option>
                        <option value="34px">34px (notched)</option>
                        <option value="59px">59px (landscape notch)</option>
                    </select>
                </label>
            </div>
            <div style={{ ...frame, height: '300px', ['--tc-safe-bottom' as any]: inset }}>
                {/* @ts-ignore */}
                <tc-mobile-shell data-key="fab-inset" style={{ height: '100%' }}>
                    <div style={pane}>
                        The FAB sits at <code>calc(104px + {inset})</code> above the frame's
                        physical bottom edge, so its clearance over the dock stays the same on every
                        device. The shell's own <code>padding-bottom</code> does not lift it — the
                        overlay layer spans the padding box.
                    </div>
                    {/* @ts-ignore */}
                    <tc-tab-dock
                        slot="dock"
                        active-id="recipes"
                        aria-label="Главна навигација"
                        ref={(el: any) => {
                            if (el)
                                el.tabs = [
                                    { id: 'recipes', label: 'Рецепти', icon: 'book-open' },
                                    { id: 'shopping', label: 'Листи', icon: 'shopping-basket' },
                                    { id: 'more', label: 'Повеќе', icon: 'ellipsis' },
                                ]
                        }}
                    />
                    <div slot="overlay">
                        {/* @ts-ignore */}
                        <tc-fab icon="plus" label="Нов рецепт" />
                    </div>
                </tc-mobile-shell>
            </div>
        </div>
    )
}

// ── the four placements and the extended variant, in a plain box ──────────────

const PlacementExample: React.FC = () => (
    <div style={{ ...frame, height: '220px', position: 'relative', overflow: 'hidden' }}>
        <div style={pane}>
            <code>position</code> is <code>bottom-right</code> by default. The centred one is
            positioned with <code>inset-inline: 0</code> and auto margins rather than a{' '}
            <code>translateX(-50%)</code>, because the retract animation needs{' '}
            <code>transform</code> to itself.
        </div>
        {/* No dock here, so the offset drops to 24px — the value a screen without one uses. */}
        {/* @ts-ignore */}
        <tc-fab icon="plus" label="Нов рецепт" offset="24px" />
        {/* @ts-ignore */}
        <tc-fab icon="pencil" label="Уреди" position="bottom-left" offset="24px" />
        {/* @ts-ignore */}
        <tc-fab icon="check" label="Зачувај" position="bottom-center" offset="96px" />
    </div>
)

const VariantExample: React.FC = () => (
    <div style={{ ...frame, padding: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* @ts-ignore */}
        <tc-fab icon="plus" label="Нов рецепт" position="static" />
        {/* @ts-ignore */}
        <tc-fab icon="plus" label="Нов рецепт" variant="extended" position="static" />
    </div>
)

const FabDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Fab"
                        description="The floating action button: a 56px squircle in the thumb zone, over a scrolling list. Amber, 16px radius (not a circle — small corners are a principle of this design system), safe-area aware, with an opt-in retract on scroll."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: these are deliberately NOT nested inside tc-section-card or
                        tc-rich-page-header. Those components distribute their own slots with
                        a subtree-wide querySelectorAll, so a [slot="overlay"] inside one of
                        them would be hoisted out. tc-fab renders its own child from
                        attributes and has no slots, so it can never do that in return. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>
                                Over a list — the design's placement (screen 1c)
                            </div>
                            <ShellExample />
                        </div>
                        <div>
                            <div style={label}>
                                auto-hide — opt-in, and off under reduced motion
                            </div>
                            <ShellExample autoHide />
                        </div>
                        <div>
                            <div style={label}>
                                Safe-area inset — forced, because env() cannot be
                            </div>
                            <InsetExample />
                        </div>
                        <div>
                            <div style={label}>position — bottom-right / -left / -center</div>
                            <PlacementExample />
                        </div>
                        <div>
                            <div style={label}>variant — icon and extended, position="static"</div>
                            <VariantExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default FabDemo
