import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const VictoryScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-victory-screen" lede="Success result screen in legendary palette.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-victory-screen
                    title="VICTORY"
                    subtitle="The Marrow King has fallen · 12:48 of campaign"
                    stats={JSON.stringify([
                        { label: 'Damage', value: '184,820' },
                        { label: 'Healing', value: '32,400' },
                        { label: 'Kills', value: '38' },
                        { label: 'Deaths', value: '1' },
                    ])}
                    rewards={JSON.stringify([
                        { icon: '◆', label: '+250 Arcane' },
                        { icon: '⚔', label: 'Maw of the Hollow Crown' },
                    ])}
                    actions={JSON.stringify([
                        { id: 'title', label: 'Title Screen', variant: 'secondary' },
                        { id: 'next', label: 'Next Chapter', variant: 'primary' },
                    ])}
                />
            </div>
        </GcSection>
    </GcPage>
)

export default VictoryScreenDemo
