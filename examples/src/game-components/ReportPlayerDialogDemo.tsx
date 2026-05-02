import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ReportPlayerDialogDemo = () => {
    const [open, setOpen] = useState(false)
    return (
        <GcPage category="Social" title="gc-report-player-dialog" lede="Confirm-style dialog for filing a player report.">
            <GcSection title="Live demo">
                <GcRow label="Trigger">
                    <button onClick={() => setOpen(true)} style={{ padding: '6px 12px' }}>Open report dialog</button>
                </GcRow>
            </GcSection>
            <gc-report-player-dialog
                open={open || undefined}
                player-name="Loud_Rogue42"
                reasons={JSON.stringify(['Cheating', 'Harassment', 'Inappropriate name', 'AFK'])}
                onCancel={() => setOpen(false)}
                onSubmit={() => setOpen(false)}
            />
        </GcPage>
    )
}

export default ReportPlayerDialogDemo
