import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const AbilityCardDemo = () => (
    <GcPage category="Progression" title="gc-ability-card" lede="Ability detail card with icon, description, and meta tags.">
        <GcSection title="Default">
            <gc-ability-card
                name="Marrow Drink"
                icon="🩸"
                keybind="LMB"
                description="On crit, restore 4% HP and gain Bloodfever for 6s."
                meta={JSON.stringify(['Cooldown 18s', 'Cost 22 MP', 'Range 6m'])}
                color="var(--fg-blood-bright)"
            />
        </GcSection>
    </GcPage>
)

export default AbilityCardDemo
