import React from 'react'
import { Icon } from './Icon'

// ── Button ─────────────────────────────────────────────────────────────────────

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode
    /** @deprecated Use `children` instead. */
    label?: string
    outline?: boolean
    size?: 'small' | 'default' | 'large'
    variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'link'
    /** Shows a spinner, disables the button, and sets `aria-busy`. */
    loading?: boolean
    /** Stretches the button to the full width of its container. */
    fullWidth?: boolean
    /** Icon rendered before the label. */
    startIcon?: React.ReactNode
    /** Icon rendered after the label. */
    endIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            label,
            outline = false,
            size = 'default',
            variant = 'primary',
            loading = false,
            fullWidth = false,
            startIcon,
            endIcon,
            className,
            disabled,
            type,
            ...props
        },
        ref,
    ) => {
        const buttonClass = [
            'component component-button',
            `component-button--${variant}`,
            outline && variant !== 'link' ? 'component-button--outline' : '',
            size === 'large' && 'component-button--large',
            size === 'small' && 'component-button--small',
            fullWidth && 'component-button--full',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        const content = children ?? label

        return (
            <button
                {...props}
                ref={ref}
                type={type ?? 'button'}
                className={buttonClass}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
            >
                {loading && <span className="component-button__spinner" role="status" aria-hidden="true" />}
                {!loading && startIcon}
                {content}
                {!loading && endIcon}
            </button>
        )
    },
)

Button.displayName = 'Button'

// ── IconButton ─────────────────────────────────────────────────────────────────

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: string
    size?: 'small' | 'default' | 'large'
    variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
    outline?: boolean
    label?: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, size = 'default', variant = 'secondary', outline = false, label, className = '', ...props }, ref) => {
        const rootClass = [
            'component component-icon-button',
            `component-icon-button--${size}`,
            `component-icon-button--${variant}`,
            outline ? 'component-icon-button--outline' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        return (
            <button {...props} ref={ref} className={rootClass} aria-label={label ?? icon}>
                <Icon name={icon} />
            </button>
        )
    },
)

IconButton.displayName = 'IconButton'
