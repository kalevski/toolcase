import React, { useEffect, useRef } from 'react'

export interface FeedTag {
	label: React.ReactNode
	variant?: 'default' | 'acid' | 'red' | 'cyan'
}

export interface FeedEvent {
	id: string
	time: React.ReactNode
	actor?: React.ReactNode
	message: React.ReactNode
	tags?: FeedTag[]
}

export interface LiveFeedProps extends React.HTMLAttributes<HTMLDivElement> {
	events: FeedEvent[]
	header?: React.ReactNode
	recording?: boolean
	maxRows?: number
	autoScroll?: boolean
}

export const LiveFeed: React.FC<LiveFeedProps> = ({
	events,
	header = '// LIVE FEED',
	recording = false,
	maxRows,
	autoScroll = false,
	className = '',
	...rest
}) => {
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const visible = maxRows ? events.slice(0, maxRows) : events

	useEffect(() => {
		if (!autoScroll) return
		const el = bodyRef.current
		if (el) el.scrollTop = 0
	}, [events, autoScroll])

	return (
		<div className={`component component-live-feed ${className}`.trim()} {...rest}>
			<div className="component-live-feed__head">
				<span className="component-live-feed__title">{header}</span>
				{recording && (
					<span className="component-live-feed__rec" role="status" aria-live="polite">
						<span className="component-live-feed__dot" aria-hidden={true} /> REC
					</span>
				)}
			</div>
			<div className="component-live-feed__body" ref={bodyRef} role="log" aria-live="polite">
				{visible.map((ev) => (
					<div key={ev.id} className="component-live-feed__row">
						<div className="component-live-feed__time">{ev.time}</div>
						<div className="component-live-feed__msg">
							{ev.actor && <b className="component-live-feed__actor">{ev.actor}</b>}
							{' '}
							{ev.message}
							{ev.tags && ev.tags.map((t, i) => (
								<span
									key={i}
									className={[
										'component-live-feed__tag',
										t.variant ? `component-live-feed__tag--${t.variant}` : '',
									].filter(Boolean).join(' ')}
								>
									{t.label}
								</span>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
