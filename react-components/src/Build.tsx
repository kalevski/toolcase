import React from 'react'
import toolcase from '@toolcase/base'
import { ActionItems, ActionItem } from './ActionItems'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

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
	badgeVariant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	menuItems?: ActionItem[]
	onMenuItemClick?: (key: string) => void
	className?: string
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
	badgeVariant = 'secondary',
	menuItems = [],
	onMenuItemClick,
	className = '',
}) => {
	const rootClass = [
		'component component-build',
		status === 'running' ? 'component-build--running' : '',
		className,
	].filter(Boolean).join(' ')

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
					<span className="component-build__name">{name}</span>
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
