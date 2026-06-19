import { esc } from "./esc"
// Shared rendering logic for the resource-bar family — tc-boss-bar today, and
// the HP / mana / stamina bars (game-components' ResourceBarBase) as they land.
// Centralises the percentage math, HTML escaping, and the track / fill / ghost /
// tick DOM so each bar component only owns its own header chrome and its
// --bs-<component>-* theming surface. Callers pass a BEM class `prefix`
// (e.g. 'tc-boss-bar') and the helper paints `<prefix>__track`, `__fill`,
// `__ghost`, `__tick`, and `__inline-text` for that component's SCSS to style.

/** Escape a user-supplied string before injecting into innerHTML. */
export function escapeHtml(value: string): string {
    return esc(value)
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value))
}

export interface ResourceBarTrackOptions {
    /** BEM class prefix for the owning component, e.g. 'tc-boss-bar'. */
    prefix: string
    /** Current value; clamped to `[0, max]` for both the fill width and aria-valuenow. */
    value: number
    /** Maximum value; non-positive values fall back to 100. */
    max: number
    /**
     * Optional "ghost" / recent-damage value rendered behind the fill — only
     * drawn when it resolves to a wider band than the current fill.
     */
    ghost?: number | null
    /**
     * Marker fractions in the open interval (0, 1): phase ticks for a boss bar,
     * or evenly-spaced segment dividers for a segmented resource bar.
     */
    ticks?: number[]
    /** Accessible label for the progressbar role. */
    label?: string | null
    /** Optional text drawn inside the track (e.g. "42 / 100"). */
    inlineText?: string | null
}

/**
 * Render the shared progressbar track for a resource bar: an optional ghost
 * band, the value fill, any tick markers, and optional inline text — all as
 * `<prefix>__*` classed elements with the correct ARIA on the track wrapper.
 */
export function renderResourceBarTrack(options: ResourceBarTrackOptions): string {
    const { prefix } = options
    const max = options.max > 0 ? options.max : 100
    const value = clamp(options.value, 0, max)
    const pct = (value / max) * 100

    const ghost = options.ghost
    const ghostPct = ghost != null ? (clamp(ghost, 0, max) / max) * 100 : 0
    const showGhost = ghost != null && ghostPct > pct

    const ghostMarkup = showGhost
        ? `<div class="${prefix}__ghost" style="width: ${ghostPct.toFixed(2)}%"></div>`
        : ''

    const ticks = (options.ticks ?? [])
        .filter(t => t > 0 && t < 1)
        .map(t => `<div class="${prefix}__tick" style="left: ${(t * 100).toFixed(2)}%"></div>`)
        .join('')

    const inlineText = options.inlineText
        ? `<div class="${prefix}__inline-text">${escapeHtml(options.inlineText)}</div>`
        : ''

    const labelAttr = options.label ? ` aria-label="${escapeHtml(options.label)}"` : ''

    return (
        `<div class="${prefix}__track" role="progressbar"` +
        ` aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${Math.round(max)}"${labelAttr}>` +
        ghostMarkup +
        `<div class="${prefix}__fill" style="width: ${pct.toFixed(2)}%"></div>` +
        ticks +
        inlineText +
        `</div>`
    )
}
