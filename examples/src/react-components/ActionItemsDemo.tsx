import React, { useState } from 'react'
import { ActionItems, Card, CodeSnippet } from '@toolcase/react-components'

const ActionItemsDemo: React.FC = () => {
	const [log, setLog] = useState<string[]>([])

	const handleClick = (key: string) => {
		setLog((prev) => [`Clicked: ${key}`, ...prev.slice(0, 9)])
	}

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ActionItems</h1>
					<p className="text-muted mb-0">A kebab menu (three-dot) dropdown for contextual actions on rows or cards.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Icons</h2>
						<p className="text-muted mb-3">Typical file or row action menu.</p>
						<div className="d-flex align-items-center gap-3">
							<span className="text-muted">document.pdf</span>
							<ActionItems
								items={[
									{ key: 'edit', icon: 'pencil', label: 'Edit' },
									{ key: 'duplicate', icon: 'clipboard', label: 'Duplicate' },
									{ key: 'download', icon: 'download', label: 'Download' },
									{ key: 'delete', icon: 'trash', label: 'Delete' },
								]}
								onActionClick={handleClick}
							/>
						</div>
					</Card>
				</div>

				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Without Icons</h2>
						<p className="text-muted mb-3">Text-only menu items.</p>
						<div className="d-flex align-items-center gap-3">
							<span className="text-muted">settings.json</span>
							<ActionItems
								items={[
									{ key: 'rename', label: 'Rename' },
									{ key: 'move', label: 'Move to folder' },
									{ key: 'archive', label: 'Archive' },
								]}
								onActionClick={handleClick}
							/>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">In a List Context</h2>
						<ul className="list-group list-group-flush">
							{['player.png', 'enemy.png', 'tilemap.json'].map((name) => (
								<li key={name} className="list-group-item d-flex align-items-center justify-content-between">
									<span>{name}</span>
									<ActionItems
										items={[
											{ key: 'preview', icon: 'eye', label: 'Preview' },
											{ key: 'download', icon: 'download', label: 'Download' },
											{ key: 'delete', icon: 'trash', label: 'Delete' },
										]}
										onActionClick={(key) => handleClick(`${key} → ${name}`)}
									/>
								</li>
							))}
						</ul>
					</Card>
				</div>

				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Event Log</h2>
						<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', minHeight: 150 }}>
							{log.length ? log.join('\n') : '(click any action)'}
						</pre>
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
						code={`import { ActionItems } from '@toolcase/react-components'

<ActionItems
  items={[
    { key: 'edit', icon: 'pencil', label: 'Edit' },
    { key: 'delete', icon: 'trash', label: 'Delete' },
  ]}
  onActionClick={(key) => console.log(key)}
/>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default ActionItemsDemo
