import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const NavButtonDemo = () => (
    <GcPage category="Inputs" title="gc-nav-button" lede="Directional menu action button for back and close affordances.">
        <GcSection title="Kinds">
            <GcRow label="Back">
                <gc-nav-button kind="back" label="Back" />
            </GcRow>
            <GcRow label="Close">
                <gc-nav-button kind="close" label="Close" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default NavButtonDemo
