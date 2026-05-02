import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CreditsScrollDemo = () => (
    <GcPage category="Progression" title="gc-credits-scroll" lede="Auto-scrolling end credits roll.">
        <GcSection title="Default">
            <div style={{ height: 360 }}>
                <gc-credits-scroll title-text="EMBERFALL" duration={20000} credits={JSON.stringify([
                    { role: 'Direction', names: ['Ardyn Thorne'] },
                    { role: 'Programming', names: ['Lirien Ash-Caller', 'Bram'] },
                    { role: 'Art', names: ['Sera', 'Cinder'] },
                    { role: 'Music', names: ['The Pale Choir'] },
                ])} />
            </div>
        </GcSection>
    </GcPage>
)

export default CreditsScrollDemo
