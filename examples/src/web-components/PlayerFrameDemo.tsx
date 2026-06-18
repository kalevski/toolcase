import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PlayerFrameDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [hp, setHp] = useState(75)
    const [mp, setMp] = useState(60)

    // Wire live-update demo
    useEffect(() => {
        const el = liveRef.current
        if (!el) return
        el.setAttribute('hp', String(hp))
    }, [hp])

    useEffect(() => {
        const el = liveRef.current
        if (!el) return
        el.setAttribute('mp', String(mp))
    }, [mp])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PlayerFrame"
                            description="Player nameplate / HUD frame combining a portrait tile, player name, optional class label, and resource bars (HP, MP, Stamina). Port of gc-player-frame, restyled to the toolcase design system."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default — HP bar only">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-player-frame
                                        name="Aria"
                                        glyph="⚔️"
                                        level="12"
                                        hp="75"
                                        hp-max="100"
                                        style={{ width: '280px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-player-frame
                                        name="Kestrel"
                                        glyph="🏹"
                                        hp="42"
                                        hp-max="80"
                                        style={{ width: '280px' }}
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="With class label and level">
                                {/* @ts-ignore */}
                                <tc-player-frame
                                    name="Vesper"
                                    class-name="Arcane Mage"
                                    glyph="🔮"
                                    level="34"
                                    hp="90"
                                    hp-max="120"
                                    style={{ width: '300px' }}
                                />
                            </SectionCard>

                            <SectionCard title="HP + MP bars (show-mp)">
                                {/* @ts-ignore */}
                                <tc-player-frame
                                    name="Solara"
                                    class-name="Paladin"
                                    glyph="🛡️"
                                    level="28"
                                    hp="88"
                                    hp-max="150"
                                    mp="55"
                                    mp-max="100"
                                    show-mp=""
                                    style={{ width: '300px' }}
                                />
                            </SectionCard>

                            <SectionCard title="HP + MP + Stamina bars (show-mp + show-stamina)">
                                {/* @ts-ignore */}
                                <tc-player-frame
                                    name="Cindrix"
                                    class-name="Berserker"
                                    glyph="🪓"
                                    level="51"
                                    hp="110"
                                    hp-max="200"
                                    mp="20"
                                    mp-max="60"
                                    stamina="80"
                                    stamina-max="100"
                                    show-mp=""
                                    show-stamina=""
                                    style={{ width: '300px' }}
                                />
                            </SectionCard>

                            <SectionCard title="Critical health (low HP)">
                                {/* @ts-ignore */}
                                <tc-player-frame
                                    name="Onyx"
                                    class-name="Rogue"
                                    glyph="🗡️"
                                    level="19"
                                    hp="8"
                                    hp-max="90"
                                    show-mp=""
                                    mp="70"
                                    mp-max="80"
                                    style={{ width: '300px' }}
                                />
                            </SectionCard>

                            <SectionCard title="Live update via attributes">
                                <div className="mb-3 d-flex flex-column gap-2" style={{ maxWidth: '300px' }}>
                                    {/* @ts-ignore */}
                                    <tc-player-frame
                                        ref={liveRef}
                                        name="DemoPlayer"
                                        class-name="Fighter"
                                        glyph="⚔️"
                                        level="7"
                                        hp="75"
                                        hp-max="100"
                                        mp="60"
                                        mp-max="100"
                                        show-mp=""
                                    />
                                </div>
                                <div className="d-flex flex-column gap-2 mt-2" style={{ maxWidth: '300px' }}>
                                    <label className="form-label mb-0">
                                        HP: <strong>{hp}</strong> / 100
                                    </label>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min={0}
                                        max={100}
                                        value={hp}
                                        onChange={e => setHp(Number(e.target.value))}
                                    />
                                    <label className="form-label mb-0">
                                        MP: <strong>{mp}</strong> / 100
                                    </label>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min={0}
                                        max={100}
                                        value={mp}
                                        onChange={e => setMp(Number(e.target.value))}
                                    />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlayerFrameDemo
