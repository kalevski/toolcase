import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CircularProgressDemo = () => (
    <GcPage category="HUD — Resource Bars" title="gc-circular-progress" lede="A circular arc progress indicator with optional central text label.">
        <GcSection title="Sizes">
            <GcRow label="Small (48)">
                <gc-stack direction="horizontal" gap="16px">
                    <gc-circular-progress value="0.9" max="1" size="48" thickness="4" show-text />
                    <gc-circular-progress value="0.5" max="1" size="48" thickness="4" color="var(--gc-warning)" show-text />
                    <gc-circular-progress value="0.2" max="1" size="48" thickness="4" color="var(--gc-danger)" show-text />
                </gc-stack>
            </GcRow>
            <GcRow label="Medium (72)">
                <gc-stack direction="horizontal" gap="16px">
                    <gc-circular-progress value="0.75" max="1" size="72" thickness="6" show-text />
                    <gc-circular-progress value="0.4" max="1" size="72" thickness="6" color="var(--gc-gold)" show-text />
                </gc-stack>
            </GcRow>
        </GcSection>
        <GcSection title="Without text">
            <GcRow label="Clean arc">
                <gc-stack direction="horizontal" gap="12px">
                    <gc-circular-progress value="1" max="1" size="40" thickness="4" />
                    <gc-circular-progress value="0.66" max="1" size="40" thickness="4" />
                    <gc-circular-progress value="0.33" max="1" size="40" thickness="4" />
                    <gc-circular-progress value="0.1" max="1" size="40" thickness="4" />
                </gc-stack>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default CircularProgressDemo
