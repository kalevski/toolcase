import React from 'react'
import { IconButton } from './IconButton'
import toolcase from '@toolcase/base'

export interface QueuedFileProps {
	name?: string
	extension?: string
	format?: string
	size?: number
	onDismiss?: () => void
	className?: string
}

export const QueuedFile: React.FC<QueuedFileProps> = ({
	name = '[FILE_NAME]',
	extension = '_',
	format = 'unknown',
	size = 0,
	onDismiss,
	className = '',
}) => {
	const rootClass = `component component-queued-file ${className}`.trim()

	return (
		<div className={rootClass}>
			<div className={`component-queued-file__type file-bg__${format}`}>
				<span>{extension}</span>
			</div>
			<div className="component-queued-file__label">
				<span className="component-queued-file__name">{name}</span>
			</div>
			<div className="component-queued-file__size">
				{size > 0 ? toolcase.formatByteSize(size) : '—'}
			</div>
			<div className="component-queued-file__dismiss">
				<IconButton
					icon="x-lg"
					size="small"
					variant="secondary"
					outline
					label="Dismiss"
					onClick={onDismiss}
				/>
			</div>
		</div>
	)
}
