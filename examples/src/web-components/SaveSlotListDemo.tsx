import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DEMO_SLOTS = [
    { id: 'auto', name: 'Auto Save', timestamp: '2 min ago', location: 'Ember Keep', level: 24, playtime: '12h 04m', autosave: true },
    { id: 's1', name: 'The Long Road', timestamp: 'Yesterday 22:14', location: 'Vale of Mist', level: 22, playtime: '11h 02m' },
    { id: 's2', name: 'Before the Boss', timestamp: '3 days ago', location: 'Catacombs', level: 19, playtime: '8h 41m' },
    { id: 's3', empty: true },
    { id: 's4', empty: true },
]

const SaveSlotListDemo: React.FC = () => {
    const loadRef = useRef<any>(null)
    const saveRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (loadRef.current) loadRef.current.slots = DEMO_SLOTS
        if (saveRef.current) saveRef.current.slots = DEMO_SLOTS
        if (emptyRef.current) emptyRef.current.slots = []
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.slots = DEMO_SLOTS

        const onSelect = (e: CustomEvent) => setLog(l => [`tc-select  id="${e.detail.id}"`, ...l].slice(0, 8))
        const onLoad   = (e: CustomEvent) => setLog(l => [`tc-load    id="${e.detail.id}"`, ...l].slice(0, 8))
        const onSave   = (e: CustomEvent) => setLog(l => [`tc-save    id="${e.detail.id}"`, ...l].slice(0, 8))
        const onDelete = (e: CustomEvent) => setLog(l => [`tc-delete  id="${e.detail.id}"`, ...l].slice(0, 8))

        el.addEventListener('tc-select', onSelect as EventListener)
        el.addEventListener('tc-load',   onLoad   as EventListener)
        el.addEventListener('tc-save',   onSave   as EventListener)
        el.addEventListener('tc-delete', onDelete as EventListener)

        return () => {
            el.removeEventListener('tc-select', onSelect as EventListener)
            el.removeEventListener('tc-load',   onLoad   as EventListener)
            el.removeEventListener('tc-save',   onSave   as EventListener)
            el.removeEventListener('tc-delete', onDelete as EventListener)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SaveSlotList"
                            description="Save/load slot list with autosave, empty, and selected states. The mode attribute switches between Load and Save/Overwrite/Delete actions."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Load mode — autosave, filled, and empty slots">
                                {/* @ts-ignore */}
                                <tc-save-slot-list ref={loadRef} mode="load" selected-id="s1" style={{ maxWidth: '640px' }} />
                            </SectionCard>

                            <SectionCard title="Save mode — Save / Overwrite / Delete actions">
                                {/* @ts-ignore */}
                                <tc-save-slot-list ref={saveRef} mode="save" selected-id="s3" style={{ maxWidth: '640px' }} />
                            </SectionCard>

                            <SectionCard title="Empty state — no slots provided">
                                {/* @ts-ignore */}
                                <tc-save-slot-list ref={emptyRef} mode="load" style={{ maxWidth: '640px' }} />
                            </SectionCard>

                            <SectionCard title="Events — tc-select / tc-load / tc-save / tc-delete">
                                {/* @ts-ignore */}
                                <tc-save-slot-list ref={eventsRef} mode="load" style={{ maxWidth: '640px' }} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click a row or button to see events…</span>
                                    ) : (
                                        <ul className="mb-0 ps-0 list-unstyled">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SaveSlotListDemo
