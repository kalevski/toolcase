import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const AspectRatioBoxDemo = () => (
    <GcPage category="Layout" title="gc-aspect-ratio-box" lede="Wraps slotted content and enforces a CSS aspect-ratio constraint.">
        <GcSection title="Ratios">
            <GcRow label="16 / 9">
                <div style={{ width: 300 }}>
                    <gc-aspect-ratio-box ratio="16/9">
                        <div style={{ width: '100%', height: '100%', background: 'rgba(106,169,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec', fontSize: 14 }}>16 : 9</div>
                    </gc-aspect-ratio-box>
                </div>
            </GcRow>
            <GcRow label="4 / 3">
                <div style={{ width: 200 }}>
                    <gc-aspect-ratio-box ratio="4/3">
                        <div style={{ width: '100%', height: '100%', background: 'rgba(255,211,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec', fontSize: 14 }}>4 : 3</div>
                    </gc-aspect-ratio-box>
                </div>
            </GcRow>
            <GcRow label="1 / 1">
                <div style={{ width: 120 }}>
                    <gc-aspect-ratio-box ratio="1/1">
                        <div style={{ width: '100%', height: '100%', background: 'rgba(58,162,86,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec', fontSize: 14 }}>1 : 1</div>
                    </gc-aspect-ratio-box>
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default AspectRatioBoxDemo
