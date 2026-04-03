import React, { useState, useCallback } from 'react'

export type CodeSnippetLanguage = 'javascript' | 'typescript' | 'bash'

export interface CodeSnippetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onCopy'> {
	code: string
	language?: CodeSnippetLanguage
	onCopy?: (code: string) => void
	showCopyButton?: boolean
	title?: string
}

const languageLabels: Record<CodeSnippetLanguage, string> = {
	javascript: 'JavaScript',
	typescript: 'TypeScript',
	bash: 'Bash',
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
	code,
	language = 'javascript',
	onCopy,
	showCopyButton = true,
	title,
	className = '',
	...rest
}) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(() => {
		onCopy?.(code)
		setCopied(true)
		const id = window.setTimeout(() => setCopied(false), 2000)
		return () => window.clearTimeout(id)
	}, [code, onCopy])

	const rootClass = `component component-code-snippet component-code-snippet--${language} ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			<div className="component-code-snippet__header">
				<span className="component-code-snippet__language">
					{title || languageLabels[language]}
				</span>
				{showCopyButton && (
					<button
						type="button"
						className="component-code-snippet__copy"
						onClick={handleCopy}
						aria-label="Copy code"
					>
						<i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} />
						<span className="component-code-snippet__copy-label">
							{copied ? 'Copied!' : 'Copy'}
						</span>
					</button>
				)}
			</div>
			<pre className="component-code-snippet__pre">
				<code className="component-code-snippet__code">{code}</code>
			</pre>
		</div>
	)
}
