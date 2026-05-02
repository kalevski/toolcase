import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const IconBadgeDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-icon-badge" lede="Small framed glyph for header badges, dialog icons, toasts.">
        <GcSection title="Sizes">
            <GcRow label="24 / 32 / 48">
                <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                    <gc-icon-badge glyph="✦" size="24" />
                    <gc-icon-badge glyph="✦" size="32" />
                    <gc-icon-badge glyph="✦" size="48" />
                </span>
            </GcRow>
        </GcSection>
        <GcSection title="Colors">
            <GcRow label="Default / blood / arcane">
                <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                    <gc-icon-badge glyph="⚔" />
                    <gc-icon-badge glyph="☠" color="var(--fg-blood-bright)" />
                    <gc-icon-badge glyph="◈" color="var(--fg-arcane-bright)" />
                </span>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default IconBadgeDemo
