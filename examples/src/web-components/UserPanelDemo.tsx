import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const ref = useRef<any>(null)
    const [count, setCount] = useState(0)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onIcon = () => setCount(c => c + 1)
        el.addEventListener('tc-icon-click', onIcon)
        return () => el.removeEventListener('tc-icon-click', onIcon)
    }, [])

    return (
        <div className="d-flex flex-column gap-3">
            {panelFrame(
                /* @ts-ignore */
                <tc-user-panel ref={ref} username="Daniel Kalevski" plan="Pro" />
            )}
            <p className="small text-muted mb-0">
                Settings icon clicked: <code>{count}</code> time{count === 1 ? '' : 's'}
            </p>
        </div>
    )
}

function MenuExample() {
    const ref = useRef<any>(null)
    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.menuItems = MENU_ITEMS
        const onMenu = (e: CustomEvent) => {
            setLog(prev => [`menu clicked → "${e.detail.key}"`, ...prev].slice(0, 5))
        }
        el.addEventListener('tc-menu-click', onMenu)
        return () => el.removeEventListener('tc-menu-click', onMenu)
    }, [])

    return (
        <div className="d-flex flex-column gap-3">
            {panelFrame(
                /* @ts-ignore */
                <tc-user-panel ref={ref} username="Daniel Kalevski" plan="Pro" />
            )}
            {log.length > 0 && (
                <ul className="list-unstyled mb-0 small text-muted">
                    {log.map((entry, i) => (
                        <li key={i}><code>{entry}</code></li>
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
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="UserPanel"
                        description="User profile panel with avatar, name, plan micro-label, a settings icon button, and an optional dropdown menu. Emits tc-icon-click on the settings button and tc-menu-click on menu selection."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Avatar image — Enterprise plan">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel
                                    avatar-src="https://i.pravatar.cc/150?img=12"
                                    username="Alice Johnson"
                                    plan="Enterprise"
                                />
                            )}
                        </SectionCard>

                        <SectionCard title="Initials fallback — Free plan">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel username="Jane Smith" initials="JS" />
                            )}
                        </SectionCard>

                        <SectionCard title="Highlighted settings icon">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel username="Bob Martin" plan="Starter" icon-highlighted />
                            )}
                        </SectionCard>

                        <SectionCard title="Settings icon click (tc-icon-click)">
                            <IconClickExample />
                        </SectionCard>

                        <SectionCard title="Dropdown menu (click the name — Escape / arrows work)">
                            <MenuExample />
                        </SectionCard>

                        <SectionCard title="Loading skeleton">
                            {panelFrame(
                                /* @ts-ignore */
                                <tc-user-panel loading />
                            )}
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default UserPanelDemo
