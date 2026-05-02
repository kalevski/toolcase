import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'settings', label: 'Settings' },
    { id: 'quit', label: 'Quit to Menu' },
]

const PauseScreenDemo: React.FC = () => {
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
        const resume = () => { setLast('resume'); setOpen(false) }
        const restart = () => { setLast('restart'); setOpen(false) }
        const quit = () => { setLast('quit'); setOpen(false) }
        const select = (event: any) => setLast(`select:${event.detail.id}`)
        el.addEventListener('resume', resume)
        el.addEventListener('restart', restart)
        el.addEventListener('quit', quit)
        el.addEventListener('select', select)
        return () => {
            el.removeEventListener('resume', resume)
            el.removeEventListener('restart', restart)
            el.removeEventListener('quit', quit)
            el.removeEventListener('select', select)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Pause Screen"
                        description="Modal pause overlay. Resume/restart/quit fire dedicated events."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Open — last action: ${last || '—'}`}>
                            {/* @ts-ignore */}
                            <gc-metal-button variant="primary" onClick={() => setOpen(true)}>Pause</gc-metal-button>
                        </SectionCard>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-pause-screen ref={ref} {...(open ? { open: '' } : {})} screen-title="Realm of Ash" />
        </div>
    )
}

export default PauseScreenDemo
