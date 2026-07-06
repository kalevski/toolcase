'use client'

// Shared loading / error / empty presentation (next-fullstack-app skill).
// Every data view renders exactly one of these or its content — never a bare
// "Loading…" string or a hand-rolled error <div>. Pair ErrorState's `message`
// with `describeApiError(err)` from lib/fetcher.

import type { ReactNode } from 'react'

/** Centered spinner + label while a view's initial data loads. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="d-flex align-items-center justify-content-center gap-2 py-5" role="status" aria-busy="true">
            <tc-spinner type="border" size="sm" />
            <tc-text variant="muted">{label}</tc-text>
        </div>
    )
}

/** Error banner with an in-place Retry — keeps the user where they were. */
export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    retryLabel = 'Retry',
}: {
    title?: string
    message?: string
    onRetry?: () => void
    retryLabel?: string
}) {
    return (
        <tc-banner variant="error">
            <strong>{title}</strong>
            {message ? <div>{message}</div> : null}
            {onRetry ? (
                <div className="mt-2">
                    <tc-button variant="secondary" outline size="sm" onClick={onRetry}>
                        {retryLabel}
                    </tc-button>
                </div>
            ) : null}
        </tc-banner>
    )
}

/** Empty result set with an optional call-to-action as children. */
export function EmptyState({
    icon,
    title,
    description,
    children,
}: {
    /** Lucide icon name (tc-empty-state resolves it), e.g. 'inbox', 'folder-git-2'. */
    icon?: string
    title: string
    description?: string
    children?: ReactNode
}) {
    return (
        <tc-empty-state icon={icon}>
            <h5>{title}</h5>
            {description ? <tc-text variant="muted">{description}</tc-text> : null}
            {children}
        </tc-empty-state>
    )
}
