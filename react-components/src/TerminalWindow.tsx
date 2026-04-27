import React, { useEffect, useState } from 'react'

export type TerminalLineKind = 'input' | 'output' | 'comment' | 'error'

export interface TerminalLine {
	kind: TerminalLineKind
	text: string
	delay?: number
}

export interface TerminalWindowProps extends React.HTMLAttributes<HTMLDivElement> {
	title?: string
	prompt?: string
	lines: TerminalLine[]
	animateTyping?: boolean
	speed?: number
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
	title = 'Terminal',
	prompt = '$',
	lines,
	animateTyping = false,
	speed = 30,
	className = '',
	...rest
}) => {
	const [revealed, setRevealed] = useState(animateTyping ? 0 : lines.length)

	useEffect(() => {
		if (!animateTyping) {
			setRevealed(lines.length)
			return
		}
		setRevealed(0)
		let cancelled = false
		let i = 0
		const tick = () => {
			if (cancelled) return
			i += 1
			setRevealed(i)
			if (i < lines.length) {
				const line = lines[i]
				const delay = line.delay ?? Math.max(line.text.length * speed, 200)
				setTimeout(tick, delay)
			}
		}
		const start = setTimeout(tick, 200)
		return () => {
			cancelled = true
			clearTimeout(start)
		}
	}, [animateTyping, lines, speed])

	const rootClass = `component component-terminal-window ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			<div className="component-terminal-window__chrome">
				<span className="component-terminal-window__dot component-terminal-window__dot--red" aria-hidden="true" />
				<span className="component-terminal-window__dot component-terminal-window__dot--yellow" aria-hidden="true" />
				<span className="component-terminal-window__dot component-terminal-window__dot--green" aria-hidden="true" />
				<span className="component-terminal-window__title">{title}</span>
			</div>
			<div className="component-terminal-window__body" role="log" aria-live="polite">
				{lines.slice(0, revealed).map((line, i) => (
					<div
						key={i}
						className={`component-terminal-window__line component-terminal-window__line--${line.kind}`}
					>
						{line.kind === 'input' && (
							<span className="component-terminal-window__prompt">{prompt}</span>
						)}
						<span className="component-terminal-window__text">{line.text}</span>
					</div>
				))}
				{animateTyping && revealed < lines.length && (
					<span className="component-terminal-window__cursor" aria-hidden="true" />
				)}
			</div>
		</div>
	)
}

export default TerminalWindow
