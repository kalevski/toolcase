import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ScrollTextDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="ScrollText"
                    description="Vertical lore block with optional gold scrollTitle. Slot for body."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="With scrollTitle">
                        {/* @ts-ignore */}
                        <gc-scroll-text scroll-title="Codex Entry">
                            The Wyrmking sleeps beneath the salt flats, his breath the slow tide
                            that draws the sea from the cliffs each century. Only when the moon
                            twins above the Watchtower does he stir.
                        {/* @ts-ignore */}
                        </gc-scroll-text>
                    </SectionCard>

                    <SectionCard title="No title">
                        {/* @ts-ignore */}
                        <gc-scroll-text>
                            A pact written in iron cannot be unwritten in flesh.
                        {/* @ts-ignore */}
                        </gc-scroll-text>
                    </SectionCard>

                    <SectionCard title="Long body">
                        {/* @ts-ignore */}
                        <gc-scroll-text scroll-title="The Long Dusk">
                            They named the river for the blood it carried, and the bridge for the
                            woman who threw herself from it to break the siege. Neither name was
                            chosen by those who lived there. Neither name was changed when the war
                            ended. The dead, it is said, do not require new titles.
                        {/* @ts-ignore */}
                        </gc-scroll-text>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default ScrollTextDemo
