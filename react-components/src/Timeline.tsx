import type { CSSProperties, FC, HTMLAttributes, ReactNode } from 'react'
import { Skeleton } from './Skeleton'

export type TimelineVariant = 'default' | 'glass' | 'outlined' | 'elevated' | 'minimal'
export type TimelineConnector = 'gradient' | 'solid' | 'dashed'
export type TimelineStatus = 'completed' | 'active' | 'upcoming'

export interface TimelineItem {
	title: string
	date: string
	description?: string
	side?: 'left' | 'right'
	subtitle?: string
	badge?: string
	meta?: string
	icon?: ReactNode
	actions?: ReactNode
	status?: TimelineStatus
	overlap?: number
	tags?: string[]
	progress?: number
	accentColor?: string
}

export interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
	items: TimelineItem[]
	overlap?: number
	loading?: boolean
	loadingCount?: number
	variant?: TimelineVariant
	connector?: TimelineConnector
}

export const Timeline: FC<TimelineProps> = ({
	items,
	overlap,
	loading = false,
	loadingCount = 3,
	variant = 'default',
	connector = 'gradient',
	className,
	...rest
}) => {
	const rootClasses = [
		'component component-timeline',
		`component-timeline--${variant}`,
		`component-timeline--connector-${connector}`,
		className,
	]
		.filter(Boolean)
		.join(' ')

	if (loading) {
		return (
			<div className={rootClasses} {...rest}>
				<div className="component-timeline__line" aria-hidden="true" />
				<div className="component-timeline__items">
					{Array.from({ length: loadingCount }, (_, i) => (
						<div
							key={i}
							className={`component-timeline__item component-timeline__item--${i % 2 === 0 ? 'left' : 'right'}`}
						>
							<div className="component-timeline__dot" aria-hidden="true" />
							<article className="component-timeline__card card" style={{ padding: '1.25rem' }}>
								<Skeleton width="30%" />
								<Skeleton width="60%" height="1.25em" />
								<Skeleton count={2} />
							</article>
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className={rootClasses} {...rest}>
			<div className="component-timeline__line" aria-hidden="true" />
			<div className="component-timeline__items">
				{items.map((item, index) => {
					const side = item.side ?? (index % 2 === 0 ? 'left' : 'right')
					const status = item.status ?? (index === 0 ? 'active' : 'upcoming')
					const overlapValue = index === 0 ? 0 : (item.overlap ?? overlap ?? 0)
					const itemClasses = [
						'component-timeline__item',
						`component-timeline__item--${side}`,
						`component-timeline__item--${status}`,
					]

					if (overlapValue > 0) {
						itemClasses.push('component-timeline__item--overlap')
					}

					const itemStyle: CSSProperties = {}
					if (overlapValue > 0) {
						(itemStyle as Record<string, string>)['--timeline-item-overlap'] = `${overlapValue}px`
					}
					if (item.accentColor) {
						(itemStyle as Record<string, string>)['--tl-item-accent'] = item.accentColor
					}

					const progress =
						typeof item.progress === 'number'
							? Math.max(0, Math.min(100, item.progress))
							: undefined

					return (
						<div
							key={`${item.title}-${item.date}-${index}`}
							className={itemClasses.join(' ')}
							aria-current={status === 'active' ? 'step' : undefined}
							style={Object.keys(itemStyle).length > 0 ? itemStyle : undefined}
						>
							<div className="component-timeline__dot" aria-hidden="true">
								<span className="component-timeline__dot-pulse" aria-hidden="true" />
								<span className="component-timeline__dot-ring" aria-hidden="true" />
							</div>
							<article className="component-timeline__card card">
								<header className="component-timeline__header">
									<div className="component-timeline__meta">
										<span className="component-timeline__date">{item.date}</span>
										{item.meta ? (
											<span className="component-timeline__meta-text">{item.meta}</span>
										) : null}
									</div>
									{item.badge ? (
										<span className="component-timeline__badge">{item.badge}</span>
									) : null}
								</header>
								<div className="component-timeline__title-group">
									{item.icon ? (
										<span className="component-timeline__icon" aria-hidden="true">
											{item.icon}
										</span>
									) : null}
									<div className="component-timeline__titles">
										<h4 className="component-timeline__title">{item.title}</h4>
										{item.subtitle ? (
											<p className="component-timeline__subtitle">{item.subtitle}</p>
										) : null}
									</div>
								</div>
								{item.description ? (
									<p className="component-timeline__description">{item.description}</p>
								) : null}
								{item.tags && item.tags.length > 0 ? (
									<div className="component-timeline__tags">
										{item.tags.map((tag, i) => (
											<span key={`${tag}-${i}`} className="component-timeline__tag">
												{tag}
											</span>
										))}
									</div>
								) : null}
								{progress !== undefined ? (
									<div
										className="component-timeline__progress"
										role="progressbar"
										aria-valuenow={progress}
										aria-valuemin={0}
										aria-valuemax={100}
									>
										<div
											className="component-timeline__progress-bar"
											style={{ width: `${progress}%` }}
										/>
									</div>
								) : null}
								{item.actions ? (
									<div className="component-timeline__actions">{item.actions}</div>
								) : null}
							</article>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default Timeline
