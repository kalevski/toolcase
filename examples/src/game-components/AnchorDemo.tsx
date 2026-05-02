import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const AnchorDemo = () => (
    <GcPage category="Layout" title="gc-anchor" lede="Pins slotted content to a position inside a bounded area.">
        <GcSection title="Positions" caption="Top-left, center, and bottom-right examples.">
            <div style={{ position: 'relative', width: '100%', minHeight: 260, border: '1px dashed rgba(255,255,255,0.16)', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                <gc-anchor position="top-left" inset="12px"><span style={{ color: '#9ec4ff' }}>Top Left</span></gc-anchor>
                <gc-anchor position="center" inset="12px"><span style={{ color: '#ffd27a' }}>Center</span></gc-anchor>
                <gc-anchor position="bottom-right" inset="12px"><span style={{ color: '#7ce8b4' }}>Bottom Right</span></gc-anchor>
            </div>
        </GcSection>
    </GcPage>
)

export default AnchorDemo
