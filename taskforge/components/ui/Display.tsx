import React from 'react'
import { Icon } from './Icon'
import { Text } from './Typography'

// ── Badge ──────────────────────────────────────────────────────────────────────

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    children?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
    pill?: boolean
    size?: 'sm' | 'md' | 'lg'
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'secondary',
    pill = false,
    size = 'md',
    ...props
}) => {
    let badgeClass = `${props.className || ''} component component-badge component-badge--${variant}`
    if (pill) badgeClass += ' component-badge--pill'
    if (size === 'sm') badgeClass += ' component-badge--sm'
    if (size === 'lg') badgeClass += ' component-badge--lg'
    return (
        <span {...props} className={badgeClass.trim()}>
            {children}
        </span>
    )
}

// ── Tag ──────────────────────────────────────────────────────────────────────

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
    children?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
    removable?: boolean
    onRemove?: () => void
}

export const Tag: React.FC<TagProps> = ({
    children,
    variant = 'secondary',
    removable = false,
    onRemove,
    className = '',
    ...props
}) => {
    const rootClass = ['component component-tag', `component-tag--${variant}`, className].filter(Boolean).join(' ')

    return (
        <span {...props} className={rootClass}>
            <span className="component-tag__label">{children}</span>
            {removable && (
                <button type="button" className="component-tag__remove" onClick={onRemove} aria-label="Remove">
                    <Icon name="x" />
                </button>
            )}
        </span>
    )
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
    status?: 'online' | 'offline' | 'busy' | 'away'
    size?: 'small' | 'default' | 'large'
    label?: string
    pulse?: boolean
}

export const StatusDot: React.FC<StatusDotProps> = ({
    status = 'offline',
    size = 'default',
    label,
    pulse = false,
    className = '',
    ...props
}) => {
    const rootClass = [
        'component component-status-dot',
        `component-status-dot--${status}`,
        `component-status-dot--${size}`,
        pulse ? 'component-status-dot--pulse' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <span {...props} className={rootClass} role="status" aria-label={label ?? status}>
            <span className="component-status-dot__dot" />
            {label && <span className="component-status-dot__label">{label}</span>}
        </span>
    )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    src?: string
    alt?: string
    name?: string
    size?: 'small' | 'default' | 'large'
    status?: 'online' | 'offline' | 'busy' | 'away'
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
}

const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    alt,
    name,
    size = 'default',
    status,
    variant = 'primary',
    ...props
}) => {
    const [imageError, setImageError] = React.useState(false)
    const [imageLoaded, setImageLoaded] = React.useState(false)

    React.useEffect(() => {
        setImageError(false)
        setImageLoaded(false)
    }, [src])

    const showImage = src && !imageError
    const showInitials = !showImage && name
    const showPlaceholder = !showImage && !name

    let avatarClass = `${props.className || ''} component component-avatar component-avatar--${size}`
    if (!showImage) {
        avatarClass += ` component-avatar--initials component-avatar--${variant}`
    }

    const initials = name ? getInitials(name) : '?'

    return (
        <div {...props} className={avatarClass.trim()}>
            {showImage && (
                <img
                    src={src}
                    alt={alt || name || 'Avatar'}
                    onError={() => setImageError(true)}
                    onLoad={() => setImageLoaded(true)}
                    className={`component-avatar__img ${imageLoaded ? 'loaded' : ''}`}
                />
            )}
            {showInitials && <span className="component-avatar__initials-text">{initials}</span>}
            {showPlaceholder && <span className="component-avatar__placeholder">?</span>}
            {status && <span className={`component-avatar__status component-avatar__status--${status}`} />}
        </div>
    )
}

