import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const LetterboxBarsDemo = () => {
    const [show, setShow] = useState(false)

    return (
        <GcPage category="HUD — Display" title="gc-letterbox-bars" lede="Cinematic bars for cutscenes and dramatic transitions.">
            <GcSection title="Toggle">
                <GcRow label="Controls">
                    <button onClick={() => setShow((v) => !v)} style={{ padding: '6px 14px', marginBottom: 12 }}>
                        {show ? 'Hide bars' : 'Show bars'}
                    </button>
                    <div style={{ position: 'relative', height: 180, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(130deg, #274465, #5d2f40)' }}>
                        <gc-letterbox-bars show={show} bar-height="14%" duration="450" />
                    </div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default LetterboxBarsDemo
