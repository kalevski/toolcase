'use client'

// Compact icon-only row-action buttons for every table in the app. One icon
// vocabulary (lucide-static, matching web-components' icon pipeline), two
// forms of the same button:
//
//   • `iconBtnHtml(...)` — an HTML *string* for buttons injected into tc-table
//     render cells / tc-advanced-table tbody HTML (the delegated-click pattern:
//     the caller supplies the `data-*` attributes its host listener reads).
//   • `<IconBtn …>` — the JSX form for buttons React renders directly.
//
// Both render a plain `<button class="btn btn-sm btn-outline-… perch-icon-btn">`
// with the inline SVG, an `aria-label`, and a native `title` tooltip carrying
// the action text the icon replaced. Raw lucide strings carry fixed
// width/height; strip them (like web-components' icon()) so `.perch-icon-btn`
// CSS owns sizing.

import {
    Activity,
    Ban,
    Copy,
    Eye,
    FileCode,
    KeyRound,
    Pencil,
    Power,
    RefreshCw,
    Server,
    SlidersHorizontal,
    Star,
    Trash2,
    X,
} from 'lucide-static'
import { escapeHtml } from './tc'

function stripSize(svg: string): string {
    return svg
        .replace(/\s+width="[^"]*"/, ' ')
        .replace(/\s+height="[^"]*"/, ' ')
        .replace(/<svg\s/, '<svg aria-hidden="true" ')
}

/** The app's row-action icon vocabulary — add here, never inline a raw SVG. */
export const ACTION_ICONS = {
    edit: stripSize(Pencil),
    remove: stripSize(Trash2),
    clone: stripSize(Copy),
    view: stripSize(Eye),
    config: stripSize(FileCode),
    toggle: stripSize(Power),
    renew: stripSize(RefreshCw),
    test: stripSize(Activity),
    default: stripSize(Star),
    rotate: stripSize(KeyRound),
    suspend: stripSize(Ban),
    limits: stripSize(SlidersHorizontal),
    realms: stripSize(Server),
    close: stripSize(X),
} as const

export type ActionIconName = keyof typeof ACTION_ICONS

export interface IconBtnHtmlOptions {
    icon: ActionIconName
    /** Tooltip (`title`) + `aria-label` — the text the icon replaced. */
    label: string
    /** `data-*` attributes the table's delegated click handler reads. */
    data: Record<string, string>
    danger?: boolean
    disabled?: boolean
}

/** The injected-HTML form. Every attribute value is escaped. */
export function iconBtnHtml({ icon, label, data, danger, disabled }: IconBtnHtmlOptions): string {
    const attrs = Object.entries(data)
        .map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`)
        .join('')
    return (
        `<button type="button" class="btn btn-sm btn-outline-${danger ? 'danger' : 'secondary'} perch-icon-btn"` +
        ` title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"${attrs}${disabled ? ' disabled' : ''}>` +
        ACTION_ICONS[icon] +
        `</button>`
    )
}

/** The JSX form, for buttons React renders directly (non-injected rows). */
export function IconBtn({
    icon,
    label,
    danger,
    disabled,
    onClick,
}: {
    icon: ActionIconName
    label: string
    danger?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            className={`btn btn-sm btn-outline-${danger ? 'danger' : 'secondary'} perch-icon-btn`}
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: ACTION_ICONS[icon] }}
        />
    )
}
