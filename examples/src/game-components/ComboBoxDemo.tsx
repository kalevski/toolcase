import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ComboBoxDemo = () => (
    <GcPage category="Inputs" title="gc-combo-box" lede="A native-styled select dropdown designed for dark game UI panels.">
        <GcSection title="Options">
            <GcRow label="Language">
                <gc-combo-box options={JSON.stringify([
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'French' },
                    { value: 'es', label: 'Spanish' },
                    { value: 'jp', label: 'Japanese' },
                    { value: 'de', label: 'German' },
                ])} value="en" placeholder="Pick language" />
            </GcRow>
            <GcRow label="Resolution">
                <gc-combo-box options={JSON.stringify([
                    { value: '1080p', label: '1920 × 1080 (FHD)' },
                    { value: '1440p', label: '2560 × 1440 (QHD)' },
                    { value: '4k', label: '3840 × 2160 (4K)' },
                ])} value="1440p" />
            </GcRow>
            <GcRow label="Placeholder">
                <gc-combo-box options={JSON.stringify([
                    { value: 'a', label: 'Option A' },
                    { value: 'b', label: 'Option B' },
                ])} placeholder="Choose..." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ComboBoxDemo
