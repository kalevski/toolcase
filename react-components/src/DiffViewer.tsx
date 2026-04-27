import React, { useMemo } from 'react'

export type DiffViewerMode = 'split' | 'unified'

export interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
	before: string
	after: string
	language?: string
	mode?: DiffViewerMode
	filename?: string
}

type DiffOp = { op: 'equal' | 'add' | 'remove'; value: string }

const computeDiff = (a: string[], b: string[]): DiffOp[] => {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1
			else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
		}
	}
	const ops: DiffOp[] = []
	let i = 0
	let j = 0
	while (i < m && j < n) {
		if (a[i] === b[j]) {
			ops.push({ op: 'equal', value: a[i] })
			i++
			j++
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			ops.push({ op: 'remove', value: a[i] })
			i++
		} else {
			ops.push({ op: 'add', value: b[j] })
			j++
		}
	}
	while (i < m) ops.push({ op: 'remove', value: a[i++] })
	while (j < n) ops.push({ op: 'add', value: b[j++] })
	return ops
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
	before,
	after,
	language,
	mode = 'split',
	filename,
	className = '',
	...rest
}) => {
	const ops = useMemo(() => computeDiff(before.split('\n'), after.split('\n')), [before, after])

	const rootClass = `component component-diff-viewer component-diff-viewer--${mode} ${className}`.trim()

	const renderSplit = () => {
		const leftLines: { value: string; type: 'equal' | 'remove' | 'empty' }[] = []
		const rightLines: { value: string; type: 'equal' | 'add' | 'empty' }[] = []
		ops.forEach((op) => {
			if (op.op === 'equal') {
				leftLines.push({ value: op.value, type: 'equal' })
				rightLines.push({ value: op.value, type: 'equal' })
			} else if (op.op === 'remove') {
				leftLines.push({ value: op.value, type: 'remove' })
				rightLines.push({ value: '', type: 'empty' })
			} else {
				leftLines.push({ value: '', type: 'empty' })
				rightLines.push({ value: op.value, type: 'add' })
			}
		})
		return (
			<div className="component-diff-viewer__split">
				<pre className="component-diff-viewer__pane">
					{leftLines.map((l, i) => (
						<div key={i} className={`component-diff-viewer__line component-diff-viewer__line--${l.type}`}>
							<span className="component-diff-viewer__sigil">
								{l.type === 'remove' ? '-' : ' '}
							</span>
							<span className="component-diff-viewer__text">{l.value || ' '}</span>
						</div>
					))}
				</pre>
				<pre className="component-diff-viewer__pane">
					{rightLines.map((l, i) => (
						<div key={i} className={`component-diff-viewer__line component-diff-viewer__line--${l.type}`}>
							<span className="component-diff-viewer__sigil">
								{l.type === 'add' ? '+' : ' '}
							</span>
							<span className="component-diff-viewer__text">{l.value || ' '}</span>
						</div>
					))}
				</pre>
			</div>
		)
	}

	const renderUnified = () => (
		<pre className="component-diff-viewer__unified">
			{ops.map((op, i) => (
				<div
					key={i}
					className={`component-diff-viewer__line component-diff-viewer__line--${op.op === 'equal' ? 'equal' : op.op === 'add' ? 'add' : 'remove'}`}
				>
					<span className="component-diff-viewer__sigil">
						{op.op === 'add' ? '+' : op.op === 'remove' ? '-' : ' '}
					</span>
					<span className="component-diff-viewer__text">{op.value || ' '}</span>
				</div>
			))}
		</pre>
	)

	return (
		<div className={rootClass} {...rest}>
			{(filename || language) && (
				<div className="component-diff-viewer__header">
					{filename ? <span className="component-diff-viewer__filename">{filename}</span> : null}
					{language ? <span className="component-diff-viewer__language">{language}</span> : null}
				</div>
			)}
			{mode === 'split' ? renderSplit() : renderUnified()}
		</div>
	)
}

export default DiffViewer
