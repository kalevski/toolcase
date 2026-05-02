import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const AchievementListDemo = () => (
    <GcPage category="Progression" title="gc-achievement-list" lede="Achievement rows with progress bar and points.">
        <GcSection title="Default">
            <gc-achievement-list achievements={JSON.stringify([
                { id: '1', name: 'Slayer of the Marrow King', desc: 'Defeat the king beneath the bone-orchard.', icon: '🏆', points: 250, unlocked: true },
                { id: '2', name: 'Soulbreaker', desc: 'Land 100 critical strikes in a single run.', icon: '✦', points: 50, progress: 64, target: 100 },
                { id: '3', name: 'Pale March', desc: 'Cross the Pale March without being detected.', icon: '🌙', points: 150, locked: true },
            ])} />
        </GcSection>
    </GcPage>
)

export default AchievementListDemo
