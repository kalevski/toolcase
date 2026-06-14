import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MENU_ITEMS = [
    { key: 'retry', label: 'Retry build' },
    { key: 'logs', label: 'View logs' },
    { key: 'divider-1', label: '', divider: true },
    { key: 'delete', label: 'Delete', danger: true },
]

const BuildDemo: React.FC = () => {
    const menuRef = useRef<any>(null)
    const clickableRef = useRef<any>(null)
    const [menuKey, setMenuKey] = useState<string | null>(null)
    const [clickCount, setClickCount] = useState(0)

    useEffect(() => {
        const el = menuRef.current
        if (!el) return
        el.menuItems = MENU_ITEMS
        const handler = (e: CustomEvent) => setMenuKey(e.detail.key)
        el.addEventListener('tc-menu-select', handler)
        return () => el.removeEventListener('tc-menu-select', handler)
    }, [])

    useEffect(() => {
        const el = clickableRef.current
        if (!el) return
        el.onClick = () => setClickCount(n => n + 1)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Build"
                            description="Build status card showing name, date, size, duration, a status icon, an optional badge, and an action menu."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Status variants">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="main / production"
                                        date="2026-06-14"
                                        size="4194304"
                                        duration="87500"
                                        status="pass"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="feature/auth-refactor"
                                        date="2026-06-13"
                                        size="3670016"
                                        duration="43200"
                                        status="fail"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="release/v2.1.0"
                                        date="2026-06-14"
                                        size="5242880"
                                        duration="62000"
                                        status="running"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="chore/dependency-updates"
                                        date="2026-06-14"
                                        status="queued"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="With badge">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="main / production"
                                        date="2026-06-14"
                                        size="4194304"
                                        duration="87500"
                                        status="pass"
                                        badge="latest"
                                        badge-variant="success"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="feature/auth-refactor"
                                        date="2026-06-13"
                                        size="3670016"
                                        duration="43200"
                                        status="fail"
                                        badge="blocked"
                                        badge-variant="danger"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-build
                                        name="release/v2.1.0"
                                        date="2026-06-14"
                                        size="5242880"
                                        duration="62000"
                                        status="pass"
                                        badge="canary"
                                        badge-variant="warning"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title={`Action menu — menuItems via JS property${menuKey ? ` (last: "${menuKey}")` : ''}`}>
                                <div style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-build
                                        ref={menuRef}
                                        name="main / production"
                                        date="2026-06-14"
                                        size="4194304"
                                        duration="87500"
                                        status="pass"
                                        badge="latest"
                                        badge-variant="success"
                                    />
                                </div>
                                {menuKey && (
                                    <p className="mt-2 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                        <code>tc-menu-select</code> fired with key: <code>{menuKey}</code>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title={`Clickable card — onClick + tc-click (clicked ${clickCount}×)`}>
                                <div style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-build
                                        ref={clickableRef}
                                        name="main / production"
                                        date="2026-06-14"
                                        size="4194304"
                                        duration="87500"
                                        status="pass"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-build loading />
                                    {/* @ts-ignore */}
                                    <tc-build loading />
                                    {/* @ts-ignore */}
                                    <tc-build loading />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BuildDemo
