import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const MatchmakingScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-matchmaking-screen" lede="Searching state with spinner, queue stats, and accept controls.">
        <GcSection title="Searching">
            <div style={{ height: 360 }}>
                <gc-matchmaking-screen title="Searching for match" state="searching" elapsed="00:42" players={3} max-players={4} />
            </div>
        </GcSection>
    </GcPage>
)

export default MatchmakingScreenDemo
