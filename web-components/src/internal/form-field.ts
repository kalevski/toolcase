// Shared helpers for the unified tc-* form-field contract. Every input component
// exposes the same vocabulary — label, name, value, disabled, required,
// placeholder, state, help, error — fires a `tc-change` CustomEvent with
// `detail: { value }`, and participates in native `<form>` submission/validation
// via ElementInternals. These helpers keep that wiring identical across the set.

/** Required-field asterisk appended after a label's text. Pair with the
 *  `.tc-field-required` rule in style/components/_field-message.scss. */
export function requiredMark(required: boolean): string {
    return required ? `<span class="tc-field-required" aria-hidden="true">*</span>` : ''
}

/**
 * Push a field's value into its form. Serializes the common value shapes:
 *   - null / '' / undefined → not submitted
 *   - array  → one entry per item under `name` (multi-select / tags)
 *   - boolean → submits `trueValue` when true, nothing when false (checkbox/switch)
 *   - everything else → String(value)
 */
export function setFieldFormValue(
    internals: ElementInternals,
    name: string | null,
    value: unknown,
    trueValue = 'on',
): void {
    if (value == null || value === '') {
        internals.setFormValue(null)
        return
    }
    if (Array.isArray(value)) {
        const fd = new FormData()
        const key = name ?? ''
        for (const item of value) fd.append(key, String(item))
        internals.setFormValue(fd)
        return
    }
    if (typeof value === 'boolean') {
        internals.setFormValue(value ? trueValue : null)
        return
    }
    internals.setFormValue(String(value))
}

/**
 * Reflect a field's validity into its ElementInternals so `form.checkValidity()`
 * / `reportValidity()` / `:invalid` work. `invalid` is the field's effective
 * invalid state (error set, state="invalid", or required-but-empty). Pass the
 * focusable inner control as `anchor` so the browser can focus it on report.
 */
export function reflectFieldValidity(
    internals: ElementInternals,
    opts: { invalid: boolean; valueMissing?: boolean; message?: string; anchor?: HTMLElement },
): void {
    if (!opts.invalid) {
        internals.setValidity({})
        return
    }
    const flags: ValidityStateFlags = opts.valueMissing
        ? { valueMissing: true }
        : { customError: true }
    internals.setValidity(flags, opts.message || 'Invalid value', opts.anchor)
}

/** Fire the canonical change event. Every input dispatches this with the same
 *  shape so a single `addEventListener('tc-change', e => e.detail.value)` works
 *  across the whole set. Bubbles + composed for cross-boundary listening. */
export function dispatchFieldChange(host: HTMLElement, value: unknown): void {
    host.dispatchEvent(
        new CustomEvent('tc-change', { bubbles: true, composed: true, detail: { value } }),
    )
}
