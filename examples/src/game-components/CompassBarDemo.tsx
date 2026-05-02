import { useState, useEffect } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CompassBarDemo = () => {
    const [heading, setHeading] = useState(0)
    const [live, setLive] = useState(true)

    useEffect(() => {
        if (!live) return
        const id = window.setInterval(() => setHeading((h) => (h + 1) % 360), 50)
        return () => window.clearInterval(id)
    }, [live])

    return (
        <GcPage category="HUD — Navigation" title="gc-compass-bar" lede="A horizontal compass strip showing cardinal headings and custom map markers.">
            <GcSection title="Live rotation" caption="Toggle the animation or drag the slider.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <gc-compass-bar heading={heading} fov="120" markers={JSON.stringify([
                        { id: 'q1', heading: 45, color: '#ffd35a', icon: '◆', label: 'Quest' },
                        { id: 'p1', heading: 200, color: '#3aa256', icon: '▼', label: 'Ally' },
                        { id: 'e1', heading: 290, color: '#d23a3a', icon: '▲', label: 'Enemy' },
                    ])} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="range" min={0} max={359} value={heading} onChange={(e) => { setLive(false); setHeading(Number(e.target.value)) }} style={{ width: 200 }} />
                        <button onClick={() => setLive((v) => !v)} style={{ padding: '4px 10px' }}>{live ? 'Pause' : 'Animate'}</button>
                        <span style={{ color: 'rgba(230,232,236,0.55)', fontSize: 12 }}>{heading}°</span>
                    </div>
                </div>
            </GcSection>
            <GcSection title="Narrow FOV (60°)">
                <GcRow label="Tight view">
                    <gc-compass-bar heading={45} fov="60" markers={JSON.stringify([
                        { id: 'q', heading: 50, color: '#ffd35a', icon: '★' },
                    ])} />
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default CompassBarDemo
