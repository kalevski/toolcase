import type { Branding } from '../api/session'

/** The first word and the rest of a name, the way tc-brand sets a two-part wordmark. */
export function brandParts(name: string): { primary: string; secondary: string } {
    const trimmed = name.trim()
    const space = trimmed.indexOf(' ')
    if (space === -1) return { primary: trimmed, secondary: '' }
    return { primary: trimmed.slice(0, space), secondary: trimmed.slice(space + 1) }
}

/**
 * The domain's mark, set as text by the toolcase brand element: the two parts the branding names (else the display
 * name split at its first space), and the badge when there is one.
 */
export function BrandMark({ branding, size = 'md' }: { branding: Branding; size?: 'md' | 'lg' | 'hero' }) {
    const { primary, secondary } = branding.brandPrimary
        ? { primary: branding.brandPrimary, secondary: branding.brandSecondary }
        : brandParts(branding.name)
    return (
        <span className={`wm-brand wm-brand--${size}`}>
            <tc-brand
                primary-text={primary}
                secondary-text={secondary}
                label={branding.brandBadge || undefined}
                color="var(--tc-app-accent, #1d63ed)"
                xlarge={size !== 'md' || undefined}
            ></tc-brand>
        </span>
    )
}
