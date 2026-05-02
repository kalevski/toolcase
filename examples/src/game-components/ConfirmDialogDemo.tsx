import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ConfirmDialogDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [danger, setDanger] = useState(false)
    const [last, setLast] = useState<string>('—')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const cancel = () => { setLast('cancel'); setOpen(false) }
        const confirm = () => { setLast('confirm'); setOpen(false) }
        el.addEventListener('cancel', cancel)
        el.addEventListener('confirm', confirm)
        return () => {
            el.removeEventListener('cancel', cancel)
            el.removeEventListener('confirm', confirm)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Confirm Dialog"
                        description="Modal yes/no dialog. Enter confirms, Escape cancels."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Action — last: ${last}`} />
                            <div className="d-flex gap-3">
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={() => { setDanger(false); setOpen(true) }}>Open primary</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger" onClick={() => { setDanger(true); setOpen(true) }}>Open danger</gc-metal-button>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-confirm-dialog
                ref={ref}
                {...(open ? { open: '' } : {})}
                {...(danger ? { danger: '' } : {})}
                eyebrow={danger ? 'Warning' : 'Confirm'}
                dialog-title={danger ? 'Delete this save?' : 'Continue?'}
                message={danger ? 'This action is permanent and cannot be undone.' : 'Your unsaved progress will be lost.'}
                confirm-label={danger ? 'Delete' : 'Continue'}
                cancel-label="Cancel"
            />
        </div>
    )
}

export default ConfirmDialogDemo
