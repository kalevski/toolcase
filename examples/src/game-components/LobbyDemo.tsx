import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const LobbyDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-lobby" lede="Pre-match lobby with party slots, ready states, and host controls.">
        <GcSection title="Default">
            <div style={{ height: 500 }}>
                <gc-lobby
                    code="MIRE-7G2X"
                    map="Ravenmoor Underdeep"
                    slots={JSON.stringify([
                        { id: 'p1', name: 'Ardyn', glyph: 'A', host: true, ready: true, rank: 'GOLD III' },
                        { id: 'p2', name: 'Lirien', glyph: 'L', ready: true, rank: 'GOLD II' },
                        { id: 'p3', name: 'Bram', glyph: 'B', ready: false, rank: 'PLAT V' },
                        { id: 'p4' },
                    ])}
                />
            </div>
        </GcSection>
    </GcPage>
)

export default LobbyDemo
