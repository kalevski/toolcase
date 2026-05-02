import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ScrollTextDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-scroll-text" lede="Lore card with optional title and dark inset background.">
        <GcSection title="Default">
            <GcRow label="With title">
                <div style={{ maxWidth: 460 }}>
                    <gc-scroll-text scroll-title="Wisdom of the road">
                        Hold the parry stance through a heavy strike to riposte. The riposte cannot be blocked — but neither can yours, if you are clumsy.
                    </gc-scroll-text>
                </div>
            </GcRow>
            <GcRow label="No title">
                <div style={{ maxWidth: 460 }}>
                    <gc-scroll-text>You walk where my brothers fell. The gate behind me drinks the names of the careless.</gc-scroll-text>
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ScrollTextDemo
