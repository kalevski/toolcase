import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const PartyPanelDemo = () => (
    <GcPage category="Social" title="gc-party-panel" lede="Roster of party members with role, ready status, and host marker.">
        <GcSection title="Default">
            <gc-party-panel
                eyebrow="Fellowship"
                name="The Hollow Four"
                members={JSON.stringify([
                    { id: '1', name: 'Ardyn', role: 'Warden', glyph: 'A', host: true, status: 'var(--fg-stamina-bright)' },
                    { id: '2', name: 'Lirien', role: 'Ash-Caller', glyph: 'L', status: 'var(--fg-stamina-bright)' },
                    { id: '3', name: 'Bram', role: 'Ironpath', glyph: 'B', status: 'var(--fg-legendary)' },
                    { id: '4', name: 'Sera', role: 'Verdant', glyph: 'S', status: 'var(--fg-blood-bright)' },
                ])}
            />
        </GcSection>
    </GcPage>
)

export default PartyPanelDemo
