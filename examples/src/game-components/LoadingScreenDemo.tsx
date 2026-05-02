import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const LoadingScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-loading-screen" lede="Full-screen loading view with eyebrow, title, lore tip card, and progress bar.">
        <GcSection title="Default">
            <div style={{ height: 380 }}>
                <gc-loading-screen
                    eyebrow="Loading the Mire"
                    title-text="Ravenmoor Underdeep"
                    label="Forging World"
                    progress={0.62}
                    tip-title="Wisdom of the road"
                    tips={JSON.stringify([
                        'Hold the parry stance through a heavy strike to riposte. The riposte cannot be blocked.',
                    ])}
                />
            </div>
        </GcSection>
    </GcPage>
)

export default LoadingScreenDemo
