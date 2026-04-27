import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'

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

	const rootClass = `component component-announcement-bar component-announcement-bar--${variant} ${className}`.trim()

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

export default AnnouncementBar
