import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const rows = Array.from({ length: 40 }, (_, i) => i + 1)

const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderBottom: '1px solid var(--tc-border)',
    fontWeight: 700,
}

// A bar that draws NO rule of its own — the one shape
// `--bs-mobile-shell-header-shadow` exists for. Every other bar in this demo, and
// every header-bearing screen in the JADI.mk design, carries its own
// `border-bottom`; that is why the shell's default is `none`, since a second rule
// from the shell would render that hairline 2px thick.
const barFlatStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    fontWeight: 700,
}

// Opting in: the separator then appears only once content has moved under the
// header, which is the state neither the bar nor the app can observe on its own.
const optInShell = {
    height: '100%',
    '--bs-mobile-shell-header-shadow': 'inset 0 -1px 0 var(--tc-border)',
} as React.CSSProperties

const actionStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderTop: '1px solid var(--tc-border)',
}

const dockStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    padding: '0.5rem 0.375rem',
    borderTop: '1px solid var(--tc-border)',
    textAlign: 'center',
    fontSize: '0.625rem',
}

// The demo page itself scrolls, so each shell is boxed rather than allowed to take
// the whole 100dvh it would own as an app root. Overriding the height inline is
// exactly what an embedded preview frame does.
const frame: React.CSSProperties = {
    height: '360px',
    border: '1px solid var(--tc-border)',
}

// NOTE: these shells are deliberately NOT wrapped in tc-section-card. That element
// distributes its own `action` slot with a subtree-wide
// `querySelectorAll('[slot="action"]')`, so it hoists a nested action bar out of
// the shell and into its own header. Light-DOM slot names are global to a subtree
// unless a component scopes its lookup — tc-mobile-shell only ever reads
// `:scope > …`, so it cannot do this to anything nested inside it.
const label: React.CSSProperties = {
    fontWeight: 700,
    marginBottom: '0.5rem',
}

const MobileShellDemo: React.FC = () => {
    const [scrolled, setScrolled] = useState(false)
    const [top, setTop] = useState(0)
    const ref = useTcEvents<HTMLElement>({
        'tc-shell-scroll': (e: CustomEvent) => {
            setScrolled(e.detail.scrolled)
            setTop(Math.round(e.detail.top))
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MobileShell"
                            description="The phone app frame — a fixed top region, exactly one scrolling pane, optional bottom chrome, and an absolute layer for sheets. Renders no markup: the five regions are the host's own children, ordered by their slot attribute, so a framework can swap or conditionally render any of them without the shell re-parenting anything."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <div>
                                <div style={label}>
                                    Header + pane + dock — header separator on scroll
                                </div>
                                <div style={frame}>
                                    {/* @ts-ignore height override: embedded preview, not an app root */}
                                    <tc-mobile-shell
                                        ref={ref}
                                        data-key="demo-full"
                                        style={optInShell}
                                    >
                                        <div slot="header" style={barFlatStyle}>
                                            <tc-icon name="chevron-left" size="18" />
                                            <span>Рецепти</span>
                                        </div>

                                        <div style={{ padding: '0.875rem' }}>
                                            {rows.map((n) => (
                                                <p key={n} className="mb-2">
                                                    Row {n} — the pane scrolls, the document does
                                                    not, and the dock never leaves the frame.
                                                </p>
                                            ))}
                                        </div>

                                        <div slot="dock" style={dockStyle}>
                                            <span>Дома</span>
                                            <span>Рецепти</span>
                                            <span>Листи</span>
                                            <span>Исхрана</span>
                                            <span>Повеќе</span>
                                        </div>
                                    </tc-mobile-shell>
                                </div>
                                <p className="text-muted mt-2 mb-0">
                                    <code>tc-shell-scroll</code> → scrolled: {String(scrolled)},
                                    top: {top}
                                </p>
                            </div>

                            <div>
                                <div style={label}>Detail screen — action bar, no dock</div>
                                <div style={frame}>
                                    {/* @ts-ignore */}
                                    <tc-mobile-shell
                                        data-key="demo-detail"
                                        style={{ height: '100%' }}
                                    >
                                        <div slot="header" style={barStyle}>
                                            <tc-icon name="chevron-left" size="18" />
                                            <span>Тавче гравче</span>
                                        </div>

                                        <div style={{ padding: '0.875rem' }}>
                                            {rows.slice(0, 20).map((n) => (
                                                <p key={n} className="mb-2">
                                                    Step {n}. The action bar carries the lift-off
                                                    shadow only because no dock sits below it.
                                                </p>
                                            ))}
                                        </div>

                                        <div slot="action" style={actionStyle}>
                                            <tc-button variant="primary" style={{ flex: 1 }}>
                                                Готви
                                            </tc-button>
                                            <tc-button variant="secondary" outline>
                                                Сподели
                                            </tc-button>
                                        </div>
                                    </tc-mobile-shell>
                                </div>
                            </div>

                            <div>
                                <div style={label}>
                                    Full-bleed — no chrome, top hardware inset opted out
                                </div>
                                <div style={frame}>
                                    {/* @ts-ignore */}
                                    <tc-mobile-shell
                                        edge="bottom"
                                        scroll-restore="manual"
                                        pane-bg="var(--tc-surface)"
                                        style={{ height: '100%' }}
                                    >
                                        <div style={{ padding: '1.125rem' }}>
                                            <tc-heading as="h3">Cooking mode</tc-heading>
                                            <p className="text-muted mb-0">
                                                Every region is optional. With no header the pane
                                                runs to the top edge; <code>edge="bottom"</code>{' '}
                                                keeps the bottom hardware inset and drops the top
                                                one. <code>scroll-restore="manual"</code> hands the
                                                offset back to the consumer.
                                            </p>
                                        </div>
                                    </tc-mobile-shell>
                                </div>
                            </div>

                            <div>
                                <div style={label}>Keyboard avoidance</div>
                                <div style={frame}>
                                    {/* @ts-ignore */}
                                    <tc-mobile-shell
                                        data-key="demo-keyboard"
                                        style={{ height: '100%' }}
                                    >
                                        <div slot="header" style={barStyle}>
                                            <span>Порака</span>
                                        </div>

                                        <div style={{ padding: '0.875rem' }}>
                                            {rows.slice(0, 12).map((n) => (
                                                <p key={n} className="mb-2">
                                                    Message {n}
                                                </p>
                                            ))}
                                        </div>

                                        <div slot="action" style={actionStyle}>
                                            <tc-input
                                                placeholder="Напишете порака…"
                                                style={{ flex: 1 }}
                                            />
                                            <tc-button variant="primary">Прати</tc-button>
                                        </div>
                                    </tc-mobile-shell>
                                </div>
                                <p className="text-muted mt-2 mb-0">
                                    Focus the field on a phone: the shell reads{' '}
                                    <code>window.visualViewport</code> and sets{' '}
                                    <code>--tc-keyboard-inset</code>, so the composer lifts above
                                    the keyboard instead of hiding behind it.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MobileShellDemo
