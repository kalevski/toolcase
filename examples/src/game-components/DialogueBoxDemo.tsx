import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const LINES = [
    { speaker: 'Old Sage', text: 'Long have I waited at this gate, traveller. The ash falls thick this season.' },
    { speaker: 'Old Sage', text: 'You wear the mark of the Gilded Hand. Tell me — do you seek council, or coin?' },
]

const CHOICES = [
    { id: 'council', label: 'I seek your council.' },
    { id: 'coin', label: 'I seek coin, nothing more.' },
    { id: 'leave', label: 'Leave silently.', disabled: true },
]

const DialogueBoxDemo: React.FC = () => {
    const refLine = useRef<HTMLElement>(null)
    const refChoice = useRef<HTMLElement>(null)
    const [idx, setIdx] = useState(0)
    const [picked, setPicked] = useState('')

    useEffect(() => {
        const el: any = refChoice.current
        if (el) el.choices = CHOICES
    }, [])

    useEffect(() => {
        const el = refLine.current
        if (!el) return
        const handler = () => setIdx((n) => (n + 1) % LINES.length)
        el.addEventListener('advance', handler)
        return () => el.removeEventListener('advance', handler)
    }, [])

    useEffect(() => {
        const el = refChoice.current
        if (!el) return
        const handler = (event: any) => setPicked(event.detail.id)
        el.addEventListener('choice', handler)
        return () => el.removeEventListener('choice', handler)
    }, [])

    const line = LINES[idx]

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Dialogue Box"
                        description="Typing-animated dialogue. Click skips/advances. Choices replace advance."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Click-to-advance" />
                            {/* @ts-ignore */}
                            <gc-dialogue-box ref={refLine} speaker={line.speaker} text={line.text} typing-speed="40" />
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title={`With choices — picked: ${picked || '—'}`} />
                            {/* @ts-ignore */}
                            <gc-dialogue-box
                                ref={refChoice}
                                speaker="Old Sage"
                                text="The path forks here, traveller. Choose carefully."
                                typing-speed="50"
                            />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DialogueBoxDemo
