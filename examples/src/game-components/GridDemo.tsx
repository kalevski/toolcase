import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const GridDemo = () => (
    <GcPage category="Layout" title="gc-grid" lede="A CSS grid wrapper for slotted children with configurable columns and gap.">
        <GcSection title="Column counts">
            <GcRow label="4 × 2">
                <gc-grid columns="4" gap="4px">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} style={{ padding: 8, background: 'rgba(106,169,255,0.12)', color: '#e6e8ec', textAlign: 'center', borderRadius: 3 }}>{i + 1}</span>
                    ))}
                </gc-grid>
            </GcRow>
            <GcRow label="3 columns">
                <gc-grid columns="3" gap="8px">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} style={{ padding: 10, background: 'rgba(255,211,90,0.1)', color: '#e6e8ec', textAlign: 'center', borderRadius: 3 }}>{i + 1}</span>
                    ))}
                </gc-grid>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default GridDemo
