import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const SelectRowDemo = () => (
    <GcPage category="Settings" title="gc-select-row" lede="Setting row with a labeled native select.">
        <GcSection title="Defaults">
            <GcRow label="Language">
                <gc-select-row row-label="Language" value="en" options={JSON.stringify([
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'Français' },
                    { value: 'de', label: 'Deutsch' },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default SelectRowDemo
