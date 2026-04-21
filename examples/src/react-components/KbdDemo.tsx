import React from 'react'
import { Kbd, Card, CodeSnippet } from '@toolcase/react-components'

const KbdDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Kbd</h1>
				<p className="text-muted mb-5">
					Displays keyboard shortcuts with styled key caps. Supports single keys and multi-key combos.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Single Key</h2>
					<div className="d-flex gap-3 align-items-center flex-wrap">
						<Kbd>Enter</Kbd>
						<Kbd>Esc</Kbd>
						<Kbd>Tab</Kbd>
						<Kbd>Space</Kbd>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Key Combinations</h2>
					<div className="d-flex flex-column gap-3">
						<div className="d-flex align-items-center gap-2">
							<Kbd keys={['Ctrl', 'C']} /> <span className="text-muted">— Copy</span>
						</div>
						<div className="d-flex align-items-center gap-2">
							<Kbd keys={['Ctrl', 'V']} /> <span className="text-muted">— Paste</span>
						</div>
						<div className="d-flex align-items-center gap-2">
							<Kbd keys={['Ctrl', 'Shift', 'P']} /> <span className="text-muted">— Command Palette</span>
						</div>
						<div className="d-flex align-items-center gap-2">
							<Kbd keys={['⌘', 'K']} /> <span className="text-muted">— Quick Open (macOS)</span>
						</div>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Inline Usage</h2>
					<p>
						Press <Kbd keys={['Ctrl', 'S']} /> to save. Use <Kbd>F2</Kbd> to rename.
						Hold <Kbd keys={['Shift', 'Alt']} /> and click to multi-select.
					</p>
				</Card>
			</div>
		</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { Kbd } from '@toolcase/react-components'

Press <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> to save.`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default KbdDemo
