import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const GraphicsPresetPickerDemo = () => (
    <GcPage category="Settings" title="gc-graphics-preset-picker" lede="Quality preset selector.">
        <GcSection title="Default">
            <GcRow label="Preset">
                <gc-graphics-preset-picker row-label="Graphics" value="high" options={JSON.stringify([
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'ultra', label: 'Ultra' },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default GraphicsPresetPickerDemo
