import type { FC, HTMLAttributes } from 'react'

export type UsageConfig = {
	label: string
	used: number
	total: number
	measurementUnit: string
	warn?: boolean
}

export interface UsageSummaryPanelProps extends HTMLAttributes<HTMLDivElement> {
	usage: Array<UsageConfig>
	title?: string
}

const clampPercentage = (value: number) => {
	if (Number.isNaN(value) || !Number.isFinite(value)) {
		return 0
	}

	return Math.max(0, Math.min(100, Math.round(value)))
}

const numberFormatter = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 1,
})

const formatNumber = (value: number) => numberFormatter.format(value)

export const UsageSummaryPanel: FC<UsageSummaryPanelProps> = ({
	title = null,
	usage = [],
	className,
	...rest
}) => {
	const rootClass = ['component component-usage-summary-panel', className].filter(Boolean).join(' ')

	return (
		<aside className={rootClass} {...rest}>
			{title && (
				<header className="component-usage-summary-panel__header">
					<h3>{title}</h3>
				</header>
			)}

			{usage.map(({ label, used, total, measurementUnit, warn = false }, index) => {
				
				const percentage = clampPercentage(total > 0 ? (used / total) * 100 : 0)
				const key = `${label}-${index}`

				return (
					<section className="component-usage-summary-panel__section" key={key}>
						<div className="component-usage-summary-panel__label">
							<span>{label}</span>
							<span>
								{formatNumber(used)} {measurementUnit} / {formatNumber(total)} {measurementUnit}
							</span>
						</div>
						<div
							className="component-usage-summary-panel__progress"
							role="meter"
							aria-valuenow={percentage}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={`${label} usage`}
						>
							<div
								className={`component-usage-summary-panel__progress-bar${warn ? ' component-usage-summary-panel__progress-bar--warning' : ''}`}
								style={{ width: `${percentage}%` }}
							/>
						</div>
					</section>
				)
			})}
		</aside>
	)
}
