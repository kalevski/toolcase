import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CharacterSelectDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-character-select" lede="Pick from a roster with portraits and per-class stats.">
        <GcSection title="Default">
            <div style={{ height: 540 }}>
                <gc-character-select selected-id="warden" classes={JSON.stringify([
                    { id: 'warden', name: 'Warden', role: 'Tank', glyph: '🛡', desc: 'Holds the line with shield and oath.', stats: [{ label: 'STR', value: 0.9 }, { label: 'AGI', value: 0.4 }] },
                    { id: 'caller', name: 'Ash-Caller', role: 'DPS', glyph: '✦', desc: 'Bends fire and ash to her will.', stats: [{ label: 'INT', value: 0.95 }, { label: 'AGI', value: 0.5 }] },
                    { id: 'iron', name: 'Ironpath', role: 'Bruiser', glyph: '⚒', desc: 'Walks the Path of Steel and Smoke.', stats: [{ label: 'STR', value: 0.85 }, { label: 'CON', value: 0.85 }] },
                    { id: 'verdant', name: 'Verdant', role: 'Healer', glyph: '🌿', desc: 'Speaks with roots and rain.', stats: [{ label: 'WIS', value: 0.9 }, { label: 'INT', value: 0.55 }], locked: true },
                ])} />
            </div>
        </GcSection>
    </GcPage>
)

export default CharacterSelectDemo
