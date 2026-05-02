import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ScoreDisplayDemo = () => {
    const [score, setScore] = useState(12345)

    return (
        <GcPage category="HUD — Display" title="gc-score-display" lede="An animated score counter with optional multiplier and label.">
            <GcSection title="Variants">
                <GcRow label="With multiplier">
                    <gc-score-display score={score} multiplier="3" label="Score" />
                </GcRow>
                <GcRow label="No multiplier">
                    <gc-score-display score={score} label="Points" />
                </GcRow>
                <GcRow label="No label">
                    <gc-score-display score={score} />
                </GcRow>
            </GcSection>
            <GcSection title="Change score">
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setScore((v) => v + 100)} style={{ padding: '6px 12px' }}>+100</button>
                    <button onClick={() => setScore((v) => v + 1000)} style={{ padding: '6px 12px' }}>+1000</button>
                    <button onClick={() => setScore(0)} style={{ padding: '6px 12px' }}>Reset</button>
                </div>
            </GcSection>
        </GcPage>
    )
}

export default ScoreDisplayDemo
