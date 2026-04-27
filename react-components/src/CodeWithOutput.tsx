import React from 'react'
import { CodeSnippet, type CodeSnippetLanguage } from './CodeSnippet'

export interface CodeWithOutputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	code: string
	language?: CodeSnippetLanguage
	output: React.ReactNode
	error?: React.ReactNode
	layout?: 'split' | 'stacked'
	title?: React.ReactNode
}

export const CodeWithOutput: React.FC<CodeWithOutputProps> = ({
	code,
	language = 'javascript',
	output,
	error,
	layout = 'split',
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-code-with-output component-code-with-output--${layout} ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <div className="component-code-with-output__title">{title}</div> : null}
			<div className="component-code-with-output__panes">
				<div className="component-code-with-output__pane component-code-with-output__pane--code">
					<CodeSnippet code={code} language={language} />
				</div>
				<div className="component-code-with-output__pane component-code-with-output__pane--output">
					<div className="component-code-with-output__pane-header">Output</div>
					<pre className="component-code-with-output__output">
						{error ? (
							<span className="component-code-with-output__error">{error}</span>
						) : (
							output
						)}
					</pre>
				</div>
			</div>
		</div>
	)
}

export default CodeWithOutput
