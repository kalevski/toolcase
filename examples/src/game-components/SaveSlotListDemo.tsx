import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const SaveSlotListDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-save-slot-list" lede="Save / load list with thumbnails, character, location, and timestamps.">
        <GcSection title="Default">
            <gc-save-slot-list selected-id="1" slots={JSON.stringify([
                { id: '1', name: 'Ardyn the Warden', level: 47, where: 'Ravenmoor · Underdeep', time: '42h 18m', date: 'Today · 19:04', auto: false, thumb: 'A' },
                { id: '2', name: 'Lirien Ash-Caller', level: 28, where: 'The Pale March', time: '12h 03m', date: '2 days ago', auto: false, thumb: 'L' },
                { id: '3', empty: true },
                { id: '4', name: 'Cinder (Ironpath)', level: 60, where: 'Crown of Bone', time: '88h 55m', date: 'Last week', auto: true, thumb: 'C' },
            ])} />
        </GcSection>
    </GcPage>
)

export default SaveSlotListDemo
