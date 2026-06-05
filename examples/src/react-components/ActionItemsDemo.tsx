import React, { useState } from 'react'
import {
	ActionItems,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ActionItemsDemo: React.FC = () => {
	const [log, setLog] = useState<string[]>([])

	const handleClick = (key: string) => {
		setLog((prev) => [`Clicked: ${key}`, ...prev.slice(0, 9)])
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="ActionItems"
				description="A kebab menu (three-dot) dropdown for contextual actions on rows or cards."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With Icons">
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
			</SectionCard>

			<SectionCard title="Without Icons">
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
			</SectionCard>

			<SectionCard title="In a List Context">
				<ul className="list-unstyled m-0">
					{['player.png', 'enemy.png', 'tilemap.json'].map((name) => (
						<li key={name} className="d-flex align-items-center justify-content-between py-2 border-bottom">
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
			</SectionCard>

			<SectionCard title="Event Log">
				<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', minHeight: 150 }}>
					{log.length ? log.join('\n') : '(click any action)'}
				</pre>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ActionItemsDemo