// ── Spinner ─────────────────────────────────────────────────────────────────────

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'small' | 'default' | 'large'
    label?: string
    variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export const Spinner: React.FC<SpinnerProps> = ({
    size = 'default',
    label,
    variant = 'primary',
    className = '',
    ...props
}) => {
    const rootClass = [
        'component component-spinner',
        `component-spinner--${size}`,
        `component-spinner--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div {...props} className={rootClass} role="status">
            <span className="component-spinner__circle" />
            {label ? (
                <span className="component-spinner__label">{label}</span>
            ) : (
                <span className="visually-hidden">Loading…</span>
            )}
        </div>
    )
}

// ── Card ─────────────────────────────────────────────────────────────────────

export interface CardProps {
    children?: React.ReactNode
    header?: React.ReactNode
    variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
    className?: string
    loading?: boolean
}

export const Card: React.FC<CardProps> = ({ children, header, variant = 'default', className }) => {
    const classNameValue = [
        'component component-card',
        variant !== 'default' ? `component-card--${variant}` : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ')
    return (
        <div className={classNameValue}>
            {header && <div className="component-card__header">{header}</div>}
            <div className="component-card__body">{children}</div>
        </div>
    )
}

// ── ProgressBar ─────────────────────────────────────────────────────────────────

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number
    label?: string
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
    height?: number | string
    indeterminate?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    label,
    variant = 'primary',
    height = 8,
    indeterminate = false,
    className,
    ...props
}) => {
    return (
        <div className="component component-progress-bar-wrapper">
            {label && (
                <div className="component-progress-bar__meta">
                    <Text variant="muted" size="small">
                        {label}
                    </Text>
                    {!indeterminate && (
                        <Text variant="muted" size="small">
                            {value}%
                        </Text>
                    )}
                </div>
            )}
            <div
                {...props}
                className={`component-progress-bar${indeterminate ? ' component-progress-bar--indeterminate' : ''}${className ? ` ${className}` : ''}`}
                style={{ height }}
                aria-label={!label ? (indeterminate ? 'Loading…' : `${value}%`) : undefined}
            >
                <div
                    className={`component-progress-bar__fill component-progress-bar__fill--${variant}`}
                    style={indeterminate ? undefined : { width: `${value}%` }}
                    role="progressbar"
                    aria-valuenow={indeterminate ? undefined : value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={indeterminate ? 'Loading…' : `${value}%`}
                />
            </div>
        </div>
    )
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
    label: string
    href?: string
    onClick?: (e: React.MouseEvent) => void
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
    items: BreadcrumbItem[]
    separator?: React.ReactNode
    maxItems?: number
    className?: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
    items,
    separator = '/',
    maxItems = 0,
    className = '',
    ...rest
}) => {
    const [expanded, setExpanded] = React.useState(false)

    const shouldCollapse = maxItems > 0 && !expanded && items.length > maxItems

    let visible: (BreadcrumbItem | null)[]
    if (shouldCollapse) {
        const tail = items.slice(items.length - (maxItems - 1))
        visible = [items[0], null, ...tail]
    } else {
        visible = items
    }

    const rootClass = ['component component-breadcrumb', className].filter(Boolean).join(' ')

    return (
        <nav className={rootClass} aria-label="breadcrumb" {...rest}>
            <ol className="component-breadcrumb__list">
                {visible.map((item, index) => {
                    const isLast = index === visible.length - 1

                    if (item === null) {
                        return (
                            <li key="__ellipsis" className="component-breadcrumb__item">
                                <button
                                    type="button"
                                    className="component-breadcrumb__ellipsis"
                                    aria-label="Show full path"
                                    onClick={() => setExpanded(true)}
                                >
                                    &hellip;
                                </button>
                                <span className="component-breadcrumb__separator" aria-hidden="true">
                                    {separator}
                                </span>
                            </li>
                        )
                    }

                    return (
                        <li
                            key={index}
                            className={[
                                'component-breadcrumb__item',
                                isLast ? 'component-breadcrumb__item--current' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {isLast || (!item.href && !item.onClick) ? (
                                <span className="component-breadcrumb__label" aria-current={isLast ? 'page' : undefined}>
                                    {item.label}
                                </span>
                            ) : (
                                <a href={item.href ?? '#'} className="component-breadcrumb__link" onClick={item.onClick}>
                                    {item.label}
                                </a>
                            )}
                            {!isLast && (
                                <span className="component-breadcrumb__separator" aria-hidden="true">
                                    {separator}
                                </span>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: string
    children?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, children, className = '', ...props }) => {
    const rootClass = `component component-empty-state ${className}`.trim()
    return (
        <div {...props} className={rootClass}>
            {icon && <Icon name={icon} className="component-empty-state__icon" />}
            <div className="component-empty-state__content">{children}</div>
        </div>
    )
}
