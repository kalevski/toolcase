import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CreditsListDemo = () => (
    <GcPage category="Progression" title="gc-credits-list" lede="Static role / name pair list.">
        <GcSection title="Default">
            <gc-credits-list credits={JSON.stringify([
                { role: 'Direction', names: ['Ardyn Thorne'] },
                { role: 'Programming', names: ['Lirien Ash-Caller', 'Bram'] },
                { role: 'Art', names: ['Sera', 'Cinder'] },
            ])} />
        </GcSection>
    </GcPage>
)

export default CreditsListDemo
