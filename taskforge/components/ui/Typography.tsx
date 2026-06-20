import React from 'react'
import { Icon } from './Icon'

// ── Heading ──────────────────────────────────────────────────────────────────

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children?: React.ReactNode
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    gradient?: boolean
}

export const Heading: React.FC<HeadingProps> = ({
    children,
    as: Tag = 'h2',
    gradient = false,
    className = '',
    ...props
}) => {
    const rootClass = [
        'component component-heading',
        `component-heading--${Tag}`,
        gradient ? 'component-heading--gradient' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <Tag {...props} className={rootClass}>
            {children}
        </Tag>
    )
}

// ── Text ─────────────────────────────────────────────────────────────────────

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode
    variant?: 'default' | 'muted' | 'code' | 'mono' | 'truncate'
    size?: 'small' | 'default' | 'large'
    as?: 'p' | 'span' | 'small' | 'div'
}

export const Text: React.FC<TextProps> = ({
    children,
    variant = 'default',
    size = 'default',
    as: Tag = 'span',
    className = '',
    ...props
}) => {
    const rootClass = [
        'component component-text',
        `component-text--${variant}`,
        `component-text--${size}`,
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <Tag {...props} className={rootClass}>
            {children}
        </Tag>
    )
}

// ── HelperText ─────────────────────────────────────────────────────────────────

export interface HelperTextProps {
    children?: React.ReactNode
    text?: string
    variant?: 'default' | 'success' | 'warning' | 'error'
    icon?: string
    className?: string
    id?: string
}

export const HelperText: React.FC<HelperTextProps> = ({
    children,
    text,
    variant = 'default',
    icon,
    className = '',
    id,
}) => {
    const resolvedIcon =
        icon ??
        (variant === 'success'
            ? 'check-circle-fill'
            : variant === 'warning'
              ? 'exclamation-triangle-fill'
              : variant === 'error'
                ? 'x-circle-fill'
                : 'info-circle')

    return (
        <p
            id={id}
            className={`component component-helper-text component-helper-text--${variant}${className ? ` ${className}` : ''}`}
        >
            <Icon name={resolvedIcon.replace('bi-', '')} className="component-helper-text__icon" />
            <span className="component-helper-text__content">
                {text}
                {children}
            </span>
        </p>
    )
}

// ── Kbd ───────────────────────────────────────────────────────────────────────

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode
    keys?: string[]
}

export const Kbd: React.FC<KbdProps> = ({ children, keys, className = '', ...props }) => {
    const rootClass = ['component component-kbd', className].filter(Boolean).join(' ')

    if (keys && keys.length > 0) {
        return (
            <span className={rootClass}>
                {keys.map((key, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <span className="component-kbd__separator">+</span>}
                        <kbd {...props} className="component-kbd__key">
                            {key}
                        </kbd>
                    </React.Fragment>
                ))}
            </span>
        )
    }

    return (
        <kbd {...props} className={rootClass}>
            {children}
        </kbd>
    )
}

// ── Divider ─────────────────────────────────────────────────────────────────────

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
    vertical?: boolean
    label?: string
}

export const Divider: React.FC<DividerProps> = ({ vertical = false, label, ...props }) => {
    const className = [
        'component component-divider',
        vertical ? 'component-divider--vertical' : 'component-divider--horizontal',
        props.className || '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div {...props} className={className} role="separator">
            {label && <span className="component-divider__label">{label}</span>}
        </div>
    )
}
