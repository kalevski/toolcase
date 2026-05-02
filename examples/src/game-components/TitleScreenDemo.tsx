import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const TitleScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-title-screen" lede="Boot-time title with hero text and PRESS ANY KEY footer.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-title-screen title="EMBERFALL" subtitle="Chapter the Third" version="v 1.04.7 · Build 8821" />
            </div>
        </GcSection>
    </GcPage>
)

export default TitleScreenDemo
