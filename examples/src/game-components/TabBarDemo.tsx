import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

type TabItem = { id: string, label: string, icon?: string }

const TABS: TabItem[] = [
    { id: 'graphics', label: 'Graphics', icon: '✦' },
    { id: 'audio', label: 'Audio', icon: '◈' },
    { id: 'controls', label: 'Controls', icon: '☩' },
    { id: 'gameplay', label: 'Gameplay', icon: '⚔' },
]

const TabBarDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const refSm = useRef<HTMLElement>(null)
    const [active, setActive] = useState('graphics')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.tabs = TABS
        const elSm: any = refSm.current
        if (elSm) elSm.tabs = TABS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setActive(event.detail.id)
        el.addEventListener('change', handler)
        return () => el.removeEventListener('change', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Tab Bar"
                        description="Horizontal tab navigation. Sizes sm/md, emits change."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Default (md) — active: ${active}`}>
                            {/* @ts-ignore */}
                            <gc-tab-bar ref={ref} active-id={active} />
                        </SectionCard>

                        <SectionCard title="Small">
                            {/* @ts-ignore */}
                            <gc-tab-bar ref={refSm} size="sm" active-id="audio" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TabBarDemo
