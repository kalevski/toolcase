import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ControllerLayoutPreviewDemo = () => (
    <GcPage category="Settings" title="gc-controller-layout-preview" lede="Diagram of the active controller layout.">
        <GcSection title="Default">
            <gc-controller-layout-preview layout="xbox" />
        </GcSection>
    </GcPage>
)

export default ControllerLayoutPreviewDemo
