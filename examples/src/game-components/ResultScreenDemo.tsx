import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ResultScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-result-screen" lede="Generic mission summary with title, stats, rewards, and actions.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-result-screen
                    title="MISSION COMPLETE"
                    subtitle="Cleared the Underdeep"
                    stats={JSON.stringify([
                        { label: 'Damage', value: '42,820' },
                        { label: 'Healing', value: '8,200' },
                        { label: 'Time', value: '07:14' },
                        { label: 'Score', value: '184,210' },
                    ])}
                />
            </div>
        </GcSection>
    </GcPage>
)

export default ResultScreenDemo
