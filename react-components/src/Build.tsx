import React from 'react'
import toolcase from '@toolcase/base'
import { ActionItems, ActionItem } from './ActionItems'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Spinner } from './Spinner'
import { Skeleton } from './Skeleton'

export interface BuildTag {
	id: string
	name: string
}

export type BuildStatus = 'pass' | 'fail' | 'running' | 'queued'

export interface BuildProps {
	name?: string
	date?: string
	size?: number
	duration?: number
	status?: BuildStatus
	badge?: string
	onClick?: () => void
	badgeVariant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	menuItems?: ActionItem[]
	onMenuItemClick?: (key: string) => void
	className?: string
	loading?: boolean
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	const seconds = ms / 1000
	if (seconds < 60) return `${seconds.toFixed(1)}s`
	const minutes = Math.floor(seconds / 60)
	const remaining = Math.round(seconds % 60)
	return `${minutes}m ${remaining}s`
}

export const Build: React.FC<BuildProps> = ({
	name = '[BUILD_NAME]',
	date = '',
	size = 0,
	duration = 0,
	status = 'pass',
	badge,
	onClick,
	badgeVariant = 'secondary',
	menuItems = [],
	onMenuItemClick,
	className = '',
	loading = false,
}) => {
	const rootClass = [
		'component component-build',
		status === 'running' ? 'component-build--running' : '',
		className,
	].filter(Boolean).join(' ')

	if (loading) {
		return (
			<div className={rootClass}>
				<Skeleton variant="circle" width="2rem" height="2rem" />
				<div className="component-build__label">
					<Skeleton width="40%" />
					<Skeleton width="25%" />
				</div>
				<Skeleton width="4rem" />
				<Skeleton width="4rem" />
			</div>
		)
	}

	return (
		<div className={rootClass}>
			<div className={`component-build__status component-build__status--${status}`}>
				{status === 'running' ? (
					<Spinner size="small" variant="primary" />
				) : (
					<Icon name={status === 'pass' ? 'check-circle-fill' : status === 'fail' ? 'x-circle-fill' : 'clock-fill'} />
				)}
			</div>
			<div className="component-build__label">
				<div className="component-build__name-row">
					<span onClick={onClick} className="component-build__name">{name}</span>
					{badge && <Badge variant={badgeVariant} pill>{badge}</Badge>}
				</div>
				<div className="component-build__meta">
					{date && <span className="component-build__date">{date}</span>}
				</div>
			</div>
			<div className="component-build__size">{toolcase.formatByteSize(size)}</div>
			<div className="component-build__duration">{formatDuration(duration)}</div>
			{menuItems.length > 0 && (
				<ActionItems items={menuItems} onActionClick={onMenuItemClick} />
			)}
		</div>
	)
}
