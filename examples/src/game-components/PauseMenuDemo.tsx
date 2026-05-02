import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'settings', label: 'Settings' },
    { id: 'load', label: 'Load Game' },
    { id: 'main', label: 'Main Menu' },
    { id: 'quit', label: 'Quit to Desktop' },
]

const PauseMenuDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState('')

    useEffect(() => {
        const el: any = ref.current
        if (el) el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const close = () => setOpen(false)
        const resume = () => { setLast('resume'); setOpen(false) }
        const select = (event: any) => { setLast(event.detail.id); setOpen(false) }
        el.addEventListener('close', close)
        el.addEventListener('resume', resume)
        el.addEventListener('select', select)
        return () => {
            el.removeEventListener('close', close)
            el.removeEventListener('resume', resume)
            el.removeEventListener('select', select)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Pause Menu"
                        description="Modal pause overlay. Esc + backdrop click emit close."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Open menu — last action: ${last || '—'}`} />
                            {/* @ts-ignore */}
                            <gc-metal-button variant="primary" onClick={() => setOpen(true)}>Pause</gc-metal-button>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-pause-menu ref={ref} {...(open ? { open: '' } : {})} menu-title="Realm of Ash" />
        </div>
    )
}

export default PauseMenuDemo
