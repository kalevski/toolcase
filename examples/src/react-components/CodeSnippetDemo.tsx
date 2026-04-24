import React from 'react'
import { CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
	<DemoPage
		eyebrow="Data Display"
		title="CodeSnippet"
		lede="A code display block with language label and copy button. Supports JavaScript, TypeScript, and Bash."
	>
		<DemoSection title="JavaScript">
			<CodeSnippet
				code={jsCode}
				language="javascript"
				onCopy={(code) => alert(`Copied JavaScript:\n${code.slice(0, 40)}…`)}
			/>
		</DemoSection>

		<DemoSection title="TypeScript">
			<CodeSnippet
				code={tsCode}
				language="typescript"
				onCopy={(code) => alert(`Copied TypeScript:\n${code.slice(0, 40)}…`)}
			/>
		</DemoSection>

		<DemoSection title="Bash">
			<CodeSnippet
				code={bashCode}
				language="bash"
				onCopy={(code) => alert(`Copied Bash:\n${code.slice(0, 40)}…`)}
			/>
		</DemoSection>

		<DemoSection title="Custom Title">
			<CodeSnippet
				code={`npm install react react-dom`}
				language="bash"
				title="Install"
				onCopy={(code) => alert(`Copied: ${code}`)}
			/>
		</DemoSection>

		<DemoSection title="No Copy Button">
			<CodeSnippet
				code={`const x = 42`}
				language="javascript"
				showCopyButton={false}
			/>
		</DemoSection>
	</DemoPage>
)

export default CodeSnippetDemo
