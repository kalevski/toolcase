import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const MuteListDemo = () => (
    <GcPage category="Social" title="gc-mute-list" lede="Players you have muted, with unmute action.">
        <GcSection title="Default">
            <gc-mute-list muted={JSON.stringify([
                { id: '1', name: 'Loud_Rogue42', reason: 'Voice chat' },
                { id: '2', name: 'TextSpammer', reason: 'Text chat' },
            ])} />
        </GcSection>
    </GcPage>
)

export default MuteListDemo
