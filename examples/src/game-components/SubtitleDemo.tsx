import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const sceneStyle: React.CSSProperties = {
    background: 'radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%)',
    padding: '40px 20px',
    minHeight: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}

const SubtitleDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Subtitle"
                    description="Cinematic caption / dialogue. Props: text, speaker, boxed, align, fontSize, maxWidth."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Text only">
                        <div style={sceneStyle}>
                            {/* @ts-ignore */}
                            <gc-subtitle text="The wind carries voices older than the stones." />
                        </div>
                    </SectionCard>

                    <SectionCard title="With speaker">
                        <div style={sceneStyle}>
                            {/* @ts-ignore */}
                            <gc-subtitle
                                speaker="Voren"
                                text="Tread softly, stranger — the stones beneath you keep older debts than mine."
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title="Boxed variant">
                        {/* @ts-ignore */}
                        <gc-subtitle
                            boxed
                            speaker="Mira"
                            text="They came at dawn. We had no time to bury our dead."
                        />
                    </SectionCard>

                    <SectionCard title="Align left, narrower">
                        <div style={sceneStyle}>
                            {/* @ts-ignore */}
                            <gc-subtitle
                                align="left"
                                speaker="Narrator"
                                text="Three winters passed in silence."
                                font-size={16}
                                max-width={360}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title="Align right">
                        <div style={sceneStyle}>
                            {/* @ts-ignore */}
                            <gc-subtitle
                                align="right"
                                text="And so the gates were sealed."
                                font-size={20}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title="Hidden when text empty">
                        {/* @ts-ignore */}
                        <gc-subtitle />
                        <div style={{ fontFamily: 'var(--fg-mono)', fontSize: 11, color: 'var(--fg-parch-3)' }}>
                            Above renders nothing — element collapses when text is empty.
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default SubtitleDemo
