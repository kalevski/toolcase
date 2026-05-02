import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const FriendsListDemo = () => (
    <GcPage category="Social" title="gc-friends-list" lede="Friend roster with online state, activity, and per-row actions.">
        <GcSection title="Default">
            <gc-friends-list eyebrow="Friends · 4 / 12 online" friends={JSON.stringify([
                { id: '1', name: 'Lirien', glyph: 'L', status: 'online', activity: 'In Ravenmoor' },
                { id: '2', name: 'Bram', glyph: 'B', status: 'online', activity: 'Lobby' },
                { id: '3', name: 'Sera', glyph: 'S', status: 'away', activity: 'Idle 12m' },
                { id: '4', name: 'Cinder', glyph: 'C', status: 'offline', activity: 'Last seen 2h ago' },
            ])} />
        </GcSection>
    </GcPage>
)

export default FriendsListDemo
