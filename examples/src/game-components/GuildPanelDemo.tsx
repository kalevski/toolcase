import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const GuildPanelDemo = () => (
    <GcPage category="Social" title="gc-guild-panel" lede="Guild header + member roster with ranks.">
        <GcSection title="Default">
            <gc-guild-panel
                guild-name="Wardens of the Hollow"
                motto="By bone and bramble we hold."
                meta="Founded 1422 · 38 members"
                members={JSON.stringify([
                    { id: '1', name: 'Ardyn', rank: 'Master', status: 'var(--fg-stamina-bright)' },
                    { id: '2', name: 'Lirien', rank: 'Officer', status: 'var(--fg-stamina-bright)' },
                    { id: '3', name: 'Bram', rank: 'Officer', status: 'var(--fg-legendary)' },
                    { id: '4', name: 'Sera', rank: 'Member', status: 'rgba(184,164,126,0.4)' },
                ])}
            />
        </GcSection>
    </GcPage>
)

export default GuildPanelDemo
