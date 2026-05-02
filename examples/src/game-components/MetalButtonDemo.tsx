import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const MetalButtonDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-metal-button" lede="Atomic gilded button. Variants: default, primary, danger, ghost. Sizes: sm, md, lg.">
        <GcSection title="Variants">
            <GcRow label="Default">
                <gc-metal-button>Continue</gc-metal-button>
            </GcRow>
            <GcRow label="Primary">
                <gc-metal-button variant="primary">Try Again</gc-metal-button>
            </GcRow>
            <GcRow label="Danger">
                <gc-metal-button variant="danger">Forsake</gc-metal-button>
            </GcRow>
            <GcRow label="Ghost">
                <gc-metal-button variant="ghost">Stay</gc-metal-button>
            </GcRow>
        </GcSection>
        <GcSection title="Sizes">
            <GcRow label="sm / md / lg">
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <gc-metal-button size="sm" variant="primary">Small</gc-metal-button>
                    <gc-metal-button size="md" variant="primary">Medium</gc-metal-button>
                    <gc-metal-button size="lg" variant="primary">Large</gc-metal-button>
                </span>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default MetalButtonDemo
