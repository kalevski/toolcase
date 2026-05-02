import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const StatsScreenDemo = () => (
    <GcPage category="Progression" title="gc-stats-screen" lede="Career-stats dashboard grouped by section.">
        <GcSection title="Default">
            <gc-stats-screen
                title-text="Lifetime Stats"
                summary="Across all sagas and seasons."
                sections={JSON.stringify([
                    { title: 'Combat', stats: [
                        { label: 'Damage', value: '4.2M' }, { label: 'K/D', value: '2.4' }, { label: 'Crits', value: '38,420' },
                    ]},
                    { title: 'Time', stats: [
                        { label: 'Hours', value: '420' }, { label: 'Sessions', value: '188' }, { label: 'Longest', value: '8h 14m' },
                    ]},
                ])}
            />
        </GcSection>
    </GcPage>
)

export default StatsScreenDemo
