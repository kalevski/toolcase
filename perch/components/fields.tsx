'use client'

// Thin React wrappers over the @toolcase/web-components form inputs so perch
// drives every input through tc-* (tc-input / tc-select / tc-check) instead of
// raw <input>/<select>/<textarea>. Each wrapper owns the lib/tc.ts interop:
//
//   • Controlled `value` flows in as a JSX prop. Because each `onValue` stores the
//     control's value verbatim, the value React writes back always equals what the
//     inner control already holds, so the assignment is a no-op for the caret —
//     it never jumps mid-edit. (Don't transform the value inside `onValue`.)
//   • Boolean props (disabled/required/checked/inline) are passed straight
//     through. The Providers gate defines every tc-* before these mount, so React
//     19 assigns them to the matching element *property*, whose setter toggles the
//     attribute — `false` correctly clears it.
//   • Changes come back out through addEventListener, not JSX `onX`: React can't
//     bind the inner native `input` event or the `tc-change` CustomEvent through
//     JSX props, so every wrapper attaches its listener via `useTc`.

import { useMemo } from 'react'
import { useTc, targetValue, detailValue } from '@/lib/tc'

type FieldSize = 'sm' | 'lg'

export interface TextFieldProps {
    value: string
    onValue: (value: string) => void
    /** `text` (default), `number`, `search`, `email`, … — forwarded to tc-input. */
    type?: string
    label?: string
    placeholder?: string
    /** Hint rendered in the reserved message slot below the control. */
    help?: string
    size?: FieldSize
    disabled?: boolean
    required?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
    inputMode?: string
    ariaLabel?: string
    className?: string
}

/** Labelled text/number/search input — tc-input. Reports every keystroke. */
export function TextField({
    value,
    onValue,
    type,
    label,
    placeholder,
    help,
    size,
    disabled,
    required,
    min,
    max,
    step,
    inputMode,
    ariaLabel,
    className,
}: TextFieldProps) {
    const ref = useTc<HTMLElement>(undefined, {
        // Inner <input> fires native `input` on every keystroke; it bubbles to the host.
        input: (event) => onValue(targetValue(event)),
    })
    return (
        <tc-input
            ref={ref}
            value={value}
            type={type ?? 'text'}
            size={size}
            label={label}
            placeholder={placeholder}
            help={help}
            min={min}
            max={max}
            step={step}
            inputmode={inputMode}
            required={required}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
        />
    )
}

export interface TextAreaFieldProps {
    value: string
    onValue: (value: string) => void
    label?: string
    placeholder?: string
    /** Hint rendered in the reserved message slot below the control. */
    help?: string
    rows?: number
    size?: FieldSize
    disabled?: boolean
    required?: boolean
    ariaLabel?: string
    className?: string
}

/**
 * Labelled multi-line textarea — tc-textarea. Same `input`-event binding as
 * {@link TextField} (tc-textarea inherits the text-field base), with a `rows` knob.
 * Used for raw passthrough fields like a proxy's `advanced` nginx block.
 */
export function TextAreaField({
    value,
    onValue,
    label,
    placeholder,
    help,
    rows,
    size,
    disabled,
    required,
    ariaLabel,
    className,
}: TextAreaFieldProps) {
    const ref = useTc<HTMLElement>(undefined, {
        input: (event) => onValue(targetValue(event)),
    })
    return (
        <tc-textarea
            ref={ref}
            value={value}
            size={size}
            label={label}
            placeholder={placeholder}
            help={help}
            rows={rows}
            required={required}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
        />
    )
}

export interface SelectOption {
    value: string
    label: string
    disabled?: boolean
}

export interface SelectFieldProps {
    value: string
    onValue: (value: string) => void
    /** The option set. Keep label text stable per `value` (see the remount note below). */
    options: SelectOption[]
    label?: string
    /** A leading disabled placeholder option (single-select). */
    placeholder?: string
    size?: FieldSize
    disabled?: boolean
    ariaLabel?: string
    className?: string
}

/** Labelled dropdown — tc-select with native <option> children. */
export function SelectField({
    value,
    onValue,
    options,
    label,
    placeholder,
    size,
    disabled,
    ariaLabel,
    className,
}: SelectFieldProps) {
    const ref = useTc<HTMLElement>(undefined, {
        'tc-change': (event) => onValue(detailValue<string>(event)),
    })
    // tc-select snapshots its <option> children into its own DOM on first render,
    // detaching the nodes React created — diffing those detached nodes later
    // throws. Keying on the option *values* keeps a static set stable (no remount)
    // while giving a changing set (e.g. the upstream pool) a clean remount instead
    // of an in-place diff React can't perform.
    const optionsKey = options.map((option) => option.value).join('')
    return (
        <tc-select
            key={optionsKey}
            ref={ref}
            value={value}
            size={size}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                </option>
            ))}
        </tc-select>
    )
}

export interface CheckFieldProps {
    checked: boolean
    onChecked: (checked: boolean) => void
    label?: string
    disabled?: boolean
    /** Compact inline checkbox (no reserved message gutter) for flag rows. */
    inline?: boolean
    className?: string
}

/** Checkbox — tc-check. */
export function CheckField({ checked, onChecked, label, disabled, inline, className }: CheckFieldProps) {
    const ref = useTc<HTMLElement>(undefined, {
        'tc-change': (event) => onChecked(detailValue<boolean>(event)),
    })
    return (
        <tc-check
            ref={ref}
            checked={checked}
            disabled={disabled}
            inline={inline}
            label={label}
            className={className}
        />
    )
}

export interface ColorFieldProps {
    value: string
    onValue: (value: string) => void
    /** Quick-pick swatches (hex strings); the picker's footer still accepts any hex. */
    colors: string[]
    label?: string
    /** Hint rendered in the reserved message slot below the control. */
    help?: string
    /** Swatch grid columns (default 8). */
    columns?: number
    disabled?: boolean
    required?: boolean
    ariaLabel?: string
    className?: string
}

/**
 * Labelled colour picker — tc-color-picker. `colors` is set as an element *property*
 * (JSX can't pass an array), and a selection (swatch click or a valid hex typed in the
 * footer) arrives via the `tc-change` `{ value }` CustomEvent — same bridge as the other
 * wrappers. The emitted value is always a `#rgb`/`#rrggbb` hex.
 */
export function ColorField({
    value,
    onValue,
    colors,
    label,
    help,
    columns,
    disabled,
    required,
    ariaLabel,
    className,
}: ColorFieldProps) {
    const ref = useTc<HTMLElement>(useMemo(() => ({ colors }), [colors]), {
        'tc-change': (event) => onValue(detailValue<string>(event)),
    })
    return (
        <tc-color-picker
            ref={ref}
            value={value}
            label={label}
            help={help}
            columns={columns}
            required={required}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
        />
    )
}
