import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ArtboardBackdropDemo = () => (
    <GcPage category="HUD — Composites" title="gc-artboard-backdrop" lede="Themed dev backdrop with three modes: dark, scene, parch.">
        <GcSection title="Modes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ height: 140 }}>
                    <gc-artboard-backdrop kind="dark"><span style={{ color: '#e6e8ec' }}>dark</span></gc-artboard-backdrop>
                </div>
                <div style={{ height: 140 }}>
                    <gc-artboard-backdrop kind="scene"><span style={{ color: '#e6e8ec' }}>scene</span></gc-artboard-backdrop>
                </div>
                <div style={{ height: 140 }}>
                    <gc-artboard-backdrop kind="parch"><span style={{ color: '#1a140d' }}>parch</span></gc-artboard-backdrop>
                </div>
            </div>
        </GcSection>
    </GcPage>
)

export default ArtboardBackdropDemo
