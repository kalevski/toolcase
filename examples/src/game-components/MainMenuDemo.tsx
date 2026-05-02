import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

type Item = { id: string, label: string, disabled?: boolean, badge?: string }

const ITEMS: Item[] = [
    { id: 'continue', label: 'Continue' },
    { id: 'new', label: 'New Game' },
    { id: 'load', label: 'Load Game', badge: '12' },
    { id: 'multiplayer', label: 'Multiplayer' },
    { id: 'settings', label: 'Settings' },
    { id: 'credits', label: 'Credits', disabled: true },
    { id: 'quit', label: 'Quit' },
]

const MainMenuDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [selected, setSelected] = useState('continue')
    const [lastChoice, setLastChoice] = useState('')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setLastChoice(event.detail.id)
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Main Menu"
                        description="Title screen menu list with arrow-key nav. Selected highlights gold; Enter emits select."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Hover/click to select — last activated: ${lastChoice || '—'}`} />
                            <div style={{ maxWidth: 360, padding: 24, background: 'radial-gradient(120% 80% at 50% 0%, #2e2418 0%, #1a130c 70%)' }}>
                                {/* @ts-ignore */}
                                <gc-main-menu
                                    ref={ref}
                                    menu-title="Realm of Ash"
                                    subtitle="A tale of forgotten gilded halls."
                                    selected-id={selected}
                                    onClick={() => {
                                        const el: any = ref.current
                                        if (el) setSelected(el.selectedId)
                                    }}
                                />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MainMenuDemo
