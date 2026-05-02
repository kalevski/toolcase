import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const KillFeedDemo = () => (
    <GcPage category="HUD — Communications" title="gc-kill-feed" lede="A timed kill-feed strip showing recent elimination events with optional headshot indicator.">
        <GcSection title="Default">
            <GcRow label="Recent kills">
                <gc-kill-feed entries={JSON.stringify([
                    { id: '1', killerName: 'SniperAce', victimName: 'Bot42', weapon: '🎯', headshot: true },
                    { id: '2', killerName: 'You', victimName: 'Bot17', weapon: '🔫' },
                    { id: '3', killerName: 'Bot07', victimName: 'TankGuy', weapon: '💣' },
                    { id: '4', killerName: 'MageX', victimName: 'You', weapon: '⚡', headshot: false },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default KillFeedDemo
