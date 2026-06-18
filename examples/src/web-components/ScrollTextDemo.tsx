import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ScrollTextDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ScrollText"
                            description="Scrollable text panel with an optional mono uppercase title header. Drop any HTML content into the default slot."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Title + short passage">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-text scroll-title="Mission Briefing">
                                        Your target is deep inside the Eastern Quarter. Avoid the main
                                        boulevard — patrols have increased since last night. Use the
                                        maintenance tunnels below the market district.
                                    </tc-scroll-text>
                                </div>
                            </SectionCard>

                            <SectionCard title="Capped height (max-height) — scrollable">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-text scroll-title="Codex Entry" max-height="160">
                                        <p>
                                            The Ironwood Compact was founded in the third century of the
                                            Restoration, when seven merchant guilds agreed to share tariff
                                            tables and arbitration courts.
                                        </p>
                                        <p>
                                            It grew slowly at first — two decades passed before a sixth
                                            city agreed to join the common ledger. The turning point came
                                            with the Drought of 1214, when grain routes collapsed and only
                                            Compact members could redirect shipments fast enough to prevent
                                            famine.
                                        </p>
                                        <p>
                                            By the modern era the Compact controls more than a third of all
                                            inland waterway traffic and employs its own arbiters, surveyors,
                                            and a small but capable courier corps.
                                        </p>
                                    </tc-scroll-text>
                                </div>
                            </SectionCard>

                            <SectionCard title="No title — plain slot content">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-text>
                                        She had walked three continents before she turned eighteen. None
                                        of the maps she carried matched the roads she found.
                                    </tc-scroll-text>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom theme (ink border + ink text)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-scroll-text
                                        scroll-title="Warning"
                                        style={{
                                            '--bs-scroll-text-border-color': 'var(--tc-app-accent)',
                                            '--bs-scroll-text-header-color': 'var(--tc-app-accent)',
                                            '--bs-scroll-text-header-border-color': 'var(--tc-app-accent)',
                                            '--bs-scroll-text-body-color': 'var(--tc-text)',
                                        }}
                                    >
                                        Proceeding without a signed manifest will void all Compact
                                        protections. Ensure your papers are countersigned before
                                        departing the checkpoint.
                                    </tc-scroll-text>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScrollTextDemo
