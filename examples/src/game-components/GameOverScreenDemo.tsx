import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const GameOverScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-game-over-screen" lede="Failure result screen in blood palette.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-game-over-screen
                    title="YOU DIED"
                    subtitle="Felled by the Marrow King · 03:14 of campaign"
                    actions={JSON.stringify([
                        { id: 'title', label: 'Title Screen', variant: 'secondary' },
                        { id: 'retry', label: 'Try Again', variant: 'primary' },
                    ])}
                />
            </div>
        </GcSection>
    </GcPage>
)

export default GameOverScreenDemo
