import React from 'react'
import { CodeSnippet, Card } from '@toolcase/react-components'

const jsCode = `function greet(name) {
  console.log(\`Hello, \${name}!\`)
  return { greeting: \`Hello, \${name}!\` }
}

const result = greet('World')
console.log(result)`

const tsCode = `interface GameConfig {
  title: string
  width: number
  height: number
  fps?: number
}

const createGame = (config: GameConfig): void => {
  const { title, width, height, fps = 60 } = config
  console.log(\`Starting \${title} at \${width}x\${height} @\${fps}fps\`)
}

createGame({ title: 'Space Invaders', width: 800, height: 600 })`

const bashCode = `#!/bin/bash
npm install @toolcase/react-components
cd my-project
npm run build
echo "Build complete!"`

const CodeSnippetDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">CodeSnippet</h1>
				<p className="text-muted mb-0">A code display block with language label and copy button. Supports JavaScript, TypeScript, and Bash.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">JavaScript</h2>
					<CodeSnippet
						code={jsCode}
						language="javascript"
						onCopy={(code) => alert(`Copied JavaScript:\n${code.slice(0, 40)}…`)}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">TypeScript</h2>
					<CodeSnippet
						code={tsCode}
						language="typescript"
						onCopy={(code) => alert(`Copied TypeScript:\n${code.slice(0, 40)}…`)}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Bash</h2>
					<CodeSnippet
						code={bashCode}
						language="bash"
						onCopy={(code) => alert(`Copied Bash:\n${code.slice(0, 40)}…`)}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Custom Title</h2>
					<CodeSnippet
						code={`npm install react react-dom`}
						language="bash"
						title="Install"
						onCopy={(code) => alert(`Copied: ${code}`)}
					/>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">No Copy Button</h2>
					<CodeSnippet
						code={`const x = 42`}
						language="javascript"
						showCopyButton={false}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default CodeSnippetDemo
