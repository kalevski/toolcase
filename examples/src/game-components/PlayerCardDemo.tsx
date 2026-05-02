import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const PlayerCardDemo = () => (
    <GcPage category="Social" title="gc-player-card" lede="Profile card with portrait, name, title, stats, and actions.">
        <GcSection title="Default">
            <gc-player-card name="Ardyn Thorne" title="Warden of the Hollow" glyph="A" status="online" status-color="var(--fg-stamina-bright)"
                meta={JSON.stringify(['Lv 47', 'GOLD III'])}
                stats={JSON.stringify([
                    { label: 'Hours', value: '420' },
                    { label: 'K/D', value: '2.4' },
                    { label: 'W/L', value: '64%' },
                ])}
                actions={JSON.stringify([
                    { id: 'invite', label: 'Invite', variant: 'normal' },
                    { id: 'whisper', label: 'Whisper', variant: 'normal' },
                    { id: 'block', label: 'Block', variant: 'danger' },
                ])} />
        </GcSection>
    </GcPage>
)

export default PlayerCardDemo
