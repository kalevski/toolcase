import React from 'react'
import {
	CodeSnippet,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="CodeSnippet"
				description="A code display block with language label and copy button. Supports JavaScript, TypeScript, and Bash."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="JavaScript">
			<CodeSnippet
				code={jsCode}
				language="javascript"
				onCopy={(code) => alert(`Copied JavaScript:\n${code.slice(0, 40)}…`)}
			/>
		</SectionCard>

		<SectionCard title="TypeScript">
			<CodeSnippet
				code={tsCode}
				language="typescript"
				onCopy={(code) => alert(`Copied TypeScript:\n${code.slice(0, 40)}…`)}
			/>
		</SectionCard>

		<SectionCard title="Bash">
			<CodeSnippet
				code={bashCode}
				language="bash"
				onCopy={(code) => alert(`Copied Bash:\n${code.slice(0, 40)}…`)}
			/>
		</SectionCard>

		<SectionCard title="Custom Title">
			<CodeSnippet
				code={`npm install react react-dom`}
				language="bash"
				title="Install"
				onCopy={(code) => alert(`Copied: ${code}`)}
			/>
		</SectionCard>

		<SectionCard title="No Copy Button">
			<CodeSnippet
				code={`const x = 42`}
				language="javascript"
				showCopyButton={false}
			/>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default CodeSnippetDemo
