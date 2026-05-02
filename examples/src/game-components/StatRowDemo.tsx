import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const StatRowDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-stat-row" lede="Label + value with optional trend arrow. Used in tooltips and stats panels.">
        <GcSection title="Stats">
            <div style={{ width: 260 }}>
                <gc-stat-row label="Damage" value="184–212" trend={18} />
                <gc-stat-row label="Crit" value="14% / x2.4" />
                <gc-stat-row label="Weight" value="9.4" trend={-2} />
                <gc-stat-row label="Resist" value="32%" accent="var(--fg-mana-bright)" />
            </div>
        </GcSection>
    </GcPage>
)

export default StatRowDemo
