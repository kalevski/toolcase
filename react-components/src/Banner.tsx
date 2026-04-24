import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: 'info' | 'warning' | 'success' | 'error'
	dismissible?: boolean
	/** localStorage key. If set, and key exists, banner will not render */
	storageKey?: string
	icon?: string
	/** Slot for an action element (e.g. a Button or link) */
	action?: React.ReactNode
	onDismiss?: () => void
	children: React.ReactNode
	className?: string
}

// ── Default icons per variant ──────────────────────────────────────────────────

const DEFAULT_ICONS: Record<NonNullable<BannerProps['variant']>, string> = {
	info:    'info-circle',
	warning: 'exclamation-triangle',
	success: 'check-circle',
	error:   'x-circle',
}

// ── Component ──────────────────────────────────────────────────────────────────

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
			try { localStorage.setItem(storageKey, 'dismissed') } catch { /* ignore */ }
		}
		setDismissed(true)
		onDismiss?.()
	}

	const iconName = icon ?? DEFAULT_ICONS[variant]

	const rootClass = [
		'component component-banner',
		`component-banner--${variant}`,
		dismissible ? 'component-banner--dismissible' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} role="status" aria-live="polite" {...rest}>
			<span className="component-banner__icon" aria-hidden="true">
				<Icon name={iconName} />
			</span>

			<div className="component-banner__content">
				{children}
			</div>

			{action && (
				<div className="component-banner__action">
					{action}
				</div>
			)}

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
