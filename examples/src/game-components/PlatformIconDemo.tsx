import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PlatformIconDemo = () => (
    <GcPage category="Settings" title="gc-platform-icon" lede="Platform-tagged glyph + label.">
        <GcSection title="Platforms">
            <GcRow label="Steam">
                <gc-platform-icon platform="steam" label="Steam" />
            </GcRow>
            <GcRow label="Xbox">
                <gc-platform-icon platform="xbox" label="Xbox" />
            </GcRow>
            <GcRow label="PlayStation">
                <gc-platform-icon platform="playstation" label="PlayStation" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PlatformIconDemo
