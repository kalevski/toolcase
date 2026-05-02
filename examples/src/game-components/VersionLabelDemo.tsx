import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const VersionLabelDemo = () => (
    <GcPage category="Progression" title="gc-version-label" lede="Footer build / version mono label.">
        <GcSection title="Default">
            <GcRow label="Build">
                <gc-version-label>v 1.04.7 · Build 8821</gc-version-label>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default VersionLabelDemo
