// Shared reserved message slot for every tc-* form field.
//
// Alignment is the whole point: a field's hint / valid / invalid line lives in a
// slot that is ALWAYS rendered and ALWAYS reserves one line of height (via the
// `.tc-field-message` `min-height` in style/components/_field-message.scss). So
// a field that has no message still occupies the same vertical space as one that
// does — adjacent fields stay aligned, and toggling a message on/off never
// shifts layout.
//
// One slot per field, used by exactly one message at a time. Precedence:
//   invalid (error / state="invalid")  >  hint (help)
// They share the spot and replace one another rather than stacking.
//
// The valid state intentionally renders NO confirmation message ("Looks good!")
// — only errors get copy. A valid field still gets its green control styling
// from the `is-valid` class each component adds; its slot just falls through to
// the hint (or stays empty), so reserved height is preserved either way.

import { esc } from './esc'

export type FieldMessageState = 'valid' | 'invalid' | null

export interface FieldMessageOptions {
    /** Invalid message. Non-empty implies the invalid state regardless of `state`. */
    error?: string | null
    /** Hint / help text — the lowest-precedence, muted message. */
    hint?: string | null
    /** Explicit validity state. `'invalid'` shows `error` (or `invalidText`);
     *  `'valid'` shows `validText`. */
    state?: FieldMessageState
    /** `id` applied to the slot so the control can `aria-describedby` it. */
    id?: string
    /** Copy shown when invalid but no `error` string was supplied. */
    invalidText?: string
    /** @deprecated No longer rendered — the valid state shows no confirmation
     *  message. Accepted for backward compatibility but ignored. */
    validText?: string
    /** Extra class(es) appended to the slot element. */
    extraClass?: string
}

// Compact lucide-shaped status glyphs (stroke="currentColor" flows the slot color).
const alertIcon =
    `<svg class="tc-field-message-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/>` +
    `<line x1="12" x2="12.01" y1="16" y2="16"/></svg>`

const has = (v: string | null | undefined): v is string => v != null && v !== ''

/**
 * Build the reserved message-slot markup for a field. Always returns a single
 * `.tc-field-message` element — empty when there is nothing to show, so the
 * reserved height is preserved.
 */
export function fieldMessageHtml(opts: FieldMessageOptions = {}): string {
    const { error, hint, state, id, invalidText, extraClass } = opts
    const idAttr = id ? ` id="${esc(id)}"` : ''
    const extra = extraClass ? ` ${extraClass}` : ''

    const isInvalid = state === 'invalid' || has(error)

    if (isInvalid) {
        const msg = has(error) ? error : (invalidText ?? '')
        const inner = has(msg) ? `${alertIcon}<span>${esc(msg)}</span>` : ''
        return (
            `<div class="tc-field-message tc-field-message--invalid${extra}"${idAttr}` +
            ` role="alert" aria-live="polite">${inner}</div>`
        )
    }
    // Valid state shows no confirmation message — fall through to the hint.
    const inner = has(hint) ? `<span>${esc(hint)}</span>` : ''
    return `<div class="tc-field-message${extra}"${idAttr}>${inner}</div>`
}
