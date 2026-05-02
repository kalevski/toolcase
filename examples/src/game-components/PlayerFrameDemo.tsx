import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PlayerFrameDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Player Frame"
                    description="Portrait + name/class + HP, with optional MP and stamina bars."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="HP only" />
                        {/* @ts-ignore */}
                        <gc-player-frame name="Astrid" class-name="Bladewarden" glyph="A" level={42} hp={86} hp-max={120} />
                    {/* @ts-ignore */}
                    </gc-panel>
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="HP + MP" />
                        {/* @ts-ignore */}
                        <gc-player-frame name="Vael" class-name="Pyromancer" glyph="V" level={28} hp={64} hp-max={80} mp={42} mp-max={100} show-mp />
                    {/* @ts-ignore */}
                    </gc-panel>
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="HP + MP + Stamina" />
                        {/* @ts-ignore */}
                        <gc-player-frame name="Hrolf" class-name="Stormbreaker" glyph="H" level={51} hp={140} hp-max={150} mp={25} mp-max={60} stamina={70} stamina-max={100} show-mp show-stamina />
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default PlayerFrameDemo
