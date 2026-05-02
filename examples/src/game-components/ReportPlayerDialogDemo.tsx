import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ReportPlayerDialogDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState<{ reason: string, comment: string } | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const cancel = () => setOpen(false)
        const submit = (event: any) => { setLast(event.detail); setOpen(false) }
        el.addEventListener('cancel', cancel)
        el.addEventListener('submit', submit)
        return () => {
            el.removeEventListener('cancel', cancel)
            el.removeEventListener('submit', submit)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Report Player Dialog"
                        description="Report submission modal with reason radios and optional comment."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Open dialog — last submit: ${last ? `${last.reason}` : '—'}`} />
                            {/* @ts-ignore */}
                            <gc-metal-button variant="danger" onClick={() => setOpen(true)}>Report Player</gc-metal-button>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-report-player-dialog ref={ref} {...(open ? { open: '' } : {})} player-name="ShadowBlade42" />
        </div>
    )
}

export default ReportPlayerDialogDemo
