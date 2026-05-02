import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const LegalScreenDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-legal-screen" lede="Tabbed EULA / privacy / credits viewer with parchment body.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-legal-screen sections={JSON.stringify([
                    { id: 'eula', title: 'End-User License', body: 'You agree to the terms of the Hollow Crown ritual…' },
                    { id: 'privacy', title: 'Privacy Notice', body: 'Telemetry: anonymous gameplay events only.' },
                    { id: 'credits', title: 'Credits', body: 'Forged by a small team in the Pale March.' },
                ])} active-id="eula" />
            </div>
        </GcSection>
    </GcPage>
)

export default LegalScreenDemo
