// Global message registry — every user-visible default string a tc-* component
// renders (validation copy, placeholders, pagination summaries, aria labels)
// resolves through this catalog at render time, so a single configureMessages()
// call at app bootstrap localizes the whole component set. Defaults stay
// English. Per-instance attributes (placeholder, empty-message, error,
// required-message, …) always win over the registry for one-off cases.
//
//     import { configureMessages } from '@toolcase/web-components'
//     configureMessages({
//         fieldRequired: 'Ова поле е задолжително',
//         paginationRange: ({ start, end, total }) => `${start}–${end} од ${total}`,
//         selectPlaceholder: 'Изберете…',
//     })
//
// Call it before components mount (components read the registry when they
// render). Changing messages later requires re-rendering the affected
// components — a `tc-messages-changed` CustomEvent is dispatched on `document`
// after every configureMessages() call so apps can trigger that themselves.

/** A parameterised message: either a `{token}` template string or a formatter
 *  function. String templates keep overrides serialisable; functions get full
 *  control over pluralisation/word order. */
export type MessageFormatter<P> = string | ((params: P) => string)

export interface PaginationRangeParams {
    start: number
    end: number
    total: number
}

export interface StepsCompleteParams {
    completed: number
    total: number
}

export interface StarsRatingParams {
    value: number
    max: number
}

export interface ToolcaseMessages {
    // ── Validation copy ──────────────────────────────────────────────────────
    /** Required field left empty. */
    fieldRequired: string
    /** Generic invalid-value copy under a text control. */
    fieldInvalid: string
    /** Fallback error label when a validator returns no message. */
    invalidValue: string
    /** Required select/combobox with nothing chosen. */
    selectionRequired: string
    /** Select/combobox holding a value outside its options. */
    selectionInvalid: string
    /** Checkbox group requiring at least one checked option. */
    selectionMinOne: string
    /** Slider/stepper style numeric choice out of range. */
    invalidChoice: string
    invalidDate: string
    invalidTime: string
    invalidColor: string
    invalidIcon: string
    invalidCode: string

    // ── Placeholders ─────────────────────────────────────────────────────────
    selectPlaceholder: string
    searchPlaceholder: string

    // ── Status / aria strings ────────────────────────────────────────────────
    loading: string
    noData: string
    close: string
    clear: string
    filtersLabel: string
    searchOptionsLabel: string
    toggleSidebarLabel: string
    paginationLabel: string
    paginationPrevious: string
    paginationNext: string
    /** Table pagination summary, e.g. "1–10 of 42". */
    paginationRange: MessageFormatter<PaginationRangeParams>
    /** Progress summary, e.g. "3 of 5 complete". */
    stepsComplete: MessageFormatter<StepsCompleteParams>
    /** Rating summary, e.g. "4 out of 5 stars". */
    starsRating: MessageFormatter<StarsRatingParams>

    // ── File inputs ──────────────────────────────────────────────────────────
    fileDropPrompt: string
    fileDropLabel: string
    fileSelectLabel: string
}

const DEFAULTS: ToolcaseMessages = {
    fieldRequired: 'This field is required',
    fieldInvalid: 'Please provide a valid value.',
    invalidValue: 'Invalid value',
    selectionRequired: 'Please make a selection.',
    selectionInvalid: 'Please provide a valid selection.',
    selectionMinOne: 'Please select at least one option.',
    invalidChoice: 'Please choose a valid value.',
    invalidDate: 'Please provide a valid date.',
    invalidTime: 'Please provide a valid time.',
    invalidColor: 'Please select a valid color.',
    invalidIcon: 'Please select a valid icon.',
    invalidCode: 'Please enter a valid code.',

    selectPlaceholder: 'Select…',
    searchPlaceholder: 'Search…',

    loading: 'Loading…',
    noData: 'No data',
    close: 'Close',
    clear: 'Clear',
    filtersLabel: 'Filters',
    searchOptionsLabel: 'Search options',
    toggleSidebarLabel: 'Toggle sidebar',
    paginationLabel: 'Page navigation',
    paginationPrevious: 'Previous',
    paginationNext: 'Next',
    paginationRange: '{start}–{end} of {total}',
    stepsComplete: '{completed} of {total} complete',
    starsRating: '{value} out of {max} stars',

    fileDropPrompt: 'Drag & drop files here or click to browse',
    fileDropLabel: 'Upload files — drag and drop or click to browse',
    fileSelectLabel: 'Select files to upload',
}

let _current: ToolcaseMessages = { ...DEFAULTS }

/** Merge overrides into the active catalog. Keys set to `undefined` are
 *  ignored (they keep their current value). Dispatches `tc-messages-changed`
 *  on `document` so apps can re-render already-mounted components. */
export function configureMessages(overrides: Partial<ToolcaseMessages>): void {
    const pruned: Partial<ToolcaseMessages> = {}
    for (const [k, v] of Object.entries(overrides)) {
        if (v !== undefined) (pruned as Record<string, unknown>)[k] = v
    }
    _current = { ..._current, ...pruned }
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('tc-messages-changed'))
    }
}

/** Restore the built-in English defaults. */
export function resetMessages(): void {
    _current = { ...DEFAULTS }
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('tc-messages-changed'))
    }
}

/** Snapshot of the active catalog (for auditing coverage). */
export function getMessages(): Readonly<ToolcaseMessages> {
    return _current
}

/** Keys whose value is always a plain string. */
type PlainKeys = {
    [K in keyof ToolcaseMessages]: ToolcaseMessages[K] extends string ? K : never
}[keyof ToolcaseMessages]

/** Resolve a plain-string message from the active catalog. */
export function msg(key: PlainKeys): string {
    return _current[key]
}

/** Resolve a parameterised message: formatter functions are invoked, string
 *  templates get `{token}` interpolation. */
export function msgFormat<P extends Record<string, unknown>>(
    key: keyof ToolcaseMessages,
    params: P,
): string {
    const value = _current[key] as MessageFormatter<P>
    if (typeof value === 'function') {
        try {
            return String(value(params))
        } catch {
            /* fall through to the default template */
        }
    }
    const template =
        typeof value === 'string' ? value : (DEFAULTS[key] as MessageFormatter<P> as string)
    return template.replace(/\{(\w+)\}/g, (m, token: string) =>
        token in params ? String(params[token]) : m,
    )
}
