import React, { useId } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { VisuallyHidden } from './VisuallyHidden'

export type ComparatorWinner = 'left' | 'right' | 'tie'

export type ComparatorValue = boolean | number | string | React.ReactNode

export interface ComparatorTechnology {
	name: string
	tagline?: string
	icon?: React.ReactNode
	iconName?: string
	accentColor?: string
}

export interface ComparatorFeature {
	id?: string
	name: string
	description?: string
	left: ComparatorValue
	right: ComparatorValue
	winner?: ComparatorWinner
	leftLabel?: React.ReactNode
	rightLabel?: React.ReactNode
	highlight?: boolean
	lowerIsBetter?: boolean
}

export interface ComparatorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	title?: string
	description?: string
	left: ComparatorTechnology
	right: ComparatorTechnology
	features: ComparatorFeature[]
	showSummary?: boolean
	loading?: boolean
	loadingCount?: number
}

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const detectWinner = (
	left: ComparatorValue,
	right: ComparatorValue,
	lowerIsBetter: boolean
): ComparatorWinner | undefined => {
	if (isBoolean(left) && isBoolean(right)) {
		if (left === right) return 'tie'
		return left ? 'left' : 'right'
	}
	if (isFiniteNumber(left) && isFiniteNumber(right)) {
		if (left === right) return 'tie'
		const leftWins = lowerIsBetter ? left < right : left > right
		return leftWins ? 'left' : 'right'
	}
	return undefined
}

const renderValue = (value: ComparatorValue, label?: React.ReactNode): React.ReactNode => {
	if (label !== undefined) return label
	if (isBoolean(value)) {
		return (
			<span
				className={`component-comparator__value-bool component-comparator__value-bool--${value ? 'yes' : 'no'}`}
			>
				<Icon name={value ? 'check-circle-fill' : 'x-circle-fill'} aria-hidden={true} />
			</span>
		)
	}
	return value as React.ReactNode
}

interface TechHeadProps {
	tech: ComparatorTechnology
	side: 'left' | 'right'
	isOverallWinner: boolean
}

const TechHead: React.FC<TechHeadProps> = ({ tech, side, isOverallWinner }) => {
	const classes = [
		'component-comparator__tech',
		`component-comparator__tech--${side}`,
		isOverallWinner ? 'component-comparator__tech--winner' : '',
	]
		.filter(Boolean)
		.join(' ')

	const accentStyle = tech.accentColor
		? ({ '--cmp-tech-accent': tech.accentColor } as React.CSSProperties)
		: undefined

	return (
		<div className={classes} style={accentStyle}>
			{(tech.icon || tech.iconName) && (
				<span className="component-comparator__tech-icon" aria-hidden="true">
					{tech.icon ?? <Icon name={tech.iconName as string} />}
				</span>
			)}
			<h4 className="component-comparator__tech-name">{tech.name}</h4>
			{tech.tagline ? (
				<p className="component-comparator__tech-tagline">{tech.tagline}</p>
			) : null}
		</div>
	)
}

