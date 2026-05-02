import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const CATS = [
    { id: 'graphics', label: 'Graphics', icon: '✦' },
    { id: 'audio', label: 'Audio', icon: '◈' },
    { id: 'controls', label: 'Controls', icon: '☩' },
    { id: 'gameplay', label: 'Gameplay', icon: '⚔' },
    { id: 'account', label: 'Account', icon: '❖' },
]

const SettingsCategoryListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [selected, setSelected] = useState('graphics')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.categories = CATS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setSelected(event.detail.id)
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Settings Category List"
                        description="Settings sidebar with a slotted content area on the right."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Active: ${selected}`} />
                            <div style={{ background: 'rgba(0,0,0,0.3)', minHeight: 280 }}>
                                {/* @ts-ignore */}
                                <gc-settings-category-list ref={ref} selected-id={selected}>
                                    <div style={{ color: 'var(--fg-parch)', fontFamily: 'var(--fg-body)', fontSize: 14, lineHeight: 1.5 }}>
                                        <strong style={{ color: 'var(--fg-gold-bright)', fontFamily: 'var(--fg-display)', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 13, display: 'block', marginBottom: 8 }}>
                                            {selected.toUpperCase()}
                                        </strong>
                                        Settings panel for the active category appears here. Replace this content with the corresponding setting rows.
                                    </div>
                                    {/* @ts-ignore */}
                                </gc-settings-category-list>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsCategoryListDemo
