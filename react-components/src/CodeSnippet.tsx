import React, { useState, useCallback, useMemo, Fragment } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export type CodeSnippetLanguage = 'javascript' | 'typescript' | 'bash'

export interface CodeSnippetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onCopy'> {
	code: string
	language?: CodeSnippetLanguage
	onCopy?: (code: string) => void
	showCopyButton?: boolean
	title?: string
	loading?: boolean
}

const languageLabels: Record<CodeSnippetLanguage, string> = {
	javascript: 'JavaScript',
	typescript: 'TypeScript',
	bash: 'Bash',
}

type TokenType =
	| 'comment'
	| 'string'
	| 'keyword'
	| 'literal'
	| 'number'
	| 'function'
	| 'variable'
	| 'flag'
	| 'operator'
	| 'punctuation'
	| 'plain'

interface Token {
	type: TokenType
	value: string
}

const JS_KEYWORDS = new Set([
	'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
	'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch',
	'finally', 'throw', 'new', 'class', 'extends', 'super', 'this', 'import',
	'export', 'from', 'as', 'async', 'await', 'yield', 'typeof', 'instanceof',
	'in', 'of', 'void', 'delete', 'static', 'get', 'set',
])

const JS_LITERALS = new Set(['null', 'undefined', 'true', 'false', 'NaN', 'Infinity'])

const TS_KEYWORDS = new Set([
	'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'public',
	'private', 'protected', 'readonly', 'abstract', 'implements', 'is',
	'keyof', 'infer', 'satisfies',
])

const TS_TYPES = new Set([
	'any', 'unknown', 'never', 'string', 'number', 'boolean', 'object',
	'symbol', 'bigint',
])

const BASH_KEYWORDS = new Set([
	'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done',
	'case', 'esac', 'in', 'function', 'return', 'export', 'local', 'readonly',
	'break', 'continue', 'declare', 'exit', 'set', 'unset', 'source', 'alias', 'eval',
])

const BASH_BUILTINS = new Set([
	'echo', 'cd', 'pwd', 'ls', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch',
	'cat', 'grep', 'sed', 'awk', 'find', 'sort', 'uniq', 'head', 'tail',
	'curl', 'wget', 'git', 'npm', 'npx', 'yarn', 'pnpm', 'node', 'python',
	'pip', 'sudo', 'chmod', 'chown', 'tar', 'gzip', 'zip', 'unzip', 'ssh',
	'scp', 'docker', 'kubectl', 'make', 'bash', 'sh', 'env', 'which', 'man',
])

const JS_PATTERN =
	/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?n?\b)|([A-Za-z_$][\w$]*)|([+\-*/%=<>!&|^~?]+)|([{}()[\];,.:])/g

const BASH_PATTERN =
	/(#[^\n]*)|('[^']*'|"(?:\\.|[^"\\])*")|(\$\{[^}]+\}|\$[A-Za-z_]\w*|\$[#@*?$!0-9])|(-{1,2}[A-Za-z][\w-]*)|(\b\d+\b)|([A-Za-z_][\w-]*)|([{}()[\];,&|<>])/g

const tokenizeJsLike = (code: string, isTs: boolean): Token[] => {
	const tokens: Token[] = []
	let last = 0
	let match: RegExpExecArray | null
	JS_PATTERN.lastIndex = 0
	while ((match = JS_PATTERN.exec(code))) {
		if (match.index > last) {
			tokens.push({ type: 'plain', value: code.slice(last, match.index) })
		}
		const [full, comment, str, num, ident, op, punct] = match
		if (comment !== undefined) {
			tokens.push({ type: 'comment', value: comment })
		} else if (str !== undefined) {
			tokens.push({ type: 'string', value: str })
		} else if (num !== undefined) {
			tokens.push({ type: 'number', value: num })
		} else if (ident !== undefined) {
			if (JS_KEYWORDS.has(ident) || (isTs && TS_KEYWORDS.has(ident))) {
				tokens.push({ type: 'keyword', value: ident })
			} else if (JS_LITERALS.has(ident) || (isTs && TS_TYPES.has(ident))) {
				tokens.push({ type: 'literal', value: ident })
			} else if (code.charAt(match.index + ident.length) === '(') {
				tokens.push({ type: 'function', value: ident })
			} else {
				tokens.push({ type: 'plain', value: ident })
			}
		} else if (op !== undefined) {
			tokens.push({ type: 'operator', value: op })
		} else if (punct !== undefined) {
			tokens.push({ type: 'punctuation', value: punct })
		}
		last = match.index + full.length
	}
	if (last < code.length) {
		tokens.push({ type: 'plain', value: code.slice(last) })
	}
	return tokens
}

const tokenizeBash = (code: string): Token[] => {
	const tokens: Token[] = []
	let last = 0
	let match: RegExpExecArray | null
	BASH_PATTERN.lastIndex = 0
	while ((match = BASH_PATTERN.exec(code))) {
		if (match.index > last) {
			tokens.push({ type: 'plain', value: code.slice(last, match.index) })
		}
		const [full, comment, str, variable, flag, num, ident, punct] = match
		if (comment !== undefined) {
			tokens.push({ type: 'comment', value: comment })
		} else if (str !== undefined) {
			tokens.push({ type: 'string', value: str })
		} else if (variable !== undefined) {
			tokens.push({ type: 'variable', value: variable })
		} else if (flag !== undefined) {
			tokens.push({ type: 'flag', value: flag })
		} else if (num !== undefined) {
			tokens.push({ type: 'number', value: num })
		} else if (ident !== undefined) {
			if (BASH_KEYWORDS.has(ident)) {
				tokens.push({ type: 'keyword', value: ident })
			} else if (BASH_BUILTINS.has(ident)) {
				tokens.push({ type: 'function', value: ident })
			} else {
				tokens.push({ type: 'plain', value: ident })
			}
		} else if (punct !== undefined) {
			tokens.push({ type: 'punctuation', value: punct })
		}
		last = match.index + full.length
	}
	if (last < code.length) {
		tokens.push({ type: 'plain', value: code.slice(last) })
	}
	return tokens
}

const tokenize = (code: string, language: CodeSnippetLanguage): Token[] => {
	if (language === 'bash') return tokenizeBash(code)
	return tokenizeJsLike(code, language === 'typescript')
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
	code,
	language = 'javascript',
	onCopy,
	showCopyButton = true,
	title,
	loading = false,
	className = '',
	...rest
}) => {
	const [copied, setCopied] = useState(false)
	const copyTimerRef = React.useRef<number | undefined>(undefined)

	// Clear any pending copied-state timer on unmount.
	React.useEffect(() => () => window.clearTimeout(copyTimerRef.current), [])

	const handleCopy = useCallback(() => {
		onCopy?.(code)
		setCopied(true)
		window.clearTimeout(copyTimerRef.current)
		copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
	}, [code, onCopy])

	const tokens = useMemo(() => (loading ? [] : tokenize(code, language)), [code, language, loading])

	const rootClass = `component component-code-snippet component-code-snippet--${language} ${className}`.trim()

	if (loading) {
		return (
			<div className={rootClass} {...rest}>
				<div className="component-code-snippet__header">
					<Skeleton width="30%" />
				</div>
				<div className="component-code-snippet__body">
					<Skeleton count={4} />
				</div>
			</div>
		)
	}

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
						<Icon name={copied ? 'check-lg' : 'clipboard'} />
						<span className="component-code-snippet__copy-label">
							{copied ? 'Copied!' : 'Copy'}
						</span>
					</button>
				)}
			</div>
			<pre className="component-code-snippet__pre">
				<code className="component-code-snippet__code">
					{tokens.map((token, i) =>
						token.type === 'plain' ? (
							<Fragment key={i}>{token.value}</Fragment>
						) : (
							<span
								key={i}
								className={`component-code-snippet__token component-code-snippet__token--${token.type}`}
							>
								{token.value}
							</span>
						)
					)}
				</code>
			</pre>
		</div>
	)
}
