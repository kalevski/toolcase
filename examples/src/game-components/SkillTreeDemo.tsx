import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const SkillTreeDemo = () => (
    <GcPage category="Progression" title="gc-skill-tree" lede="Talent tree with nodes, edges, ranks, and selectable detail.">
        <GcSection title="Default">
            <gc-skill-tree points={4} selected-id="d" nodes={JSON.stringify([
                { id: 'a', x: 50, y: 12, glyph: '⚔', rarity: 'legendary', state: 'owned' },
                { id: 'b', x: 22, y: 36, glyph: '✦', rarity: 'epic', state: 'owned' },
                { id: 'c', x: 78, y: 36, glyph: '🛡', rarity: 'epic', state: 'owned' },
                { id: 'd', x: 12, y: 60, glyph: '🔥', rarity: 'rare', state: 'available' },
                { id: 'e', x: 36, y: 60, glyph: '❄', rarity: 'rare', state: 'available' },
                { id: 'f', x: 64, y: 60, glyph: '☩', rarity: 'rare', state: 'locked' },
                { id: 'g', x: 88, y: 60, glyph: '☠', rarity: 'rare', state: 'locked' },
                { id: 'h', x: 30, y: 84, glyph: '✶', rarity: 'mythic', state: 'locked' },
                { id: 'i', x: 70, y: 84, glyph: '◉', rarity: 'mythic', state: 'locked' },
            ])} edges={JSON.stringify([
                ['a', 'b'], ['a', 'c'], ['b', 'd'], ['b', 'e'], ['c', 'f'], ['c', 'g'], ['d', 'h'], ['e', 'h'], ['f', 'i'], ['g', 'i'],
            ])} />
        </GcSection>
    </GcPage>
)

export default SkillTreeDemo
