import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const StackDemo = () => (
    <GcPage category="Layout" title="gc-stack" lede="A flexbox row or column with a uniform gap between slotted children.">
        <GcSection title="Direction">
            <GcRow label="Horizontal">
                <gc-stack direction="horizontal" gap="8px">
                    {['A', 'B', 'C', 'D'].map((l) => (
                        <span key={l} style={{ padding: '6px 12px', background: 'rgba(106,169,255,0.15)', color: '#e6e8ec', borderRadius: 3 }}>{l}</span>
                    ))}
                </gc-stack>
            </GcRow>
            <GcRow label="Vertical">
                <gc-stack direction="vertical" gap="6px">
                    {['Item 1', 'Item 2', 'Item 3'].map((l) => (
                        <span key={l} style={{ padding: '6px 12px', background: 'rgba(106,169,255,0.15)', color: '#e6e8ec', borderRadius: 3 }}>{l}</span>
                    ))}
                </gc-stack>
            </GcRow>
        </GcSection>
        <GcSection title="Gap sizes">
            <GcRow label="gap 4px">
                <gc-stack direction="horizontal" gap="4px">
                    {[1, 2, 3].map((n) => <span key={n} style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.1)', display: 'inline-block' }} />)}
                </gc-stack>
            </GcRow>
            <GcRow label="gap 16px">
                <gc-stack direction="horizontal" gap="16px">
                    {[1, 2, 3].map((n) => <span key={n} style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.1)', display: 'inline-block' }} />)}
                </gc-stack>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default StackDemo