export const Comparator: React.FC<ComparatorProps> = ({
	title,
	description,
	left,
	right,
	features,
	showSummary = false,
	loading = false,
	loadingCount = 4,
	className = '',
	...rest
}) => {
	const headingId = useId()
	const rootClass = `component component-comparator ${className}`.trim()

	if (loading) {
		return (
			<div className={rootClass} {...rest}>
				<div className="component-comparator__header">
					<div className="component-comparator__tech component-comparator__tech--left">
						<Skeleton width="36px" height="36px" />
						<Skeleton width="60%" height="0.95em" />
					</div>
					<div className="component-comparator__vs" aria-hidden="true">VS</div>
					<div className="component-comparator__tech component-comparator__tech--right">
						<Skeleton width="36px" height="36px" />
						<Skeleton width="60%" height="0.95em" />
					</div>
				</div>
				<div className="component-comparator__features">
					{Array.from({ length: loadingCount }, (_, i) => (
						<div key={i} className="component-comparator__row">
							<div className="component-comparator__feature">
								<Skeleton width="50%" height="0.85em" />
							</div>
							<div className="component-comparator__cell component-comparator__cell--left">
								<Skeleton width="60%" />
							</div>
							<div className="component-comparator__cell component-comparator__cell--right">
								<Skeleton width="60%" />
							</div>
						</div>
					))}
				</div>
			</div>
		)
	}

	let leftWins = 0
	let rightWins = 0
	let ties = 0

	const enriched = features.map((feature) => {
		const winner = feature.winner ?? detectWinner(feature.left, feature.right, !!feature.lowerIsBetter)
		if (winner === 'left') leftWins += 1
		else if (winner === 'right') rightWins += 1
		else if (winner === 'tie') ties += 1
		return { ...feature, resolvedWinner: winner }
	})

	const overallWinner: ComparatorWinner | undefined =
		leftWins > rightWins
			? 'left'
			: rightWins > leftWins
				? 'right'
				: leftWins + rightWins > 0
					? 'tie'
					: undefined

	return (
		<div
			className={rootClass}
			aria-labelledby={title ? headingId : undefined}
			{...rest}
		>
			{(title || description) && (
				<header className="component-comparator__intro">
					{title ? (
						<h3 id={headingId} className="component-comparator__title">
							{title}
						</h3>
					) : null}
					{description ? (
						<p className="component-comparator__description">{description}</p>
					) : null}
				</header>
			)}

			<div className="component-comparator__header">
				<TechHead tech={left} side="left" isOverallWinner={overallWinner === 'left'} />
				<div className="component-comparator__vs" aria-hidden="true">
					VS
				</div>
				<TechHead tech={right} side="right" isOverallWinner={overallWinner === 'right'} />
			</div>

			<div className="component-comparator__features" role="list">
				{enriched.map((feature, index) => {
					const rowClasses = [
						'component-comparator__row',
						feature.highlight ? 'component-comparator__row--highlight' : '',
					]
						.filter(Boolean)
						.join(' ')

					return (
						<div
							key={feature.id ?? `${feature.name}-${index}`}
							className={rowClasses}
							role="listitem"
						>
							<div className="component-comparator__feature">
								<p className="component-comparator__feature-name">{feature.name}</p>
								{feature.description ? (
									<p className="component-comparator__feature-desc">{feature.description}</p>
								) : null}
							</div>
							<Cell
								side="left"
								tech={left}
								value={feature.left}
								label={feature.leftLabel}
								winner={feature.resolvedWinner}
							/>
							<Cell
								side="right"
								tech={right}
								value={feature.right}
								label={feature.rightLabel}
								winner={feature.resolvedWinner}
							/>
						</div>
					)
				})}
			</div>

			{showSummary ? (
				<footer className="component-comparator__summary">
					<SummaryCard
						side="left"
						tech={left}
						wins={leftWins}
						isWinner={overallWinner === 'left'}
					/>
					<div className="component-comparator__summary-divider" aria-hidden="true">
						{ties > 0 ? `${ties} tie${ties === 1 ? '' : 's'}` : 'vs'}
					</div>
					<SummaryCard
						side="right"
						tech={right}
						wins={rightWins}
						isWinner={overallWinner === 'right'}
					/>
				</footer>
			) : null}
		</div>
	)
}

interface CellProps {
	side: 'left' | 'right'
	tech: ComparatorTechnology
	value: ComparatorValue
	label?: React.ReactNode
	winner: ComparatorWinner | undefined
}

const Cell: React.FC<CellProps> = ({ side, tech, value, label, winner }) => {
	const isWinner = winner === side
	const isTie = winner === 'tie'
	const classes = [
		'component-comparator__cell',
		`component-comparator__cell--${side}`,
		isWinner ? 'component-comparator__cell--winner' : '',
		isTie ? 'component-comparator__cell--tie' : '',
		!isWinner && !isTie && winner ? 'component-comparator__cell--loser' : '',
	]
		.filter(Boolean)
		.join(' ')

	return (
		<div className={classes}>
			<span className="component-comparator__cell-label">{tech.name}</span>
			<div className="component-comparator__cell-value">{renderValue(value, label)}</div>
			{isWinner ? <VisuallyHidden>Better option</VisuallyHidden> : null}
		</div>
	)
}

interface SummaryCardProps {
	side: 'left' | 'right'
	tech: ComparatorTechnology
	wins: number
	isWinner: boolean
}

const SummaryCard: React.FC<SummaryCardProps> = ({ side, tech, wins, isWinner }) => {
	const classes = [
		'component-comparator__summary-card',
		`component-comparator__summary-card--${side}`,
		isWinner ? 'component-comparator__summary-card--winner' : '',
	]
		.filter(Boolean)
		.join(' ')

	return (
		<div className={classes}>
			<span className="component-comparator__summary-count">{wins}</span>
			<span className="component-comparator__summary-tech">{tech.name}</span>
			{isWinner ? <VisuallyHidden>Leading overall</VisuallyHidden> : null}
		</div>
	)
}

export default Comparator
