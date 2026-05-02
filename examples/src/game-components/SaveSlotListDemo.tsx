import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SLOTS = [
    { id: 'auto', name: 'Auto Save', timestamp: '2 min ago', location: 'Ember Keep', level: 24, playtime: '12h 04m', autosave: true },
    { id: 's1', name: 'The Long Road', timestamp: 'Yesterday 22:14', location: 'Vale of Mist', level: 22, playtime: '11h 02m' },
    { id: 's2', name: 'Before the Boss', timestamp: '3 days ago', location: 'Catacombs', level: 19, playtime: '8h 41m' },
    { id: 's3', empty: true },
    { id: 's4', empty: true }
]

const SaveSlotListDemo: React.FC = () => {
    const loadRef = useRef<HTMLElement>(null)
    const saveRef = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const a = loadRef.current as any
        const b = saveRef.current as any
        if (a) a.slots = SLOTS
        if (b) b.slots = SLOTS
    }, [])

    useEffect(() => {
        const a = loadRef.current
        const b = saveRef.current
        if (!a || !b) return
        const handler = (e: any) => setLast(`${e.type} ${e.detail.id}`)
        ;['select', 'load', 'save', 'delete'].forEach((evt) => {
            a.addEventListener(evt, handler)
            b.addEventListener(evt, handler)
        })
        return () => {
            ;['select', 'load', 'save', 'delete'].forEach((evt) => {
                a.removeEventListener(evt, handler)
                b.removeEventListener(evt, handler)
            })
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="SaveSlotList"
                        description="Save/load slot list with autosave and empty states. Mode flips between load and save buttons."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Load mode — ${last}`}>
                            <div style={{ maxWidth: 640 }}>
                                {/* @ts-ignore */}
                                <gc-save-slot-list ref={loadRef} mode="load" selected-id="s1" />
                            </div>
                        </SectionCard>
                        <SectionCard title="Save mode">
                            <div style={{ maxWidth: 640 }}>
                                {/* @ts-ignore */}
                                <gc-save-slot-list ref={saveRef} mode="save" selected-id="s3" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SaveSlotListDemo
