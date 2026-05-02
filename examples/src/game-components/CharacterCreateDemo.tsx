import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CharacterCreateDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-character-create" lede="Form-style customization with name, class options, sliders.">
        <GcSection title="Default">
            <div style={{ height: 540 }}>
                <gc-character-create
                    name="Ardyn Thorne"
                    classes={JSON.stringify([
                        { id: 'warden', label: 'Warden' },
                        { id: 'caller', label: 'Ash-Caller' },
                        { id: 'iron', label: 'Ironpath' },
                    ])}
                    selected-class="warden"
                />
            </div>
        </GcSection>
    </GcPage>
)

export default CharacterCreateDemo
