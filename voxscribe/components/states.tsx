'use client'

import type { ReactNode } from 'react'

// Shared loading / error / empty states (plan WS-4). Every data view used to roll
// its own: plain "Loading…" text, and a "Couldn't load — refresh the page" dead
// end with no way to retry. These three components give one consistent treatment:
//
//   • LoadingState — shimmer skeletons shaped like the content (tc-skeleton), so
//     the page keeps its silhouette while data arrives instead of blank text.
//   • ErrorState   — a tc-banner with a specific message AND a Retry button that
//     re-runs the fetcher in place (no full-page reload).
//   • EmptyState   — a tc-empty-state with an actionable call-to-action.
//
// tc-skeleton / tc-banner / tc-empty-state / tc-button are presentational and take
// only scalar attributes, so they render straight from JSX (no lib/tc.ts bridge).

type SkeletonShape = 'text' | 'cards' | 'rows' | 'detail'

/**
 * A busy placeholder shaped like the content it stands in for. `shape` picks the
 * silhouette; `count` is how many cards/rows to draw.
 */
export function LoadingState({
    shape = 'text',
    count = 3,
    label = 'Loading…',
}: {
    shape?: SkeletonShape
    count?: number
    label?: string
}) {
    const items = Array.from({ length: count })
    return (
        <div className="voxscribe-loading" role="status" aria-busy="true" aria-label={label}>
            {shape === 'text' && <tc-skeleton variant="text" count={count} />}

            {shape === 'cards' && (
                <div className="voxscribe-card-grid">
                    {items.map((_, i) => (
                        <div className="voxscribe-card voxscribe-skeleton-card" key={i}>
                            <tc-skeleton variant="text" width="60%" height="1.2em" />
                            <tc-skeleton variant="text" width="80%" />
                            <tc-skeleton variant="rect" width="100%" height="2.5em" />
                        </div>
                    ))}
                </div>
            )}

            {shape === 'rows' && (
                <div className="voxscribe-skeleton-rows">
                    {items.map((_, i) => (
                        <tc-skeleton key={i} variant="rect" width="100%" height="3em" />
                    ))}
                </div>
            )}

            {shape === 'detail' && (
                <div className="voxscribe-skeleton-detail">
                    <tc-skeleton variant="text" width="40%" height="1.5em" />
                    <tc-skeleton variant="rect" width="100%" height="8em" />
                    <tc-skeleton variant="rect" width="100%" height="6em" />
                </div>
            )}
        </div>
    )
}

/**
 * A failure banner with a specific message and an in-place Retry. Pass the copy
 * from `describeApiError(err)`; `onRetry` re-runs the fetcher.
 */
export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    retryLabel = 'Try again',
}: {
    title?: string
    message: string
    onRetry?: () => void
    retryLabel?: string
}) {
    return (
        <tc-banner variant="error" role="alert">
            <strong>{title}.</strong> {message}
            {onRetry && (
                <tc-button slot="action" variant="secondary" size="sm" onClick={onRetry}>
                    {retryLabel}
                </tc-button>
            )}
        </tc-banner>
    )
}

/** An empty-state with an optional action (button/link) supplied as children. */
export function EmptyState({
    icon,
    title,
    description,
    children,
}: {
    icon?: string
    title: string
    description?: string
    children?: ReactNode
}) {
    return (
        <tc-empty-state icon={icon}>
            <strong className="voxscribe-empty-title">{title}</strong>
            {description && <p className="voxscribe-empty-desc">{description}</p>}
            {children}
        </tc-empty-state>
    )
}
