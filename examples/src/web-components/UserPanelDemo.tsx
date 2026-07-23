import React, { useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

const MENU_ITEMS = [
    { key: 'profile', label: 'Profile', icon: 'user' },
    { key: 'billing', label: 'Billing', icon: 'credit-card' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
    { key: 'signout', label: 'Sign out', icon: 'log-out' },
]

function panelFrame(children: React.ReactNode) {
    return (
        <div style={{ maxWidth: 260, border: '1px solid var(--tc-border, #dee2e6)' }}>
            {children}
        </div>
    )
}

function IconClickExample() {
    const [count, setCount] = useState(0)

    const ref = useTcEvents<HTMLElement>({
        'tc-icon-click': () => setCount((c) => c + 1),
    })

    return (
        <div className="d-flex flex-column gap-3">
            {panelFrame(
                /* @ts-ignore */
                <tc-user-panel ref={ref} username="Daniel Kalevski" plan="Pro" />,
            )}
            <p className="small text-muted mb-0">
                Settings icon clicked: <code>{count}</code> time{count === 1 ? '' : 's'}
            </p>
        </div>
    )
}

function MenuExample() {
    const [log, setLog] = useState<string[]>([])

    const ref = useTc<HTMLElement>(
        { menuItems: MENU_ITEMS },
        {
            'tc-menu-click': (e: CustomEvent) => {
                setLog((prev) => [`menu clicked → "${e.detail.key}"`, ...prev].slice(0, 5))
            },
        }
    )

    return (
        <div className="d-flex flex-column gap-3">
            {panelFrame(
                /* @ts-ignore */
                <tc-user-panel ref={ref} username="Daniel Kalevski" plan="Pro" />,
            )}
            {log.length > 0 && (
                <ul className="list-unstyled mb-0 small text-muted">
                    {log.map((entry, i) => (
                        <li key={i}>
                            <code>{entry}</code>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

const UserPanelDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="UserPanel"
                        description="User profile panel with avatar, name, plan micro-label, a settings icon button, and an optional dropdown menu. Emits tc-icon-click on the settings button and tc-menu-click on menu selection."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Avatar image — Enterprise plan">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel
                                    avatar-src="https://i.pravatar.cc/150?img=12"
                                    username="Alice Johnson"
                                    plan="Enterprise"
                                />,
                            )}
                        </tc-section-card>

                        <tc-section-card title="Initials fallback — Free plan">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel username="Jane Smith" initials="JS" />,
                            )}
                        </tc-section-card>

                        <tc-section-card title="Highlighted settings icon">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel
                                    username="Bob Martin"
                                    plan="Starter"
                                    icon-highlighted
                                />,
                            )}
                        </tc-section-card>

                        <tc-section-card title="Settings icon click (tc-icon-click)">
                            <IconClickExample />
                        </tc-section-card>

                        <tc-section-card title="Dropdown menu (click the name — Escape / arrows work)">
                            <MenuExample />
                        </tc-section-card>

                        <tc-section-card title="Loading skeleton">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel loading />,
                            )}
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default UserPanelDemo
