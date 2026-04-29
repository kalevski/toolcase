import React, { useEffect, useState } from 'react'

export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

export interface CountdownTimerProps extends React.HTMLAttributes<HTMLDivElement> {
	target: Date | number
	units?: CountdownUnit[]
	label?: React.ReactNode
	subLabel?: React.ReactNode
	onExpire?: () => void
	compact?: boolean
}

const UNIT_LABEL: Record<CountdownUnit, string> = {
	days: 'DAYS',
	hours: 'HRS',
	minutes: 'MIN',
	seconds: 'SEC',
}

function pad(n: number) {
	return String(Math.max(0, n)).padStart(2, '0')
}

function compute(target: number) {
	const diff = Math.max(0, target - Date.now())
	const days = Math.floor(diff / 86400000)
	const hours = Math.floor((diff % 86400000) / 3600000)
	const minutes = Math.floor((diff % 3600000) / 60000)
	const seconds = Math.floor((diff % 60000) / 1000)
	return { days, hours, minutes, seconds, expired: diff === 0 }
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
	target,
	units = ['days', 'hours', 'minutes', 'seconds'],
	label,
	subLabel,
	onExpire,
	compact = false,
	className = '',
	...rest
}) => {
	const targetMs = target instanceof Date ? target.getTime() : target
	const [now, setNow] = useState(() => compute(targetMs))

	useEffect(() => {
		setNow(compute(targetMs))
		let interval: ReturnType<typeof setInterval> | null = null
		const start = () => {
			if (interval) return
			interval = setInterval(() => {
				const next = compute(targetMs)
				setNow(next)
				if (next.expired) {
					if (interval) { clearInterval(interval); interval = null }
					onExpire?.()
				}
			}, 1000)
		}
		const stop = () => { if (interval) { clearInterval(interval); interval = null } }
		const onVis = () => { if (document.hidden) stop(); else start() }
		if (!document.hidden) start()
		document.addEventListener('visibilitychange', onVis)
		return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
	}, [targetMs, onExpire])

	const rootClass = [
		'component component-countdown',
		compact ? 'component-countdown--compact' : '',
		className,
	].filter(Boolean).join(' ')

	const valueFor = (u: CountdownUnit) => pad(now[u])

	return (
		<div className={rootClass} role="timer" aria-live="polite" {...rest}>
			{label && <div className="component-countdown__label">{label}</div>}
			<div className="component-countdown__grid">
				{units.map((u, i) => (
					<div
						key={u}
						className={`component-countdown__cell component-countdown__cell--${u}${i === 0 ? ' component-countdown__cell--lead' : ''}`}
					>
						<div className="component-countdown__num">{valueFor(u)}</div>
						<div className="component-countdown__unit">{UNIT_LABEL[u]}</div>
					</div>
				))}
			</div>
			{subLabel && <div className="component-countdown__sub">{subLabel}</div>}
		</div>
	)
}
