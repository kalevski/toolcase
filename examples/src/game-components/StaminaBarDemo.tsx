import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const StaminaBarDemo = () => (
    <GcPage category="HUD — Resource Bars" title="gc-stamina-bar" lede="A stamina / endurance bar, typically used for sprinting or blocking actions.">
        <GcSection title="Variants">
            <GcRow label="Full">
                <div style={{ width: 220 }}><gc-stamina-bar value={100} max={100} show-text /></div>
            </GcRow>
            <GcRow label="Draining">
                <div style={{ width: 220 }}><gc-stamina-bar value={45} max={100} /></div>
            </GcRow>
            <GcRow label="Exhausted">
                <div style={{ width: 220 }}><gc-stamina-bar value={5} max={100} /></div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default StaminaBarDemo
