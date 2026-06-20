import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Icon } from './Icon'
import { IconButton } from './Button'

// ── Banner ─────────────────────────────────────────────────────────────────────

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'info' | 'warning' | 'success' | 'error'
    dismissible?: boolean
    /** localStorage key. If set, and key exists, banner will not render */
    storageKey?: string
    icon?: string
    action?: React.ReactNode
    onDismiss?: () => void
    children: React.ReactNode
    className?: string
}

const BANNER_DEFAULT_ICONS: Record<NonNullable<BannerProps['variant']>, string> = {
    info: 'info-circle',
    warning: 'exclamation-triangle',
    success: 'check-circle',
    error: 'x-circle',
}

export const Banner: React.FC<BannerProps> = ({
    variant = 'info',
    dismissible = false,
    storageKey,
    icon,
    action,
    onDismiss,
    children,
    className = '',
    ...rest
}) => {
    const [dismissed, setDismissed] = useState(() => {
        if (!storageKey) return false
        try {
            return localStorage.getItem(storageKey) === 'dismissed'
        } catch {
            return false
        }
    })

    if (dismissed) return null

    const handleDismiss = () => {
        if (storageKey) {
            try {
                localStorage.setItem(storageKey, 'dismissed')
            } catch {
                /* ignore */
            }
        }
        setDismissed(true)
        onDismiss?.()
    }

    const iconName = icon ?? BANNER_DEFAULT_ICONS[variant]

    const rootClass = [
        'component component-banner',
        `component-banner--${variant}`,
        dismissible ? 'component-banner--dismissible' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={rootClass} role="status" aria-live="polite" {...rest}>
            <span className="component-banner__icon" aria-hidden="true">
                <Icon name={iconName} />
            </span>

            <div className="component-banner__content">{children}</div>

            {action && <div className="component-banner__action">{action}</div>}

            {dismissible && (
                <IconButton
                    icon="x"
                    label="Dismiss notification"
                    className="component-banner__dismiss"
                    onClick={handleDismiss}
                />
            )}
        </div>
    )
}

// ── AnnouncementBar ───────────────────────────────────────────────────────────

export type AnnouncementBarVariant = 'info' | 'success' | 'warning' | 'announce'

export interface AnnouncementBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
    message: React.ReactNode
    ctaLabel?: string
    ctaHref?: string
    dismissible?: boolean
    variant?: AnnouncementBarVariant
    persistDismissKey?: string
    icon?: React.ReactNode
    iconName?: string
    onDismiss?: () => void
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
    message,
    ctaLabel,
    ctaHref,
    dismissible = false,
    variant = 'info',
    persistDismissKey,
    icon,
    iconName,
    onDismiss,
    className = '',
    ...rest
}) => {
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (persistDismissKey && typeof window !== 'undefined') {
            try {
                if (window.localStorage.getItem(`tc-announce:${persistDismissKey}`) === '1') {
                    setDismissed(true)
                }
            } catch {
                /* ignore */
            }
        }
    }, [persistDismissKey])

    const handleDismiss = () => {
        setDismissed(true)
        if (persistDismissKey && typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(`tc-announce:${persistDismissKey}`, '1')
            } catch {
                /* ignore */
            }
        }
        onDismiss?.()
    }

    if (dismissed) return null

    const rootClass =
        `component component-announcement-bar component-announcement-bar--${variant} ${className}`.trim()

    return (
        <div className={rootClass} role="region" aria-label="Announcement" {...rest}>
            <div className="component-announcement-bar__inner">
                {(icon || iconName) && (
                    <span className="component-announcement-bar__icon" aria-hidden="true">
                        {icon ?? <Icon name={iconName as string} />}
                    </span>
                )}
                <div className="component-announcement-bar__message">{message}</div>
                {ctaLabel && ctaHref && (
                    <a className="component-announcement-bar__cta" href={ctaHref}>
                        {ctaLabel}
                        <Icon name="arrow-right" aria-hidden={true} />
                    </a>
                )}
                {dismissible && (
                    <button
                        type="button"
                        className="component-announcement-bar__dismiss"
                        onClick={handleDismiss}
                        aria-label="Dismiss announcement"
                    >
                        <Icon name="x-lg" aria-hidden={true} />
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Tooltip ─────────────────────────────────────────────────────────────────────

export interface TooltipProps {
    children: React.ReactElement
    content: React.ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top', className = '' }) => {
    const [visible, setVisible] = useState(false)
    const [adjustedPosition, setAdjustedPosition] = useState(position)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const bubbleRef = useRef<HTMLSpanElement>(null)

    const show = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setVisible(true)
    }, [])

    const hide = useCallback(() => {
        timeoutRef.current = setTimeout(() => setVisible(false), 100)
    }, [])

    useEffect(() => {
        if (!visible || !bubbleRef.current) return
        const rect = bubbleRef.current.getBoundingClientRect()
        let next = position
        if (position === 'top' && rect.top < 0) next = 'bottom'
        else if (position === 'bottom' && rect.bottom > window.innerHeight) next = 'top'
        else if (position === 'left' && rect.left < 0) next = 'right'
        else if (position === 'right' && rect.right > window.innerWidth) next = 'left'
        if (next !== adjustedPosition) setAdjustedPosition(next)
    }, [visible, position]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setAdjustedPosition(position)
    }, [position])

    const rootClass = ['component component-tooltip', className].filter(Boolean).join(' ')

    return (
        <span className={rootClass} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
            {children}
            {visible && (
                <span
                    ref={bubbleRef}
                    className={`component-tooltip__bubble component-tooltip__bubble--${adjustedPosition}`}
                    role="tooltip"
                >
                    {content}
                </span>
            )}
        </span>
    )
}
