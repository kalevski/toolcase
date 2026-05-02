import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ConfirmDialogDemo = () => {
    const [open, setOpen] = useState(false)
    return (
        <GcPage category="Menus & Dialogs" title="gc-confirm-dialog" lede="Centered confirmation dialog with eyebrow, title, divider, message, and actions.">
            <GcSection title="Live demo">
                <GcRow label="Trigger">
                    <button onClick={() => setOpen(true)} style={{ padding: '6px 12px' }}>Abandon run…</button>
                </GcRow>
            </GcSection>
            <gc-confirm-dialog
                open={open || undefined}
                eyebrow="Abandon Run"
                dialog-title="Forsake the Vault?"
                message="Unbanked relics will be lost to the dark. Your shards will reset to the last bonfire."
                confirm-label="Forsake"
                cancel-label="Stay"
                danger
                onCancel={() => setOpen(false)}
                onConfirm={() => setOpen(false)}
            />
        </GcPage>
    )
}

export default ConfirmDialogDemo
